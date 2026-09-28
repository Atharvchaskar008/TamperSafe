#pragma once
// TamperSafe box -- proposed GPIOs, copied verbatim from docs/HARDWARE.md §2.
//
// EVERY pin below is UNCONFIRMED as of this pass: HARDWARE.md §1-2 are still
// TBD/☐. Per the neurick-firmware skill and CLAUDE.md's board discipline, a
// sketch may only use pins the team has confirmed. A TBD row blocks that
// pin's code.
//
// PINS_CONFIRMED gates all of it. Leave it 0 until the team fills the TBD
// rows in HARDWARE.md §2 AND replaces sensors_stub.cpp's stub functions with
// real drivers. Flipping it to 1 without doing that second part is caught at
// compile time below (see sensors_stub.cpp's #error), so a half-stubbed box
// can't ship silently.
#define PINS_CONFIRMED 0

// --- GPS (u-blox NEO-6M), UART1 ---------------------------------------------
#define PIN_GPS_RX 17 // UNCONFIRMED - TBD in HARDWARE.md §2 (module TX -> here)
#define PIN_GPS_TX 18 // UNCONFIRMED - TBD in HARDWARE.md §2 (ESP TX -> module RX, optional)

// --- Ultrasonic (HC-SR04), contents sensor ----------------------------------
#define PIN_ULTRASONIC_TRIG 12 // UNCONFIRMED - TBD in HARDWARE.md §2
#define PIN_ULTRASONIC_ECHO 13 // UNCONFIRMED - TBD in HARDWARE.md §2 (needs 1k/2k divider to 3.3V)

// --- IR lid sensor (FC-51 / TCRT5000), digital OUT --------------------------
#define PIN_IR_LID 14 // UNCONFIRMED - TBD in HARDWARE.md §2

// --- Stretch: LDR (ADC1) -----------------------------------------------------
#define PIN_LDR_AO 4 // UNCONFIRMED - TBD in HARDWARE.md §2 (ADC1, stretch only)

// --- RFID (MFRC522, SPI) -----------------------------------------------------
// HARDWARE.md §2 has no proposed GPIO for any of these yet (all rows are
// bare "TBD", not even a guess) -- do not invent numbers, per the task brief.
// -1 is not a valid GPIO; it stands in as "no proposal exists at all".
#define PIN_RFID_SCK  -1 // TBD in HARDWARE.md §2 -- no proposal yet
#define PIN_RFID_MOSI -1 // TBD in HARDWARE.md §2 -- no proposal yet
#define PIN_RFID_MISO -1 // TBD in HARDWARE.md §2 -- no proposal yet
#define PIN_RFID_SDA  -1 // TBD in HARDWARE.md §2 -- no proposal yet (SS/CS)
#define PIN_RFID_RST  -1 // TBD in HARDWARE.md §2 -- no proposal yet

// --- Confirmed, NOT gated by PINS_CONFIRMED ---------------------------------
// These are fixed addresses on the shared I2C bus (SDA=8, SCL=9, set up once
// by nr.begin()) or STM32 channels via the Newrick library -- not header
// pins, so no HARDWARE.md §2 row applies and no TBD blocks them.
#define I2C_ADDR_STM32  0x08
#define I2C_ADDR_OLED   0x3C
#define I2C_ADDR_MPU6050 0x68
