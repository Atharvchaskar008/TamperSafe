# TamperSafe — Hardware

Board facts and wiring rules live in `CLAUDE.md` and the `neurick-firmware` skill. This file holds TamperSafe's parts, wiring, mounting and tamper thresholds. Section numbers are referenced from `docs/ARCHITECTURE.md` and the plan.

---

## 1. Inventory: confirm with the team in M0 before any wiring

| Item | Planned part | Actual model | Supply | Check |
| :--- | :--- | :--- | :--- | :--- |
| Ultrasonic | HC-SR04 | **HC-SR04** (`sensors.xlsx` #5, confirmed 5 V variant) | 5 V | ECHO needs the 1k/2k divider (not the 3.3 V HC-SR04P variant) |
| IR lid sensor | FC-51 or TCRT5000 reflective module, digital OUT | **Generic IR obstacle-avoidance module** (`sensors.xlsx` #6, "Infrared Obstacle Detection 2-30cm") — same reflective digital-OUT-with-threshold-pot family as FC-51/TCRT5000, but confirm the exact board's supply voltage and OUT polarity (active-low vs active-high) physically before wiring | ☐ TBD — check | At 5 V, OUT needs a divider |
| GPS | u-blox NEO-6M (GY-NEO6MV2) + patch antenna | **NEO-6M** (`sensors.xlsx` #17, exact match) | 3.3–5 V | Measure that TX idles ≤ 3.3 V |
| Latch servo | SG90 / MG90S | ☐ **`sensors.xlsx` #8 is listed as "MG995 Metal Gear Servo... Tower Pro" but its own link is the MG996R product page (4.8–7.2 V, 500–900 mA, 180°, 3-wire PWM).** Confirm with the team which servo is physically in hand — MG995/MG996R is a much higher-torque/current part than the planned SG90/MG90S, still fine on the Neurick servo port but check the STM32's servo-driver current headroom | Neurick servo port | Needs the 12 V battery switched on |
| Box | Cardboard or acrylic, hinged lid, side compartment for board + battery | ☐ | — | Window so the OLED is visible |
| Passives | 1 kΩ + 2 kΩ resistors (ECHO divider), jumpers, foam padding | ☐ | — | — |
| Neurick P1 header map | from the Neurick manual | ☐ (library source `docs/neurick/Newrick.h`/`.cpp` received 2026-09-28; confirms the STM32 I2C command protocol and `servo(s1,s2,s4)` — no S3. Still no physical P1 header pinout) | — | Needed to fill the header column in §2 |
| RFID reader | MFRC522 (13.56 MHz, SPI) + at least one tag/card per demo package | **RC522 (MFRC522 chip)** (`sensors.xlsx` #10, exact match) | 3.3 V | SPI, not I2C — needs its own SCK/MOSI/MISO/SDA(SS)/RST pins, separate from the shared I2C bus |
| Optional | LDR + 10 kΩ, microSD card | **LDR** (`sensors.xlsx` #18) and **8 GB Sandisk microSD** (`sensors.xlsx` #1) both confirmed in hand | 3.3 V | Stretch only |

---

## 2. Pin map

The GPIOs below are **proposed**. They avoid the unavailable pins, the strapping pins and ADC-only needs. Every header pin is **TBD: confirm against the Neurick manual**. A TBD row blocks any firmware that uses that pin.

| Function | Module pin | ESP32-S3 GPIO | P1 header pin | Supply | Level handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GPS → ESP (UART1 RX) | TX | 17 | TBD | 3.3 V (5 V if the module needs it) | Direct if TX ≤ 3.3 V, else 1k/2k divider |
| ESP → GPS (UART1 TX) | RX | 18 | TBD | — | Optional (config only) |
| Ultrasonic trigger | TRIG | 12 | TBD | 5 V | Direct |
| Ultrasonic echo | ECHO | 13 | TBD | 5 V | **1k/2k divider** → 3.3 V |
| IR lid sensor | OUT | 14 | TBD | 3.3 V | Direct |
| Latch servo | signal | STM32 servo **S1** | servo port | 12 V battery | `nr.servo(lockAngle, S2_REST, S4_REST)`. The real API is `servo(s1_angle, s2_angle, s4_angle)` — channels S1, S2, **S4** (no S3). All three are set together every call, so keep S2/S4 constants |
| Motion | — | onboard MPU6050 `0x68` | — | — | Shared I2C bus |
| Status | — | onboard OLED `0x3C` | — | — | Shared I2C bus |
| Depot / demo button | — | STM32 `buttonState` | — | — | Long press in IDLE = local reset (demo) |
| Stretch: LDR | AO | 4 (ADC1) | TBD | 3.3 V divider | — |
| RFID SCK / MOSI / MISO | MFRC522 SPI | TBD | TBD | 3.3 V | Direct. Confirm against the manual which P1 pins carry the ESP32-S3's SPI bus |
| RFID SDA (SS/CS) | MFRC522 | TBD | TBD | 3.3 V | Direct, any free GPIO |
| RFID RST | MFRC522 | TBD | TBD | 3.3 V | Direct, any free GPIO |

GPIO 12–18 are ADC2. They work as digital pins with Wi-Fi on, and only the stretch LDR is analog, so it takes the ADC1 pin. The RFID reader is SPI, so it needs its own dedicated pins in addition to the shared I2C bus (SDA=8, SCL=9) — do not reuse those two.

---

## 3. Power

- **Sensor load on the header 5 V / 3.3 V rails:** GPS ≈ 45 mA, HC-SR04 ≈ 15 mA, IR ≈ 20 mA. This is sensors only, which is what the rails are for.
- **Servo:** runs from the Neurick servo port, so the 12 V pack must be ON.
  - Move once to LOCK or UNLOCK, then hold. Avoid repeated re-commanding.
- **Untethered:** the box must run from the 12 V pack with USB unplugged. With the laptop's USB-C cable in, the ESP32 stays powered, so switching the pack off never produces `POWER_INTERRUPTED`.
- **Brownout:** a reset mid-transit reads as `POWER_INTERRUPTED` by design, so **a charged pack is a demo requirement**.
  - The firmware refuses SEAL when `batteryVolts` is below the threshold in §5.

---

## 4. Mounting

```
             side view, lid closed
   ┌──────[GPS antenna on top of lid]──────┐
   │ lid       [HC-SR04 facing down]   hook│◀── servo horn swings under the hook
   ├───────────────────────────────────────┤ ◀── IR module on the rim, facing lid underside
   │             ┌───────────┐             │
   │             │  package  │  ↕ baseline │
   │             │  (foam)   │    distance │
   │             └───────────┘             │
   └───────────────────────────────────────┘
   Neurick board + 12 V pack in a side compartment; OLED behind a window.
```

- **Ultrasonic:** on the underside of the lid, centred, pointing down at the package.
  - Keep the package top ≥ 5 cm below the sensor, because HC-SR04 readings are unreliable under ~2–3 cm.
  - A lifted lid makes the reading jump. A removed or swapped package shifts it to the floor or to the new height.
- **IR:** on the box rim, facing the lid's underside. Lid closed = reflection detected. Tune the module pot so it flips cleanly at about a 5 mm gap.
- **Servo latch:** on the inner wall. The horn swings under a hook fixed to the lid. Calibrate the LOCK and UNLOCK angles in M2.
- **Package:** pad it snugly with foam so that carrying the box does not move it (this matters for false tamper, §5).
- **GPS antenna:** on top of the lid, facing the sky. **Expect no fix indoors at the venue.**
- **Wiring:** loop the wires to the lid-mounted sensors through the hinge with slack.

---

## 5. Tamper thresholds (initial values; calibrate in M2, then overwrite this table)

| Signal | Sampling | Rule | Result |
| :--- | :--- | :--- | :--- |
| IR lid | 20 Hz | Lid reads open for 4 consecutive samples (200 ms) in SEALED | TAMPER `LID_OPENED` (1) |
| Ultrasonic | 10 Hz, median of last 5 | `abs(d − baseline) > 20 mm` sustained 1 s in SEALED | TAMPER `CONTENTS_DISTURBED` (2) |
| Ultrasonic health | 10 Hz | 10 consecutive invalid reads (0 or timeout) | ALERT `SENSOR_FAULT` (15) |
| Baseline | — | Median of 20 reads over 2 s after the servo locks | NVS `baseline_mm`; carried in the SEALED event |
| Boot | — | NVS state is SEALED at boot | TAMPER `POWER_INTERRUPTED` (3) |
| Shock | 20 Hz | `abs(accel) > 2.5 g`, at most 1 per 10 s | ALERT `SHOCK` (10) |
| Tilt | 20 Hz | Tilt > 60° for 3 s | ALERT `TILT` (11) |
| GPS | every loop | Valid when TinyGPS location is valid and its age < 5 s | Evidence only |
| RFID tag | 1 Hz | Read tag UID at seal (baseline). While SEALED, tag UID absent or changed for 3 consecutive reads (3 s) | ALERT `PACKAGE_MISMATCH` (16) — evidence only, never TAMPER |
| Battery | 2 Hz | `batteryVolts` < 10.5 V → refuse SEAL, show `LOW BATT` | — |
| Servo | — | LOCK angle = ☐, UNLOCK angle = ☐ | — |

---

## 6. Libraries (list them in the README)

- **Board and display:** `Newrick` (board library), Adafruit SSD1306 + Adafruit GFX.
- **Sensors and data:** TinyGPSPlus, ArduinoJson v7, MFRC522 (e.g. `miguelbalboa/rfid`) for the RFID reader.
- **ESP32 core:** WiFi, HTTPClient, Preferences (NVS), mbedtls (SHA-256, HMAC).
- **MPU6050:** read the raw registers over the shared bus, or use a library that accepts the existing `Wire` instance. Either way, re-run the I2C scan afterwards to confirm `0x3C` and `0x68` still answer.

---

## 7. Bring-up checklist (the M2 done-criterion)

1. Battery ON. The I2C scan shows `0x08`, `0x3C` and `0x68`.
2. Each sensor prints sane values on Serial **with Wi-Fi connected** (phone hotspot, 2.4 GHz).
3. The servo reaches LOCK and UNLOCK. With the latch locked, the lid cannot be lifted.
4. Seal the box, then walk it around the room for 60 s: **zero** tamper events.
5. Lift the lid 1 cm: `LID_OPENED` within 300 ms. Remove the package: `CONTENTS_DISTURBED` within 1.5 s.
6. Present the demo package's RFID tag, seal, then pull the tag away: `PACKAGE_MISMATCH` alert within 3 s, and confirm the order stays InTransit (no tamper, no escrow transition).
7. Write the calibrated thresholds and angles back into §5 and commit.
