# GharSwitch IoT Hardware Documentation

This directory contains MicroPython implementations for physical smart switch hardware.

## 🚀 Supported Hardware
- **ESP32**: Standard ESP32 dev kits.
- **Pico W**: Raspberry Pi Pico W (with built-in WiFi).

## 🛠 Setup Instructions

### 1. Requirements
- Thonny IDE (recommended) or any MicroPython editor.
- MicroPython firmware flashed onto your device ([ESP32](https://micropython.org/download/esp32/) | [Pico W](https://micropython.org/download/rp2-pico-w/)).

### 2. Configuration
Navigate to your specific hardware folder (`iot/esp32` or `iot/pico`) and locate `config.py`. Update the following values:
```python
WIFI_SSID = "Your_Network_Name"
WIFI_PASS = "Your_Password"

DB_URL = "https://your-project.firebasedatabase.app"
TENANT_ID = "your_tenant_id"
DEVICE_ID = "your_unique_device_id"
```

### 3. Deployment
Upload the following files to the **root** of your MicroPython device:
1. `config.py`
2. `boot.py`
3. `main.py`

### 4. Running
- Reboot the device.
- `boot.py` will initialize the WiFi connection.
- `main.py` will start the real-time sync engine.
- You should see "WiFi Connected!" and "Status reported to RTDB" in the serial console.

## 🔌 Hardware Mappings

### ESP32
| Switch | Pin |
| :--- | :--- |
| s1 | GPIO 2 |
| s2 | GPIO 4 |
| s3 | GPIO 5 |
| s4 | GPIO 18 |

### Pico W
| Switch | Pin |
| :--- | :--- |
| s1 | GP15 |
| s2 | GP14 |
| s3 | GP13 |
| s4 | GP12 |

---
**Security Note**: `config.py` is ignored by Git to protect your credentials. Never upload this file to a public repository. 🛡️
