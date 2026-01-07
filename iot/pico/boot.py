import network
import time
import config

# WiFi Configuration
WIFI_SSID = config.WIFI_SSID
WIFI_PASS = config.WIFI_PASS

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('Connecting to WiFi...')
        wlan.connect(WIFI_SSID, WIFI_PASS)
        
        # Wait for connection with timeout
        timeout = 10
        while not wlan.isconnected() and timeout > 0:
            time.sleep(1)
            timeout -= 1
            
    if wlan.isconnected():
        print('WiFi Connected!')
        print('IP Address:', wlan.ifconfig()[0])
        # Disable Power Saving Mode for lower latency (consumes more power)
        wlan.config(pm=0xa11140) 
        print('WiFi Power Management: DISABLED (High Performance)')
    else:
        print('WiFi Connection Failed!')

connect_wifi()
