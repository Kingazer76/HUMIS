# HUMIS ESP32 firmware (PictoBlox)

The ESP32 is a **hardware endpoint**, not a second HUMIS brain.

It only does this loop:

**SENSE → REPORT → RECEIVE COMMAND → ACTUATE → REPORT**

HUMIS still decides crops, weather, tank planning, Assistant/Khaya, and when watering should start. The board may only apply **physical** fail-safes (pump off if it loses HUMIS, if the tank sensor is junk, if a command is old, or if the pump has been on too long).

Build this in **PictoBlox Upload Mode** for ESP32. Add the **Internet of Things (IoT)** extension. Do not switch to Arduino IDE unless PictoBlox cannot send HTTP at all.

## Pins (wired today)

| Device | GPIO | Direction |
|---|---|---|
| HC-SR04 TRIG | 5 | output |
| HC-SR04 ECHO | 18 | input |
| Soil moisture analog | 34 | analog in (input-only pin) |
| Pump relay signal | 26 | output |

## Pins (not wired — leave disabled)

Set these as variables, but **do not read or drive them**:

- `RAIN_SENSOR_PIN` = unassigned
- `FLOW_IN_PIN` = unassigned
- `FLOW_OUT_PIN` = unassigned
- `ZONE_A_VALVE_PIN` = unassigned
- `ZONE_B_VALVE_PIN` = unassigned
- `SECOND_SOIL_PIN` = unassigned

If a pin is unassigned, send `null` (or omit the field) for that sensor. Never invent a value.

## HUMIS URLs

Replace `HUMIS_HOST` with the computer running HUMIS on your farm Wi-Fi (not `localhost` on the ESP32 — `localhost` means the board itself).

Replace `YOUR_KEY` with `HUMIS_HARDWARE_KEY` from the server `.env`.

```
POST http://HUMIS_HOST:5418/api/hardware/telemetry?key=YOUR_KEY
GET  http://HUMIS_HOST:5418/api/hardware/command?key=YOUR_KEY
GET  http://HUMIS_HOST:5418/api/hardware/command?key=YOUR_KEY&format=csv
```

The board does **not** sign in as a farmer. It uses the hardware key, not a login cookie.

If PictoBlox HTTP cannot parse JSON, use `format=csv`. The reply is one line:

```
pump,valveA,valveB,maxPumpOnSeconds
```

Example: `0,0,0,30`

- First number = pump (0 off, 1 on)
- Second = Zone A valve (ignore until a valve is wired)
- Third = Zone B valve (ignore until a valve is wired)
- Fourth = max pump-on seconds

## Telemetry body

JSON (preferred):

```json
{
  "tankDistanceCm": 42.0,
  "soilAdc": 1800,
  "pumpIsOn": false,
  "rainIsWet": null,
  "flowInHz": null,
  "flowOutHz": null,
  "ok": true
}
```

PictoBlox form / query string also works:

```
tankDistanceCm=42.0&soilAdc=1800&pumpIsOn=false&ok=true
```

You may put those fields on the POST URL if the body block is awkward.

`null` means “this sensor is not connected.” Do not send fake rain or flow numbers.

If the ultrasonic fails this pass, still POST, but set `tankDistanceCm` empty/null and `ok` to false. HUMIS will not invent a tank level.

## Command body HUMIS may also accept (bench test only)

```json
{
  "pump": 0,
  "valveA": 0,
  "valveB": 0,
  "maxPumpOnSeconds": 30
}
```

`0` = OFF, `1` = ON.

Ignore `valveA` and `valveB` until those GPIOs are assigned. The pump command must still work.

While the practice farm is on (`USE_SIMULATED=true`), watering buttons on the website do **not** change this command. You can still POST a test command with the hardware key to bench-test the relay.

## PictoBlox variables

Set these once at the top of the script:

- `WIFI_NAME`
- `WIFI_PASSWORD`
- `HUMIS_URL` — e.g. `http://192.168.1.20:5418`
- `HARDWARE_KEY`
- `TRIG_PIN` = 5
- `ECHO_PIN` = 18
- `SOIL_PIN` = 34
- `PUMP_PIN` = 26
- `RELAY_ACTIVE_HIGH` = 1  (change to 0 if the pump runs backwards)
- `COMMAND_TIMEOUT_MS` = 10000
- `LOOP_WAIT_MS` = 2000
- `lastCommandMs` = 0
- `pumpStartedMs` = 0
- `pumpIsOn` = 0
- `lastPumpOutput` = -1  (so the first GPIO write always happens)
- `maxPumpOnSeconds` = 30

## When the green flag / ESP32 starts

1. Set pump pin to OFF using `applyPump(0)` below.
2. Connect to Wi-Fi (`connect to Wi-Fi (WIFI_NAME) with password (WIFI_PASSWORD)`).
3. Wait until Wi-Fi is connected.
4. Forever: do the loop below, then wait `LOOP_WAIT_MS`.

## Forever loop

### 1. SENSE

**Ultrasonic**

1. Set TRIG low, wait 2 microseconds.
2. Set TRIG high, wait 10 microseconds.
3. Set TRIG low.
4. Measure ECHO pulse (PictoBlox pulse-in / ultrasonic block).
5. Distance cm = time × 0.0343 / 2.
6. If the pulse timed out or distance is under 2 or over 400, set `tankDistanceCm` empty and `ok` = false.

**Soil**

Read analog on GPIO 34. Store as `soilAdc` (0–4095). If the read fails, leave it empty and keep `ok` false.

Do not read rain, flow, or a second soil pin.

### 2. REPORT

Join this URL:

`HUMIS_URL` + `/api/hardware/telemetry?key=` + `HARDWARE_KEY` + `&tankDistanceCm=` + distance + `&soilAdc=` + soil + `&pumpIsOn=` + pumpIsOn + `&ok=` + ok

Use:

**make POST request (that URL) without body**

(or with body, if your PictoBlox build allows JSON)

If the request fails (no Wi-Fi, no reply, error):

- `applyPump(0)`
- skip the rest of this loop

If it succeeds, continue.

### 3. RECEIVE COMMAND

GET:

`HUMIS_URL` + `/api/hardware/command?key=` + `HARDWARE_KEY` + `&format=csv`

Use the IoT **get** block for the reply text.

If GET fails: `applyPump(0)`, skip the rest.

If GET works: set `lastCommandMs` = current time.

Split the csv by comma:

- item 1 → `wantedPump` (0 or 1)
- item 4 → `maxPumpOnSeconds`

Ignore items 2 and 3 (valves).

### 4. Physical fail-safes (before moving the relay)

Turn the pump **OFF immediately** if any of these are true:

- Wi-Fi is down
- telemetry POST failed
- command GET failed
- `(now - lastCommandMs)` > `COMMAND_TIMEOUT_MS`  (stale command / lost HUMIS)
- ultrasonic this pass was invalid
- `wantedPump` is 0  (stop must always win)
- pump is already on AND `(now - pumpStartedMs)` > `maxPumpOnSeconds` × 1000

Only if **none** of those fired, and `wantedPump` is 1, call `applyPump(1)`.

### 5. `applyPump(on)` — no relay chatter

`on` is 0 or 1 (want water moving, **not** a raw GPIO level).

1. If `on` equals `pumpIsOn` and the GPIO was already written, **do not write the pin again**.
2. If `RELAY_ACTIVE_HIGH` is 1: GPIO 26 = high when on, low when off.
3. If `RELAY_ACTIVE_HIGH` is 0: GPIO 26 = low when on, high when off.
4. Set `pumpIsOn` = on.
5. If turning on, set `pumpStartedMs` = now.
6. If turning off, set `pumpStartedMs` = 0.

HUMIS sends **water on/off**. The board maps that through `RELAY_ACTIVE_HIGH`. Do not guess HIGH vs LOW — try High in Settings first. If the pump runs when HUMIS says off, switch to Low.

## What the ESP32 must not do

Do not decide:

- which crop needs water
- weather / rain delay
- days of water remaining
- irrigation planning
- Assistant answers
- conservation / shortage

HUMIS already does those.

## Wiring warnings

1. **HC-SR04 ECHO is often 5V.** ESP32 GPIO 18 is 3.3V. Use a voltage divider (two resistors) on ECHO before GPIO 18. TRIG can stay on GPIO 5.
2. **GPIO 34 is input-only.** Soil analog is fine there. Do not try to drive a relay from 34.
3. **The 12 V pump must never share the ESP32 pin.** GPIO 26 only drives the relay **signal**. Pump +12 V goes through the relay COM/NO. Share ground between ESP32, relay module, and the 12 V supply as the relay maker shows.
4. Many relay boards want **5 V VCC**. A 3.3 V GPIO may still switch them, or may not. That is why relay polarity is a setting, not a guess.
5. Keep the ultrasonic above the water, looking down. Measure empty and full distances yourself in Settings. Do not use the starter 100 cm / 20 cm as if they were your tank.

## How to test the board before switching HUMIS off the practice farm

1. Leave `USE_SIMULATED=true` (default). The website is still the pretend farm.
2. Set `HUMIS_HARDWARE_KEY` in `.env` and restart HUMIS.
3. Upload this PictoBlox script. Watch `/api/hardware/status?key=YOUR_KEY` — `lastTelemetry` should move.
4. POST a short pump test:

```
POST /api/hardware/command?key=YOUR_KEY
{"pump":1,"maxPumpOnSeconds":5}
```

The real pump should run at most 5 seconds, then the board’s max-runtime fail-safe should stop it. Then POST `{"pump":0}`.

5. Only after that works, set `USE_SIMULATED=false` and restart HUMIS. Then watering buttons go through HUMIS safety to this same command slot.
