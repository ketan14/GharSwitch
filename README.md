# GharSwitch Pro - SaaS Smart Switch Platform

GharSwitch Pro is a high-performance, multi-tenant IoT platform designed for managing smart switch hardware at scale. It features zero-trust security, real-time synchronization, and comprehensive platform controls.

## 🏗 Project Architecture

The project is organized as a monorepo containing frontend applications, backend services, and an IoT simulator.

- **`/apps/web-portal`**: Next.js web application providing dashboards for Users, Tenant Admins, and Super Admins.
- **`/backend/firebase`**: Firebase configuration, Firestore security rules, and Realtime Database rules.
- **`/backend/firebase/functions`**: Node.js v20 Cloud Functions for authoritative backend logic and automation.
- **`/iot/python-simulator`**: Python-based high-fidelity hardware simulator with real-time status reporting.

## 🚀 Key Features

- **Multi-Tenant Isolation**: Complete data separation enforced via Firebase Security Rules and Custom Claims.
- **Real-Time Control**: Sub-second switch toggling and status updates via Firebase Realtime Database.
- **Super Admin Authority**: Global maintenance mode, tenant lifecycle management, and hardware deactivation.
- **Authoritative Backend**: No direct frontend writes to sensitive data; all actions are validated and logged via Cloud Functions.
- **Presence Tracking**: Automatic online/offline detection for all IoT devices.

## 🛠 Quick Start

### 1. Prerequisites
- Node.js v20 or higher
- Python 3.9 or higher
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Environment Setup
Create the following environment files based on `.env.example` where provided:
- **Web Portal**: `apps/web-portal/.env.local`
- **IoT Simulator**: `iot/python-simulator/.env`

### 3. Installation
```bash
# Install dependencies for all components
npm install --prefix apps/web-portal
npm install --prefix backend/firebase/functions
pip install -r iot/python-simulator/requirements.txt
```

### 4. Running Locally
```bash
# Start Web Portal
cd apps/web-portal && npm run dev

# Start IoT Simulator
cd iot/python-simulator && python main.py
```

## 📚 Documentation

Detailed documentation is available in the `brain/` directory:
- [Walkthrough & Verification](file:///Users/ketan/.gemini/antigravity/brain/ccbd15d7-27d6-4333-8c13-e331b6ca340b/walkthrough.md)
- [Quick Start Guide](file:///Users/ketan/.gemini/antigravity/brain/ccbd15d7-27d6-4333-8c13-e331b6ca340b/quick_start_guide.md)
- [Deployment Guide](file:///Users/ketan/.gemini/antigravity/brain/ccbd15d7-27d6-4333-8c13-e331b6ca340b/final_deployment_guide.md)

---
Developed for high-security IoT environments. 🛡️ 💡


## 🔐 Device Security & Configuration

### Managing Device Secrets
GharSwitch uses a secure "Device Secret" authentication flow. To register a device's secret in the cloud, use the built-in tool:

```bash
# Run from the root directory
npm run set-device-secret -w tools -- <DEVICE_ID> <YOUR_SECRET_PASSWORD>

# Example:
npm run set-device-secret -w tools -- PICO_001 my-secure-password-123
```
*Note: This command updates the secure `global_devices` registry in Firestore.*

### Configuring the Pico W
Update your `iot/pico/config.py` with the following credentials to enable secure connection:

```python
# iot/pico/config.py

# === Network ===
WIFI_SSID = "Your_WiFi_Name"
WIFI_PASS = "Your_WiFi_Password"

# === Firebase ===
DB_URL = "https://your-project.firebaseio.com"
TENANT_ID = "your-tenant-id"
DEVICE_ID = "PICO_001"  # Must match the ID used in the tool above

# === Security ===
# 1. The URL of your deployed Cloud Function
AUTH_URL = "https://us-central1-your-project.cloudfunctions.net/getDeviceToken"

# 2. Your Web API Key (Project Settings -> General)
API_KEY = "AIzaSy..." 

# 3. The secret password you set using the tool above
DEVICE_SECRET = "my-secure-password-123" 
```

---
Developed for high-security IoT environments. 🛡️ 💡

