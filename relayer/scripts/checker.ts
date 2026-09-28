// Asserts final on-chain state + balance deltas for a scenario run. Failures
// throw (the orchestrator's exit code follows), so "checked by the script,
// not by eye" per the M3 done-criteria.
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

/** Happy path: seller gets the full order amount (it sent no txs, so its
 * delta is exact); the courier's bond unlocks back to free balance. */
export async function assertHappyOutcome(opts: {
  wallet: WalletActions;
  orderId: number;
  amountWei: bigint;
  before: Balances;
  after: Balances;
  sellerAddr: string;
  courierAddr: string;
}): Promise<void> {
  const order = await opts.wallet.getOrder(opts.orderId);
  if (Number(order.status) !== STATUS.Delivered) {
    throw new Error(`checker: expected Delivered (4), got status=${Number(order.status)}`);
  }
  const sellerDelta = opts.after.seller - opts.before.seller;
  if (sellerDelta !== opts.amountWei) {
    throw new Error(`checker: seller delta ${sellerDelta} !== order amount ${opts.amountWei}`);
  }
  const lockedBond = await opts.wallet.lockedBond(opts.courierAddr);
  if (lockedBond !== 0n) {
    throw new Error(`checker: courier's locked bond should be 0 after delivery, got ${lockedBond}`);
  }
}

/** Tamper: buyer is refunded the order amount, the courier's locked bond is
 * slashed to the seller (goods were compromised in the courier's custody). */
export async function assertTamperOutcome(opts: {
  wallet: WalletActions;
  orderId: number;
  amountWei: bigint;
  bondWei: bigint;
  before: Balances;
  after: Balances;
}): Promise<void> {
  const order = await opts.wallet.getOrder(opts.orderId);
  if (Number(order.status) !== STATUS.Tampered) {
    throw new Error(`checker: expected Tampered (5), got status=${Number(order.status)}`);
  }
  const sellerDelta = opts.after.seller - opts.before.seller;
  if (sellerDelta !== opts.bondWei) {
    throw new Error(`checker: seller delta ${sellerDelta} !== slashed bond ${opts.bondWei}`);
  }
  // createOrder is payable: the buyer already paid amountWei OUT at order
  // creation (that's what "before" is snapshotted ahead of). reportTamper's
  // refund pays that same amountWei back IN, so the buyer's net delta across
  // the whole scenario is just -gas (roughly zero, never positive, and never
  // anywhere close to -amountWei -- which is what we'd see if the refund had
  // silently failed to land).
  const buyerDelta = opts.after.buyer - opts.before.buyer;
  const maxPlausibleGas = opts.amountWei / 10n; // generous upper bound for 1-2 local txs
  if (buyerDelta > 0n || -buyerDelta > maxPlausibleGas) {
    throw new Error(
      `checker: buyer delta ${buyerDelta} is not "paid amount then got it refunded, net of gas" ` +
        `(expected roughly 0, bounded by -${maxPlausibleGas}) -- the refund may not have landed`,
    );
  }
}

export function assertReceiptOk(receipt: ethers.TransactionReceipt | null, label: string): void {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`checker: ${label} did not confirm successfully`);
  }
}
