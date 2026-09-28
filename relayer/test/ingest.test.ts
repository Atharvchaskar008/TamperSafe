// Ingest pipeline negative tests, per the M3 build brief: "take a valid
// batch, flip one field in a middle event, confirm ingest rejects it even
// though the outer MAC (computed over the last event) is unchanged." Also
// covers dedup, gap/rebase, the 409 mismatch path, box re-provisioning, and
// the re-provisioning "replay hole" guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readFileSync } from "node:fs";
import { buildCanon, computeHead, computeMac, GENESIS_HEAD, type CanonicalEventFields } from "../src/protocol.js";
import { verifyBatch } from "../src/ingest/verify.js";
import type { BoxIngestState, WireEvent } from "../src/ingest/types.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url), "utf8"));
const SECRET = vectors.box_secret_hex as string;
const BOX_ID = vectors.box_id as string;

function freshState(): BoxIngestState {
  return { boxId: BOX_ID, lastSeq: 0, lastHead: GENESIS_HEAD, seenSeq1Heads: new Set() };
}

/** Rebuilds the exact 3-event wire batch from vectors.json (fields + the
 * device's claimed head, i.e. exactly what would arrive over HTTP). */
function vectorBatch() {
  const events: WireEvent[] = vectors.events.map((e: Record<string, unknown>) => ({
    seq: e.seq,
    ts: e.ts,
    type: e.type,
    state: e.state,
    order_id: e.order_id,
    lat_e6: e.lat_e6,
    lon_e6: e.lon_e6,
    fix: e.fix,
    dist_mm: e.dist_mm,
    lid: e.lid,
    accel_mg: e.accel_mg,
    tilt_deg: e.tilt_deg,
    lock: e.lock,
    batt_mv: e.batt_mv,
    code: e.code,
    cmd_id: e.cmd_id,
    head: e.head,
  }));
  return { box_id: BOX_ID, events, mac: vectors.batch.mac as string };
}

test("happy path: fresh box accepts the full 3-event vectors batch", () => {
  const outcome = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.ackSeq, 3);
  assert.equal(outcome.accepted.length, 3);
  assert.equal(outcome.gap, false);
  assert.equal(outcome.reprovisioned, false);
  assert.equal(outcome.newState.lastSeq, 3);
  assert.equal(outcome.newState.lastHead, vectors.events[2].head);
});

test("duplicate resend of a fully-committed batch is dropped and acked, not re-verified", () => {
  const first = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = verifyBatch(first.newState, vectorBatch(), { secretHex: SECRET });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.ackSeq, 3);
  assert.equal(second.accepted.length, 0, "fully-duplicate batch appends nothing");
});

test("duplicate resend of an OLDER (not most-recent) window MACs against the head AT that window, not the current head", () => {
  const first = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.newState.lastSeq, 3, "sanity: box committed up through seq 3");

  // The box resends its first window ([1, 2]) -- e.g. it never saw the
  // relayer's ack for that batch and retried before also sending seq 3.
  // Its MAC covers seq=2's head (vectors.events[1]), NOT the box's current
  // lastHead (seq=3's head) -- a naive "always MAC against candidateState.
  // lastHead" implementation would reject this as a MAC mismatch (401)
  // even though it's a perfectly legitimate resend per §9.2 rule 3.
  const batch = vectorBatch();
  const resend = { ...batch, events: batch.events.slice(0, 2), mac: vectors.events[1].mac };
  const headAt = (seq: number) => vectors.events.find((e: { seq: number; head: string }) => e.seq === seq)?.head;
  const outcome = verifyBatch(first.newState, resend, { secretHex: SECRET, headAt });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.accepted.length, 0, "both events are duplicates of already-committed history");
  assert.equal(outcome.newState.lastSeq, 3, "state must be unchanged by a pure duplicate resend");
});

test("a seq gap (ring buffer overrun) is accepted, rebased, and flagged", () => {
  const first = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const fields: CanonicalEventFields = {
    box_id: BOX_ID,
    seq: 10,
    ts: 1790582500,
    type: "TELEMETRY",
    state: "SEALED",
    order_id: 3,
    lat_e6: -12971600,
    lon_e6: 77594600,
    fix: 1,
    dist_mm: 84,
    lid: 0,
    accel_mg: 1010,
    tilt_deg: 1,
    lock: "L",
    batt_mv: 11700,
    code: 0,
    cmd_id: "",
  };
  // The box's own claimed head is trusted as the rebase point -- it's
  // self-consistent by construction here (a real box would compute it the
  // same way from its own persisted NVS chain, which we can't see across
  // the gap).
  const claimedHead = computeHead(GENESIS_HEAD, buildCanon(fields)); // any consistent value works for the test
  const event: WireEvent = { ...fields, head: claimedHead };
  const mac = computeMac(SECRET, BOX_ID, 10, claimedHead);
  const outcome = verifyBatch(first.newState, { box_id: BOX_ID, events: [event], mac }, { secretHex: SECRET });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.gap, true);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.newState.lastSeq, 10);
  assert.equal(outcome.newState.lastHead, claimedHead);
});

test("a mismatched claimed head at the first new event is rejected as forgery (409)", () => {
  // Recomputation never uses a claimed `head` field as input to the chain
  // (only genesis/our own prior recomputed head does) -- so corrupting
  // event 1's claimed head alone does not change the true recomputed final
  // head, and the ORIGINAL batch MAC (which authenticates that true final
  // head) still validates. This isolates the per-event mismatch check (409)
  // from the MAC check (401): the MAC passes, but event 1's own claim does not.
  const batch = vectorBatch();
  const corrupted = {
    ...batch,
    events: batch.events.map((e, i) => (i === 0 ? { ...e, head: "f".repeat(64) } : e)),
    // mac left exactly as-is -- it authenticates the true (unaffected) final head.
  };
  const outcome = verifyBatch(freshState(), corrupted, { secretHex: SECRET });
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.status, 409);
  if (outcome.status === 409) assert.equal(outcome.body.expected_seq, 1);
});

test("middle-of-batch tamper (field flipped, head left stale) is rejected even though the batch MAC is untouched", () => {
  const batch = vectorBatch();
  // Flip event 2's tilt_deg but leave its claimed `head` exactly as it was
  // in the genuine batch -- and leave the outer batch.mac exactly as it was
  // too (this is the scenario the build brief calls out explicitly).
  const tampered = {
    ...batch,
    events: batch.events.map((e, i) => (i === 1 ? { ...e, tilt_deg: e.tilt_deg + 1 } : e)),
  };
  const outcome = verifyBatch(freshState(), tampered, { secretHex: SECRET });
  assert.equal(outcome.ok, false, "a middle-event field flip must be caught by re-deriving the hash chain");
});

test("middle-of-batch tamper variant 2: the flipped event's own head is recomputed consistently, but the next event's is not -- still rejected", () => {
  const batch = vectorBatch();
  const event1 = batch.events[0]!;
  const flippedEvent2Fields = { ...event1_asEvent2Fields(batch), tilt_deg: (batch.events[1]!.tilt_deg as number) + 1 };
  const selfConsistentHead2 = computeHead(event1.head, buildCanon(flippedEvent2Fields as unknown as CanonicalEventFields));
  const tampered = {
    ...batch,
    events: [event1, { ...flippedEvent2Fields, head: selfConsistentHead2 } as WireEvent, batch.events[2]!],
    // mac left as the ORIGINAL batch mac -- the attacker has no secret to
    // compute a new one for the new (different) final head this implies.
  };
  const outcome = verifyBatch(freshState(), tampered, { secretHex: SECRET });
  assert.equal(outcome.ok, false, "a locally self-consistent middle flip must still be caught by the next event / final MAC");

  function event1_asEvent2Fields(b: typeof batch): CanonicalEventFields {
    // Reuse event 2's real fields as the base (minus its claimed head),
    // only tilt_deg is flipped above.
    const { head: _h, ...rest } = b.events[1]!;
    return { box_id: BOX_ID, ...rest };
  }
});

test("box re-provisioning: a genuinely new chain from genesis rebases trust and is flagged", () => {
  const first = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const newEpochFields: CanonicalEventFields = {
    box_id: BOX_ID,
    seq: 1,
    ts: 0,
    type: "BOOT",
    state: "IDLE",
    order_id: 0,
    lat_e6: 0,
    lon_e6: 0,
    fix: 0,
    dist_mm: 0,
    lid: 1,
    accel_mg: 999, // different content -> different head1 than epoch 1's
    tilt_deg: 0,
    lock: "U",
    batt_mv: 12000,
    code: 0,
    cmd_id: "",
  };
  const head1 = computeHead(GENESIS_HEAD, buildCanon(newEpochFields));
  const event: WireEvent = { ...newEpochFields, head: head1 };
  const mac = computeMac(SECRET, BOX_ID, 1, head1);
  const outcome = verifyBatch(first.newState, { box_id: BOX_ID, events: [event], mac }, { secretHex: SECRET });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.reprovisioned, true);
  assert.equal(outcome.newState.lastSeq, 1);
  assert.equal(outcome.newState.lastHead, head1);
  assert.ok(outcome.newState.seenSeq1Heads.has(head1));
  assert.ok(outcome.newState.seenSeq1Heads.has(vectors.events[0].head), "epoch 1's marker must still be remembered");
});

test("replay hole: replaying an OLDER genuine epoch's first batch after a re-provision is a duplicate, not another re-provision", () => {
  const epoch1 = verifyBatch(freshState(), vectorBatch(), { secretHex: SECRET });
  assert.equal(epoch1.ok, true);
  if (!epoch1.ok) return;

  const newEpochFields: CanonicalEventFields = {
    box_id: BOX_ID,
    seq: 1,
    ts: 0,
    type: "BOOT",
    state: "IDLE",
    order_id: 0,
    lat_e6: 0,
    lon_e6: 0,
    fix: 0,
    dist_mm: 0,
    lid: 1,
    accel_mg: 999,
    tilt_deg: 0,
    lock: "U",
    batt_mv: 12000,
    code: 0,
    cmd_id: "",
  };
  const head1Epoch2 = computeHead(GENESIS_HEAD, buildCanon(newEpochFields));
  const epoch2 = verifyBatch(
    epoch1.newState,
    { box_id: BOX_ID, events: [{ ...newEpochFields, head: head1Epoch2 }], mac: computeMac(SECRET, BOX_ID, 1, head1Epoch2) },
    { secretHex: SECRET },
  );
  assert.equal(epoch2.ok, true);
  if (!epoch2.ok) return;
  assert.equal(epoch2.reprovisioned, true);

  // Now replay epoch 1's real, original seq=1 batch verbatim (its own
  // per-event mac from vectors.json, "as if a batch ended at that event").
  const replayedEvent: WireEvent = {
    seq: vectors.events[0].seq,
    ts: vectors.events[0].ts,
    type: vectors.events[0].type,
    state: vectors.events[0].state,
    order_id: vectors.events[0].order_id,
    lat_e6: vectors.events[0].lat_e6,
    lon_e6: vectors.events[0].lon_e6,
    fix: vectors.events[0].fix,
    dist_mm: vectors.events[0].dist_mm,
    lid: vectors.events[0].lid,
    accel_mg: vectors.events[0].accel_mg,
    tilt_deg: vectors.events[0].tilt_deg,
    lock: vectors.events[0].lock,
    batt_mv: vectors.events[0].batt_mv,
    code: vectors.events[0].code,
    cmd_id: vectors.events[0].cmd_id,
    head: vectors.events[0].head,
  };
  const replay = verifyBatch(
    epoch2.newState,
    { box_id: BOX_ID, events: [replayedEvent], mac: vectors.events[0].mac },
    { secretHex: SECRET },
  );
  // The key safety property: this must NEVER be treated as a re-provision
  // (which would roll the relayer's trusted head backwards to epoch 1).
  // Because epoch 1's marker is already in seenSeq1Heads, the batch is
  // classified as a duplicate of seq 1 <= epoch 2's lastSeq (=1) -- and
  // since a genuine duplicate's MAC is checked against our CURRENT head
  // (epoch 2's), not the stale replayed one, it is correctly rejected
  // outright (401) rather than silently accepted. Either way, epoch 2's
  // state must be left completely untouched.
  assert.equal(replay.ok, false, "a replayed old epoch's real batch must not be silently accepted");
  if (replay.ok) return;
  assert.equal(replay.status, 401);
});

test.after(() => {
  // no filesystem state used by these tests -- nothing to clean up. Kept as
  // an explicit no-op so a future disk-backed extension of this suite has
  // an obvious place to add teardown.
  void fs;
});
