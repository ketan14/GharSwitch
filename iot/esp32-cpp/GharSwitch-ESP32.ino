/*
  GharSwitch IoT — ESP32 Consolidated Sketch
  - Wi-Fi + NTP
  - Custom token → ID token + refresh
  - Firebase RTDB stream for commands
  - Presence heartbeat
  - Initial state sync
  - Safe GPIO init for relays (pins: 27, 26, 25, 33)

  Notes:
  - Replace placeholders with your actual values (SSID, PASSWORD, API_KEY, etc.).
  - Uses Firebase_ESP_Client library.
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include <Firebase_ESP_Client.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

// Removed addons/TokenHelper.h and RTDBHelper.h to save ~100KB of space

#include <LittleFS.h>
#include <ArduinoJson.h>

// ====== Config Variables (Loaded from LittleFS) ======
String wifi_ssid;
String wifi_pass;
String api_key;
String db_url;
String tenant_id;
String device_id;
String device_secret;
String auth_url;

// ====== Hardware Pins (ESP32) ======
const int S1_PIN = 27; // Was 12 (Strapping Pin - causing crash)
const int S2_PIN = 26; // Was 14
const int S3_PIN = 25; // Was 13
const int S4_PIN = 33; // Was 15 (Strapping Pin)
const int WIFI_LED_PIN = 2; // Onboard Blue LED

// ====== Firebase Objects ======
FirebaseData stream;
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ====== Globals ======
int simulatorFlag = 0; // 0 = Real Hardware, 1 = Simulator Mode
unsigned long lastHeartbeat = 0;

const unsigned long HEARTBEAT_INTERVAL = 600000UL; //300000UL; // 10 minutes

// ====== Paths (config-driven) ======
String BASE;
String PATH_CMD_PENDING;
String PATH_STATE_SWITCHES;
String PATH_PRESENCE;

// ====== Prototypes ======
void initPins();
bool loadConfig();
bool syncTime(uint32_t timeoutMs = 8000);
void updatePresence();
void syncInitialState();
String fetchCustomToken();
void executeSingleCommand(const String &cmdId, const String &target, bool action);
void handleCommand(const String &path, const String &payload);
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);

// ====== Setup ======
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Disable brownout detector
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n=================================");
  Serial.println("   GharSwitch ESP32 Starting...  ");
  Serial.println("=================================");

  // 1. Initialize LittleFS and load config
  if (!loadConfig()) {
    Serial.println("[CRITICAL] Config failed. Rebooting in 10s...");
    delay(10000);
    ESP.restart();
  }

  // Build base paths once
  BASE = "/tenants/" + tenant_id;
  PATH_CMD_PENDING   = BASE + "/device_commands/" + device_id + "/pending";
  PATH_STATE_SWITCHES= BASE + "/device_states/" + device_id + "/switches";
  PATH_PRESENCE      = BASE + "/presence/" + device_id;

  // Initialize GPIOs to safe state
  initPins();
  digitalWrite(WIFI_LED_PIN, LOW); // Ensure LED is off before connection

  // Connect Wi-Fi with LED blinking indicator
  Serial.printf("[NET] Connecting to Wi-Fi: %s\n", wifi_ssid.c_str());
  
  // Clean slate: Disconnect any previous connection
  WiFi.disconnect(true);
  delay(1000);
  
  // Configure WiFi mode and settings
  WiFi.mode(WIFI_STA);  // Station mode only (not AP)
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);  // Don't save to flash (faster)
  
  // Set WiFi power to maximum (helps with weak signals)
  WiFi.setTxPower(WIFI_POWER_19_5dBm);
  
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());
  Serial.println("[NET] Waiting up to 30 seconds for connection...");
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 120) {  // 120 × 250ms = 30 seconds
    // Blink LED while connecting
    digitalWrite(WIFI_LED_PIN, !digitalRead(WIFI_LED_PIN));
    delay(250);
    Serial.print(".");
    retry++;
  }
  Serial.println();
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET] Wi-Fi connection failed!");
    Serial.print("[NET] WiFi Status Code: ");
    Serial.println(WiFi.status());
    Serial.println("[NET] 1=No SSID | 4=Wrong Password | 6=Disconnected");
    // Rapid blink to indicate failure
    for (int i = 0; i < 20; i++) {
      digitalWrite(WIFI_LED_PIN, !digitalRead(WIFI_LED_PIN));
      delay(100);
    }
    Serial.println("[NET] Rebooting in 5s...");
    delay(5000);
    ESP.restart();
  }

  Serial.println("[NET] WiFi Connected Successfully!");
  digitalWrite(WIFI_LED_PIN, HIGH); // Turn on Blue LED
  Serial.printf("[NET] Local IP Address: %s\n", WiFi.localIP().toString().c_str());

  // NTP time sync (non-blocking with timeout)
  syncTime();

  // ====== Authentication (Custom Token Flow) ======
  Serial.println("[AUTH] Fetching Custom Token...");
  String customToken = fetchCustomToken();
  if (customToken == "") {
    Serial.println("[AUTH] Failed to fetch token. Rebooting in 5s...");
    delay(5000);
    ESP.restart();
  }

  // Firebase config
  config.api_key = api_key.c_str();
  config.database_url = db_url.c_str();

  // Assign the Custom Token to 'uid'. 
  // The library will automatically exchange this for an ID token.
  auth.token.uid = customToken.c_str();

  // Start Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Wait briefly for ready
  Serial.println("[FB] Connecting to Firebase...");
  int timeout = 0;
  while (!Firebase.ready() && timeout < 40) {
    delay(250);
    timeout++;
  }
  if (Firebase.ready()) {
    Serial.println("[AUTH] Firebase Authentication Successful!");
  } else {
    Serial.println("[AUTH] Firebase Authentication Failed!");
  }

  // Initial sync + presence
  syncInitialState();
  updatePresence();

  // Start stream
  Serial.println("[STREAM] Starting RTDB stream...");
  if (!Firebase.RTDB.beginStream(&stream, PATH_CMD_PENDING.c_str())) {
    Serial.printf("[STREAM] Begin error: %s\n", stream.errorReason().c_str());
  }
  Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
}

// ====== Loop ======
void loop() {
  // Check WiFi connection status
  if (WiFi.status() != WL_CONNECTED) {
    // Blink LED to indicate disconnection
    digitalWrite(WIFI_LED_PIN, HIGH);
    delay(500);
    return; // Skip other operations until reconnected
  } else {
    digitalWrite(WIFI_LED_PIN, !digitalRead(WIFI_LED_PIN));
    // Ensure LED is solid ON when connected
  }
  
  // Heartbeat every 5 minutes
  if (Firebase.ready() && (millis() - lastHeartbeat > HEARTBEAT_INTERVAL || lastHeartbeat == 0)) {
    lastHeartbeat = millis();
    updatePresence(); 
  }
}

void updatePresence();
void syncInitialState();
String fetchCustomToken();

// ====== Configuration Loader ======
bool loadConfig() {
  if (!LittleFS.begin(true)) {
    Serial.println("[FS] LittleFS mount failed.");
    return false;
  }

  File file = LittleFS.open("/config.json", "r");
  if (!file) {
    Serial.println("[FS] Failed to open config.json");
    return false;
  }

  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, file);
  file.close();

  if (error) {
    Serial.println("[JS] JSON Parse failed.");
    return false;
  }

  wifi_ssid = doc["wifi_ssid"].as<String>();
  wifi_pass = doc["wifi_pass"].as<String>();
  api_key = doc["api_key"].as<String>();
  db_url = doc["db_url"].as<String>();
  tenant_id = doc["tenant_id"].as<String>();
  device_id = doc["device_id"].as<String>();
  device_secret = doc["device_secret"].as<String>();
  auth_url = doc["auth_url"].as<String>();

  Serial.println("[FS] Config loaded successfully.");
  return true;
}

// ====== Helpers ======

void initPins() {
  if (simulatorFlag == 1) {
    Serial.println("[SIM] Simulator Mode Enabled. GPIOs will not be initialized/toggled.");
    return;
  }
  
  pinMode(S1_PIN, OUTPUT);
  pinMode(S2_PIN, OUTPUT);
  pinMode(S3_PIN, OUTPUT);
  pinMode(S4_PIN, OUTPUT);
  if (simulatorFlag == 0) {
    pinMode(WIFI_LED_PIN, OUTPUT);
  }

  // Safe initial state (Likely Active-LOW relays, so HIGH = OFF)
  digitalWrite(S1_PIN, HIGH);
  digitalWrite(S2_PIN, HIGH);
  digitalWrite(S3_PIN, HIGH);
  digitalWrite(S4_PIN, HIGH);
  Serial.println("[GPIO] Pins initialized to HIGH (Relays OFF).");
}

bool syncTime(uint32_t timeoutMs) {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    if (getLocalTime(&timeinfo)) {
      Serial.println("[NTP] Time synced.");
      return true;
    }
    delay(250);
  }
  Serial.println("[NTP] Sync timed out—continuing.");
  return false;
}

String fetchCustomToken() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // Step 1: Get Custom Token from Cloud Function
  http.begin(client, auth_url);
  http.addHeader("Content-Type", "application/json");
  FirebaseJson payload;
  payload.add("deviceId", device_id);
  payload.add("deviceSecret", device_secret);
  String jsonStr; payload.toString(jsonStr);

  int code = http.POST(jsonStr);
  if (code != 200) {
    Serial.printf("[AUTH] Failed to get Custom Token: %d\n", code);
    http.end();
    return "";
  }

  FirebaseJson resp; 
  resp.setJsonData(http.getString()); 
  http.end();

  FirebaseJsonData tok;
  resp.get(tok, "token");
  if (!tok.success) {
    Serial.println("[AUTH] Token field missing in response.");
    return "";
  }

  Serial.println("[AUTH] Custom Token acquired.");
  return tok.stringValue;
}

void updatePresence() {
  Serial.printf("[DEVICE] Sending heartbeat for %s...\n", device_id.c_str());
  
  // NOTE: setOnDisconnect is NOT supported by the REST-based library. 
  // We rely on the "Lazy Heartbeat" every 5 minutes.

  FirebaseJson onlineJson;
  onlineJson.add("online", true);
  onlineJson.add("lastSeen", (double)((uint64_t)time(NULL) * 1000ULL));

  // Use updateNode to keep it lightweight
  if (Firebase.RTDB.updateNode(&fbdo, PATH_PRESENCE.c_str(), &onlineJson)) {
    Serial.println("[SUCCESS] Presence updated.");
  } else {
    Serial.println(String("[ERROR] Presence update failed: ") + fbdo.errorReason());
  }
}

void syncInitialState() {
  Serial.println("[INIT] Fetching initial state...");
  if (!Firebase.RTDB.getJSON(&fbdo, PATH_STATE_SWITCHES.c_str())) {
    Serial.println(String("[INIT] Failed: ") + fbdo.errorReason());
    return;
  }
  if (fbdo.dataType() != "json") {
    Serial.println("[INIT] Unexpected type—skipping.");
    return;
  }

  FirebaseJson &json = fbdo.jsonObject();
  FirebaseJsonData val;

  struct { const char* key; int pin; } map[] = {
    {"s1", S1_PIN}, {"s2", S2_PIN}, {"s3", S3_PIN}, {"s4", S4_PIN}
  };

  for (auto &m : map) {
    if (json.get(val, m.key) && val.success) {
      bool state = false;
      if (val.stringValue == "true" || val.boolValue == true) {
         state = true;
      }
      
      if (simulatorFlag == 1) {
         Serial.printf("Switch %s got %s\n", m.key, state ? "ON" : "OFF");
      } else {
         // Active-LOW: True(ON) -> LOW, False(OFF) -> HIGH
         digitalWrite(m.pin, state ? LOW : HIGH);
      }
    }
  }
  Serial.println("[INIT] Initial state applied.");
}

void executeSingleCommand(const String &cmdId, const String &target, bool action) {
  int pin = -1;
  if (target == "s1") pin = S1_PIN;
  else if (target == "s2") pin = S2_PIN;
  else if (target == "s3") pin = S3_PIN;
  else if (target == "s4") pin = S4_PIN;

  if (pin == -1) {
    Serial.printf("[CMD] Unknown target: %s\n", target.c_str());
    return;
  }

  // Apply locally
  if (simulatorFlag == 1) {
    Serial.printf("Switch %s got %s\n", target.c_str(), action ? "ON" : "OFF");
  } else {
    // Active-LOW: True(ON) -> LOW, False(OFF) -> HIGH
    digitalWrite(pin, action ? LOW : HIGH);
    Serial.printf("[STATUS] Switch %s changed to %s\n", target.c_str(), action ? "ON" : "OFF");
  }

  // 1) Update remote state
  FirebaseJson update;
  update.add(target, action);
  if (!Firebase.RTDB.updateNode(&fbdo, PATH_STATE_SWITCHES.c_str(), &update)) {
    Serial.println(String("[STATE] Update failed: ") + fbdo.errorReason());
    return;
  }

  // 2) Acknowledge/delete command
  String ackPath = PATH_CMD_PENDING + "/" + cmdId;
  if (!Firebase.RTDB.deleteNode(&fbdo, ackPath.c_str())) {
    Serial.println(String("[ACK] Delete failed: ") + fbdo.errorReason());
    // Optional: write processed marker instead of delete
  } else {
    Serial.printf("[SUCCESS] Pending command %s processed and cleared successfully.\n", cmdId.c_str());
  }

  // 3) Presence bump
  updatePresence();
}

void handleCommand(const String &path, const String &payload) {
  if (payload == "null" || payload.length() == 0) return;

  FirebaseJson json;
  json.setJsonData(payload);

  if (path == "/") {
    // Root path: multiple commands
    size_t len = json.iteratorBegin();
    String key, value;
    int type = 0;
    for (size_t i = 0; i < len; i++) {
      json.iteratorGet(i, type, key, value);
      if (type == FirebaseJson::JSON_OBJECT) {
        FirebaseJson cmd;
        cmd.setJsonData(value);
        FirebaseJsonData targetData, actionData;
        cmd.get(targetData, "target");
        cmd.get(actionData, "action");
        if (targetData.success && actionData.success) {
          executeSingleCommand(key, targetData.stringValue, actionData.boolValue);
        } else {
          Serial.printf("[CMD] Malformed command: %s\n", key.c_str());
        }
      }
    }
    json.iteratorEnd();
  } else {
    // Specific path /CMD_ID
    String cmdId = path.substring(1);
    FirebaseJsonData targetData, actionData;
    json.get(targetData, "target");
    json.get(actionData, "action");
    if (targetData.success && actionData.success) {
      executeSingleCommand(cmdId, targetData.stringValue, actionData.boolValue);
    } else {
      Serial.printf("[CMD] Malformed single command: %s\n", cmdId.c_str());
    }
  }
}

void streamCallback(FirebaseStream data) {
  const String evt = data.eventType();
  const String payload = data.payload();
  const String dpath = data.dataPath();

  Serial.printf("[STREAM] Path: %s, Event: %s\n", dpath.c_str(), evt.c_str());
  if (payload == "null") return;

  if (evt == "put" || evt == "patch") {
    handleCommand(dpath, payload);
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) Serial.println("[STREAM] Timeout—resuming...");
}
