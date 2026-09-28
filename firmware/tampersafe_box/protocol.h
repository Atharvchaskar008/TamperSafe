#pragma once
#include <Arduino.h>

// TamperSafe device protocol: canonical form, hash chain, HMAC.
// Mirrors relayer/src/protocol.ts field-for-field and byte-for-byte -- see
// docs/ARCHITECTURE.md §9.1. Both sides must agree exactly, which is why
// selftest.cpp reproduces relayer/test/vectors.json on every boot.
//
// Two traps this file exists to avoid (same two as protocol.ts):
//   1. box_secret is the 32 RAW BYTES decoded from the hex secret string,
//      never the 64-char ASCII hex string itself.
//   2. A "head" value is always used as its 64-char lowercase hex STRING
//      (concatenated as ASCII text), never decoded to bytes. Only the
//      secret itself gets byte-decoded.

// 64 lowercase '0' chars -- head_{-1} on a box's first boot ever, per §9.1.
#define GENESIS_HEAD "0000000000000000000000000000000000000000000000000000000000000000"

// The fields that make up one canonical event, in exactly the order §9.1
// lists them. box_id is threaded in separately since it is shared across a
// whole batch but is still part of the canon.
struct CanonFields {
  const char *box_id;
  uint32_t seq;
  uint32_t ts;        // unix seconds from NTP, or 0 until synced.
  const char *type;   // BOOT|TELEMETRY|SEALED|SEAL_FAILED|TAMPER|ALERT|UNLOCKED|RESET_DONE
  const char *state;  // BOOT|IDLE|ARMING|SEALED|TAMPERED|OPEN_AUTHORIZED
  uint32_t order_id;
  int32_t lat_e6;
  int32_t lon_e6;
  uint8_t fix;        // 0/1
  int32_t dist_mm;
  uint8_t lid;        // 1 closed, 0 open
  int32_t accel_mg;
  int32_t tilt_deg;
  char lock;          // 'L' or 'U'
  int32_t batt_mv;
  uint16_t code;      // tamper or alert code, else 0
  const char *cmd_id; // "" when absent
};

// Builds "v1|box_id|seq|ts|type|state|order_id|lat_e6|lon_e6|fix|dist_mm|
//         lid|accel_mg|tilt_deg|lock|batt_mv|code|cmd_id"
// into `out` (must be at least CANON_BUF_LEN bytes). Returns the length
// written, or 0 if `out` was too small.
#define CANON_BUF_LEN 256
size_t buildCanon(const CanonFields &f, char *out, size_t outLen);

// head_n = lowercase_hex( SHA-256( head_{n-1} + "|" + canon_n ) )
// prevHead must be a 64-char lowercase hex string; outHead must be at least
// 65 bytes (64 hex chars + NUL).
void computeHead(const char *prevHead, const char *canon, char *outHead);

// Decodes a 64-char hex string into 32 raw bytes. Returns false (and leaves
// `out` untouched) if secretHex isn't exactly 64 hex chars.
bool decodeBoxSecret(const char *secretHex, uint8_t out[32]);

// mac = lowercase_hex( HMAC-SHA256( box_secret, box_id + "|" + last_seq + "|" + last_head ) )
// secretHex is the 64-char ASCII hex secret (decoded internally, per the
// trap above); outMac must be at least 65 bytes.
void computeMac(const char *secretHex, const char *boxId, uint32_t lastSeq, const char *lastHead, char *outMac);

// Runs the boot self-test against the embedded copy of
// relayer/test/vectors.json (see vectors.h). Prints "SELFTEST PASS" or
// "SELFTEST FAIL: <field>" to Serial. Returns true on PASS.
bool runProtocolSelfTest();
