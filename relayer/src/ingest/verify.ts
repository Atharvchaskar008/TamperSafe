// Pure ingest verification: schema -> MAC -> dedup/mismatch/gap classification,
// per docs/ARCHITECTURE.md §9.2 and §10. Pure so the negative tests (a
// tampered middle-of-batch field must be caught even though the outer MAC
// only covers the last event) are plain unit tests with no server, no disk.
//
// The one rule everything here serves: NEVER use a wire-claimed "head" field
// as the input to the next hash. Every head we treat as real is one we
// derived ourselves from computeHead(ourRunningPrevHead, canon). The one
// deliberate exception is the first event of a genuine gap, where we have no
// way to know the true prevHead at all (see "gap" handling below) -- there we
// trust that one claimed head as the new basis and say so via LOG_GAP.
import { buildCanon, computeHead, computeMac, GENESIS_HEAD, type CanonicalEventFields } from "../protocol.js";
import type { BoxIngestState, IngestOutcome, StoredEvent, WireBatch, WireEvent } from "./types.js";

const HEX64 = /^[0-9a-f]{64}$/;

function schemaError(msg: string): IngestOutcome {
  return { ok: false, status: 400, body: { ok: false, error: `schema: ${msg}` } };
}

function validateSchema(batch: unknown): batch is WireBatch {
  if (typeof batch !== "object" || batch === null) return false;
  const b = batch as Record<string, unknown>;
  if (typeof b.box_id !== "string" || b.box_id.length === 0) return false;
  if (typeof b.mac !== "string" || !HEX64.test(b.mac)) return false;
  if (!Array.isArray(b.events) || b.events.length === 0) return false;
  for (const e of b.events) {
    if (typeof e !== "object" || e === null) return false;
    const ev = e as Record<string, unknown>;
    if (typeof ev.head !== "string" || !HEX64.test(ev.head)) return false;
    if (typeof ev.seq !== "number" || !Number.isInteger(ev.seq) || ev.seq < 1) return false;
    // Remaining canonical fields are validated by buildCanon() below, which
    // throws with a precise field name -- caught by the caller.
  }
  return true;
}

interface WalkedEvent {
  event: WireEvent;
  recomputedHead: string;
}

/** box_id is sent once per batch, not per event (§9.1: "threaded in
 * separately by the caller since it is shared across a whole batch, but it
 * is still part of the canon"). This reattaches it before hashing. */
function toCanonical(boxId: string, event: WireEvent): CanonicalEventFields {
  const { head: _head, ...fields } = event;
  return { box_id: boxId, ...fields };
}

/** Recomputes the head chain for a run of (assumed-new) events, in order,
 * starting from `prevHead`. Never reads any event's claimed head as input. */
function walkChain(boxId: string, events: WireEvent[], startPrevHead: string): WalkedEvent[] {
  const out: WalkedEvent[] = [];
  let prevHead = startPrevHead;
  for (const event of events) {
    const canon = buildCanon(toCanonical(boxId, event));
    const recomputedHead = computeHead(prevHead, canon);
    out.push({ event, recomputedHead });
    prevHead = recomputedHead;
  }
  return out;
}

export interface VerifyDeps {
  secretHex: string;
  now?: () => number;
}

/**
 * Verifies one batch against the box's currently-trusted state and returns
 * either the accepted events (ready to append) or a rejection. Does not
 * mutate `state` -- the caller commits `newState` only after a successful
 * append (see ingest/pipeline.ts).
 */
export function verifyBatch(state: BoxIngestState, rawBatch: unknown, deps: VerifyDeps): IngestOutcome {
  if (!validateSchema(rawBatch)) return schemaError("malformed device event batch");
  const batch = rawBatch as WireBatch;
  if (batch.box_id !== state.boxId) return schemaError(`box_id mismatch: expected ${state.boxId}`);

  // Sort defensively by seq -- firmware sends ascending, but don't assume.
  const events = [...batch.events].sort((a, b) => a.seq - b.seq);
  const lastSeqInBatch = events[events.length - 1]!.seq;

  let candidateState = state;
  let reprovisioned = false;

  // --- Box re-provisioning (§10) -------------------------------------
  // A batch restarting at seq==1 is only a re-provision if it is genuinely a
  // NEVER-BEFORE-SEEN chain (its recomputed seq=1 head doesn't match any
  // epoch marker we've ever recorded for this box -- not just the latest
  // one). Checking only the latest marker would close the replay hole for
  // "replay the current epoch's own first batch" but leave it open for
  // "replay an OLDER genuine epoch's first batch", which is still a valid
  // MAC (it's real captured traffic) and would otherwise roll trust
  // backwards to that stale epoch.
  const firstEventOverall = events[0]!;
  if (firstEventOverall.seq === 1 && state.lastSeq > 0) {
    let candidateCanon: string;
    try {
      candidateCanon = buildCanon(toCanonical(batch.box_id, firstEventOverall));
    } catch (err) {
      return schemaError((err as Error).message);
    }
    const candidateHead1 = computeHead(GENESIS_HEAD, candidateCanon);
    if (!state.seenSeq1Heads.has(candidateHead1)) {
      reprovisioned = true;
      candidateState = { boxId: state.boxId, lastSeq: 0, lastHead: GENESIS_HEAD, seenSeq1Heads: state.seenSeq1Heads };
    }
  }

  // --- Partition into already-known (dup) vs genuinely new events -----
  const dupEvents = events.filter((e) => e.seq <= candidateState.lastSeq);
  const newEvents = events.filter((e) => e.seq > candidateState.lastSeq);

  // Dup events are dropped without re-verification against our history (we
  // don't keep a per-seq head map in memory), but we still schema-validate
  // their fields so garbage can't hide behind "it's just a duplicate".
  for (const e of dupEvents) {
    try {
      buildCanon(toCanonical(batch.box_id, e));
    } catch (err) {
      return schemaError((err as Error).message);
    }
  }

  let walkedNew: WalkedEvent[] = [];
  let finalRecomputedHead: string;
  let gap = false;

  if (newEvents.length === 0) {
    // Entire batch is a resend of history we've already committed.
    finalRecomputedHead = candidateState.lastHead;
  } else {
    const first = newEvents[0]!;
    if (first.seq === candidateState.lastSeq + 1) {
      try {
        walkedNew = walkChain(batch.box_id, newEvents, candidateState.lastHead);
      } catch (err) {
        return schemaError((err as Error).message);
      }
    } else {
      // Genuine gap: we have no way to know the true prevHead for the
      // missing events (ring buffer overrun, or a fresh relayer that lost
      // this box's jsonl). Trust this one claimed head as the new basis.
      gap = true;
      try {
        buildCanon(toCanonical(batch.box_id, first)); // schema-validate even though untrusted for hashing
      } catch (err) {
        return schemaError((err as Error).message);
      }
      const trustedHead: WalkedEvent = { event: first, recomputedHead: first.head };
      let rest: WalkedEvent[];
      try {
        rest = walkChain(batch.box_id, newEvents.slice(1), first.head);
      } catch (err) {
        return schemaError((err as Error).message);
      }
      walkedNew = [trustedHead, ...rest];
    }
    finalRecomputedHead = walkedNew[walkedNew.length - 1]!.recomputedHead;
  }

  // Flag (but don't specially trust) any seq discontinuity *within* the new
  // events too, e.g. batch = [7, 9] with lastSeq=6 -- still hash-chained
  // normally (we do know the true prevHead at each step here), just also
  // worth a LOG_GAP.
  for (let i = 1; i < newEvents.length; i++) {
    if (newEvents[i]!.seq !== newEvents[i - 1]!.seq + 1) gap = true;
  }

  // --- MAC check (401) -------------------------------------------------
  const expectedMac = computeMac(deps.secretHex, batch.box_id, lastSeqInBatch, finalRecomputedHead);
  if (expectedMac !== batch.mac) {
    return { ok: false, status: 401, body: { ok: false, error: "mac mismatch" } };
  }

  // --- Mismatched-head forgery check (409) ------------------------------
  // Skip index 0 when it was the trusted gap basis (comparing it to itself
  // is meaningless -- we deliberately accepted its claim as truth there).
  const checkFrom = gap && newEvents[0] === walkedNew[0]?.event ? 1 : 0;
  for (let i = checkFrom; i < walkedNew.length; i++) {
    const w = walkedNew[i]!;
    if (w.recomputedHead !== w.event.head) {
      return {
        ok: false,
        status: 409,
        body: { ok: false, error: `mismatched head at seq ${w.event.seq}`, expected_seq: candidateState.lastSeq + 1 },
      };
    }
  }

  // --- Accept ------------------------------------------------------------
  const now = deps.now ?? (() => Date.now());
  const accepted: StoredEvent[] = walkedNew.map((w) => ({
    ...toCanonical(batch.box_id, w.event),
    head: w.recomputedHead,
    received_at: now(),
  }));

  let lastSeq = candidateState.lastSeq;
  let lastHead = candidateState.lastHead;
  const seenSeq1Heads = new Set(candidateState.seenSeq1Heads);
  for (const w of walkedNew) {
    lastSeq = w.event.seq;
    lastHead = w.recomputedHead;
    if (w.event.seq === 1) seenSeq1Heads.add(w.recomputedHead);
  }

  const newState: BoxIngestState = { boxId: state.boxId, lastSeq, lastHead, seenSeq1Heads };
  return { ok: true, ackSeq: lastSeqInBatch, accepted, gap, reprovisioned, newState };
}
