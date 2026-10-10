/*
  ALS Rehab Sensor Node — MPU6050 (motion) + Pmod ISNS20 (current)

  Reads limb motion from the MPU6050 to count reps for a training program,
  and monitors motor/actuator current from the Pmod ISNS20 for over-current
  safety cutoff. Talks to a host (PC/RPi bridge script) over Serial using a
  small line protocol. The host relays status to POST /api/devices/telemetry
  ({ deviceId, state: RUNNING | DONE, reps, totalReps, durationSec }) with the
  board's X-Device-Key header, and forwards the reply's START/STOP command
  back to this device. The board never knows which patient it measures: the
  database links each set to the appointment the board is bound to.
  There is no rep target — a set ends at <durationSec> or on STOP.

  Wiring
  ------
  MPU6050 (I2C):
    VCC -> 5V (or 3.3V on 3.3V boards)   GND -> GND
    SCL -> A5 (Uno) / SCL pin            SDA -> A4 (Uno) / SDA pin
    AD0 -> GND (I2C address 0x68)

  Pmod ISNS20 (analog current sense, standalone/6-pin Pmod header):
    Pin1 ISEN (analog out) -> Arduino analog pin (ISNS_PIN, default A0)
    Pin5 VCC (3.3V) -> 3.3V              Pin6 GND -> GND
    Output is a 3.3V-referenced analog voltage centered near VCC/2 at 0A.
    Confirm ISNS_OFFSET_V / ISNS_SENSITIVITY against your board's datasheet
    revision before trusting the amp readings for safety cutoff.

  Serial protocol (115200 baud)
  ------------------------------
  Host -> device:
    START <durationSec>                 start a set (no rep target; the old
                                        "START <reps> <durationSec>" form is
                                        still accepted and the reps ignored)
    STOP                                abort the current session
  Device -> host:
    DATA,<elapsedSec>,<repCount>,<currentA>       periodic status (~5 Hz)
    ALERT,OVERCURRENT,<currentA>                  safety cutoff, session aborted
    DONE,<totalReps>,<durationSec>,<distanceCm>,<avgCurrentA>,<maxCurrentA>
*/

#include <Wire.h>

// ---------- MPU6050 ----------
const uint8_t MPU_ADDR = 0x68;
int16_t ax, ay, az, gx, gy, gz;
float gyroBiasZ = 0;

// ---------- Pmod ISNS20 ----------
const int ISNS_PIN = A0;
const float ADC_VREF = 5.0;            // Arduino logic supply used as ADC reference
const int ADC_RES = 1023;
const float ISNS_OFFSET_V = 1.65;      // Voltage at 0A — verify against datasheet
const float ISNS_SENSITIVITY = 0.066;  // V per A — verify against datasheet
const float CURRENT_SAFETY_LIMIT_A = 15.0;

// ---------- Rep detection ----------
const float REP_THRESHOLD_G = 0.35;    // accel-magnitude swing that counts as motion, tune per exercise
const unsigned long REP_DEBOUNCE_MS = 400;
bool aboveThreshold = false;
unsigned long lastRepTime = 0;

// crude distance estimate: integrate angular swing per rep * assumed limb length
const float LIMB_LENGTH_CM = 30.0;
float lastRepAngleAccumDeg = 0;
float totalDistanceCm = 0;

// ---------- Session state ----------
bool sessionRunning = false;
unsigned long targetDurationMs = 0;
unsigned long sessionStartMs = 0;
int repCount = 0;
float currentSum = 0;
float currentMax = 0;
unsigned int currentSamples = 0;
unsigned long lastReportMs = 0;
unsigned long lastGyroMs = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  mpuInit();
  calibrateGyro();
}

void loop() {
  handleSerialCommands();
  if (sessionRunning) {
    updateMotion();
    updateCurrent();
    reportProgress();
    checkSessionEnd();
  }
}

// ---------- MPU6050 ----------
void mpuInit() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);  // wake up
  Wire.endTransmission(true);
}

void calibrateGyro() {
  const int samples = 200;
  long sumGz = 0;
  for (int i = 0; i < samples; i++) {
    readMpuRaw();
    sumGz += gz;
    delay(3);
  }
  gyroBiasZ = sumGz / (float)samples;
}

void readMpuRaw() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);  // ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)14, (uint8_t)true);
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();  // skip temperature
  gx = (Wire.read() << 8) | Wire.read();
  gy = (Wire.read() << 8) | Wire.read();
  gz = (Wire.read() << 8) | Wire.read();
}

void updateMotion() {
  readMpuRaw();

  // accel magnitude in g, default MPU6050 sensitivity +-2g => 16384 LSB/g
  float gx_g = ax / 16384.0;
  float gy_g = ay / 16384.0;
  float gz_g = az / 16384.0;
  float magnitude = sqrt(gx_g * gx_g + gy_g * gy_g + gz_g * gz_g);
  float swing = fabs(magnitude - 1.0);  // deviation from resting 1g

  unsigned long now = millis();
  float dt = lastGyroMs == 0 ? 0 : (now - lastGyroMs) / 1000.0;
  lastGyroMs = now;

  // integrate yaw rate while swinging, for a rough per-rep distance estimate
  float gz_dps = (gz - gyroBiasZ) / 131.0;  // default +-250 dps => 131 LSB/(deg/s)
  if (swing > REP_THRESHOLD_G) {
    lastRepAngleAccumDeg += fabs(gz_dps) * dt;
  }

  bool nowAbove = swing > REP_THRESHOLD_G;
  if (nowAbove && !aboveThreshold && (now - lastRepTime) > REP_DEBOUNCE_MS) {
    repCount++;
    lastRepTime = now;
    float angleRad = lastRepAngleAccumDeg * PI / 180.0;
    totalDistanceCm += angleRad * LIMB_LENGTH_CM;
    lastRepAngleAccumDeg = 0;
  }
  aboveThreshold = nowAbove;
}

// ---------- Pmod ISNS20 ----------
float readCurrentAmps() {
  int raw = analogRead(ISNS_PIN);
  float volts = raw * (ADC_VREF / ADC_RES);
  return (volts - ISNS_OFFSET_V) / ISNS_SENSITIVITY;
}

void updateCurrent() {
  float amps = readCurrentAmps();
  currentSum += amps;
  currentMax = max(currentMax, fabs(amps));
  currentSamples++;

  if (fabs(amps) > CURRENT_SAFETY_LIMIT_A) {
    Serial.print("ALERT,OVERCURRENT,");
    Serial.println(amps, 2);
    endSession();
  }
}

// ---------- Session control ----------
void startSession(unsigned long durationSec) {
  targetDurationMs = durationSec * 1000UL;
  sessionStartMs = millis();
  repCount = 0;
  totalDistanceCm = 0;
  lastRepAngleAccumDeg = 0;
  currentSum = 0;
  currentMax = 0;
  currentSamples = 0;
  lastReportMs = 0;
  lastGyroMs = 0;
  sessionRunning = true;
}

void reportProgress() {
  unsigned long now = millis();
  if (now - lastReportMs < 200) return;  // ~5 Hz
  lastReportMs = now;
  Serial.print("DATA,");
  Serial.print((now - sessionStartMs) / 1000);
  Serial.print(",");
  Serial.print(repCount);
  Serial.print(",");
  Serial.println(readCurrentAmps(), 2);
}

void checkSessionEnd() {
  unsigned long elapsed = millis() - sessionStartMs;
  // ไม่มีเป้าหมายจำนวนครั้ง — จบเมื่อครบเวลาของเซต (หรือได้ STOP / กระแสเกิน)
  if (elapsed >= targetDurationMs) {
    endSession();
  }
}

void endSession() {
  if (!sessionRunning) return;
  sessionRunning = false;
  float avgCurrent = currentSamples ? currentSum / currentSamples : 0;
  Serial.print("DONE,");
  Serial.print(repCount);
  Serial.print(",");
  Serial.print((millis() - sessionStartMs) / 1000);
  Serial.print(",");
  Serial.print(totalDistanceCm, 2);
  Serial.print(",");
  Serial.print(avgCurrent, 2);
  Serial.print(",");
  Serial.println(currentMax, 2);
}

// ---------- Serial command handling ----------
void handleSerialCommands() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.startsWith("START")) {
    unsigned long a = 0, b = 0;
    int n = sscanf(line.c_str(), "START %lu %lu", &a, &b);
    unsigned long durationSec = n >= 2 ? b : a;  // รูปแบบเก่ามีจำนวนครั้งนำหน้า — ไม่ใช้แล้ว
    if (durationSec > 0) startSession(durationSec);
  } else if (line == "STOP") {
    endSession();
  }
}
