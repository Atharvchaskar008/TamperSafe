#pragma once
#include <Arduino.h>

// Builds a canonical event from the live BoxContext (box_context.h),
// advances the hash chain, persists seq+head to NVS (ARCHITECTURE §8:
// "Write seq and head on every event generated"), and enqueues it for the
// core-0 network task. Called only from loop() (core 1) -- it is the one
// place that touches the hash chain, so seq/head can't race between
// callers.
//
// IMPORTANT ordering rule (CLAUDE.md "latch before report"): when emitting
// a TAMPER event, the caller must have already called nvsSaveState(TAMPERED)
// (and nvsSaveTamperCode()) BEFORE calling emitEvent(). This function does
// not enforce that itself -- it only persists seq/head -- so every TAMPER
// call site in tampersafe_box.ino does the state write first; see the
// comments there.
void emitEvent(const char *type, uint16_t code, const char *cmdId);

// Convenience wrapper for the two alert-only events MPU alerts raise.
// Alerts never change state (ARCHITECTURE §8), so this never touches NVS's
// `state` key.
void emitAlertEvent(uint16_t code);
