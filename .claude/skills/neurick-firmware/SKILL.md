---
name: neurick-firmware
description: Use when writing, wiring, or debugging Arduino/ESP32-S3 firmware for the NEWRRO Neurick robotics board, including motors, servos, encoders, the OLED, the MPU6050, sensors on the P1 header, Wi-Fi/HTTP from the ESP32, or I2C and brownout problems.
---

# Neurick firmware discipline

## Before writing any sketch
1. Confirm which sensors are wired, to which P1 header pin, and at what supply voltage (3.3 V or 5 V).
2. Reject any plan that puts a 5 V signal straight on a GPIO. Require a divider (e.g. 1k/2k) or a level shifter.
3. Analog sensors go on ADC1 pins only: GPIO1, 4, 5, 6, 7, 10. ADC2 (GPIO11-18) is digital-only once Wi-Fi is on.

## Sketch structure rules
- `setup()`:
  1. `Serial.begin(115200); delay(2000);`
  2. `nr.begin();` (this starts I2C on 8/9 at 400 kHz)
  3. Then OLED `display.begin(SSD1306_SWITCHCAPVCC, 0x3C)`
  4. Then the other peripherals.
- Never call `Wire.begin()` or `Wire.setClock()` anywhere.
- Use a state machine plus `millis()` timing. No long `delay()` while motors run, because motor commands persist.
- Always check the return values of `updateEncoders()` and `updateSensors()`.
- Poll encoders at 50 Hz max and sensors at about 10 Hz max. The bus is shared with the OLED and MPU6050.
- Show the current state on the OLED and on Serial, for demo visibility and debugging.
- Wi-Fi: 2.4 GHz only (use a phone hotspot). Reconnect without blocking. Keep the relayer URL in one constant.
- Send data as JSON (ArduinoJson) via HTTPClient POST to the relayer. Timeouts should be at most 3 s.
- Provide a safe stop path that sets every motor to 0: on a button press, on network loss, and on a watchdog timeout.

## Debug checklist (in order)
1. Run an I2C scan. Expect 0x08, 0x3C and 0x68.
   - Missing 0x08: the battery is off.
   - Missing 0x3C or 0x68: a stray Wire.begin() somewhere.
2. Resets when the motors start: a brownout. Check `batteryVolts`, charge the pack, ramp speed up gradually.
3. Board won't boot or upload: unplug whatever is on header pins 20, 22 and 38 (strapping pins).
4. Garbage analog values with Wi-Fi on: the sensor is on an ADC2 pin.
5. Serial port busy: close the Serial Monitor before uploading.
6. Motors don't move: USB-only power, or `nr.begin()` wasn't called, or the speed is too small to overcome friction.

## Common sensor wiring
- HC-SR04:
  - 5 V supply
  - TRIG direct from a GPIO
  - ECHO through a 1k/2k divider
- MQ gas sensors:
  - 5 V heater, with 1-2 minutes of warm-up
  - AO through a divider into an ADC1 pin
- DHT11/22: 3.3 V, data line with a 10k pull-up. Read every 1 s (DHT11) or 2 s (DHT22).
- PIR HC-SR501: 5 V supply, output is about 3.3 V (OK). Needs roughly 60 s to settle.
- Capacitive soil probe or LDR divider: 3.3 V into an ADC1 pin.
