import network
import socket
import machine
import time
import utime
import json
import firebase_helper   # import our helper

CONFIG_FILE = 'config.json'

def load_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            return config.get('ssid'), config.get('password'), config.get('fb_email'), config.get('fb_password')
    except (OSError, ValueError):
        error_led_signal()
        return None, None, None, None

def error_led_signal():
    onboard_led = machine.Pin("LED", machine.Pin.OUT)
    while True:
        onboard_led.toggle()
        time.sleep(0.1)

ssid, password, fb_email, fb_password = load_config()
onboard_led = machine.Pin("LED", machine.Pin.OUT)

def get_status_html():
    status = onboard_led.value()
    state_text = "Connected (LED ON)" if status == 1 else "Error/Connecting"
    t = utime.localtime()
    current_time = "{:02}:{:02}:{:02} (UTC)".format(t[3], t[4], t[5])
    html = """<html>
    <head><meta http-equiv="refresh" content="5"></head>
    <body>
    <h1>Pico W Status</h1>
    <p>Current time: {}</p>
    <p>Onboard LED Status: {}</p>
    </body>
    </html>""".format(current_time, state_text)
    return html

def connect_and_serve():
    if not ssid or not password:
        error_led_signal()
        return

    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(ssid, password)

    max_wait = 20
    while max_wait > 0:
        if wlan.status() < 0 or wlan.status() >= 3:
            break
        onboard_led.toggle()
        max_wait -= 1
        time.sleep(0.5)

    if wlan.status() != 3:
        error_led_signal()
    else:
        ip_config_tuple = wlan.ifconfig()
        server_ip = ip_config_tuple[0]
        onboard_led.value(1)
        print('Connected! IP address:', server_ip)

        # --- Firebase login ---
        if firebase_helper.login(fb_email, fb_password):
            print("Firebase login successful. Monitoring switches...")

            # Setup socket
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind(('', 80))
            s.listen(5)
            s.setblocking(False)   # non-blocking socket
            print('Web server active at http://{}'.format(server_ip))

            # Loop with Firebase polling every 5 seconds
            last_check = utime.ticks_ms()
            while True:
                # Handle web requests
                try:
                    conn, addr = s.accept()
                    response = get_status_html()
                    conn.send(b'HTTP/1.0 200 OK\r\nContent-type: text/html\r\n\r\n')
                    conn.send(response.encode())
                    conn.close()
                except OSError:
                    pass

                # Poll Firebase every 5 seconds
                if utime.ticks_diff(utime.ticks_ms(), last_check) > 5000:
                    print("Polling Firebase for switch states...")
                    switches = firebase_helper.get_user_switches()
                    if switches:
                        for key, info in switches.items():
                            print("Switch '{}' status: {}".format(info["name"], info["status"]))
                        # Also track changes and update GPIO pins
                        firebase_helper.track_switch_changes()
                    else:
                        print("No switches found or failed to fetch.")
                    last_check = utime.ticks_ms()
        else:
            print("Firebase login failed.")

if __name__ == '__main__':
    time.sleep(2)
    connect_and_serve()

