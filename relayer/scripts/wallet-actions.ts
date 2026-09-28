// Buyer/courier/seller wallet actions for the LOCAL scenario driver only.
// This is deliberately a separate code path from the relayer server's own
// signer (src/chain/writer.ts) -- CLAUDE.md: "Buyer and courier actions are
// never signed by the relayer." createOrder, cancelOrder, requestUnlock,
// depositBond and withdrawBond are wallet actions; in the real system
// they're signed by MetaMask in the dashboard. Here, for a repeatable local
// scenario run, they're signed by OTHER Hardhat dev accounts (never the
// relayer's own account -- see index note below) via provider.getSigner(),
// still no private key involved, still CHAIN=local only.
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

export interface WalletActionsDeps {
  rpcUrl: string;
  deploymentFile: string; // absolute path to deployments/local.json
  abiFile: string; // absolute path to deployments/abi/TamperSafeEscrow.json
}

// Hardhat dev account indices used by the local scenario driver.
// #0 = deployer/admin, #1 = relayerOracle (never used here -- that account's
// nonce is owned exclusively by the relayer's ChainWriter, see server.ts).
export const ACCOUNT_INDEX = { buyer: 2, seller: 3, courier: 4 } as const;

export class WalletActions {
  private provider: ethers.JsonRpcProvider;
  private escrowAddress: string;
  private abi: ethers.InterfaceAbi;
  /** Cumulative gas fees paid by each address through this class, so the
   * checker can assert EXACT balance deltas (amount +/- fees), not just
   * "roughly right" bounds. Keyed by lowercase address. */
  private fees = new Map<string, bigint>();

  constructor(deps: WalletActionsDeps) {
    this.provider = new ethers.JsonRpcProvider(deps.rpcUrl, undefined, { pollingInterval: 300 });
    const deployment = JSON.parse(fs.readFileSync(deps.deploymentFile, "utf8"));
    this.escrowAddress = deployment.contracts.TamperSafeEscrow.address;
    this.abi = JSON.parse(fs.readFileSync(deps.abiFile, "utf8"));
  }

  private trackFee(address: string, fee: bigint): void {
    const key = address.toLowerCase();
    this.fees.set(key, (this.fees.get(key) ?? 0n) + fee);
  }

  /** Total gas fees this class has paid on behalf of `address` so far. */
  feesPaidBy(address: string): bigint {
    return this.fees.get(address.toLowerCase()) ?? 0n;
  }

  private async signerFor(index: number): Promise<ethers.Signer> {
    const accounts: string[] = await this.provider.send("eth_accounts", []);
    const address = accounts[index];
    if (!address) throw new Error(`wallet-actions: hardhat node has no account at index ${index}`);
    return this.provider.getSigner(address);
  }

  private async escrowAs(index: number): Promise<ethers.Contract> {
    const signer = await this.signerFor(index);
    return new ethers.Contract(this.escrowAddress, this.abi, signer);
  }

  async addressOf(index: number): Promise<string> {
    const accounts: string[] = await this.provider.send("eth_accounts", []);
    const addr = accounts[index];
    if (!addr) throw new Error(`wallet-actions: no account at index ${index}`);
    return addr;
  }

  async createOrder(opts: {
    sellerAddress: string;
    destLat: number;
    destLon: number;
    deadlineUnix: number;
    valueWei: bigint;
  }): Promise<number> {
    const buyerAddr = await this.addressOf(ACCOUNT_INDEX.buyer);
    const escrow = await this.escrowAs(ACCOUNT_INDEX.buyer);
    const tx = await (escrow.createOrder as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(
      opts.sellerAddress,
      opts.destLat,
      opts.destLon,
      opts.deadlineUnix,
      { value: opts.valueWei },
    );
    const receipt = await tx.wait();
    if (!receipt) throw new Error("createOrder: no receipt");
    this.trackFee(buyerAddr, receipt.fee);
    const iface = new ethers.Interface(this.abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "OrderCreated") return Number(parsed.args[0]);
      } catch {
        // not this event
      }
    }
    throw new Error("createOrder: OrderCreated event not found in receipt");
  }

  async cancelOrder(orderId: number): Promise<void> {
    const buyerAddr = await this.addressOf(ACCOUNT_INDEX.buyer);
    const escrow = await this.escrowAs(ACCOUNT_INDEX.buyer);
    const tx = await (escrow.cancelOrder as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(orderId);
    const receipt = await tx.wait();
    if (receipt) this.trackFee(buyerAddr, receipt.fee);
  }

  async requestUnlock(orderId: number): Promise<void> {
    const buyerAddr = await this.addressOf(ACCOUNT_INDEX.buyer);
    const escrow = await this.escrowAs(ACCOUNT_INDEX.buyer);
    const tx = await (escrow.requestUnlock as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(orderId);
    const receipt = await tx.wait();
    if (receipt) this.trackFee(buyerAddr, receipt.fee);
  }

  async depositBond(valueWei: bigint): Promise<void> {
    const courierAddr = await this.addressOf(ACCOUNT_INDEX.courier);
    const escrow = await this.escrowAs(ACCOUNT_INDEX.courier);
    const tx = await (escrow.depositBond as (...a: unknown[]) => Promise<ethers.TransactionResponse>)({ value: valueWei });
    const receipt = await tx.wait();
    if (receipt) this.trackFee(courierAddr, receipt.fee);
  }

  async withdrawBond(amountWei: bigint): Promise<void> {
    const courierAddr = await this.addressOf(ACCOUNT_INDEX.courier);
    const escrow = await this.escrowAs(ACCOUNT_INDEX.courier);
    const tx = await (escrow.withdrawBond as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(amountWei);
    const receipt = await tx.wait();
    if (receipt) this.trackFee(courierAddr, receipt.fee);
  }

  async getBalance(address: string): Promise<bigint> {
    // Deliberately bypasses ethers' Provider.getBalance() -- confirmed via a
    // throwaway debug script that it can return a stale value immediately
    // after a same-process tx confirms (its "latest" blockTag resolution is
    // cached against the provider's own last-observed block, which a fast
    // local scenario can outrun). A raw eth_getBalance call always reflects
    // the chain's true current state.
    const hex = (await this.provider.send("eth_getBalance", [address, "latest"])) as string;
    return BigInt(hex);
  }

  async getOrder(orderId: number): Promise<Record<string, unknown>> {
    const escrow = new ethers.Contract(this.escrowAddress, this.abi, this.provider);
    return (escrow.getOrder as (...a: unknown[]) => Promise<Record<string, unknown>>)(orderId);
  }

  /** Raw eth_call (bypassing ethers' Contract read cache -- see getBalance's
   * comment above for why) for a single-bigint-return view function. */
  private async rawCallBigint(fnFragment: string, args: unknown[]): Promise<bigint> {
    const iface = new ethers.Interface([`function ${fnFragment}`]);
    const name = fnFragment.split("(")[0]!;
    const data = iface.encodeFunctionData(name, args);
    const result = (await this.provider.send("eth_call", [{ to: this.escrowAddress, data }, "latest"])) as string;
    return iface.decodeFunctionResult(name, result)[0] as bigint;
  }

  async bondBalance(address: string): Promise<bigint> {
    return this.rawCallBigint("bondBalance(address) view returns (uint256)", [address]);
  }

  async lockedBond(address: string): Promise<bigint> {
    return this.rawCallBigint("lockedBond(address) view returns (uint256)", [address]);
  }

  async bondBps(): Promise<bigint> {
    const escrow = new ethers.Contract(this.escrowAddress, this.abi, this.provider);
    return (escrow.bondBps as (...a: unknown[]) => Promise<bigint>)();
  }

  async receiptFee(txHash: string): Promise<bigint> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error(`wallet-actions: no receipt for ${txHash}`);
    return receipt.fee;
  }
}

export function defaultDeps(repoRoot: string, chain: "local" = "local"): WalletActionsDeps {
  return {
    rpcUrl: "http://127.0.0.1:8545",
    deploymentFile: path.join(repoRoot, "deployments", `${chain}.json`),
    abiFile: path.join(repoRoot, "deployments", "abi", "TamperSafeEscrow.json"),
  };
}
