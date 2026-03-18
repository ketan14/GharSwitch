#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

void setup() {
    Serial.begin(115200);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    // --- THE STABILITY FIX ---
    // This prevents the ESP32 radio from entering "Modem Sleep"
    WiFi.setSleep(false); 
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConnected!");
}

// 2 Hours in milliseconds
const unsigned long RESTART_INTERVAL = 2UL * 60UL * 60UL * 1000UL;

void loop() {
    // 1. Check for scheduled stability restart
    if (millis() > RESTART_INTERVAL) {
        Serial.println("[SYSTEM] 2-Hour scheduled reboot for stability...");
        ESP.restart();
    }

    // ... your regular loop code goes here ...
    
    // Small delay to yield to the underlying FreeRTOS task and prevent watchdog panic
    delay(10); 
}