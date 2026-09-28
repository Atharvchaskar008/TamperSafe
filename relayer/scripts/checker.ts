// Asserts final on-chain state + EXACT balance deltas for a scenario run.
// Failures throw (the orchestrator's exit code follows), so "checked by the
// script, not by eye" per the M3 done-criteria. Deltas are exact (not
// bounded/approximate) because WalletActions tracks the gas fee of every tx
// it sends on each account's behalf (see wallet-actions.ts's `feesPaidBy`).
import { ethers } from "ethers";
import type { WalletActions } from "./wallet-actions.js";

// Escrow.Status, per ARCHITECTURE.md §6.
export const STATUS = { Delivered: 4, Tampered: 5 } as const;

export async function waitForOrderStatus(
  wallet: WalletActions,
  orderId: number,
  wantStatus: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = -1;
  while (Date.now() < deadline) {
    const order = await wallet.getOrder(orderId);
    last = Number(order.status);
    if (last === wantStatus) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`checker: order ${orderId} never reached status ${wantStatus} (last seen: ${last})`);
}

export interface Balances {
  buyer: bigint;
  seller: bigint;
  courier: bigint;
}

export async function snapshotBalances(wallet: WalletActions, addrs: { buyer: string; seller: string; courier: string }): Promise<Balances> {
  return {
    buyer: await wallet.getBalance(addrs.buyer),
    seller: await wallet.getBalance(addrs.seller),
    courier: await wallet.getBalance(addrs.courier),
  };
}

function assertExact(label: string, actual: bigint, expected: bigint): void {
  if (actual !== expected) {
    throw new Error(`checker: ${label}: expected ${expected}, got ${actual} (diff ${actual - expected})`);
  }
}

/** Happy path / offline-gap: seller gets the full order amount (it sent no
 * txs, so its delta is exact); the buyer already paid `amount` out at
 * createOrder and never gets it back (seller does), so its total delta is
 * exactly -(amount + its own gas); the courier's bond unlocks back to free. */
export async function assertHappyOutcome(opts: {
  wallet: WalletActions;
  orderId: number;
  amountWei: bigint;
  depositWei: bigint;
  before: Balances;
  after: Balances;
  buyerAddr: string;
  sellerAddr: string;
  courierAddr: string;
}): Promise<void> {
  const order = await opts.wallet.getOrder(opts.orderId);
  if (Number(order.status) !== STATUS.Delivered) {
    throw new Error(`checker: expected Delivered (4), got status=${Number(order.status)}`);
  }

  assertExact("seller delta", opts.after.seller - opts.before.seller, opts.amountWei);

  const buyerFees = opts.wallet.feesPaidBy(opts.buyerAddr);
  assertExact("buyer delta", opts.after.buyer - opts.before.buyer, -(opts.amountWei + buyerFees));

  const courierFees = opts.wallet.feesPaidBy(opts.courierAddr);
  assertExact("courier ETH delta", opts.after.courier - opts.before.courier, -(opts.depositWei + courierFees));

  const freeBond = await opts.wallet.bondBalance(opts.courierAddr);
  assertExact("courier free bond (bondBalance)", freeBond, opts.depositWei);
  const lockedBond = await opts.wallet.lockedBond(opts.courierAddr);
  assertExact("courier locked bond", lockedBond, 0n);
}

/** Tamper / power-cycle: buyer is refunded the order amount it already paid
 * in (net effect: -its own gas only), the courier's LOCKED bond is slashed
 * to the seller (goods were compromised in the courier's custody) while its
 * free bond stays exactly as reduced at seal time. */
export async function assertTamperOutcome(opts: {
  wallet: WalletActions;
  orderId: number;
  amountWei: bigint;
  bondWei: bigint;
  depositWei: bigint;
  before: Balances;
  after: Balances;
  buyerAddr: string;
  courierAddr: string;
}): Promise<void> {
  const order = await opts.wallet.getOrder(opts.orderId);
  if (Number(order.status) !== STATUS.Tampered) {
    throw new Error(`checker: expected Tampered (5), got status=${Number(order.status)}`);
  }

  assertExact("seller delta", opts.after.seller - opts.before.seller, opts.bondWei);

  const buyerFees = opts.wallet.feesPaidBy(opts.buyerAddr);
  assertExact("buyer delta", opts.after.buyer - opts.before.buyer, -buyerFees);

  const courierFees = opts.wallet.feesPaidBy(opts.courierAddr);
  assertExact("courier ETH delta", opts.after.courier - opts.before.courier, -(opts.depositWei + courierFees));

  const freeBond = await opts.wallet.bondBalance(opts.courierAddr);
  assertExact("courier free bond (bondBalance)", freeBond, opts.depositWei - opts.bondWei);
  const lockedBond = await opts.wallet.lockedBond(opts.courierAddr);
  assertExact("courier locked bond", lockedBond, 0n);
}

export function assertReceiptOk(receipt: ethers.TransactionReceipt | null, label: string): void {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`checker: ${label} did not confirm successfully`);
  }
}

/** Reads relayer SSE (`GET /api/stream`) from now until `stop()` is called,
 * and records every `tx` event with stage:"failed", permanent:true. The
 * balance-delta checks above can't tell "a repeat TAMPER was a safe no-op"
 * apart from "a repeat TAMPER was tried and permanently reverted", because a
 * failed estimateGas leaves no on-chain trace at all. This is that missing
 * signal. */
export class TxFailureWatcher {
  public failures: Array<{ label: string; error: string }> = [];
  public confirmed: Array<{ label: string; fn: string }> = [];
  private controller = new AbortController();
  private done: Promise<void>;

  constructor(relayerUrl: string) {
    this.done = this.run(relayerUrl);
  }

  private async run(relayerUrl: string): Promise<void> {
    try {
      const res = await fetch(`${relayerUrl}/api/stream`, { signal: this.controller.signal });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const chunk of events) {
          const lines = chunk.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;
          if (eventLine.slice("event: ".length) !== "tx") continue;
          const payload = JSON.parse(dataLine.slice("data: ".length));
          if (payload.stage === "failed" && payload.permanent) {
            this.failures.push({ label: payload.label, error: payload.error });
          }
          if (payload.stage === "confirmed") {
            this.confirmed.push({ label: payload.label, fn: payload.fn });
          }
        }
      }
    } catch {
      // aborted on stop(), or the relayer went away during teardown -- fine.
    }
  }

  countConfirmed(fn: string): number {
    return this.confirmed.filter((c) => c.fn === fn).length;
  }

  async stop(): Promise<void> {
    this.controller.abort();
    await this.done.catch(() => {});
  }

  assertNoFailures(): void {
    if (this.failures.length > 0) {
      throw new Error(`checker: relayer reported ${this.failures.length} permanent tx failure(s): ${JSON.stringify(this.failures)}`);
    }
  }
}
