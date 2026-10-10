/*
  ALS Rehab Sensor Node — WiFi/HTTP variant (ESP32)

  Talks to the web app directly over WiFi — no PC bridge script needed.
  The device only needs its own DEVICE_ID and never knows which patient it is
  measuring: the database binds the board to one appointment at a time
  (devices.current_appointment_id, set when the therapist connects the board)
  and links every set back to that patient. Values sent while the board is
  not bound are rejected.

  Flow (everything goes through POST /api/devices/telemetry):
    1. Idle: send a heartbeat every IDLE_REPORT_MS with battery/voltage/current.
       The reply carries any command the patient app left for this device.
    2. Reply command "START" (therapist connected the board, or started the
       next set): start counting. There is no rep target — the patient does
       as many as they can; the set ends at setDurationSec or on "STOP".
    3. Running: send { state: "RUNNING", reps } every RUN_REPORT_MS so the
       patient screen counts live. A "STOP" command ends the set early.
    4. Set ends (set time, STOP or over-current):
       send { state: "DONE", totalReps, durationSec, distanceCm } and the
       backend records the therapy session for the patient.

  Requires the "ArduinoJson" library v7 (Library Manager -> "ArduinoJson" by
  Benoit Blanchon). Board: ESP32 (WiFi.h + HTTPClient.h from the ESP32 core).

  Wiring
  ------
    MPU6050:     SDA/SCL -> board's I2C pins, AD0 -> GND (address 0x68)
    Pmod ISNS20: put it IN SERIES between the power supply and the motor/load.
                 ISEN (pin1) -> ISNS_PIN, VCC 3.3V, GND
    Battery:     battery+ -> R1 -> BATTERY_PIN -> R2 -> GND (voltage divider,
                 keep the pin below 3.3V). Set BATTERY_PIN = -1 if not wired.
    ALL GROUNDS (power supply, ESP32, sensors) MUST BE CONNECTED TOGETHER.
    Use ADC1 pins only (GPIO 32-39): ADC2 pins stop working while WiFi is on.
*/

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ---------- Config: fill in per device ----------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// NOTb localhost — that would be the ESP32 itself. Use the PC's LAN IP
// (e.g. "http://192.168.1.10:3000") or the deployed backend URL, no trailing slash.
const char* API_BASE_URL = "http://192.168.1.10:3000";
const char* DEVICE_ID = "DEV000001";  // must match a device in the web app's device inventory
// Key issued by the web app (PATCH /api/devices { deviceId, issueKey: true }). The database only stores
// its SHA-256 hash. Leave empty only while the board has no key yet.
const char* DEVICE_KEY = "";

// ---------- MPU6050 ----------
const uint8_t MPU_ADDR = 0x68;
int16_t ax, ay, az, gx, gy, gz;
float gyroBiasZ = 0;
bool imuOk = false;

// ---------- Pmod ISNS20 ----------
const int ISNS_PIN = 34;               // ADC1 pin
const float ADC_VREF = 3.3;
const int ADC_RES = 4095;              // 12-bit ADC on ESP32
const float ISNS_OFFSET_V = 1.65;      // verify against datasheet for your board rev
const float ISNS_SENSITIVITY = 0.066;  // V per A — verify against datasheet
const float CURRENT_SAFETY_LIMIT_A = 15.0;

// ---------- Battery / power supply ----------
const int BATTERY_PIN = 35;             // ADC1 pin, -1 = not wired (no battery reading)
const float DIVIDER_RATIO = (100.0 + 33.0) / 33.0;  // (R1 + R2) / R2 — 100k / 33k example
const float BATTERY_V_EMPTY = 6.4;      // example: 2S Li-ion. Set to your pack's empty voltage
const float BATTERY_V_FULL = 8.4;       // and full voltage

// ---------- Rep detection ----------
const float REP_THRESHOLD_G = 0.35;
const unsigned long REP_DEBOUNCE_MS = 400;
bool aboveThreshold = false;
unsigned long lastRepTime = 0;
const float LIMB_LENGTH_CM = 30.0;
float lastRepAngleAccumDeg = 0;
float totalDistanceCm = 0;

// ---------- Session state ----------
bool sessionRunning = false;
unsigned long targetDurationMs = 0;
unsigned long sessionStartMs = 0;
int repCount = 0;
float currentMax = 0;
float lastCurrentA = 0;
unsigned long lastGyroMs = 0;

// ---------- Reporting ----------
const unsigned long IDLE_REPORT_MS = 3000;  // heartbeat while waiting for START
const unsigned long RUN_REPORT_MS = 1000;   // live rep count while training
unsigned long lastReportMs = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  analogReadResolution(12);
  mpuInit();
  calibrateGyro();
  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    return;
  }

  if (sessionRunning) {
    updateMotion();
    updateCurrent();
    checkSessionEnd();
  } else {
    lastCurrentA = readCurrentAmps();
  }

  unsigned long now = millis();
  unsigned long interval = sessionRunning ? RUN_REPORT_MS : IDLE_REPORT_MS;
  if (now - lastReportMs >= interval) {
    lastReportMs = now;
    sendTelemetry(sessionRunning ? "RUNNING" : "IDLE");
  }
}

// ---------- WiFi ----------
void connectWifi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed, will retry");
}

// ---------- Telemetry + commands ----------
// Sends one report and acts on the command in the reply.
void sendTelemetry(const char* state) {
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["state"] = state;
  doc["current"] = lastCurrentA;
  doc["imuOk"] = imuOk;
  if (strcmp(state, "RUNNING") == 0) doc["reps"] = repCount;

  float volts = readBatteryVolts();
  if (volts > 0) {
    doc["voltage"] = volts;
    doc["batteryLevel"] = batteryPercent(volts);
  }

  if (strcmp(state, "DONE") == 0) {
    doc["totalReps"] = repCount;
    doc["durationSec"] = (millis() - sessionStartMs) / 1000;
    doc["distanceCm"] = totalDistanceCm;
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(String(API_BASE_URL) + "/api/devices/telemetry");
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_KEY) > 0) http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(body);
  if (code != 200) {
    Serial.printf("POST telemetry (%s) failed: %d %s\n", state, code, http.getString().c_str());
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  JsonDocument reply;
  if (deserializeJson(reply, payload)) return;
  const char* command = reply["command"] | "";

  if (strcmp(command, "START") == 0 && !sessionRunning) {
    long durationSec = reply["setDurationSec"] | 0;
    if (!(reply["bound"] | false) || durationSec <= 0) {
      Serial.println("START ignored: board is not bound to an appointment in progress");
      return;
    }
    Serial.printf("Starting set: up to %ld sec, no rep target\n", durationSec);
    startSession(durationSec);
  } else if (strcmp(command, "STOP") == 0 && sessionRunning) {
    Serial.println("STOP received from app");
    endSession();
  }
}

// ---------- MPU6050 ----------
void mpuInit() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  imuOk = Wire.endTransmission(true) == 0;
  if (!imuOk) Serial.println("MPU6050 not found — check wiring");
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
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, (uint8_t)14, (uint8_t)true);
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  Wire.read(); Wire.read();
  gx = (Wire.read() << 8) | Wire.read();
  gy = (Wire.read() << 8) | Wire.read();
  gz = (Wire.read() << 8) | Wire.read();
}

void updateMotion() {
  readMpuRaw();

  float gx_g = ax / 16384.0;
  float gy_g = ay / 16384.0;
  float gz_g = az / 16384.0;
  float magnitude = sqrt(gx_g * gx_g + gy_g * gy_g + gz_g * gz_g);
  float swing = fabs(magnitude - 1.0);

  unsigned long now = millis();
  float dt = lastGyroMs == 0 ? 0 : (now - lastGyroMs) / 1000.0;
  lastGyroMs = now;

  float gz_dps = (gz - gyroBiasZ) / 131.0;
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
  lastCurrentA = amps;
  currentMax = max(currentMax, fabs(amps));

  if (fabs(amps) > CURRENT_SAFETY_LIMIT_A) {
    Serial.printf("ALERT overcurrent: %.2f A\n", amps);
    endSession();
  }
}

// ---------- Battery ----------
// Returns the supply voltage in volts, or 0 when no battery pin is wired.
float readBatteryVolts() {
  if (BATTERY_PIN < 0) return 0;
  long sum = 0;
  for (int i = 0; i < 16; i++) sum += analogRead(BATTERY_PIN);  // average out ADC noise
  float pinVolts = (sum / 16.0) * (ADC_VREF / ADC_RES);
  return pinVolts * DIVIDER_RATIO;
}

int batteryPercent(float volts) {
  float pct = (volts - BATTERY_V_EMPTY) / (BATTERY_V_FULL - BATTERY_V_EMPTY) * 100.0;
  return constrain((int)round(pct), 0, 100);
}

// ---------- Session control ----------
void startSession(unsigned long durationSec) {
  targetDurationMs = durationSec * 1000UL;
  sessionStartMs = millis();
  repCount = 0;
  totalDistanceCm = 0;
  lastRepAngleAccumDeg = 0;
  currentMax = 0;
  lastGyroMs = 0;
  aboveThreshold = false;
  sessionRunning = true;
}

void checkSessionEnd() {
  unsigned long elapsed = millis() - sessionStartMs;
  // ไม่มีเป้าหมายจำนวนครั้ง — เซตจบเมื่อครบเวลาของเซต (หรือได้ STOP / กระแสเกิน)
  if (elapsed >= targetDurationMs) {
    endSession();
  }
}

void endSession() {
  if (!sessionRunning) return;
  sessionRunning = false;
  Serial.printf("Session done: %d reps, %lu sec, %.2f cm, maxCurrent %.2f A\n",
                repCount, (millis() - sessionStartMs) / 1000, totalDistanceCm, currentMax);
  sendTelemetry("DONE");
  lastReportMs = millis();
}
