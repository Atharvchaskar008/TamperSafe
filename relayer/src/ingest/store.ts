// data/<box_id>.jsonl: the append-only, off-chain, verifiable event log.
// ARCHITECTURE.md §10 "Rebuild in-memory state at startup": for every known
// box, last-seen seq/head come from this file, not from nothing.
import fs from "node:fs";
import path from "node:path";
import { GENESIS_HEAD } from "../protocol.js";
import type { BoxIngestState, StoredEvent } from "./types.js";

export class BoxLogStore {
  constructor(private readonly dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  private filePath(boxId: string): string {
    // box ids are strings like "TS-BOX-01"; safe as a filename as-is, but
    // guard against path traversal from a malformed box_id on the wire.
    const safe = boxId.replace(/[^A-Za-z0-9_-]/g, "_");
    return path.join(this.dataDir, `${safe}.jsonl`);
  }

  append(boxId: string, events: StoredEvent[]): void {
    if (events.length === 0) return;
    const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.appendFileSync(this.filePath(boxId), lines, "utf8");
  }

  /** Rebuilds a box's trusted ingest state from its jsonl file. Returns a
   * fresh first-contact state (lastSeq 0, genesis head) if the file doesn't
   * exist yet. */
  rebuild(boxId: string): BoxIngestState {
    const file = this.filePath(boxId);
    if (!fs.existsSync(file)) {
      return { boxId, lastSeq: 0, lastHead: GENESIS_HEAD, seenSeq1Heads: new Set() };
    }
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { boxId, lastSeq: 0, lastHead: GENESIS_HEAD, seenSeq1Heads: new Set() };
    }
    let lastSeq = 0;
    let lastHead = GENESIS_HEAD;
    const seenSeq1Heads = new Set<string>();
    for (const line of lines) {
      const record = JSON.parse(line) as StoredEvent;
      lastSeq = record.seq;
      lastHead = record.head;
      if (record.seq === 1) seenSeq1Heads.add(record.head); // every epoch's marker, not just the latest
    }
    return { boxId, lastSeq, lastHead, seenSeq1Heads };
  }

  /** Lists box_ids that have a jsonl file on disk, for startup rebuild of
   * every known box (not just ones a request happens to touch first). */
  listBoxIds(): string[] {
    if (!fs.existsSync(this.dataDir)) return [];
    return fs
      .readdirSync(this.dataDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.slice(0, -".jsonl".length));
  }

  readAll(boxId: string): StoredEvent[] {
    const file = this.filePath(boxId);
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as StoredEvent);
  }
}
