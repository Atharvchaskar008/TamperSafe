// Watches Escrow order status by polling (1s), not just UnlockRequested
// events -- terminal transitions can come from the buyer's own cancelOrder
// or from anyone's claimTimeout, neither of which is a relayer tx, so the
// only way to learn about them is to read the chain. Reconciles at startup
// by scanning every known order, not only new events after boot.
// See docs/ARCHITECTURE.md §10 "Chain listener".
import type { ChainContext } from "./contracts.js";
import { OrderStatus, labelForBoxHash } from "./contracts.js";
import { getOrder, getOrderCount } from "./typedCalls.js";
import type { CommandQueue } from "../commandQueue.js";
import type { SseHub } from "../sse.js";

const POLL_MS = 1000;
const TERMINAL = new Set<number>([OrderStatus.Delivered, OrderStatus.Tampered, OrderStatus.Expired, OrderStatus.Cancelled]);

export interface OrderSnapshot {
  id: number;
  status: number;
  buyer: string;
  seller: string;
  amount: bigint;
  boxId: string;
  courier: string;
}

export class OrderWatcher {
  private lastStatus = new Map<number, number>();
  private timer: NodeJS.Timeout | undefined;
  public latest = new Map<number, OrderSnapshot>();

  constructor(
    private readonly ctx: ChainContext,
    private readonly commands: CommandQueue,
    private readonly sse: SseHub,
  ) {}

  async start(): Promise<void> {
    await this.pollOnce(); // startup reconciliation
    this.timer = setInterval(() => void this.pollOnce(), POLL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async pollOnce(): Promise<void> {
    let count: bigint;
    try {
      count = await getOrderCount(this.ctx);
    } catch {
      return; // transient RPC hiccup -- next tick retries.
    }
    for (let id = 1; id <= Number(count); id++) {
      let o: Awaited<ReturnType<typeof getOrder>>;
      try {
        o = await getOrder(this.ctx, id);
      } catch {
        continue;
      }
      const status = Number(o.status);
      const snapshot: OrderSnapshot = {
        id,
        status,
        buyer: String(o.buyer),
        seller: String(o.seller),
        amount: BigInt(o.amount as bigint),
        boxId: String(o.boxId),
        courier: String(o.courier),
      };
      this.latest.set(id, snapshot);
      const prev = this.lastStatus.get(id);
      // Cancel unconditionally (idempotent no-op once already cancelled) so
      // a relayer restart that lands after an order already went terminal
      // still clears any command persisted from before the restart.
      if (TERMINAL.has(status)) this.commands.cancelForOrder(id);
      if (prev === status) continue;
      this.lastStatus.set(id, status);
      this.sse.emit("order", { id, status, prevStatus: prev });

      if (status === OrderStatus.UnlockRequested && prev !== OrderStatus.UnlockRequested) {
        const label = labelForBoxHash(this.ctx, snapshot.boxId);
        if (label) this.commands.queueUnlock(label, id);
      }
    }
  }
}
