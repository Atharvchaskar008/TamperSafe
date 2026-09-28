// Dashboard-facing REST routes, per docs/ARCHITECTURE.md §9.3. Buyer/courier
// wallet actions (createOrder, cancelOrder, requestUnlock, depositBond,
// withdrawBond) are NOT here -- those are signed client-side by MetaMask in
// the real dashboard, or by relayer/scripts/wallet-actions.ts for the local
// scenario driver. This file only ever reads the chain and queues commands.
import express, { type Request, type Response } from "express";
import { ethers } from "ethers";
import type { ChainContext } from "./chain/contracts.js";
import { OrderStatus, labelForBoxHash } from "./chain/contracts.js";
import { getOrder, getBox, getBondBps, getBondBalance, getAnchorLatest } from "./chain/typedCalls.js";
import type { OrderWatcher } from "./chain/listener.js";
import type { CommandQueue } from "./commandQueue.js";
import type { BoxLogStore } from "./ingest/store.js";
import type { BoxTracker } from "./boxTracker.js";
import { gpsBadge } from "./boxTracker.js";
import type { SseHub } from "./sse.js";

export interface RouteDeps {
  ctx: ChainContext;
  watcher: OrderWatcher;
  commands: CommandQueue;
  store: BoxLogStore;
  tracker: BoxTracker;
  sse: SseHub;
}

export function buildRouter(deps: RouteDeps): express.Router {
  const router = express.Router();

  router.get("/api/orders", (_req: Request, res: Response) => {
    const orders = [...deps.watcher.latest.values()].map((o) => {
      const label = labelForBoxHash(deps.ctx, o.boxId);
      const telemetry = label ? deps.tracker.get(label) : undefined;
      return {
        id: o.id,
        status: o.status,
        buyer: o.buyer,
        seller: o.seller,
        amount: o.amount.toString(),
        boxId: o.boxId,
        boxLabel: label,
        courier: o.courier,
        telemetry: telemetry
          ? {
              state: telemetry.state,
              lastSeenAt: telemetry.lastSeenAt,
              gps: gpsBadge(telemetry),
              lat_e6: telemetry.lat_e6,
              lon_e6: telemetry.lon_e6,
              dist_mm: telemetry.dist_mm,
              lid: telemetry.lid,
              lock: telemetry.lock,
              batt_mv: telemetry.batt_mv,
            }
          : undefined,
      };
    });
    res.json({ orders });
  });

  router.get("/api/orders/:id/log", async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId < 1) {
      res.status(400).json({ ok: false, error: "invalid order id" });
      return;
    }
    let order;
    try {
      order = await getOrder(deps.ctx, orderId);
    } catch (err) {
      res.status(404).json({ ok: false, error: `order not found: ${String(err)}` });
      return;
    }
    const label = labelForBoxHash(deps.ctx, String(order.boxId));
    const events = label ? deps.store.readAll(label) : [];

    let anchored: { seq: bigint; head: string; timestamp: bigint } | undefined;
    try {
      anchored = await getAnchorLatest(deps.ctx, orderId);
    } catch {
      anchored = undefined;
    }
    const anchoredSeq = anchored ? Number(anchored.seq) : 0;
    // Our stored/computed heads are bare lowercase hex (protocol.ts's
    // SHA-256 digest output); the on-chain bytes32 comes back from ethers
    // as "0x"-prefixed. Normalize both before comparing, or `match` is
    // always false regardless of whether the chain actually agrees.
    const normalizeHex = (h: string) => h.toLowerCase().replace(/^0x/, "");
    const anchoredHead = anchored ? normalizeHex(String(anchored.head)) : undefined;
    // Look up the LAST occurrence of that seq, not the first -- seq numbers
    // repeat across box re-provisioning epochs (§10), so the first match
    // could be a stale earlier epoch's event at the same seq.
    let atAnchoredSeq: (typeof events)[number] | undefined;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]!.seq === anchoredSeq) {
        atAnchoredSeq = events[i];
        break;
      }
    }
    const computedHeadAtAnchoredSeq = atAnchoredSeq ? normalizeHex(atAnchoredSeq.head) : undefined;
    const match = anchoredSeq > 0 ? computedHeadAtAnchoredSeq !== undefined && computedHeadAtAnchoredSeq === anchoredHead : null;

    res.json({
      order_id: orderId,
      box_label: label,
      events,
      anchored_seq: anchoredSeq,
      computed_head_at_anchored_seq: computedHeadAtAnchoredSeq ?? null,
      anchored_head: anchoredHead ?? null,
      match,
    });
  });

  router.post("/api/orders/:id/seal", async (req: Request, res: Response) => {
    const orderId = Number(req.params.id);
    const { box_id: boxLabel, courier } = req.body ?? {};
    if (!Number.isInteger(orderId) || orderId < 1 || typeof boxLabel !== "string" || typeof courier !== "string") {
      res.status(400).json({ ok: false, error: "expected { box_id: string, courier: address }" });
      return;
    }
    let order;
    try {
      order = await getOrder(deps.ctx, orderId);
    } catch (err) {
      res.status(404).json({ ok: false, error: `order not found: ${String(err)}` });
      return;
    }
    if (Number(order.status) !== OrderStatus.Funded) {
      res.status(409).json({ ok: false, error: `order ${orderId} is not Funded (status=${Number(order.status)})` });
      return;
    }
    const boxIdHash = ethers.id(boxLabel);
    let box;
    try {
      box = await getBox(deps.ctx, boxIdHash);
    } catch (err) {
      res.status(404).json({ ok: false, error: `unknown box ${boxLabel}: ${String(err)}` });
      return;
    }
    if (!box.active || box.activeOrderId !== 0n) {
      res.status(409).json({ ok: false, error: `box ${boxLabel} is not free (active=${box.active}, activeOrderId=${box.activeOrderId})` });
      return;
    }
    // The command queue holds exactly one slot per box. Silently
    // overwriting it here would let a SEAL displace a still-pending RESET
    // (or a leftover seal-abort UNLOCK), and "RESET supersedes any other
    // pending command" (§10) would no longer hold -- the depot would need
    // to retry blind. Refuse instead of overwriting.
    const existingCmd = deps.commands.getForBox(boxLabel);
    if (existingCmd) {
      res.status(409).json({ ok: false, error: `box ${boxLabel} already has a pending ${existingCmd.type} command (${existingCmd.cmdId})` });
      return;
    }
    let bondBps: bigint;
    try {
      bondBps = await getBondBps(deps.ctx);
    } catch {
      bondBps = 10_000n;
    }
    const required = (BigInt(order.amount) * bondBps) / 10_000n;
    let free: bigint;
    try {
      free = await getBondBalance(deps.ctx, courier);
    } catch (err) {
      res.status(400).json({ ok: false, error: `could not read courier bond: ${String(err)}` });
      return;
    }
    if (free < required) {
      res.status(409).json({ ok: false, error: `courier free bond ${free} < required ${required}` });
      return;
    }
    const cmd = deps.commands.queueSeal(boxLabel, orderId, courier);
    res.json({ ok: true, queued: { cmd_id: cmd.cmdId, type: cmd.type } });
  });

  router.post("/api/boxes/:box_id/reset", async (req: Request, res: Response) => {
    const boxLabel = String(req.params.box_id ?? "");
    const boxIdHash = ethers.id(boxLabel);
    let box;
    try {
      box = await getBox(deps.ctx, boxIdHash);
    } catch (err) {
      res.status(404).json({ ok: false, error: `unknown box ${boxLabel}: ${String(err)}` });
      return;
    }
    // Per ARCHITECTURE.md §10: check the REGISTRY's activeOrderId, not the
    // box's own reported order_id -- a box can tamper against an order that
    // was Funded but never actually sealed on-chain (seal-abort), in which
    // case the box's local order_id is nonzero but the registry was never
    // bound, and reset must still be allowed.
    if (box.activeOrderId !== 0n) {
      res.status(409).json({ ok: false, error: `box ${boxLabel} still bound to active order ${box.activeOrderId}` });
      return;
    }
    const cmd = deps.commands.queueReset(boxLabel, 0);
    res.json({ ok: true, queued: { cmd_id: cmd.cmdId, type: cmd.type } });
  });

  router.get("/api/boxes", (_req: Request, res: Response) => {
    const boxes = deps.ctx.deployment.boxes.map((b) => {
      const snap = deps.tracker.get(b.label);
      return {
        label: b.label,
        boxId: b.boxId,
        lastSeenAt: snap?.lastSeenAt ?? null,
        state: snap?.state ?? null,
        gps: snap ? gpsBadge(snap) : "NO_FIX",
        pendingCommand: deps.commands.getForBox(b.label) ?? null,
      };
    });
    res.json({ boxes });
  });

  router.post("/api/demo/gps-sim", (req: Request, res: Response) => {
    const { box_id: boxLabel, enabled } = req.body ?? {};
    if (typeof boxLabel !== "string" || typeof enabled !== "boolean") {
      res.status(400).json({ ok: false, error: "expected { box_id: string, enabled: boolean }" });
      return;
    }
    deps.tracker.setGpsSim(boxLabel, enabled);
    res.json({ ok: true });
  });

  router.get("/api/stream", (req: Request, res: Response) => {
    deps.sse.add(res);
  });

  return router;
}
