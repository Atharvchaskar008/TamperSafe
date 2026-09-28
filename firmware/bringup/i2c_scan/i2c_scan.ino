// TamperSafe bring-up: I2C scan.
//
// Expected addresses (docs/HARDWARE.md §7, step 1; neurick-firmware skill's
// debug checklist step 1):
//   0x08 -- STM32 motion controller (needs the 12V battery ON, not just USB)
//   0x3C -- SSD1306 OLED
//   0x68 -- MPU6050
//
// If 0x08 is missing: battery is off.
// If 0x3C or 0x68 is missing: a stray Wire.begin() somewhere reset the bus,
// or that device genuinely isn't wired/powered.
//
// Uses nr.begin() (NOT Wire.begin()) to bring up the bus, per the skill's
// "call nr.begin() ONCE in setup(), before anything else" rule.

#include <Newrick.h>
#include <Wire.h>

Newrick nr;

void setup() {
  Serial.begin(115200);
  delay(2000);

  nr.begin(); // starts I2C on SDA=8/SCL=9 at 400 kHz

  Serial.println("TamperSafe bring-up: i2c_scan");
  Serial.println("Expect 0x08 (STM32, battery ON), 0x3C (OLED), 0x68 (MPU6050)");
}

void loop() {
  Serial.println("Scanning...");
  int found = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t err = Wire.endTransmission();
    if (err == 0) {
      Serial.printf("  found device at 0x%02X\n", addr);
      found++;
    }
  }
  if (found == 0) {
    Serial.println("  no devices found -- check battery/wiring");
  }
  Serial.printf("Scan done, %d device(s) found. Next scan in 3s.\n\n", found);
  delay(3000);
}
