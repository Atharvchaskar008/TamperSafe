#ifndef NEWRICK_H
#define NEWRICK_H

#include <Arduino.h>
#include <Wire.h>

class Newrick {
  private:
    const uint8_t _i2c_addr = 0x08;

  public:
    int32_t enc1, enc2, enc3, enc4;
    float current1, current2, current3, current4;
    float batteryVolts;
    uint8_t buttonState;

    void begin(int sda_pin = 8, int scl_pin = 9);
    void motor(uint8_t motor_id, int16_t speed);
    void servo(uint8_t s1_angle, uint8_t s2_angle, uint8_t s4_angle);
    
    void resetEncoders(); // NEW: Reset function

    bool updateEncoders();
    bool updateSensors();
};

#endif