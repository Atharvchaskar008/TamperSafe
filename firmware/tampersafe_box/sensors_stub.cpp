#include "sensors_stub.h"
#include "pins.h"

#if PINS_CONFIRMED
// pins.h's PINS_CONFIRMED flag exists so a sketch never runs against pins
// the team hasn't confirmed in HARDWARE.md §2 (CLAUDE.md board discipline).
// It has been flipped to 1, but these are still the stub bodies -- if the
// real ultrasonic/IR/GPS/RFID drivers had replaced them, this file
// wouldn't compile the stub definitions below at all. Write the real
// drivers in this file (or split them out) before flipping the flag.
#error "PINS_CONFIRMED=1 but sensors_stub.cpp still has stub bodies. Replace readUltrasonicMm()/readLidIR()/readGPS()/readRFID() with real drivers first."
#endif

int32_t readUltrasonicMm() {
  return -1; // FAKE: no ultrasonic driver yet (HARDWARE.md §2 TRIG/ECHO are TBD)
}

uint8_t readLidIR() {
  return 2; // FAKE: not 0 or 1 on purpose -- see sensors_stub.h
}

bool readGPS(int32_t *outLatE6, int32_t *outLonE6) {
  *outLatE6 = 0;
  *outLonE6 = 0;
  return false; // FAKE: always "no fix" -- no GPS driver yet
}

bool readRFID(char *outUid, size_t uidLen) {
  if (uidLen > 0) outUid[0] = '\0';
  return false; // FAKE: always "no tag" -- no RFID driver yet, and HARDWARE.md
                // §2 has no proposed GPIO for it at all (still bare TBD)
}
