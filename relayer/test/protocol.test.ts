// Proves relayer/test/vectors.json is internally consistent with
// relayer/src/protocol.ts: recomputes every canon, head and mac from the
// raw field values in the vectors file and asserts they match the file's
// own recorded values. Firmware's boot self-test does the same
// recomputation independently in C++ against the same file.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanon,
  computeHead,
  computeMac,
  decodeBoxSecret,
  GENESIS_HEAD,
  type CanonicalEventFields,
} from "../src/protocol.ts";

const vectorsPath = fileURLToPath(new URL("./vectors.json", import.meta.url));
const vectors = JSON.parse(readFileSync(vectorsPath, "utf8"));

test("genesis head is 64 lowercase '0' chars, matching the protocol module's constant", () => {
  assert.equal(vectors.genesis_head, GENESIS_HEAD);
  assert.equal(vectors.events[0].prev_head, GENESIS_HEAD);
});

test("box secret decodes to exactly 32 raw bytes", () => {
  const key = decodeBoxSecret(vectors.box_secret_hex);
  assert.equal(key.length, 32);
});

test("each event's canon, hash_input and head match the protocol module's output", () => {
  let prevHead = vectors.genesis_head as string;

  for (const [i, event] of vectors.events.entries()) {
    const fields: CanonicalEventFields = {
      box_id: vectors.box_id,
      seq: event.seq,
      ts: event.ts,
      type: event.type,
      state: event.state,
      order_id: event.order_id,
      lat_e6: event.lat_e6,
      lon_e6: event.lon_e6,
      fix: event.fix,
      dist_mm: event.dist_mm,
      lid: event.lid,
      accel_mg: event.accel_mg,
      tilt_deg: event.tilt_deg,
      lock: event.lock,
      batt_mv: event.batt_mv,
      code: event.code,
      cmd_id: event.cmd_id,
    };

    const canon = buildCanon(fields);
    assert.equal(canon, event.canon, `event ${i + 1}: canon mismatch`);

    assert.equal(event.prev_head, prevHead, `event ${i + 1}: prev_head does not chain from the previous event's head`);
    assert.equal(
      event.hash_input,
      event.prev_head + "|" + event.canon,
      `event ${i + 1}: hash_input does not equal prev_head + "|" + canon`,
    );

    const head = computeHead(prevHead, canon);
    assert.equal(head, event.head, `event ${i + 1}: head mismatch`);
    assert.match(head, /^[0-9a-f]{64}$/, `event ${i + 1}: head is not 64 lowercase hex chars`);

    prevHead = head;
  }
});

test("each event's per-event mac (batch ending at that event) matches the protocol module's output", () => {
  for (const [i, event] of vectors.events.entries()) {
    assert.equal(
      event.mac_input,
      `${vectors.box_id}|${event.seq}|${event.head}`,
      `event ${i + 1}: mac_input does not equal box_id|seq|head`,
    );
    const mac = computeMac(vectors.box_secret_hex, vectors.box_id, event.seq, event.head);
    assert.equal(mac, event.mac, `event ${i + 1}: mac mismatch`);
    assert.match(mac, /^[0-9a-f]{64}$/, `event ${i + 1}: mac is not 64 lowercase hex chars`);
  }
});

test("top-level batch MAC equals the last event's mac (one POST covering all 3 events)", () => {
  const lastEvent = vectors.events[vectors.events.length - 1];
  assert.equal(vectors.batch.last_seq, lastEvent.seq);
  assert.equal(vectors.batch.last_head, lastEvent.head);
  assert.equal(vectors.batch.mac_input, lastEvent.mac_input);
  assert.equal(vectors.batch.mac, lastEvent.mac);

  const mac = computeMac(vectors.box_secret_hex, vectors.box_id, vectors.batch.last_seq, vectors.batch.last_head);
  assert.equal(mac, vectors.batch.mac);
});

test("keying the HMAC with the ASCII hex string instead of decoded bytes gives a DIFFERENT mac", async () => {
  // This proves the test actually detects the §9.1 raw-bytes-vs-hex-string
  // bug, rather than passing vacuously regardless of key handling.
  const lastEvent = vectors.events[vectors.events.length - 1];
  const correctMac = computeMac(vectors.box_secret_hex, vectors.box_id, lastEvent.seq, lastEvent.head);

  const wrongKey = Buffer.from(vectors.box_secret_hex, "utf8"); // the bug: hex string, not decoded bytes
  const message = `${vectors.box_id}|${lastEvent.seq}|${lastEvent.head}`;
  const { createHmac } = await import("node:crypto");
  const wrongMac = createHmac("sha256", wrongKey).update(message, "utf8").digest("hex");

  assert.equal(correctMac, lastEvent.mac);
  assert.notEqual(wrongMac, lastEvent.mac);
});

test("protocol module rejects a non-integer field (e.g. a float lat_e6)", () => {
  const lastEvent = vectors.events[vectors.events.length - 1];
  const badFields: CanonicalEventFields = {
    box_id: vectors.box_id,
    seq: lastEvent.seq,
    ts: lastEvent.ts,
    type: lastEvent.type,
    state: lastEvent.state,
    order_id: lastEvent.order_id,
    lat_e6: 12.5,
    lon_e6: lastEvent.lon_e6,
    fix: lastEvent.fix,
    dist_mm: lastEvent.dist_mm,
    lid: lastEvent.lid,
    accel_mg: lastEvent.accel_mg,
    tilt_deg: lastEvent.tilt_deg,
    lock: lastEvent.lock,
    batt_mv: lastEvent.batt_mv,
    code: lastEvent.code,
    cmd_id: lastEvent.cmd_id,
  };
  assert.throws(() => buildCanon(badFields));
});
