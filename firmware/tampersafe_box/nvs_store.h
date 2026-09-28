#pragma once
#include <Arduino.h>

// NVS (Preferences) persistence for the tamper latch and the hash chain.
// Keys per ARCHITECTURE.md §8: state, order_id, seq, head, baseline_mm,
// tamper_code, boot_count.
//
// Rule (CLAUDE.md invariant 3 / ARCHITECTURE §8 "latch first, then report"):
// nvsSaveState() must be called and RETURN before the corresponding device
// event is handed to the network task's ring buffer. Every call site in
// tampersafe_box.ino follows that order; see the comments there.

void nvsInit();

// --- state (persisted as a short string: BOOT|IDLE|ARMING|SEALED|TAMPERED|OPEN_AUTHORIZED)
String nvsLoadState();
void nvsSaveState(const String &state);

// --- order_id
uint32_t nvsLoadOrderId();
void nvsSaveOrderId(uint32_t orderId);

// --- seq / head (hash chain tail, persisted across orders and reboots)
uint32_t nvsLoadSeq();
void nvsSaveSeq(uint32_t seq);
String nvsLoadHead();      // returns GENESIS_HEAD if never set
void nvsSaveHead(const String &head);

// --- baseline_mm (ultrasonic baseline captured at SEAL)
uint32_t nvsLoadBaseline();
void nvsSaveBaseline(uint32_t mm);

// --- tamper_code (latched code, 0 if not tampered)
uint8_t nvsLoadTamperCode();
void nvsSaveTamperCode(uint8_t code);

// --- boot_count
uint32_t nvsLoadBootCount();
uint32_t nvsIncrementBootCount(); // returns the new count
