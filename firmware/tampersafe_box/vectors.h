#pragma once
// Embedded mirror of relayer/test/vectors.json, committed there 2026-09-28
// by the app-dev track (protocol.ts's test fixture). This file is NOT
// generated automatically -- if relayer/test/vectors.json changes, this
// file must be updated by hand to match, or the self-test will legitimately
// FAIL (it is checking against a stale copy, not the real fixture).
//
// Why a copy instead of reading the JSON at runtime: the ESP32 has no
// access to the repo's relayer/ directory at boot; it only has whatever is
// flashed into it. Embedding is the standard way to carry a fixture into
// firmware.
//
// box_secret_hex below is the SAME dummy fixture value as vectors.json --
// it is not a real device secret and is safe to commit (vectors.json's own
// header comment says so explicitly).

#define VECTORS_EMBEDDED 1

#define VECTORS_BOX_ID "TS-BOX-01"
#define VECTORS_BOX_SECRET_HEX "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
#define VECTORS_GENESIS_HEAD "0000000000000000000000000000000000000000000000000000000000000000"

#define VECTORS_BATCH_LAST_SEQ 3
#define VECTORS_BATCH_MAC "8ce8432b3f5a8d72c8890d403151930e2f79da68e2d714e6b7b69bffb0e587d7"

struct TestVectorEvent {
  uint32_t seq;
  uint32_t ts;
  const char *type;
  const char *state;
  uint32_t order_id;
  int32_t lat_e6;
  int32_t lon_e6;
  uint8_t fix;
  int32_t dist_mm;
  uint8_t lid;
  int32_t accel_mg;
  int32_t tilt_deg;
  char lock;
  int32_t batt_mv;
  uint16_t code;
  const char *cmd_id;
  const char *expected_prev_head;
  const char *expected_canon;
  const char *expected_head;
  const char *expected_mac;
};

static const TestVectorEvent kVectors[] = {
  {
    1, 0, "BOOT", "IDLE", 0, 0, 0, 0, 0, 1, 1000, 0, 'U', 11800, 0, "",
    "0000000000000000000000000000000000000000000000000000000000000000",
    "v1|TS-BOX-01|1|0|BOOT|IDLE|0|0|0|0|0|1|1000|0|U|11800|0|",
    "02e8406f1e00c50f29e24fe7b2b6e0aa406c7a2e4a42afc8989ff3c37e48b891",
    "34a28e913e4cfa720231f32f3abf014497da7893a5ee90a709f63257382c69d7"
  },
  {
    2, 1790582400, "ALERT", "SEALED", 3, -12971599, 77594566, 1, 84, 0, 1850, 3, 'L', 11750, 10, "",
    "02e8406f1e00c50f29e24fe7b2b6e0aa406c7a2e4a42afc8989ff3c37e48b891",
    "v1|TS-BOX-01|2|1790582400|ALERT|SEALED|3|-12971599|77594566|1|84|0|1850|3|L|11750|10|",
    "1f08525316d418472e3332badcf7446dc19a2ecb0dc610d735724665814e396c",
    "67c40d9c668149140eb3269aabea31f1fcde834dabcdbcf177b562302ac3008f"
  },
  {
    3, 1790582410, "UNLOCKED", "OPEN_AUTHORIZED", 3, -12971599, 77594566, 1, 84, 0, 1005, 2, 'U', 11740, 0, "cmd-9",
    "1f08525316d418472e3332badcf7446dc19a2ecb0dc610d735724665814e396c",
    "v1|TS-BOX-01|3|1790582410|UNLOCKED|OPEN_AUTHORIZED|3|-12971599|77594566|1|84|0|1005|2|U|11740|0|cmd-9",
    "9a238d516c48bfee5e29b433383af9efb11d311e828f53282bfa5b588c8eaad3",
    "8ce8432b3f5a8d72c8890d403151930e2f79da68e2d714e6b7b69bffb0e587d7"
  },
};
static const size_t VECTORS_COUNT = sizeof(kVectors) / sizeof(kVectors[0]);
