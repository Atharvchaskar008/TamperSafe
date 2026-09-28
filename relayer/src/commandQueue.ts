// The relayer -> box command queue: one pending command slot per box.
// Persisted to disk (cmd_id -> {orderId, courierAddress, boxId}) so a
// restart mid-seal doesn't lose track of which courier a pending SEAL was
// locking a bond for. See docs/ARCHITECTURE.md §10 "Command queue".
import fs from "node:fs";
import path from "node:path";

export type CommandType = "SEAL" | "UNLOCK" | "RESET";

export interface PendingCommand {
  cmdId: string;
  type: CommandType;
  boxId: string;
  orderId: number;
  courierAddress?: string;
  /** Set on the seal-abort UNLOCK (sealShipment failed permanently after the
   * box already reported SEALED): this command must survive the order
   * reaching/staying terminal, because there is no on-chain seal to have
   * ever gone terminal against -- the box is just physically locked with
   * nothing backing it. See ARCHITECTURE.md §10 "Seal abort". */
  exemptFromTerminalCancel?: boolean;
}

export class CommandQueue {
  private byBox = new Map<string, PendingCommand>();
  private cmdCounter = 0;
  private readonly file: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, "commands.json");
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.file)) return;
    const raw = JSON.parse(fs.readFileSync(this.file, "utf8")) as Record<string, PendingCommand>;
    for (const cmd of Object.values(raw)) {
      this.byBox.set(cmd.boxId, cmd);
      const n = Number(cmd.cmdId.replace(/^cmd-/, ""));
      if (Number.isFinite(n) && n > this.cmdCounter) this.cmdCounter = n;
    }
  }

  private persist(): void {
    const out: Record<string, PendingCommand> = {};
    for (const cmd of this.byBox.values()) out[cmd.cmdId] = cmd;
    fs.writeFileSync(this.file, JSON.stringify(out, null, 2), "utf8");
  }

  private nextCmdId(): string {
    this.cmdCounter += 1;
    return `cmd-${this.cmdCounter}`;
  }

  queueSeal(boxId: string, orderId: number, courierAddress: string): PendingCommand {
    const cmd: PendingCommand = { cmdId: this.nextCmdId(), type: "SEAL", boxId, orderId, courierAddress };
    this.byBox.set(boxId, cmd);
    this.persist();
    return cmd;
  }

  queueUnlock(boxId: string, orderId: number, opts?: { exemptFromTerminalCancel?: boolean }): PendingCommand {
    const cmd: PendingCommand = { cmdId: this.nextCmdId(), type: "UNLOCK", boxId, orderId, exemptFromTerminalCancel: opts?.exemptFromTerminalCancel };
    this.byBox.set(boxId, cmd);
    this.persist();
    return cmd;
  }

  /** RESET supersedes any other pending command for the box -- a box stuck
   * TAMPERED ignores UNLOCK entirely, so UNLOCK must never block RESET from
   * reaching the single command slot. */
  queueReset(boxId: string, orderId: number): PendingCommand {
    const cmd: PendingCommand = { cmdId: this.nextCmdId(), type: "RESET", boxId, orderId };
    this.byBox.set(boxId, cmd);
    this.persist();
    return cmd;
  }

  getForBox(boxId: string): PendingCommand | undefined {
    return this.byBox.get(boxId);
  }

  /** Acks and clears a box's pending command once the device confirms it
   * (matching cmd_id on SEALED / SEAL_FAILED / UNLOCKED / RESET_DONE). */
  clearIfMatches(boxId: string, cmdId: string): PendingCommand | undefined {
    const cur = this.byBox.get(boxId);
    if (cur && cur.cmdId === cmdId) {
      this.byBox.delete(boxId);
      this.persist();
      return cur;
    }
    return undefined;
  }

  /** Cancels any pending command still queued for a box whose order just
   * reached a terminal status -- a stale SEAL or UNLOCK must never fire
   * against a resolved order. Exempts the seal-abort UNLOCK (see above). */
  cancelForOrder(orderId: number): void {
    for (const [boxId, cmd] of this.byBox.entries()) {
      if (cmd.orderId === orderId && !cmd.exemptFromTerminalCancel) {
        this.byBox.delete(boxId);
      }
    }
    this.persist();
  }
}
