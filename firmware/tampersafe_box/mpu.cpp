#include "mpu.h"
#include "pins.h"
#include "events.h"

#include <Wire.h>
#include <math.h>

// MPU6050 registers (RM-MPU-6000A datasheet).
#define REG_WHO_AM_I     0x75
#define REG_PWR_MGMT_1   0x6B
#define REG_ACCEL_CONFIG 0x1C
#define REG_ACCEL_XOUT_H 0x3B

// +/-8g full scale => 4096 LSB/g (AFS_SEL=2, bits 4:3 = 0b10).
#define ACCEL_CONFIG_FS_8G 0x10
#define ACCEL_LSB_PER_G    4096.0f

static bool writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(I2C_ADDR_MPU6050);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

bool mpuInit() {
  Wire.beginTransmission(I2C_ADDR_MPU6050);
  Wire.write(REG_WHO_AM_I);
  if (Wire.endTransmission() != 0) return false;
  if (Wire.requestFrom((uint16_t)I2C_ADDR_MPU6050, (uint8_t)1) != 1) return false;
  Wire.read(); // WHO_AM_I value itself isn't checked strictly (some clones
               // answer with a different constant) -- reachability is what
               // matters here; the i2c_scan bring-up sketch is the real
               // "is 0x68 present" check.

  if (!writeReg(REG_PWR_MGMT_1, 0x00)) return false;       // wake from sleep
  if (!writeReg(REG_ACCEL_CONFIG, ACCEL_CONFIG_FS_8G)) return false; // +/-8g
  return true;
}

bool mpuReadAccelTilt(int32_t *outAccelMg, int32_t *outTiltDeg) {
  Wire.beginTransmission(I2C_ADDR_MPU6050);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission() != 0) return false; // stale values kept by caller
  if (Wire.requestFrom((uint16_t)I2C_ADDR_MPU6050, (uint8_t)6) != 6) return false;

  int16_t ax = (Wire.read() << 8) | Wire.read();
  int16_t ay = (Wire.read() << 8) | Wire.read();
  int16_t az = (Wire.read() << 8) | Wire.read();

  float axg = ax / ACCEL_LSB_PER_G;
  float ayg = ay / ACCEL_LSB_PER_G;
  float azg = az / ACCEL_LSB_PER_G;

  float mag = sqrtf(axg * axg + ayg * ayg + azg * azg);
  *outAccelMg = (int32_t)lroundf(mag * 1000.0f);

  // Tilt = angle between the measured accel vector and the +Z axis, which
  // approximates device tilt from vertical when the box is roughly static
  // (accel vector ~= gravity). Not valid during a genuine free-fall/shock
  // transient, which is exactly when SHOCK (not TILT) should be firing.
  float magSafe = (mag < 0.01f) ? 0.01f : mag;
  float cosTilt = azg / magSafe;
  if (cosTilt > 1.0f) cosTilt = 1.0f;
  if (cosTilt < -1.0f) cosTilt = -1.0f;
  *outTiltDeg = (int32_t)lroundf(acosf(cosTilt) * 180.0f / (float)M_PI);

  return true;
}

// SHOCK: |accel| > 2.5g, rate-limited to at most 1 per 10s (HARDWARE.md §5).
static unsigned long lastShockMs = 0;
#define SHOCK_THRESHOLD_MG 2500
#define SHOCK_RATE_LIMIT_MS 10000

// TILT: >60 deg sustained for 3s (HARDWARE.md §5). Fires once per excursion
// (re-arms only once tilt drops back below the threshold), since the rule
// doesn't specify a repeat rate the way SHOCK does.
#define TILT_THRESHOLD_DEG 60
#define TILT_SUSTAIN_MS 3000
static unsigned long tiltExceededSinceMs = 0; // 0 = not currently exceeding
static bool tiltAlertFiredThisExcursion = false;

void mpuEvaluateAlerts(int32_t accelMg, int32_t tiltDeg) {
  unsigned long now = millis();

  if (abs(accelMg) > SHOCK_THRESHOLD_MG) {
    if (now - lastShockMs >= SHOCK_RATE_LIMIT_MS || lastShockMs == 0) {
      lastShockMs = now;
      emitAlertEvent(10); // SHOCK
    }
  }

  if (tiltDeg > TILT_THRESHOLD_DEG) {
    if (tiltExceededSinceMs == 0) tiltExceededSinceMs = now;
    if (!tiltAlertFiredThisExcursion && (now - tiltExceededSinceMs) >= TILT_SUSTAIN_MS) {
      tiltAlertFiredThisExcursion = true;
      emitAlertEvent(11); // TILT
    }
  } else {
    tiltExceededSinceMs = 0;
    tiltAlertFiredThisExcursion = false;
  }
}
