// TamperSafe bring-up: MPU6050 raw register read.
//
// Reads raw accelerometer registers over the shared I2C bus (already
// brought up by nr.begin()) and prints them to Serial, per
// docs/HARDWARE.md §6: "read the raw registers over the shared bus... Re-run
// the I2C scan afterwards to confirm 0x3C and 0x68 still answer."
//
// Deliberately NOT the Adafruit_MPU6050 library: Adafruit_BusIO's
// Adafruit_I2CDevice::begin() calls _wire->begin() again, which would
// violate "never call Wire.begin()/setClock() after nr.begin()".

#include <Newrick.h>
#include <Wire.h>
#include <math.h>

Newrick nr;

#define MPU_ADDR 0x68
#define REG_WHO_AM_I     0x75
#define REG_PWR_MGMT_1   0x6B
#define REG_ACCEL_CONFIG 0x1C
#define REG_ACCEL_XOUT_H 0x3B
#define ACCEL_CONFIG_FS_8G 0x10   // +/-8g, 4096 LSB/g
#define ACCEL_LSB_PER_G 4096.0f

static bool writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  nr.begin();

  Serial.println("TamperSafe bring-up: mpu");

  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_WHO_AM_I);
  if (Wire.endTransmission() == 0 && Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)1) == 1) {
    Serial.printf("WHO_AM_I = 0x%02X\n", Wire.read());
  } else {
    Serial.println("WARNING: MPU6050 did not answer WHO_AM_I -- check wiring/battery");
  }

  bool ok = writeReg(REG_PWR_MGMT_1, 0x00) && writeReg(REG_ACCEL_CONFIG, ACCEL_CONFIG_FS_8G);
  Serial.println(ok ? "MPU6050 woken, range set to +/-8g" : "WARNING: MPU6050 init write failed");
}

void loop() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(REG_ACCEL_XOUT_H);
  if (Wire.endTransmission() != 0 || Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)6) != 6) {
    Serial.println("MPU6050 read failed");
    delay(200);
    return;
  }

  int16_t ax = (Wire.read() << 8) | Wire.read();
  int16_t ay = (Wire.read() << 8) | Wire.read();
  int16_t az = (Wire.read() << 8) | Wire.read();

  float axg = ax / ACCEL_LSB_PER_G;
  float ayg = ay / ACCEL_LSB_PER_G;
  float azg = az / ACCEL_LSB_PER_G;

  Serial.printf("raw ax=%d ay=%d az=%d  |  ax=%.3fg ay=%.3fg az=%.3fg |a|=%.3fg\n",
                ax, ay, az, axg, ayg, azg, sqrtf(axg * axg + ayg * ayg + azg * azg));
  delay(200); // ~5 Hz, plenty for eyeballing on Serial
}
