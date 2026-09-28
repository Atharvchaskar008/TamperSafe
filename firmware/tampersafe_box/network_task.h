#pragma once
#include <Arduino.h>

// Core-0 network task: Wi-Fi reconnect, NTP, batched POST /api/device/events,
// per ARCHITECTURE.md §8. Runs on its own FreeRTOS task/core so a stalled
// POST (up to the 3 s HTTPClient timeout) never blocks loop()'s sensor
// reads or the state machine on core 1.
//
// The two tasks hand off through exactly two guarded structures:
//   - a 128-slot ring buffer of outgoing events (this file)
//   - a single pending-command slot (SEAL/UNLOCK/RESET + cmd_id)
// Only loop() (core 1) ever touches nr.*, display, Wire or Preferences.
// This file never does.

// One outgoing device event, exactly the fields of §9.2's event object
// plus the head this event produced. Copied by value into the ring so the
// network task never reads memory loop() might reuse.
struct RingEvent {
  uint32_t seq;
  uint32_t ts;
  char type[16];
  char state[20];
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
  char cmd_id[32];
  char head[65];
};

// Creates the mutexes and starts the network task pinned to core 0. Call
// once from setup(), after nr.begin()/NVS init (order doesn't matter to
// this call itself, but keeping it after board bring-up matches the
// skill's "peripherals last" ordering).
void networkInit();

// Enqueues one event, dropping the oldest UNACKED event if the ring is
// full (128 events per §8; the relayer notices the resulting seq gap and
// raises LOG_GAP on its own). Safe to call from loop() (core 1) only.
void networkEnqueueEvent(const RingEvent &ev);

// Wakes the network task immediately instead of waiting for its normal
// 2 s cadence -- call right after a TAMPER, SEALED or UNLOCKED event is
// enqueued (§8: "POST batch ... immediately after TAMPER / SEALED / UNLOCKED").
void networkNotifyPriority();

// Non-blocking poll for a pending command from the relayer. Returns true
// and fills the out-params if one is pending; false if none. Safe to call
// from loop() (core 1) only. Does NOT clear the slot -- call
// networkAckCommandHandled() once loop() has actually emitted the
// resulting event (SEALED/SEAL_FAILED/UNLOCKED/RESET_DONE), so a command
// the box couldn't yet act on (e.g. SEAL arriving while already SEALED)
// stays visible for the next loop() tick rather than being silently lost.
bool networkGetPendingCommand(char *outId, size_t idLen, char *outType, size_t typeLen, uint32_t *outOrderId);

// Clears the pending-command slot once its cmd_id has been acknowledged
// by an emitted event. Safe to call from loop() (core 1) only.
void networkAckCommandHandled(const char *cmdId);

// Current unix time from NTP, or 0 until the network task has synced.
// loop() calls this rather than reading NTP itself, since NTP sync happens
// on the core-0 network task. Safe to call from either core (reads two
// volatile words and does integer math only -- no locking needed).
uint32_t networkCurrentUnixTime();
