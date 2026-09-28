// The rules table from docs/ARCHITECTURE.md §10: what chain call (if any) a
// device event triggers, gated on the order's CURRENT on-chain status, never
// on the device event alone -- this is what makes a repeated TAMPER/UNLOCKED
// after firmware's re-emit-on-boot quirk a safe no-op instead of a revert.
import type { ChainContext } from "./chain/contracts.js";
import { OrderStatus } from "./chain/contracts.js";
import type { ChainWriter } from "./chain/writer.js";
import type { CommandQueue } from "./commandQueue.js";
import type { SseHub } from "./sse.js";
import type { StoredEvent } from "./ingest/types.js";
import { getOrder as chainGetOrder } from "./chain/typedCalls.js";
import { ethers } from "ethers";

const ALERT_RATE_LIMIT_MS = 60_000;
const ANCHOR_EVERY_MS = 30_000;
const ANCHOR_EVERY_COUNT = 20;

interface OrderView {
  status: number;
}

export class RulesEngine {
  private lastAlertAt = new Map<string, number>(); // `${orderId}:${code}` -> ms
  private eventsSinceAnchor = new Map<number, number>();
  private lastAnchorAt = new Map<number, number>();
  private seqByOrder = new Map<number, number>(); // most recent seq seen for the order (for anchor())
  private headByOrder = new Map<number, string>(); // most recent head for the order

  constructor(
    private readonly ctx: ChainContext,
    private readonly writer: ChainWriter,
    private readonly commands: CommandQueue,
    private readonly sse: SseHub,
  ) {}

  private async getOrder(orderId: number): Promise<OrderView> {
    const o = await chainGetOrder(this.ctx, orderId);
    return { status: Number(o.status) };
  }

  private alertAllowed(orderId: number, code: number, now: number): boolean {
    const key = `${orderId}:${code}`;
    const last = this.lastAlertAt.get(key);
    if (last !== undefined && now - last < ALERT_RATE_LIMIT_MS) return false;
    this.lastAlertAt.set(key, now);
    return true;
  }

  private async maybeAnchor(orderId: number, seq: number, head: string, forceNow: boolean): Promise<void> {
    if (orderId === 0) return;
    this.seqByOrder.set(orderId, seq);
    this.headByOrder.set(orderId, head);
    const count = (this.eventsSinceAnchor.get(orderId) ?? 0) + 1;
    this.eventsSinceAnchor.set(orderId, count);
    const lastAt = this.lastAnchorAt.get(orderId) ?? 0;
    const now = Date.now();
    const due = forceNow || count >= ANCHOR_EVERY_COUNT || now - lastAt >= ANCHOR_EVERY_MS;
    if (!due) return;
    let status: number;
    try {
      status = (await this.getOrder(orderId)).status;
    } catch {
      return;
    }
    if (status !== OrderStatus.InTransit && !forceNow) return; // §7: anchor while InTransit, or at transitions
    this.writer.dropPendingAnchor(orderId);
    this.eventsSinceAnchor.set(orderId, 0);
    this.lastAnchorAt.set(orderId, now);
    try {
      await this.writer.anchor(orderId, seq, head, count);
    } catch {
      // Permanent (StaleSeq) or transient failure already logged/SSE'd by
      // the writer itself; nothing else to do here.
    }
  }

  async handleEvent(boxId: string, event: StoredEvent): Promise<void> {
    const orderId = event.order_id;
    switch (event.type) {
      case "SEALED":
        await this.onSealed(boxId, event);
        break;
      case "SEAL_FAILED":
        this.commands.clearIfMatches(boxId, event.cmd_id);
        this.sse.emit("alert", { boxId, orderId, type: "SEAL_FAILED", message: "box reported SEAL_FAILED" });
        break;
      case "TAMPER":
        await this.onTamper(boxId, event);
        break;
      case "ALERT":
        await this.onAlert(boxId, event);
        break;
      case "UNLOCKED":
        await this.onUnlocked(boxId, event);
        break;
      case "RESET_DONE":
        this.commands.clearIfMatches(boxId, event.cmd_id);
        this.sse.emit("order", { boxId, orderId, event: "RESET_DONE" });
        break;
      case "BOOT":
      case "TELEMETRY":
        break;
    }
    await this.maybeAnchor(orderId, event.seq, event.head, false);
  }

  private async onSealed(boxId: string, event: StoredEvent): Promise<void> {
    const pending = this.commands.getForBox(boxId);
    if (!pending || pending.type !== "SEAL" || pending.cmdId !== event.cmd_id) {
      this.sse.emit("alert", { boxId, orderId: event.order_id, type: "UNEXPECTED_SEALED", message: "SEALED with no matching pending SEAL command" });
      return;
    }
    this.commands.clearIfMatches(boxId, event.cmd_id);
    const orderId = pending.orderId;
    let status: number;
    try {
      status = (await this.getOrder(orderId)).status;
    } catch (err) {
      this.sse.emit("alert", { boxId, orderId, type: "ORDER_READ_FAILED", message: String(err) });
      return;
    }
    if (status !== OrderStatus.Funded) {
      // Seal-abort: the order didn't stay Funded (e.g. buyer cancelled while
      // the SEAL was in flight to the box). The box is physically sealed
      // with nothing on-chain backing it -- queue UNLOCK so the depot can
      // recover it, per ARCHITECTURE.md §10 "Seal abort".
      this.commands.queueUnlock(boxId, orderId, { exemptFromTerminalCancel: true });
      this.sse.emit("alert", { boxId, orderId, type: "SEAL_ABORT", message: "box sealed but order is not Funded on-chain; queuing UNLOCK" });
      return;
    }
    try {
      // ChainWriter expects the on-chain bytes32 box id, not the string
      // label the device protocol (and CommandQueue) speaks.
      await this.writer.sealShipment(orderId, ethers.id(boxId), pending.courierAddress!, event.head);
      await this.maybeAnchor(orderId, event.seq, event.head, true);
    } catch (err) {
      // Permanent revert: the seal never landed, but the box is still
      // physically sealed -- same recovery path as the check above.
      console.error(`[rules] sealShipment(${orderId}) failed:`, err);
      this.commands.queueUnlock(boxId, orderId, { exemptFromTerminalCancel: true });
      this.sse.emit("alert", { boxId, orderId, type: "SEAL_ABORT", message: "sealShipment reverted; queuing UNLOCK to recover the box" });
    }
  }

  private async onTamper(boxId: string, event: StoredEvent): Promise<void> {
    const orderId = event.order_id;
    if (orderId === 0) {
      this.sse.emit("alert", { boxId, orderId, type: "TAMPER_NO_ORDER", message: "TAMPER with no bound order" });
      return;
    }
    let status: number;
    try {
      status = (await this.getOrder(orderId)).status;
    } catch (err) {
      this.sse.emit("alert", { boxId, orderId, type: "ORDER_READ_FAILED", message: String(err) });
      return;
    }
    if (status === OrderStatus.InTransit || status === OrderStatus.UnlockRequested) {
      try {
        await this.writer.reportTamper(orderId, event.code, event.head);
        await this.maybeAnchor(orderId, event.seq, event.head, true);
      } catch {
        // Permanent revert already surfaced via SSE by the writer.
      }
      return;
    }
    if (status === OrderStatus.Tampered) {
      return; // already reported -- no-op, ack only.
    }
    if (status === OrderStatus.Funded) {
      // Box thinks it's sealed locally but the seal never landed on-chain.
      this.sse.emit("alert", {
        boxId,
        orderId,
        type: "TAMPER_UNBACKED_SEAL",
        message: "box reports TAMPER against a Funded (never-sealed) order -- human check needed",
      });
      return;
    }
    // Delivered / Expired / Cancelled: order already resolved; nothing to do.
  }

  private async onAlert(boxId: string, event: StoredEvent): Promise<void> {
    const orderId = event.order_id;
    if (orderId === 0) {
      this.sse.emit("alert", { boxId, orderId, code: event.code, type: "ALERT", onChain: false });
      return;
    }
    if (!this.alertAllowed(orderId, event.code, Date.now())) return;
    try {
      await this.writer.logAlert(orderId, event.code, event.head);
      this.sse.emit("alert", { boxId, orderId, code: event.code, type: "ALERT", onChain: true });
    } catch {
      // Permanent/transient already surfaced by the writer via SSE "tx".
    }
  }

  private async onUnlocked(boxId: string, event: StoredEvent): Promise<void> {
    this.commands.clearIfMatches(boxId, event.cmd_id);
    const orderId = event.order_id;
    if (orderId === 0) return;
    let status: number;
    try {
      status = (await this.getOrder(orderId)).status;
    } catch (err) {
      this.sse.emit("alert", { boxId, orderId, type: "ORDER_READ_FAILED", message: String(err) });
      return;
    }
    if (status === OrderStatus.UnlockRequested) {
      try {
        await this.writer.confirmDelivery(orderId, event.head, event.lat_e6, event.lon_e6, event.fix === 1);
        await this.maybeAnchor(orderId, event.seq, event.head, true);
      } catch {
        // Permanent revert already surfaced via SSE by the writer.
      }
      return;
    }
    // Delivered (already confirmed) or Funded (seal-abort): no-op, ack only.
  }

  /** Raises LOG_GAP for a batch that arrived with a sequence discontinuity.
   * Per the advisor review: only put it on-chain when the box has a
   * non-zero bound order; otherwise SSE-only (flagged as a simplification). */
  async raiseLogGap(boxId: string, orderId: number, head: string): Promise<void> {
    if (orderId !== 0 && this.alertAllowed(orderId, 13 /* LOG_GAP */, Date.now())) {
      try {
        await this.writer.logAlert(orderId, 13, head);
      } catch {
        // surfaced via SSE "tx" already.
      }
    }
    this.sse.emit("alert", { boxId, orderId, code: 13, type: "LOG_GAP", onChain: orderId !== 0 });
  }

  raiseReprovisioned(boxId: string): void {
    this.sse.emit("alert", { boxId, type: "BOX_REPROVISIONED", message: "box restarted its hash chain from genesis (re-flash or flash-erase)" });
  }

  raiseSignalLost(boxId: string, orderId: number): void {
    this.sse.emit("alert", { boxId, orderId, code: 12, type: "SIGNAL_LOST" });
    if (orderId !== 0 && this.alertAllowed(orderId, 12, Date.now())) {
      const head = this.headByOrder.get(orderId);
      const seq = this.seqByOrder.get(orderId);
      if (head !== undefined && seq !== undefined) {
        void this.writer.logAlert(orderId, 12, head).catch(() => {});
      }
    }
  }
}
