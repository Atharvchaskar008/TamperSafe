// TamperSafe device protocol: canonical form, hash chain, HMAC.
//
// This module is the single source of truth for how a device event turns
// into (a) the string that gets hashed and (b) the batch MAC. Firmware
// (mbedtls, C++) must reproduce every one of these bytes exactly -- see
// docs/ARCHITECTURE.md §9.1 and relayer/test/vectors.json.
//
// Two traps this module exists to avoid:
//   1. box_secret is the 32 RAW BYTES decoded from the hex secret string,
//      not the 64-character ASCII hex string itself.
//   2. head_{n-1} is fed into the next hash (and into the MAC message) as
//      its 64-character lowercase hex STRING, not as 32 raw bytes.
// Mixing these two up in either direction silently breaks every MAC/head,
// because both sides still produce *some* 64-hex-char output -- it's just
// the wrong one.

import { createHash, createHmac } from "node:crypto";

/** 0/1 encodes a boolean per §9.1 ("fix", "lid"). Keep it a literal union
 *  so a real boolean can never leak into the canonical string. */
export type ZeroOrOne = 0 | 1;

/** "L" locked / "U" unlocked, per §9.1. */
export type LockState = "L" | "U";

/** Device event types, per ARCHITECTURE.md §6. */
export type DeviceEventType =
  | "BOOT"
  | "TELEMETRY"
  | "SEALED"
  | "SEAL_FAILED"
  | "TAMPER"
  | "ALERT"
  | "UNLOCKED"
  | "RESET_DONE";

/** Box states, per ARCHITECTURE.md §6. */
export type BoxState =
  | "BOOT"
  | "IDLE"
  | "ARMING"
  | "SEALED"
  | "TAMPERED"
  | "OPEN_AUTHORIZED";

/**
 * The fields that make up one canonical event, in exactly the order
 * §9.1 lists them (box_id is threaded in separately by the caller since
 * it is shared across a whole batch, but it is still part of the canon).
 */
export interface CanonicalEventFields {
  box_id: string;
  seq: number;
  /** unix seconds, or 0 before NTP sync. */
  ts: number;
  type: DeviceEventType;
  state: BoxState;
  order_id: number;
  lat_e6: number;
  lon_e6: number;
  fix: ZeroOrOne;
  dist_mm: number;
  lid: ZeroOrOne;
  accel_mg: number;
  tilt_deg: number;
  lock: LockState;
  batt_mv: number;
  /** tamper or alert code, else 0. */
  code: number;
  /** empty string when no command is being acknowledged. */
  cmd_id: string;
}

const INTEGER_FIELDS: readonly (keyof CanonicalEventFields)[] = [
  "seq",
  "ts",
  "order_id",
  "lat_e6",
  "lon_e6",
  "fix",
  "dist_mm",
  "lid",
  "accel_mg",
  "tilt_deg",
  "batt_mv",
  "code",
];

const STRING_FIELDS: readonly (keyof CanonicalEventFields)[] = [
  "box_id",
  "type",
  "state",
  "lock",
  "cmd_id",
];

function assertValid(fields: CanonicalEventFields): void {
  for (const key of INTEGER_FIELDS) {
    const value = fields[key] as unknown;
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(
        `protocol: field "${String(key)}" must be an integer, got ${JSON.stringify(value)}`,
      );
    }
  }
  for (const key of STRING_FIELDS) {
    const value = fields[key] as unknown;
    if (typeof value !== "string") {
      throw new Error(`protocol: field "${String(key)}" must be a string, got ${JSON.stringify(value)}`);
    }
    if (value.includes("|")) {
      throw new Error(`protocol: field "${String(key)}" must not contain "|", got ${JSON.stringify(value)}`);
    }
  }
  if (fields.fix !== 0 && fields.fix !== 1) {
    throw new Error(`protocol: field "fix" must be 0 or 1, got ${fields.fix}`);
  }
  if (fields.lid !== 0 && fields.lid !== 1) {
    throw new Error(`protocol: field "lid" must be 0 or 1, got ${fields.lid}`);
  }
  if (fields.lock !== "L" && fields.lock !== "U") {
    throw new Error(`protocol: field "lock" must be "L" or "U", got ${JSON.stringify(fields.lock)}`);
  }
}

/**
 * Builds the exact string that gets hashed for one event:
 *   "v1|" + box_id|seq|ts|type|state|order_id|lat_e6|lon_e6|fix|dist_mm|
 *           lid|accel_mg|tilt_deg|lock|batt_mv|code|cmd_id
 * Integers only (no floats -- ESP32 and Node format floats differently).
 * `cmd_id` defaults to "" via the type system, but we still guard against
 * `undefined` reaching the template literal (which would silently become
 * the string "undefined").
 */
export function buildCanon(fields: CanonicalEventFields): string {
  assertValid(fields);
  return [
    "v1",
    fields.box_id,
    fields.seq,
    fields.ts,
    fields.type,
    fields.state,
    fields.order_id,
    fields.lat_e6,
    fields.lon_e6,
    fields.fix,
    fields.dist_mm,
    fields.lid,
    fields.accel_mg,
    fields.tilt_deg,
    fields.lock,
    fields.batt_mv,
    fields.code,
    fields.cmd_id ?? "",
  ].join("|");
}

/** Genesis head: 64 lowercase '0' chars, used as head_{-1} on a box's first boot. */
export const GENESIS_HEAD = "0".repeat(64);

/**
 * head_n = lowercase_hex( SHA-256( head_{n-1} + "|" + canon_n ) )
 * `prevHead` is fed in as its 64-char hex STRING (not decoded to bytes) --
 * the hash chain is a hash of ASCII text, unlike the HMAC key below.
 */
export function computeHead(prevHead: string, canon: string): string {
  if (!/^[0-9a-f]{64}$/.test(prevHead)) {
    throw new Error(`protocol: prevHead must be 64 lowercase hex chars, got ${JSON.stringify(prevHead)}`);
  }
  return createHash("sha256")
    .update(prevHead + "|" + canon, "utf8")
    .digest("hex");
}

/**
 * Decodes a hex secret string into the raw bytes used as the HMAC key.
 * §9.1: box_secret is the 32 RAW BYTES decoded from the hex secret, not
 * the hex string itself. Exported so callers (and tests) can assert the
 * decoded length is exactly 32 bytes.
 */
export function decodeBoxSecret(secretHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(secretHex)) {
    throw new Error(`protocol: box secret must be a 64-character hex string, got ${JSON.stringify(secretHex)}`);
  }
  const key = Buffer.from(secretHex, "hex");
  if (key.length !== 32) {
    // Unreachable given the regex above, but kept as a defensive check --
    // this is exactly the class of bug §9.1 calls out.
    throw new Error(`protocol: decoded box secret must be 32 bytes, got ${key.length}`);
  }
  return key;
}

/**
 * mac = lowercase_hex( HMAC-SHA256( box_secret, box_id + "|" + last_seq + "|" + last_head ) )
 * `lastHead` is the 64-char hex STRING of the last event in the batch,
 * concatenated as ASCII text (not decoded to bytes) -- only the secret
 * itself is decoded to raw bytes before keying the HMAC.
 */
export function computeMac(secretHex: string, boxId: string, lastSeq: number, lastHead: string): string {
  if (!Number.isInteger(lastSeq)) {
    throw new Error(`protocol: lastSeq must be an integer, got ${JSON.stringify(lastSeq)}`);
  }
  if (!/^[0-9a-f]{64}$/.test(lastHead)) {
    throw new Error(`protocol: lastHead must be 64 lowercase hex chars, got ${JSON.stringify(lastHead)}`);
  }
  const key = decodeBoxSecret(secretHex);
  const message = boxId + "|" + lastSeq + "|" + lastHead;
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}
