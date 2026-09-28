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

// Small test sweep -- deliberately NOT 0/180 (a servo's mechanical hard
// stops). Commanding an un-mounted or freshly-mounted horn straight to a
// hard stop can jam it against the hook before the real range is known.
// NOT the calibrated LOCK/UNLOCK angles either -- write those into
// docs/HARDWARE.md §5 once found (this sketch's job is to help find them).
static const uint8_t testAngles[] = {10, 45, 90, 135, 170, 135, 90, 45};

void setup() {
  Serial.begin(115200);
  delay(2000);

  nr.begin();

  Serial.println("TamperSafe bring-up: servo_angles");
  Serial.println("Watch the S1 horn against the lid hook at each angle below.");
  Serial.println("Move slowly (this sketch waits 2s per step) -- avoid repeated");
  Serial.println("re-commanding per docs/HARDWARE.md §3.");
  Serial.println("Type a number (0-180) + Enter in the Serial Monitor at any time");
  Serial.println("to jump straight to that angle instead of waiting for the sweep.");
}

void loop() {
  // Manual override: type an angle in the Serial Monitor to test one exact
  // value instead of waiting through the sweep -- useful once you're
  // narrowing in on the real LOCK/UNLOCK angle.
  if (Serial.available()) {
    long angle = Serial.parseInt();
    while (Serial.available()) Serial.read(); // discard the rest of the line
    if (angle >= 0 && angle <= 180) {
      Serial.printf("(manual) S1 -> %ld deg\n", angle);
      nr.servo((uint8_t)angle, S2_REST, S4_REST);
      delay(500); // let it settle before accepting the next command
      return;
    }
  }

  for (uint8_t angle : testAngles) {
    if (Serial.available()) return; // a manual command arrived -- handle it next loop() instead
    Serial.printf("S1 -> %u deg (S2/S4 held at %u)\n", angle, S2_REST);
    nr.servo(angle, S2_REST, S4_REST);
    delay(2000);
  }
}
