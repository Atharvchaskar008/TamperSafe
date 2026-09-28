#pragma once
#include <Arduino.h>

// MPU6050 read over the shared I2C bus (SDA=8, SCL=9, already brought up by
// nr.begin() at 400 kHz). Raw register access per docs/HARDWARE.md §6 --
// deliberately NOT the Adafruit_MPU6050 library, because Adafruit_BusIO's
// Adafruit_I2CDevice::begin() calls _wire->begin() again, which would
// violate "never call Wire.begin()/setClock() after nr.begin()".
//
// Never calls Wire.begin() or Wire.setClock() -- only beginTransmission /
// write / endTransmission / requestFrom / read on the existing Wire
// instance.

// Wakes the MPU6050 and sets the accelerometer range to +/-8g (4096 LSB/g),
// so the >2.5g SHOCK threshold (HARDWARE.md §5) is actually reachable --
// the chip powers up at +/-2g full scale, under which 2.5g is unreachable.
// Returns false if WHO_AM_I doesn't answer or any write fails; the caller
// should treat readings as stale/unavailable in that case.
bool mpuInit();

// Reads accel + computes tilt. On success fills outAccelMg (magnitude in
// milli-g) and outTiltDeg (angle from vertical, degrees) and returns true.
// On any I2C failure, leaves both outputs UNCHANGED (stale-but-not-garbage)
// and returns false, per "always check the bool return value" (CLAUDE.md).
bool mpuReadAccelTilt(int32_t *outAccelMg, int32_t *outTiltDeg);

// Evaluates the §5 SHOCK/TILT rules against the latest reading and emits
// ALERT events as needed (rate-limited). Call at 20 Hz. Never changes box
// state -- alerts are evidence only (ARCHITECTURE §8).
void mpuEvaluateAlerts(int32_t accelMg, int32_t tiltDeg);
