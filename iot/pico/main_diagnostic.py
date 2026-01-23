"""
Diagnostic version of main.py to identify crash points
Upload this as main.py to test where the Pico is failing
"""

import time
from machine import Pin

print("=" * 50)
print("DIAGNOSTIC MODE - GharSwitch Pico")
print("=" * 50)

# Blink LED to show we're alive
led = Pin("LED", Pin.OUT)

def blink_pattern(count, delay=0.2):
    """Blink LED to show progress"""
    for i in range(count):
        led.on()
        time.sleep(delay)
        led.off()
        time.sleep(delay)

print("[1/7] Basic imports successful")
blink_pattern(1)
time.sleep(1)

# Test network import
try:
    import network
    print("[2/7] Network module imported")
    blink_pattern(2)
    time.sleep(1)
except Exception as e:
    print(f"[ERROR] Failed to import network: {e}")
    while True:
        blink_pattern(10, 0.1)
        time.sleep(2)

# Test config import
try:
    import config
    print("[3/7] Config module imported")
    print(f"    WIFI_SSID: {config.WIFI_SSID}")
    print(f"    TENANT_ID: {config.TENANT_ID}")
    print(f"    DEVICE_ID: {config.DEVICE_ID}")
    blink_pattern(3)
    time.sleep(1)
except Exception as e:
    print(f"[ERROR] Failed to import config: {e}")
    while True:
        blink_pattern(10, 0.1)
        time.sleep(2)

# Test WiFi connection
try:
    print("[4/7] Testing WiFi connection...")
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    
    if not wlan.isconnected():
        print(f"    Connecting to {config.WIFI_SSID}...")
        wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
        
        timeout = 15
        while not wlan.isconnected() and timeout > 0:
            print(f"    Waiting... {timeout}s")
            time.sleep(1)
            timeout -= 1
    
    if wlan.isconnected():
        print(f"    WiFi Connected! IP: {wlan.ifconfig()[0]}")
        blink_pattern(4)
    else:
        print("    [WARNING] WiFi connection failed")
        blink_pattern(4, 0.5)  # Slower blinks = warning
    
    time.sleep(1)
except Exception as e:
    print(f"[ERROR] WiFi test failed: {e}")
    while True:
        blink_pattern(10, 0.1)
        time.sleep(2)

# Test NTP time sync
try:
    print("[5/7] Testing NTP time sync...")
    import ntptime
    ntptime.settime()
    print("    Time synced successfully")
    blink_pattern(5)
    time.sleep(1)
except Exception as e:
    print(f"[WARNING] NTP sync failed: {e}")
    print("    Continuing anyway...")
    blink_pattern(5, 0.5)
    time.sleep(1)

# Test HTTP request
try:
    print("[6/7] Testing HTTP request...")
    import urequests
    
    # Simple test request
    print("    Making test request to Google...")
    r = urequests.get("http://www.google.com")
    print(f"    Response: {r.status_code}")
    r.close()
    blink_pattern(6)
    time.sleep(1)
except Exception as e:
    print(f"[ERROR] HTTP request failed: {e}")
    while True:
        blink_pattern(10, 0.1)
        time.sleep(2)

# Test Firebase auth
try:
    print("[7/7] Testing Firebase authentication...")
    import ujson
    
    payload = ujson.dumps({
        "deviceId": config.DEVICE_ID,
        "deviceSecret": config.DEVICE_SECRET
    })
    
    print(f"    Requesting custom token from {config.AUTH_URL}...")
    r = urequests.post(
        config.AUTH_URL,
        data=payload,
        headers={'Content-Type': 'application/json'}
    )
    
    print(f"    Response: {r.status_code}")
    
    if r.status_code == 200:
        print("    Authentication successful!")
        blink_pattern(7)
    elif r.status_code == 500:
        print("    [ERROR] Server returned 500 - Configuration error")
        print(f"    Response: {r.text}")
        blink_pattern(7, 0.5)
    else:
        print(f"    [WARNING] Unexpected status: {r.status_code}")
        print(f"    Response: {r.text}")
        blink_pattern(7, 0.5)
    
    r.close()
    time.sleep(1)
except Exception as e:
    print(f"[ERROR] Authentication test failed: {e}")
    import sys
    sys.print_exception(e)
    while True:
        blink_pattern(10, 0.1)
        time.sleep(2)

print("=" * 50)
print("ALL DIAGNOSTIC TESTS COMPLETED!")
print("=" * 50)
print("\nIf you see this message, the Pico is working.")
print("The issue was likely in the main loop or watchdog.")
print("\nLED will blink continuously to show success.")

# Success - continuous slow blink
while True:
    led.toggle()
    time.sleep(1)
