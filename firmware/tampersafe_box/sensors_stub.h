#pragma once
#include <Arduino.h>

// Stubs for the sensors HARDWARE.md §2 still lists as TBD (ultrasonic, IR
// lid, GPS, RFID). Gated behind PINS_CONFIRMED (pins.h) -- see
// sensors_stub.cpp for why flipping that flag without replacing these
// functions is a compile error, not a silent no-op.
//
// Every sentinel below is deliberately NOT a plausible real reading, so a
// caller that forgets to gate its use can't mistake a stub for data:
//   - readUltrasonicMm(): -1 (a real HC-SR04 never reads negative)
//   - readLidIR(): 2 (the protocol's `lid` field is only ever 0 or 1)
//   - readGPS(): always returns false ("no fix"), coordinates 0,0
//   - readRFID(): always returns false ("no tag"), empty UID

int32_t readUltrasonicMm();
uint8_t readLidIR();
bool readGPS(int32_t *outLatE6, int32_t *outLonE6);
bool readRFID(char *outUid, size_t uidLen);
