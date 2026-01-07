"""
GharSwitch IoT Configuration Template
Copy this file to 'config.py' and fill in your credentials.
"""

# ==========================================
# 1. Network Configuration
# ==========================================
WIFI_SSID = "YOUR_WIFI_NAME"
WIFI_PASS = "YOUR_WIFI_PASSWORD"

# ==========================================
# 2. Firebase Configuration
# ==========================================
# Your Realtime Database URL (from Project Settings)
DB_URL = "https://your-project-id.firebaseio.com"

# The Tenant ID this device belongs to (e.g., from your URL route /admin/tenants/...)
TENANT_ID = "tenant_xyz123"

# The Unique ID for this specific hardware unit
DEVICE_ID = "PICO_001"

# ==========================================
# 3. Security Credentials (MANDATORY)
# ==========================================

# The URL of your deployed 'getDeviceToken' Cloud Function
# Run 'firebase deploy --only functions:getDeviceToken' to get this URL.
AUTH_URL = "https://us-central1-your-project-id.cloudfunctions.net/getDeviceToken"

# Your Web API Key (Project Settings -> General -> Web API Key)
# Required to exchange the custom token for an ID token.
API_KEY = "AIzaSy..."

# The Secure Device Secret
# MUST match the 'sharedSecret' value you set in the Cloud Firestore 'global_devices' collection.
# Use: npm run set-device-secret -w tools -- PICO_001 my-secure-password
DEVICE_SECRET = "my-secure-password-123"
