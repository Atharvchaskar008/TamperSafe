#include "network_task.h"
#include "config.h"
#include "protocol.h"

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ---- Ring buffer (events waiting to be POSTed) -----------------------------
#define RING_CAPACITY 128
#define BATCH_MAX 32

static RingEvent ring[RING_CAPACITY];
static int ringStart = 0; // index of the oldest occupied slot
static int ringCount = 0;
static SemaphoreHandle_t ringMutex;

void networkEnqueueEvent(const RingEvent &ev) {
  xSemaphoreTake(ringMutex, portMAX_DELAY);
  if (ringCount == RING_CAPACITY) {
    // Ring full: drop the oldest, per §8 ("128 events in RAM. When it is
    // full, the oldest is dropped"). The relayer notices the resulting
    // seq gap on its own and raises LOG_GAP -- the box doesn't need to.
    ringStart = (ringStart + 1) % RING_CAPACITY;
    ringCount--;
  }
  int idx = (ringStart + ringCount) % RING_CAPACITY;
  ring[idx] = ev;
  ringCount++;
  xSemaphoreGive(ringMutex);
}

// Copies up to maxCount oldest-first events out of the ring WITHOUT
// removing them (removal only happens once the relayer acks them, in
// ackUpToSeq below) -- copy happens under the mutex, but the caller
// serializes/POSTs after releasing it, so loop() is never blocked on an
// in-flight HTTP request.
static int copyBatch(RingEvent *outBuf, int maxCount) {
  xSemaphoreTake(ringMutex, portMAX_DELAY);
  int n = ringCount < maxCount ? ringCount : maxCount;
  for (int i = 0; i < n; i++) outBuf[i] = ring[(ringStart + i) % RING_CAPACITY];
  xSemaphoreGive(ringMutex);
  return n;
}

static void ackUpToSeq(uint32_t ackSeq) {
  xSemaphoreTake(ringMutex, portMAX_DELAY);
  while (ringCount > 0 && ring[ringStart].seq <= ackSeq) {
    ringStart = (ringStart + 1) % RING_CAPACITY;
    ringCount--;
  }
  xSemaphoreGive(ringMutex);
}

// ---- Pending command slot ---------------------------------------------------
struct PendingCommand {
  bool valid = false;
  char id[32] = "";
  char type[16] = "";
  uint32_t order_id = 0;
};
static PendingCommand pendingCmd;
static SemaphoreHandle_t cmdMutex;

static void setPendingCommand(const char *id, const char *type, uint32_t orderId) {
  xSemaphoreTake(cmdMutex, portMAX_DELAY);
  strlcpy(pendingCmd.id, id, sizeof(pendingCmd.id));
  strlcpy(pendingCmd.type, type, sizeof(pendingCmd.type));
  pendingCmd.order_id = orderId;
  pendingCmd.valid = (id[0] != '\0');
  xSemaphoreGive(cmdMutex);
}

bool networkGetPendingCommand(char *outId, size_t idLen, char *outType, size_t typeLen, uint32_t *outOrderId) {
  xSemaphoreTake(cmdMutex, portMAX_DELAY);
  bool v = pendingCmd.valid;
  if (v) {
    strlcpy(outId, pendingCmd.id, idLen);
    strlcpy(outType, pendingCmd.type, typeLen);
    *outOrderId = pendingCmd.order_id;
  }
  xSemaphoreGive(cmdMutex);
  return v;
}

void networkAckCommandHandled(const char *cmdId) {
  xSemaphoreTake(cmdMutex, portMAX_DELAY);
  if (pendingCmd.valid && strcmp(pendingCmd.id, cmdId) == 0) {
    pendingCmd.valid = false;
  }
  xSemaphoreGive(cmdMutex);
}

// ---- NTP time (network task keeps its own anchor; loop() reads it via
// networkCurrentUnixTime() rather than this file writing into loop()'s
// BoxContext directly) ------------------------------------------------------
static volatile uint32_t g_ntpEpochAtSync = 0;   // 0 = never synced
static volatile unsigned long g_ntpSyncMillis = 0;

uint32_t networkCurrentUnixTime() {
  if (g_ntpEpochAtSync == 0) return 0;
  return g_ntpEpochAtSync + (uint32_t)((millis() - g_ntpSyncMillis) / 1000UL);
}

// ---- Task handle, for the priority wake ------------------------------------
static TaskHandle_t networkTaskHandle = nullptr;

void networkNotifyPriority() {
  if (networkTaskHandle) xTaskNotifyGive(networkTaskHandle);
}

// ---- Wi-Fi / NTP maintenance (non-blocking) --------------------------------
static unsigned long lastWifiAttemptMs = 0;
static bool ntpConfigured = false;

static void maintainWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastWifiAttemptMs < 5000) return; // don't hammer WiFi.begin()
  lastWifiAttemptMs = now;
  ntpConfigured = false; // re-arm NTP once we reconnect
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

static void maintainNtp() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!ntpConfigured) {
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    ntpConfigured = true;
  }
  if (g_ntpEpochAtSync == 0) {
    time_t now = time(nullptr);
    if (now > 1700000000) { // sane-looking epoch => sync landed
      g_ntpEpochAtSync = (uint32_t)now;
      g_ntpSyncMillis = millis();
    }
  }
}

// ---- POST cycle -------------------------------------------------------------
static void runPostCycle() {
  if (WiFi.status() != WL_CONNECTED) return; // retry next cycle; never crash

  RingEvent batch[BATCH_MAX];
  int n = copyBatch(batch, BATCH_MAX);
  if (n == 0) return; // nothing to send this cycle

  JsonDocument doc;
  doc["box_id"] = BOX_ID;
  JsonArray events = doc["events"].to<JsonArray>();
  for (int i = 0; i < n; i++) {
    JsonObject e = events.add<JsonObject>();
    e["seq"] = batch[i].seq;
    e["ts"] = batch[i].ts;
    e["type"] = batch[i].type;
    e["state"] = batch[i].state;
    e["order_id"] = batch[i].order_id;
    e["lat_e6"] = batch[i].lat_e6;
    e["lon_e6"] = batch[i].lon_e6;
    e["fix"] = batch[i].fix;
    e["dist_mm"] = batch[i].dist_mm;
    e["lid"] = batch[i].lid;
    e["accel_mg"] = batch[i].accel_mg;
    e["tilt_deg"] = batch[i].tilt_deg;
    e["lock"] = String(batch[i].lock);
    e["batt_mv"] = batch[i].batt_mv;
    e["code"] = batch[i].code;
    e["cmd_id"] = batch[i].cmd_id;
    e["head"] = batch[i].head;
  }

  char mac[65];
  computeMac(BOX_SECRET_HEX, BOX_ID, batch[n - 1].seq, batch[n - 1].head, mac);
  doc["mac"] = mac;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.setConnectTimeout(3000); // core default is 5000ms -- §8 requires <=3s
  http.setTimeout(3000);
  if (!http.begin(RELAYER_EVENTS_URL)) return; // malformed URL (team hasn't filled secrets.h yet)
  http.addHeader("Content-Type", "application/json");

  int status = http.POST(body);
  if (status == 200) {
    String resp = http.getString();
    JsonDocument respDoc;
    if (deserializeJson(respDoc, resp) == DeserializationError::Ok) {
      if (respDoc["ok"] == true && respDoc["ack_seq"].is<uint32_t>()) {
        ackUpToSeq(respDoc["ack_seq"].as<uint32_t>());
      }
      if (respDoc["command"].is<JsonObject>()) {
        JsonObject cmd = respDoc["command"];
        const char *id = cmd["id"] | "";
        const char *type = cmd["type"] | "";
        uint32_t orderId = cmd["order_id"] | 0;
        setPendingCommand(id, type, orderId);
      } else {
        setPendingCommand("", "", 0); // command: null -> nothing pending
      }
    }
  }
  // Any other status (or a transport failure, status < 0): leave the batch
  // in the ring un-acked and retry next cycle. Never crash on a bad
  // response -- the ring buffer is exactly the "don't blind the box while
  // offline" mechanism from §8.
  http.end();
}

static void networkTaskFn(void *pvParameters) {
  for (;;) {
    maintainWifi();
    maintainNtp();
    runPostCycle();
    // Sleep up to 2s (§8 cadence), but wake immediately if
    // networkNotifyPriority() was called (TAMPER/SEALED/UNLOCKED).
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(2000));
  }
}

void networkInit() {
  ringMutex = xSemaphoreCreateMutex();
  cmdMutex = xSemaphoreCreateMutex();
  // Core 0, per ARCHITECTURE §8 ("loop() on core 1 ... a FreeRTOS network
  // task on core 0"). Stack sized generously for HTTPClient + TLS-free JSON.
  xTaskCreatePinnedToCore(networkTaskFn, "netTask", 8192, nullptr, 1, &networkTaskHandle, 0);
}
