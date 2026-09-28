// A box that speaks the exact wire protocol from src/protocol.ts -- this is
// what lets Track C finish without hardware (CLAUDE.md). It never
// reimplements the hash chain or MAC; it imports and uses the real module,
// the same one firmware's boot self-test reproduces byte-for-byte.
//
// Deliberately copies the real firmware's documented quirks (per the M3
// build brief) so the scenarios exercise the relayer the same way real
// hardware will:
//   - re-emits TAMPER on every "boot" that comes up TAMPERED against a real
//     order (simulated here as a second TAMPER event, since a real reboot
//     wouldn't reset seq/head -- only re-provisioning does that);
//   - re-acks an idempotent UNLOCK;
//   - seq stays continuous across a simulated power cycle (never resets to
//     1 -- that's reserved for a genuine re-provision scenario);
//   - sends SEAL_FAILED when told to.
import { buildCanon, computeHead, computeMac, GENESIS_HEAD, type CanonicalEventFields, type DeviceEventType, type BoxState } from "../src/protocol.js";

export interface SimBoxOptions {
  boxId: string;
  secretHex: string;
  relayerUrl: string;
}

export interface DeviceCommand {
  id: string;
  type: "SEAL" | "UNLOCK" | "RESET";
  order_id: number;
}

type PostResult = { ok: true; ack_seq: number; command: DeviceCommand | null } | { ok: false; status: number; body: unknown };

/** Low-level client: owns the box's own seq/head chain state and knows how
 * to build + POST one batch. Scenario drivers below compose this. */
export class SimBoxClient {
  private seq = 0;
  private head = GENESIS_HEAD;
  public state: BoxState = "BOOT";
  public orderId = 0;

  constructor(private readonly opts: SimBoxOptions) {}

  /** The box's own last-sent seq -- used by the offline-gap scenario to
   * compute a deliberate jump (e.g. currentSeq() + 6) without exposing the
   * full internal chain state. */
  currentSeq(): number {
    return this.seq;
  }

  /** Builds one event's canon/head from the box's own running chain and
   * POSTs a single-event batch, exactly as ARCHITECTURE.md §9.1/§9.2
   * describe. `seqOverride` lets a scenario simulate a ring-buffer gap by
   * skipping ahead without sending the skipped seq numbers. */
  async send(
    partial: Omit<CanonicalEventFields, "box_id" | "seq" | "head"> & { seq?: number },
    seqOverride?: number,
  ): Promise<PostResult> {
    const seq = seqOverride ?? this.seq + 1;
    const fields: CanonicalEventFields = { box_id: this.opts.boxId, ...partial, seq };
    const canon = buildCanon(fields);
    const head = computeHead(this.head, canon);
    const mac = computeMac(this.opts.secretHex, this.opts.boxId, seq, head);
    const { box_id: _b, ...wireFields } = fields;
    const batch = { box_id: this.opts.boxId, events: [{ ...wireFields, head }], mac };

    const res = await fetch(`${this.opts.relayerUrl}/api/device/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batch),
    });
    const body = (await res.json()) as { ok: boolean; ack_seq?: number; command?: DeviceCommand | null };
    if (res.status === 200 && body.ok) {
      this.seq = seq;
      this.head = head;
      return { ok: true, ack_seq: body.ack_seq!, command: body.command ?? null };
    }
    return { ok: false, status: res.status, body };
  }

  async boot(): Promise<PostResult> {
    this.state = "IDLE";
    return this.send({
      ts: 0,
      type: "BOOT",
      state: this.state,
      order_id: 0,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 0,
      lid: 1,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "U",
      batt_mv: 11800,
      code: 0,
      cmd_id: "",
    });
  }

  async telemetry(): Promise<PostResult> {
    return this.send({
      ts: Math.floor(Date.now() / 1000),
      type: "TELEMETRY" as DeviceEventType,
      state: this.state,
      order_id: this.orderId,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0, // sim-box never claims a real fix -- Invariant 4 / GPS badge.
      dist_mm: 84,
      lid: this.state === "SEALED" ? 1 : 0,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: this.state === "SEALED" || this.state === "TAMPERED" ? "L" : "U",
      batt_mv: 11700,
      code: 0,
      cmd_id: "",
    });
  }

  async ackSealed(cmdId: string, orderId: number): Promise<PostResult> {
    this.state = "SEALED";
    this.orderId = orderId;
    return this.send({
      ts: Math.floor(Date.now() / 1000),
      type: "SEALED",
      state: this.state,
      order_id: orderId,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 84,
      lid: 1,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "L",
      batt_mv: 11700,
      code: 0,
      cmd_id: cmdId,
    });
  }

  async ackSealFailed(cmdId: string): Promise<PostResult> {
    this.state = "IDLE";
    return this.send({
      ts: Math.floor(Date.now() / 1000),
      type: "SEAL_FAILED",
      state: this.state,
      order_id: 0,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 0,
      lid: 1,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "U",
      batt_mv: 11700,
      code: 0,
      cmd_id: cmdId,
    });
  }

  /** code 1 LID_OPENED, 2 CONTENTS_DISTURBED, 3 POWER_INTERRUPTED, per §6. */
  async tamper(code: number, seqOverride?: number): Promise<PostResult> {
    this.state = "TAMPERED";
    return this.send(
      {
        ts: Math.floor(Date.now() / 1000),
        type: "TAMPER",
        state: this.state,
        order_id: this.orderId,
        lat_e6: 0,
        lon_e6: 0,
        fix: 0,
        dist_mm: code === 2 ? 40 : 84,
        lid: code === 1 ? 0 : 1,
        accel_mg: 1000,
        tilt_deg: 0,
        lock: "L",
        batt_mv: 11700,
        code,
        cmd_id: "",
      },
      seqOverride,
    );
  }

  async ackUnlocked(cmdId: string): Promise<PostResult> {
    this.state = "OPEN_AUTHORIZED";
    return this.send({
      ts: Math.floor(Date.now() / 1000),
      type: "UNLOCKED",
      state: this.state,
      order_id: this.orderId,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 84,
      lid: 0,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "U",
      batt_mv: 11700,
      code: 0,
      cmd_id: cmdId,
    });
  }

  async ackResetDone(cmdId: string): Promise<PostResult> {
    this.state = "IDLE";
    this.orderId = 0;
    return this.send({
      ts: Math.floor(Date.now() / 1000),
      type: "RESET_DONE",
      state: this.state,
      order_id: 0,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 0,
      lid: 1,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "U",
      batt_mv: 11700,
      code: 0,
      cmd_id: cmdId,
    });
  }
}

export interface ScenarioHooks {
  onSealed?: (orderId: number) => void | Promise<void>;
  onTampered?: (orderId: number, code: number) => void | Promise<void>;
  onUnlocked?: (orderId: number) => void | Promise<void>;
}

const POLL_MS = 250;

async function waitForCommand(
  client: SimBoxClient,
  type: "SEAL" | "UNLOCK" | "RESET",
  maxWaitMs: number,
): Promise<DeviceCommand> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = await client.telemetry();
    if (res.ok && res.command && res.command.type === type) return res.command;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`sim-box: timed out waiting for a ${type} command`);
}

export async function runHappyScenario(client: SimBoxClient, hooks: ScenarioHooks = {}, maxWaitMs = 30_000): Promise<void> {
  const bootRes = await client.boot();
  if (!bootRes.ok) throw new Error(`sim-box boot failed: ${JSON.stringify(bootRes.body)}`);

  const sealCmd = await waitForCommand(client, "SEAL", maxWaitMs);
  const sealedRes = await client.ackSealed(sealCmd.id, sealCmd.order_id);
  if (!sealedRes.ok) throw new Error(`sim-box SEALED ack failed: ${JSON.stringify(sealedRes.body)}`);
  await hooks.onSealed?.(sealCmd.order_id);

  const unlockCmd = await waitForCommand(client, "UNLOCK", maxWaitMs);
  const unlockedRes = await client.ackUnlocked(unlockCmd.id);
  if (!unlockedRes.ok) throw new Error(`sim-box UNLOCKED ack failed: ${JSON.stringify(unlockedRes.body)}`);
  await hooks.onUnlocked?.(client.orderId);
}

export async function runTamperScenario(client: SimBoxClient, hooks: ScenarioHooks = {}, maxWaitMs = 30_000): Promise<void> {
  const bootRes = await client.boot();
  if (!bootRes.ok) throw new Error(`sim-box boot failed: ${JSON.stringify(bootRes.body)}`);

  const sealCmd = await waitForCommand(client, "SEAL", maxWaitMs);
  const sealedRes = await client.ackSealed(sealCmd.id, sealCmd.order_id);
  if (!sealedRes.ok) throw new Error(`sim-box SEALED ack failed: ${JSON.stringify(sealedRes.body)}`);
  await hooks.onSealed?.(sealCmd.order_id);

  // A volunteer lifts the lid: LID_OPENED, latched immediately (state
  // TAMPERED is set before this event is even built -- see tamper()).
  const tamperRes = await client.tamper(1);
  if (!tamperRes.ok) throw new Error(`sim-box TAMPER failed: ${JSON.stringify(tamperRes.body)}`);
  await hooks.onTampered?.(client.orderId, 1);

  // A couple of quiet telemetry ticks afterward, state TAMPERED, per §8
  // ("telemetry continues").
  await client.telemetry();
}

export async function runPowerCycleScenario(client: SimBoxClient, hooks: ScenarioHooks = {}, maxWaitMs = 30_000): Promise<void> {
  const bootRes = await client.boot();
  if (!bootRes.ok) throw new Error(`sim-box boot failed: ${JSON.stringify(bootRes.body)}`);

  const sealCmd = await waitForCommand(client, "SEAL", maxWaitMs);
  const sealedRes = await client.ackSealed(sealCmd.id, sealCmd.order_id);
  if (!sealedRes.ok) throw new Error(`sim-box SEALED ack failed: ${JSON.stringify(sealedRes.body)}`);
  await hooks.onSealed?.(sealCmd.order_id);

  // USB unplugged, battery off/on: the box boots straight into TAMPERED
  // (POWER_INTERRUPTED). seq/head are NOT reset -- a real reboot keeps its
  // NVS-persisted chain tail; only a re-flash (re-provisioning) restarts at
  // seq=1. We simulate two power cycles to exercise firmware's documented
  // "re-emits TAMPER on every boot that comes up TAMPERED" quirk, and
  // confirm the relayer treats the second one as a safe no-op.
  const first = await client.tamper(3);
  if (!first.ok) throw new Error(`sim-box first POWER_INTERRUPTED TAMPER failed: ${JSON.stringify(first.body)}`);
  await hooks.onTampered?.(client.orderId, 3);

  const second = await client.tamper(3);
  if (!second.ok) throw new Error(`sim-box second POWER_INTERRUPTED TAMPER (re-emit) failed: ${JSON.stringify(second.body)}`);
}

export async function runOfflineGapScenario(client: SimBoxClient, hooks: ScenarioHooks = {}, maxWaitMs = 30_000): Promise<void> {
  const bootRes = await client.boot();
  if (!bootRes.ok) throw new Error(`sim-box boot failed: ${JSON.stringify(bootRes.body)}`);

  const sealCmd = await waitForCommand(client, "SEAL", maxWaitMs);
  const sealedRes = await client.ackSealed(sealCmd.id, sealCmd.order_id);
  if (!sealedRes.ok) throw new Error(`sim-box SEALED ack failed: ${JSON.stringify(sealedRes.body)}`);
  await hooks.onSealed?.(sealCmd.order_id);

  // Hotspot off: several telemetry ticks are generated locally but never
  // reach the relayer (ring buffer would eventually drop the oldest ones).
  // We simulate this by jumping the wire seq forward by 6 without sending
  // the skipped events -- the relayer must accept + LOG_GAP, not reject.
  const gapEvent = await client.send(
    {
      ts: Math.floor(Date.now() / 1000),
      type: "TELEMETRY",
      state: client.state,
      order_id: client.orderId,
      lat_e6: 0,
      lon_e6: 0,
      fix: 0,
      dist_mm: 84,
      lid: 1,
      accel_mg: 1000,
      tilt_deg: 0,
      lock: "L",
      batt_mv: 11600,
      code: 0,
      cmd_id: "",
    },
    client.currentSeq() + 6, // simulate 5 events lost while the hotspot was down
  );
  if (!gapEvent.ok) throw new Error(`sim-box gap telemetry failed: ${JSON.stringify(gapEvent.body)}`);

  const unlockCmd = await waitForCommand(client, "UNLOCK", maxWaitMs);
  const unlockedRes = await client.ackUnlocked(unlockCmd.id);
  if (!unlockedRes.ok) throw new Error(`sim-box UNLOCKED ack failed: ${JSON.stringify(unlockedRes.body)}`);
  await hooks.onUnlocked?.(client.orderId);
}
