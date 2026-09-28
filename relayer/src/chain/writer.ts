// The one chain writer: a single queue, one in-flight transaction, exactly
// the five ORACLE-role functions reachable -- this is how Invariant 1 (the
// relayer never names a payee) holds by construction, not by convention.
// See docs/ARCHITECTURE.md §10 "Chain writer".
import { ethers } from "ethers";
import type { ChainContext } from "./contracts.js";
import { classifyRevert } from "./revert.js";
import type { SseHub } from "../sse.js";
import { explorerTxUrl } from "./contracts.js";

export type WriterFn = "sealShipment" | "reportTamper" | "confirmDelivery" | "anchor" | "logAlert";

interface WriterJob {
  fn: WriterFn;
  args: unknown[];
  /** Front-of-queue jobs (TAMPER) jump ahead of normal ones, but never ahead
   * of an already-enqueued/in-flight job for the SAME order (see holdKey). */
  priority: boolean;
  /** Jobs sharing a holdKey are never reordered past one another -- used to
   * keep a TAMPER for an order behind that order's own in-flight/queued
   * sealShipment (ARCHITECTURE.md §10 spike note: tamper must not jump a
   * queued seal for the same order). */
  holdKey: string;
  resolve: (receipt: ethers.TransactionReceipt) => void;
  reject: (err: unknown) => void;
  attempts: number;
  label: string; // for logs/SSE
}

const MAX_RETRIES = 2;

export interface TxEvent {
  stage: "submitted" | "confirmed" | "failed";
  label: string;
  fn: WriterFn;
  hash?: string;
  explorerUrl?: string | null;
  error?: string;
  permanent?: boolean;
  decodedError?: { name: string; args: unknown[] } | undefined;
}

export class ChainWriter {
  private queue: WriterJob[] = [];
  private inFlight = false;
  private nonce: number | undefined;
  private useLegacy = false;

  constructor(
    private readonly ctx: ChainContext,
    private readonly sse: SseHub,
  ) {}

  async init(): Promise<void> {
    this.nonce = await this.ctx.provider.getTransactionCount(this.ctx.signerAddress, "pending");
  }

  private enqueue(fn: WriterFn, args: unknown[], opts: { priority?: boolean; holdKey: string; label: string }): Promise<ethers.TransactionReceipt> {
    return new Promise((resolve, reject) => {
      const job: WriterJob = { fn, args, priority: opts.priority ?? false, holdKey: opts.holdKey, resolve, reject, attempts: 0, label: opts.label };
      if (job.priority) {
        // Insert after the last existing job sharing this holdKey (if any),
        // otherwise at the front -- so a TAMPER never jumps ahead of an
        // in-flight/queued sealShipment for the SAME order.
        let insertAt = 0;
        for (let i = this.queue.length - 1; i >= 0; i--) {
          if (this.queue[i]!.holdKey === job.holdKey) {
            insertAt = i + 1;
            break;
          }
        }
        this.queue.splice(insertAt, 0, job);
      } else {
        this.queue.push(job);
      }
      void this.pump();
    });
  }

  /** Exactly the five ORACLE functions. No other contract call is reachable
   * through this class. */
  sealShipment(orderId: number, boxId: string, courier: string, baselineHash: string): Promise<ethers.TransactionReceipt> {
    return this.enqueue("sealShipment", [orderId, boxId, courier, baselineHash], { holdKey: `order:${orderId}`, label: `sealShipment(${orderId})` });
  }

  reportTamper(orderId: number, code: number, evidenceHash: string): Promise<ethers.TransactionReceipt> {
    return this.enqueue("reportTamper", [orderId, code, evidenceHash], {
      priority: true,
      holdKey: `order:${orderId}`,
      label: `reportTamper(${orderId}, code=${code})`,
    });
  }

  confirmDelivery(orderId: number, logHead: string, lat: number, lon: number, gpsFix: boolean): Promise<ethers.TransactionReceipt> {
    return this.enqueue("confirmDelivery", [orderId, logHead, lat, lon, gpsFix], {
      holdKey: `order:${orderId}`,
      label: `confirmDelivery(${orderId})`,
    });
  }

  anchor(orderId: number, seq: number, head: string, count: number): Promise<ethers.TransactionReceipt> {
    return this.enqueue("anchor", [orderId, seq, head, count], { holdKey: `anchor:${orderId}`, label: `anchor(${orderId}, seq=${seq})` });
  }

  logAlert(orderId: number, code: number, evidenceHash: string): Promise<ethers.TransactionReceipt> {
    return this.enqueue("logAlert", [orderId, code, evidenceHash], { holdKey: `alert:${orderId}:${code}`, label: `logAlert(${orderId}, code=${code})` });
  }

  /** Drops any queued (not yet in-flight) anchor job for an order, keeping
   * at most one pending -- a duplicate anchor call reverts StaleSeq
   * (permanent), so we coalesce rather than let them pile up. */
  dropPendingAnchor(orderId: number): void {
    // Note: an in-flight job has already been shifted out of `this.queue`
    // (see pump()), so this only ever removes not-yet-started duplicates.
    this.queue = this.queue.filter((j) => !(j.fn === "anchor" && j.holdKey === `anchor:${orderId}`));
  }

  private contractFor(fn: WriterFn): ethers.Contract {
    return fn === "anchor" || fn === "logAlert" ? this.ctx.anchor : this.ctx.escrow;
  }

  private async pump(): Promise<void> {
    if (this.inFlight) return;
    const job = this.queue.shift();
    if (!job) return;
    this.inFlight = true;
    try {
      await this.run(job);
    } finally {
      this.inFlight = false;
      void this.pump();
    }
  }

  private async run(job: WriterJob): Promise<void> {
    const contract = this.contractFor(job.fn);
    this.sse.emit("tx", { stage: "submitted", label: job.label, fn: job.fn } satisfies TxEvent);
    try {
      const nonce = this.nonce!;
      const overrides: Record<string, unknown> = { nonce };
      if (this.useLegacy) {
        overrides.type = 0;
        overrides.gasPrice = await this.legacyGasPrice();
      }
      const tx: ethers.TransactionResponse = await (contract[job.fn] as (...a: unknown[]) => Promise<ethers.TransactionResponse>)(
        ...job.args,
        overrides,
      );
      this.nonce = nonce + 1; // only advance once the node accepted the tx
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        throw Object.assign(new Error("transaction reverted on-chain"), { code: "CALL_EXCEPTION" });
      }
      this.sse.emit("tx", {
        stage: "confirmed",
        label: job.label,
        fn: job.fn,
        hash: tx.hash,
        explorerUrl: explorerTxUrl(this.ctx.chain, tx.hash),
      } satisfies TxEvent);
      job.resolve(receipt);
    } catch (err) {
      const classification = classifyRevert(this.ctx, err);
      if (classification.kind === "transient" && job.attempts < MAX_RETRIES) {
        job.attempts += 1;
        // Fee-estimation failures fall back to a legacy transaction; nonce
        // errors re-sync from the chain rather than trusting our local count.
        const code = (err as { code?: string })?.code;
        if (code === "UNPREDICTABLE_GAS_LIMIT" || code === "SERVER_ERROR") this.useLegacy = true;
        if (code === "NONCE_EXPIRED" || code === "REPLACEMENT_UNDERPRICED") {
          this.nonce = await this.ctx.provider.getTransactionCount(this.ctx.signerAddress, "pending");
        }
        this.queue.unshift(job); // retry next, ahead of later-queued jobs
        this.sse.emit("tx", { stage: "failed", label: job.label, fn: job.fn, error: String((err as Error).message ?? err), permanent: false } satisfies TxEvent);
        return;
      }
      this.sse.emit("tx", {
        stage: "failed",
        label: job.label,
        fn: job.fn,
        error: String((err as Error).message ?? err),
        permanent: true,
        decodedError: classification.kind === "permanent" ? classification.decoded : undefined,
      } satisfies TxEvent);
      job.reject(err);
    }
  }

  private async legacyGasPrice(): Promise<bigint> {
    const feeData = await this.ctx.provider.getFeeData();
    return feeData.gasPrice ?? ethers.parseUnits("10", "gwei");
  }
}
