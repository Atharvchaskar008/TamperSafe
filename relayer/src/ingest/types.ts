import type { CanonicalEventFields } from "../protocol.js";

/** One event exactly as it arrives on the wire in a POST /api/device/events
 * batch: the canonical fields (minus box_id, which is only sent once per
 * batch -- see protocol.ts's note that the caller threads it in) plus the
 * device's own claimed "head". Per ARCHITECTURE.md §10 this claimed head is
 * never trusted as an input to the next computation -- it is only ever
 * compared against what we recompute. */
export type WireEvent = Omit<CanonicalEventFields, "box_id"> & { head: string };

export interface WireBatch {
  box_id: string;
  events: WireEvent[];
  mac: string;
}

/** Per-box ingest state the relayer trusts, rebuilt at startup from
 * data/<box_id>.jsonl (ARCHITECTURE.md §10 "Rebuild in-memory state"). */
export interface BoxIngestState {
  boxId: string;
  lastSeq: number; // 0 = no history yet
  lastHead: string; // GENESIS_HEAD when lastSeq === 0
  /** Every head we have ever recorded for a seq === 1 event, across every
   * epoch this box has ever had (not just the current one). A replayed seq=1
   * batch matching ANY entry here is a duplicate, not a re-provision -- this
   * is what closes the "replay an old genuine epoch's first batch" hole: a
   * single "current epoch marker" would only catch a replay of the *latest*
   * epoch, not an older one (ARCHITECTURE.md §10 "Box re-provisioning"). */
  seenSeq1Heads: ReadonlySet<string>;
}

/** One line of data/<box_id>.jsonl: a verified, accepted event, with the
 * head this relayer computed for it (never the device's claimed head). */
export interface StoredEvent extends CanonicalEventFields {
  head: string;
  received_at: number; // unix ms, relayer clock
}

export type IngestOutcome =
  | { ok: true; ackSeq: number; accepted: StoredEvent[]; gap: boolean; reprovisioned: boolean; newState: BoxIngestState }
  | { ok: false; status: 400; body: { ok: false; error: string } }
  | { ok: false; status: 401; body: { ok: false; error: string } }
  | { ok: false; status: 409; body: { ok: false; error: string; expected_seq: number } };
