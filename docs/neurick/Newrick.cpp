#include "Newrick.h"

void Newrick::begin(int sda_pin, int scl_pin) {
  Wire.begin(sda_pin, scl_pin);
  Wire.setClock(400000); 
  
  enc1 = enc2 = enc3 = enc4 = 0;
  current1 = current2 = current3 = current4 = batteryVolts = 0;
  buttonState = 0;
}

void Newrick::motor(uint8_t motor_id, int16_t speed) {
  if (motor_id < 1 || motor_id > 4) return;
  if (speed > 1000) speed = 1000;
  if (speed < -1000) speed = -1000;

  Wire.beginTransmission(_i2c_addr);
  Wire.write(0x10);                      
  Wire.write(motor_id);                  
  Wire.write((speed >> 8) & 0xFF);       
  Wire.write(speed & 0xFF);              
  Wire.endTransmission();
}

void Newrick::servo(uint8_t s1_angle, uint8_t s2_angle, uint8_t s4_angle) {
  if (s1_angle > 180) s1_angle = 180;
  if (s2_angle > 180) s2_angle = 180;
  if (s4_angle > 180) s4_angle = 180;

  Wire.beginTransmission(_i2c_addr);
  Wire.write(0x40); 
  Wire.write(s1_angle); 
  Wire.write(s2_angle); 
  Wire.write(s4_angle); 
  Wire.endTransmission();
}

// ==========================================
// NEW: Reset Encoders Function
// ==========================================
void Newrick::resetEncoders() {
  Wire.beginTransmission(_i2c_addr);
  Wire.write(0x50); // Send the reset command to STM32
  Wire.endTransmission();

  // Reset the local ESP32 variables immediately
  enc1 = 0;
  enc2 = 0;
  enc3 = 0;
  enc4 = 0;
}

bool Newrick::updateEncoders() {
  Wire.beginTransmission(_i2c_addr);
  Wire.write(0x20);                      
  if (Wire.endTransmission() != 0) return false; 

  if (Wire.requestFrom((uint16_t)_i2c_addr, (uint8_t)17) == 17) {
    uint8_t buf[17];
    uint8_t checksum = 0;
    for (int i = 0; i < 17; i++) {
      buf[i] = Wire.read();
      if (i < 16) checksum ^= buf[i];
    }
    if (checksum != buf[16]) return false;

    enc1 = (uint32_t)buf[0] | ((uint32_t)buf[1] << 8) | ((uint32_t)buf[2] << 16) | ((uint32_t)buf[3] << 24);
    enc2 = (uint32_t)buf[4] | ((uint32_t)buf[5] << 8) | ((uint32_t)buf[6] << 16) | ((uint32_t)buf[7] << 24);
    enc3 = (uint32_t)buf[8] | ((uint32_t)buf[9] << 8) | ((uint32_t)buf[10] << 16) | ((uint32_t)buf[11] << 24);
    enc4 = (uint32_t)buf[12] | ((uint32_t)buf[13] << 8) | ((uint32_t)buf[14] << 16) | ((uint32_t)buf[15] << 24);
    return true;
  }
  return false;
}

bool Newrick::updateSensors() {
  Wire.beginTransmission(_i2c_addr);
  Wire.write(0x30);                      
  if (Wire.endTransmission() != 0) return false; 

  if (Wire.requestFrom((uint16_t)_i2c_addr, (uint8_t)12) == 12) {
    uint8_t buf[12];
    uint8_t checksum = 0;
    for (int i = 0; i < 12; i++) {
      buf[i] = Wire.read();
      if (i < 11) checksum ^= buf[i];
    }
    if (checksum != buf[11]) return false;

    uint16_t rawC1 = buf[0] | (buf[1] << 8);
    uint16_t rawC2 = buf[2] | (buf[3] << 8);
    uint16_t rawC3 = buf[4] | (buf[5] << 8);
    uint16_t rawC4 = buf[6] | (buf[7] << 8);
    uint16_t rawV  = buf[8] | (buf[9] << 8);
    
    buttonState = buf[10]; 

    batteryVolts = (rawV * 0.000805) * 11.0;
    current1 = (rawC1 * 0.000805) / 0.6;
    current2 = (rawC2 * 0.000805) / 0.6;
    current3 = (rawC3 * 0.000805) / 0.6;
    current4 = (rawC4 * 0.000805) / 0.6;

    return true;
  }
  return false;
}