
# ESP32 C++ (Arduino) Boilerplate

This folder contains the C++ implementation for the ESP32. It is designed to be highly efficient and stable for production use.

## 🎯 Alignment with Pico (main.py)
This code follows the exact same logic as your Pico implementation:
1. **Real-time Connection**: Uses SSE (Server-Sent Events) via `Firebase.RTDB.beginStream` instead of polling.
2. **Command Pattern**: Listens to `/tenants/{id}/device_commands/{deviceId}/pending`.
3. **Acknowledgment**: Executes the switch toggle and then `DELETE`s the pending command from the database.
4. **Presence**: Updates a `heartbeat` in `/presence` every 10 minutes.
5. **Hardware**: Defaults to the same pin mapping (S1=15, S2=14, S3=13, S4=12).

## 🛠 Prerequisites
1. **Arduino IDE** or **VS Code + PlatformIO**.
2. **ESP32 Board Support**: Install "esp32" by Espressif Systems in the Board Manager.
3. **Required Library**:
   - `Firebase-ESP-Client` by **Mobizt** (Search in Library Manager).
   - `ArduinoJson` (Usually installed automatically with the Firebase library).

## 🚀 How to Setup
1. Open `GharSwitch-ESP32.ino`.
2. Update the `#define` section at the top with:
   - Your Wi-Fi Credentials.
   - Your Firebase Web API Key (found in Firebase Project Settings).
   - Your Project Database URL.
   - Your specific Tenant and Device details.
3. Compile and Upload to your ESP32.

## 📦 Why use C++?
- **Stability**: C++ is more robust for 24/7 operation.
- **Memory**: Uses significantly less RAM than MicroPython, allowing for smaller/cheaper ESP32 variants (like C3).
- **Speed**: Instantaneous JSON parsing and SSL handling.


SAFE (Use freely):

4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33


AVOID:

0, 2, 12, 15
