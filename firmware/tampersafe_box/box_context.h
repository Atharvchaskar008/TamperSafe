#pragma once
#include <Arduino.h>

// Shared RAM state for the box. Only loop() (core 1) ever writes this
// struct -- the network task (core 0) only reads the small snapshot it
// needs through the ring buffer / command slot, never this struct directly,
// per ARCHITECTURE.md §8 ("only loop() touches the I2C bus" and, by
// extension, the sensor-derived state that comes from it).

enum class BoxState : uint8_t { BOOT, IDLE, ARMING, SEALED, TAMPERED, OPEN_AUTHORIZED };

const char *boxStateName(BoxState s);
BoxState boxStateFromName(const String &name); // unknown/empty -> BOOT (caller decides the boot mapping)

struct BoxContext {
  BoxState state = BoxState::BOOT;
  uint32_t orderId = 0;

  // Hash chain tail, mirrored from NVS into RAM for speed; NVS is always
  // the value written first (nvs_store.cpp), this is just the live copy.
  uint32_t seq = 0;
  char head[65];

  uint8_t tamperCode = 0;   // 0 = not tampered
  uint32_t baselineMm = 0;  // FAKE (0) until ultrasonic pins are confirmed

  char lock = 'U';          // 'L'/'U', mirrors the last commanded servo position

  // Latest sensor snapshot, folded into every canonical event.
  int32_t accelMg = 1000;   // ~1g at rest; updated at 20 Hz by mpuReadAccelTilt()
  int32_t tiltDeg = 0;
  int32_t battMv = 0;       // 0 until the first successful nr.updateSensors()
  bool battValid = false;   // true once at least one updateSensors() call has succeeded
  int32_t distMm = 0;       // FAKE (0) -- ultrasonic stubbed, PINS_CONFIRMED=0
  uint8_t lid = 1;          // FAKE (1=closed) -- IR stubbed, PINS_CONFIRMED=0
  int32_t lat_e6 = 0, lon_e6 = 0;
  uint8_t fix = 0;          // FAKE (0=no fix) -- GPS stubbed, PINS_CONFIRMED=0

  uint32_t ts = 0;          // unix seconds from NTP, 0 until synced (network task sets this)

  // Pending command bookkeeping so a resent (unacked) command isn't
  // executed twice -- the relayer resends until it sees the resulting
  // event's cmd_id (§9.2).
  char lastHandledCmdId[32] = "";

  BoxContext() { head[0] = '\0'; } // setup() overwrites this from NVS before it's ever read
};

extern BoxContext ctx;
