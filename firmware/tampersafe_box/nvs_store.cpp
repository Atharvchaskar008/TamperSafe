#include "nvs_store.h"
#include "protocol.h" // GENESIS_HEAD
#include <Preferences.h>

static Preferences prefs;
static const char *NS = "tampersafe";

void nvsInit() {
  // Preferences::begin() uses the ESP32 NVS driver directly, not the I2C
  // Wire bus -- no conflict with nr.begin() having already run.
  prefs.begin(NS, false);
}

String nvsLoadState() {
  return prefs.getString("state", "");
}
void nvsSaveState(const String &state) {
  prefs.putString("state", state);
}

uint32_t nvsLoadOrderId() {
  return prefs.getUInt("order_id", 0);
}
void nvsSaveOrderId(uint32_t orderId) {
  prefs.putUInt("order_id", orderId);
}

uint32_t nvsLoadSeq() {
  return prefs.getUInt("seq", 0);
}
void nvsSaveSeq(uint32_t seq) {
  prefs.putUInt("seq", seq);
}

String nvsLoadHead() {
  return prefs.getString("head", GENESIS_HEAD);
}
void nvsSaveHead(const String &head) {
  prefs.putString("head", head);
}

uint32_t nvsLoadBaseline() {
  return prefs.getUInt("baseline_mm", 0);
}
void nvsSaveBaseline(uint32_t mm) {
  prefs.putUInt("baseline_mm", mm);
}

uint8_t nvsLoadTamperCode() {
  return (uint8_t)prefs.getUChar("tamper_code", 0);
}
void nvsSaveTamperCode(uint8_t code) {
  prefs.putUChar("tamper_code", code);
}

uint32_t nvsLoadBootCount() {
  return prefs.getUInt("boot_count", 0);
}
uint32_t nvsIncrementBootCount() {
  uint32_t c = nvsLoadBootCount() + 1;
  prefs.putUInt("boot_count", c);
  return c;
}
