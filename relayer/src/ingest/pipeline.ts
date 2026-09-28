// Wires POST /api/device/events end to end: schema/MAC/chain-verify (see
// verify.ts) -> append data/<box_id>.jsonl -> SSE -> rules. Also rebuilds
// every known box's trusted state from disk at startup (§10).
import type { BoxLogStore } from "./store.js";
import type { BoxIngestState } from "./types.js";
import { verifyBatch } from "./verify.js";
import type { SseHub } from "../sse.js";
import type { BoxTracker } from "../boxTracker.js";
import type { RulesEngine } from "../rules.js";
import type { CommandQueue } from "../commandQueue.js";
import type { BoxSecrets } from "../config.js";

export interface DeviceEventsResult {
  status: 200 | 400 | 401 | 409;
  body: unknown;
}

export class IngestPipeline {
  private states = new Map<string, BoxIngestState>();

  constructor(
    private readonly store: BoxLogStore,
    private readonly boxSecrets: BoxSecrets,
    private readonly sse: SseHub,
    private readonly tracker: BoxTracker,
    private readonly rules: RulesEngine,
    private readonly commands: CommandQueue,
  ) {}

  /** Rebuild in-memory state for every box that already has a jsonl file,
   * not just ones a request happens to touch first. */
  rebuildAll(): void {
    for (const boxId of this.store.listBoxIds()) {
      this.states.set(boxId, this.store.rebuild(boxId));
    }
  }

  async handleBatch(rawBatch: unknown): Promise<DeviceEventsResult> {
    const boxId = (rawBatch as { box_id?: unknown } | null)?.box_id;
    if (typeof boxId !== "string" || boxId.length === 0) {
      return { status: 400, body: { ok: false, error: "schema: box_id must be a non-empty string" } };
    }
    const secretHex = this.boxSecrets[boxId];
    if (!secretHex) {
      return { status: 401, body: { ok: false, error: `unknown box_id: ${boxId}` } };
    }

    let state = this.states.get(boxId);
    if (!state) {
      state = this.store.rebuild(boxId);
      this.states.set(boxId, state);
    }

    const outcome = verifyBatch(state, rawBatch, {
      secretHex,
      headAt: (seq) => {
        // Last occurrence wins -- seq numbers repeat across re-provisioning
        // epochs (§10), and we want the CURRENT epoch's recorded head.
        const all = this.store.readAll(boxId);
        for (let i = all.length - 1; i >= 0; i--) {
          if (all[i]!.seq === seq) return all[i]!.head;
        }
        return undefined;
      },
    });
    if (!outcome.ok) {
      return { status: outcome.status, body: outcome.body };
    }

    this.store.append(boxId, outcome.accepted);
    this.states.set(boxId, outcome.newState);

    for (const event of outcome.accepted) {
      this.tracker.recordEvent(boxId, event);
      this.sse.emit("telemetry", event);
    }

    if (outcome.reprovisioned) this.rules.raiseReprovisioned(boxId);
    if (outcome.gap) {
      const last = outcome.accepted[outcome.accepted.length - 1];
      await this.rules.raiseLogGap(boxId, last?.order_id ?? 0, last?.head ?? outcome.newState.lastHead);
    }

    // Sequential on purpose: rules must see events in the order they were
    // accepted (e.g. a SEALED then TAMPER within one batch must be applied
    // in that order, not raced).
    for (const event of outcome.accepted) {
      await this.rules.handleEvent(boxId, event);
    }

    const pending = this.commands.getForBox(boxId);
    return {
      status: 200,
      body: {
        ok: true,
        ack_seq: outcome.ackSeq,
        command: pending ? { id: pending.cmdId, type: pending.type, order_id: pending.orderId } : null,
      },
    };
  }
}
