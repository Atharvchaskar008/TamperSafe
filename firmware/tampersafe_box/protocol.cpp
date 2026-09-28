#include "protocol.h"
#include "vectors.h"

#include <mbedtls/md.h>
#include <string.h>
#include <stdio.h>

static void bytesToHex(const uint8_t *bytes, size_t len, char *out) {
  static const char *hexd = "0123456789abcdef";
  for (size_t i = 0; i < len; i++) {
    out[i * 2] = hexd[(bytes[i] >> 4) & 0xF];
    out[i * 2 + 1] = hexd[bytes[i] & 0xF];
  }
  out[len * 2] = '\0';
}

size_t buildCanon(const CanonFields &f, char *out, size_t outLen) {
  int n = snprintf(out, outLen,
                    "v1|%s|%u|%u|%s|%s|%u|%ld|%ld|%u|%ld|%u|%ld|%ld|%c|%ld|%u|%s",
                    f.box_id, (unsigned)f.seq, (unsigned)f.ts, f.type, f.state,
                    (unsigned)f.order_id, (long)f.lat_e6, (long)f.lon_e6,
                    (unsigned)f.fix, (long)f.dist_mm, (unsigned)f.lid,
                    (long)f.accel_mg, (long)f.tilt_deg, f.lock,
                    (long)f.batt_mv, (unsigned)f.code, f.cmd_id);
  if (n < 0 || (size_t)n >= outLen) return 0; // truncated -- caller must use a bigger buffer
  return (size_t)n;
}

void computeHead(const char *prevHead, const char *canon, char *outHead) {
  // hash_input = prevHead + "|" + canon, hashed as ASCII text (not decoded).
  char buf[64 + 1 + CANON_BUF_LEN];
  int n = snprintf(buf, sizeof(buf), "%s|%s", prevHead, canon);
  uint8_t hash[32];
  mbedtls_md(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), (const unsigned char *)buf, (size_t)n, hash);
  bytesToHex(hash, 32, outHead);
}

bool decodeBoxSecret(const char *secretHex, uint8_t out[32]) {
  if (strlen(secretHex) != 64) return false;
  for (int i = 0; i < 32; i++) {
    char hi = secretHex[i * 2];
    char lo = secretHex[i * 2 + 1];
    auto nibble = [](char c) -> int {
      if (c >= '0' && c <= '9') return c - '0';
      if (c >= 'a' && c <= 'f') return c - 'a' + 10;
      if (c >= 'A' && c <= 'F') return c - 'A' + 10;
      return -1;
    };
    int h = nibble(hi), l = nibble(lo);
    if (h < 0 || l < 0) return false;
    out[i] = (uint8_t)((h << 4) | l);
  }
  return true;
}

void computeMac(const char *secretHex, const char *boxId, uint32_t lastSeq, const char *lastHead, char *outMac) {
  uint8_t key[32];
  if (!decodeBoxSecret(secretHex, key)) {
    strcpy(outMac, "0000000000000000000000000000000000000000000000000000000000000000");
    return;
  }
  // mac_input = box_id + "|" + last_seq + "|" + last_head, last_head used
  // as its ASCII hex string (never byte-decoded).
  char msg[128];
  int n = snprintf(msg, sizeof(msg), "%s|%u|%s", boxId, (unsigned)lastSeq, lastHead);
  uint8_t mac[32];
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), key, 32, (const unsigned char *)msg, (size_t)n, mac);
  bytesToHex(mac, 32, outMac);
}

bool runProtocolSelfTest() {
#if !VECTORS_EMBEDDED
  Serial.println("SELFTEST FAIL: vectors not embedded (relayer/test/vectors.json absent at build time)");
  return false;
#else
  char canon[CANON_BUF_LEN];
  char head[65];
  char mac[65];
  char prevHead[65];
  strcpy(prevHead, VECTORS_GENESIS_HEAD);

  for (size_t i = 0; i < VECTORS_COUNT; i++) {
    const TestVectorEvent &ev = kVectors[i];

    CanonFields f;
    f.box_id = VECTORS_BOX_ID;
    f.seq = ev.seq;
    f.ts = ev.ts;
    f.type = ev.type;
    f.state = ev.state;
    f.order_id = ev.order_id;
    f.lat_e6 = ev.lat_e6;
    f.lon_e6 = ev.lon_e6;
    f.fix = ev.fix;
    f.dist_mm = ev.dist_mm;
    f.lid = ev.lid;
    f.accel_mg = ev.accel_mg;
    f.tilt_deg = ev.tilt_deg;
    f.lock = ev.lock;
    f.batt_mv = ev.batt_mv;
    f.code = ev.code;
    f.cmd_id = ev.cmd_id;

    size_t clen = buildCanon(f, canon, sizeof(canon));
    if (clen == 0 || strcmp(canon, ev.expected_canon) != 0) {
      Serial.printf("SELFTEST FAIL: event %u canon mismatch\n  got:      %s\n  expected: %s\n",
                    (unsigned)(i + 1), canon, ev.expected_canon);
      return false;
    }
    if (strcmp(prevHead, ev.expected_prev_head) != 0) {
      Serial.printf("SELFTEST FAIL: event %u prev_head mismatch\n", (unsigned)(i + 1));
      return false;
    }

    computeHead(prevHead, canon, head);
    if (strcmp(head, ev.expected_head) != 0) {
      Serial.printf("SELFTEST FAIL: event %u head mismatch\n  got:      %s\n  expected: %s\n",
                    (unsigned)(i + 1), head, ev.expected_head);
      return false;
    }

    computeMac(VECTORS_BOX_SECRET_HEX, VECTORS_BOX_ID, ev.seq, head, mac);
    if (strcmp(mac, ev.expected_mac) != 0) {
      Serial.printf("SELFTEST FAIL: event %u mac mismatch\n  got:      %s\n  expected: %s\n",
                    (unsigned)(i + 1), mac, ev.expected_mac);
      return false;
    }

    strcpy(prevHead, head);
  }

  // batch mac == last event's mac (one POST covering all vector events).
  computeMac(VECTORS_BOX_SECRET_HEX, VECTORS_BOX_ID, VECTORS_BATCH_LAST_SEQ, prevHead, mac);
  if (strcmp(mac, VECTORS_BATCH_MAC) != 0) {
    Serial.printf("SELFTEST FAIL: batch mac mismatch\n  got:      %s\n  expected: %s\n", mac, VECTORS_BATCH_MAC);
    return false;
  }

  Serial.println("SELFTEST PASS");
  return true;
#endif
}
