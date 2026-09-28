// TamperSafe bring-up: servo angle sweep.
//
// Sweeps the latch servo (S1 channel) through a small test range so the
// team can find the real LOCK and UNLOCK angles on the physical box, per
// docs/HARDWARE.md §4/§5/§7. Watch the horn under the hook: LOCK should
// swing it fully under the hook (lid cannot be lifted), UNLOCK should clear
// it (lid opens freely).
//
// nr.servo(s1, s2, s4) sets ALL THREE channels every call -- there is no
// S3 (see docs/neurick/Newrick.h). S2/S4 are held at a neutral rest angle
// throughout since this box only uses S1 for the latch.
//
// Needs the 12V battery ON (servos run off the Neurick servo port, not
// USB) -- see docs/HARDWARE.md §3.

#include <Newrick.h>

Newrick nr;

#define S2_REST 90
#define S4_REST 90

// Small test sweep, NOT the calibrated LOCK/UNLOCK angles -- write those
// into docs/HARDWARE.md §5 once found (this sketch's job is to help find
// them, not to assume them).
static const uint8_t testAngles[] = {0, 45, 90, 135, 180, 135, 90, 45};

void setup() {
  Serial.begin(115200);
  delay(2000);

  nr.begin();

  Serial.println("TamperSafe bring-up: servo_angles");
  Serial.println("Watch the S1 horn against the lid hook at each angle below.");
  Serial.println("Move slowly (this sketch waits 2s per step) -- avoid repeated");
  Serial.println("re-commanding per docs/HARDWARE.md §3.");
}

void loop() {
  for (uint8_t angle : testAngles) {
    Serial.printf("S1 -> %u deg (S2/S4 held at %u)\n", angle, S2_REST);
    nr.servo(angle, S2_REST, S4_REST);
    delay(2000);
  }
}
