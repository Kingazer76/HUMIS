# AquaFlow

AquaFlow is a low-cost smart water-management system for farms in Ghana. It helps
farmers monitor water, manage irrigation, conserve water, and predict shortages.
The website still starts on a **practice farm** (`USE_SIMULATED=true`). A real
ESP32 can already talk to HUMIS for tank distance, Zone A soil, and the pump.
Leave the practice farm on until that board has been tested.

V3 combines:

- **V1's water-management foundation** — dashboard, a single main tank as stored water,
  other sources that can fill that tank, crop-specific irrigation zones, irrigation
  controls, water-in/stored/used accounting, days-of-water-remaining, and shortage
  prediction. Rainwater is an incoming source into the main tank, not a second tank.
- **V2's inclusivity goals** — a chatbot with Ghanaian-language voice support (via Khaya AI),
  planned for later phases, integrated into the existing dashboard rather than as a separate app.
- **Real-hardware readiness** — every sensor/actuator interaction goes through a swappable
  `DeviceProvider`, so a simulated farm today can become a real ESP32-driven farm later
  without a redesign.

This repository is being built in staged phases. **Phases 0–8B are complete.**
Settings writes live farm numbers. Overview leads with water, crops, weather, shortage,
days remaining, and watering status. The AquaFlow Assistant in the header can answer
farm questions, start or stop watering through the same safety gate as the Irrigation tab,
listen with the microphone, and read new answers out loud when Khaya AI is configured.

## Why a flow-sensor disclaimer matters

AquaFlow tracks two flow figures — **Water IN** and **Water USED** — from configured
rates in simulation (`configured-rate`). Real flow meters are not connected yet.
Every screen is built to say so explicitly (e.g. "(estimated)", "(simulated)",
"(forecast)") rather than presenting an estimate as if it were a real sensor reading.
Irrigation advice estimates how many litres a field needs; that estimate can later
be checked against Water USED. AquaFlow does not add a third flow channel.

## Irrigation decisions

Automatic watering uses crop type, soil type, growth stage, current soil moisture,
weather/rainfall, and main-tank water. It does not use one farm-wide moisture number
such as "water if below 35%." Crop coefficients (`Kc`) and allowable depletion (`p`)
come from FAO-56 where the crop (or a named analog) is listed. Soil water limits
come from FAO-56 Table 19. Mapping the 0–100 simulated soil probe onto those volumes
is an AquaFlow assumption, not a laboratory calibration.

The same `decideZoneIrrigation` function drives Auto mode and the Irrigation /
Planning advice text. Pump and valves still change only through `safetyController`.

## Stack

- **`client/`** — React + Vite + TypeScript + Tailwind CSS + shadcn/ui. Renders the six tabs
  (Overview, Irrigation, Water, Planning, History, Settings) via `react-router-dom`.
- **`server/`** — Node + Express + TypeScript. Holds the simulation loop, the water/
  irrigation domain logic, planning/shortage prediction, and any secrets (e.g. the Khaya
  API key) that must never reach the browser bundle.
- **`shared/`** — TypeScript types shared between `client` and `server`.

npm workspaces tie the three packages together — there's no separate build tooling beyond npm.

## Running it locally

Requires Node.js 20+ and npm 10+.

```bash
npm install        # installs all three workspaces from the repo root
npm run dev        # starts both the client (Vite) and the server (Express) together
```

- Client (the app you open in a browser): **http://localhost:5417**
- Server (API): **http://localhost:5418/api/health**
- Planning API: **http://localhost:5418/api/planning**

The Vite dev server proxies any `/api/*` request to the Express server, so the browser only
ever talks to port 5417.

### Sign in

HUMIS now asks you to sign in before opening the farm screens.

1. Open **http://localhost:5417**
2. Choose **Create an account** the first time
3. Sign in with that email and password

Your password is stored as a hash on the server, not in the browser. The login cookie is
httpOnly (the page cannot read it). Farm data is still the shared simulated farm — accounts
are ready for later multi-user farms, but this build does not split tank/zone data yet.

To create the first user without the Register page, set these in `.env` **before** the first
start, only if no users exist yet:

```
AUTH_BOOTSTRAP_EMAIL=farmer@example.com
AUTH_BOOTSTRAP_PASSWORD=YourPassword1
AUTH_BOOTSTRAP_NAME=Farm manager
```

Password reset works end-to-end (one-hour, one-use token). Email sending needs SMTP:

```
APP_PUBLIC_URL=http://127.0.0.1:5417
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=HUMIS <noreply@example.com>
```

If SMTP is not set, HUMIS does not fake an inbox. In local development the reset link is
printed in the **server** terminal log. Set `AUTH_SESSION_SECRET` in production so people
stay signed in across server restarts.

`/api/health` stays public. ESP32 hardware routes under `/api/hardware` use
`HUMIS_HARDWARE_KEY` instead of a farmer login. All other `/api` farm routes,
including the Assistant, require a signed-in session.

### Voice listening and speaking (Phases 8A–8B)

Typed chat works with no extra setup. Listening and speaking use **one Khaya API key**
from https://translation.ghananlp.org for both Automatic Speech Recognition API v3 and
Text-To-Speech API v2. Copy `.env.example` to `.env` in the repo root (the same folder as
`package.json`), then fill in:

```
KHAYA_API_KEY=your-key
KHAYA_ASR_LANGUAGE=eng
KHAYA_TTS_LANGUAGE=eng
```

`KHAYA_API_KEY` stays on the server. Never put it in `client/` code, Vite `VITE_` variables,
Git, or Render Blueprint files. Restart `npm run dev` after editing `.env`. If the key is
missing, typed chat still works. The microphone may still open, but AquaFlow will not guess
speech or invent audio — it asks you to type instead. Voice needs an internet connection to
Khaya; the rest of AquaFlow keeps working if Khaya is unreachable.

On Render, add `KHAYA_API_KEY` under **Environment** in the web service dashboard. Do not
paste the key into `render.yaml`.

The plant shows: **Hold to speak**, **Listening**, **Thinking**, then **Speaking**.
Recognized speech appears in the chat as **You said**, then the same AquaFlow Assistant
answers it. If the words are unclear, or a control command is missing a clear target
(for example Khaya heard "comb" instead of "pump"), AquaFlow asks you to try again or
confirm — it does not guess a farm-status answer, and it does not turn hardware on
until you clearly confirm. The safety gate still has the last word. Ghanaian-language
switching is Phase 8C. Only African English (`eng`) is active.

You can also run each side on its own:

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express dev server only (auto-restarts on change via tsx watch)
```

Build everything (type-checks + production bundles):

```bash
npm run build      # production UI + server typecheck
npm start          # one process: UI + /api + farm simulation (uses PORT if set)
```

Run checks:

```bash
npm run build    # production UI + server typecheck
npm run lint
npm test
```

## Official website (Render)

HUMIS is already one Node website: `npm run build`, then `npm start`. Render uses
the same commands. The file `render.yaml` is the official hosting recipe.

This workspace cannot log into GitHub or Render for you. Official publish needs
two actions only you can do:

1. In Cursor, click **Create repo** so HUMIS has a real GitHub repository.
2. Open [render.com](https://render.com), sign in (GitHub login is easiest), then
   **New → Blueprint** and connect that repository. Or **New → Web Service** and
   paste the same settings.

Use this branch: `cursor/humis-production-16f2`

- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

Render will ask for these names (paste values only in Render, never in git):

- `USE_SIMULATED` = `true` (keep the practice farm on the public site)
- `AUTH_SESSION_SECRET` = let Render generate this
- `APP_PUBLIC_URL` = the live `https://humis.onrender.com` URL Render gives you
- `KHAYA_API_KEY` = optional; typed Assistant works without it
- `HUMIS_HARDWARE_KEY` = optional; only if a real board will call this server

Do **not** put secrets in `render.yaml` or in any `VITE_` variable.

`--include=dev` is required because Vite and TypeScript are install-time build tools.
Render's default production install would skip them and the build would fail.

The public site stays on the **practice farm**. Do not set `USE_SIMULATED=false` on
Render until the ESP32 has been tested. A public website must not start a real pump
by default.

Typed assistant works without Khaya. For voice, set `KHAYA_API_KEY` in the Render
dashboard Environment page — not in `render.yaml`.

After Render finishes, your official link looks like `https://humis.onrender.com`
(Render may add extra letters if that name is taken). Send that URL here and this
workspace can check it.

Simulation state and Settings live in memory inside the Express process. Restarting the server
resets the farm, including tank size, field setup, farm location, and hardware calibration.
Farmer accounts are saved under `data/` on disk. A typical Render disk is wiped on restart
unless you later attach a persistent disk — this release does not add a new database. Weather planning uses
Open-Meteo (no API key) at the farm's configured coordinates. If the forecast is missing,
returns nothing, or throws, planning still returns a valid days-remaining / shortage result
from tank level and usage. The farm rain sensor used for irrigation stays simulated until a
rain GPIO is assigned. When that sensor detects rain, AquaFlow estimates rainwater inflow into the **main tank**.
Extra rain is overflow and is not stored. Rainwater is not a separate reserve.

## Real ESP32 board (Phase 9)

The dashboard, irrigation brain, safety gate, Assistant, and practice farm are unchanged.
The ESP32 is only a hardware endpoint: it senses, reports, receives a command, and moves the relay.

**Default stays the practice farm.** `USE_SIMULATED=true` until you have tested the real board.

### What is wired today

| Device | GPIO |
|---|---|
| HC-SR04 TRIG | 5 |
| HC-SR04 ECHO | 18 |
| Zone A soil analog | 34 |
| Pump relay signal | 26 |

Not wired yet (placeholders only, no fake readings): rain sensor, flow in, flow out, Zone A valve, Zone B valve, second soil probe.

Zone A's soil probe is GPIO 34. Zone B keeps a practice-farm soil number until a second probe exists. HUMIS does not copy Zone A onto Zone B. There is one physical pump. Valve commands stay off until valve GPIOs are assigned.

### Board talk

1. Put a long secret in `.env` as `HUMIS_HARDWARE_KEY` and restart HUMIS.
2. The ESP32 POSTs readings to `/api/hardware/telemetry?key=...`
3. The ESP32 GETs `/api/hardware/command?key=...` (JSON or `format=csv`)
4. HUMIS converts distance → tank litres and soil ADC → Zone A percent using the numbers on the Settings tab.

PictoBlox block-by-block firmware: `hardware/pictoblox/HUMIS-ESP32-firmware.md`.

### Switch from practice farm to real board

1. Confirm Settings → **Real pump and sensors** shows the board is sending readings.
2. Enter your own empty/full tank distances and dry/wet soil numbers. Do not keep the starter 100 cm / 20 cm unless you measured them.
3. Bench-test the pump with the hardware key while `USE_SIMULATED=true` so a website watering click cannot start the real pump.
4. Set `USE_SIMULATED=false` in `.env`.
5. Restart HUMIS.

Until step 4, watering on the website still drives the practice farm only.

## Project status

- [x] **Phase 0** — project scaffold, V1-matching visual shell, six placeholder tabs.
- [x] **Phase 1** — domain types, `SimulatedDeviceProvider`, water-accounting math, data APIs.
- [x] **Phase 2** — Overview and Water tabs wired to simulated data, with explicit
      measured/estimated/simulated labeling.
- [x] **Phase 3** — Irrigation tab, hysteresis-based irrigation engine, and the single
      safety-controller choke point for every pump/valve action.
- [x] **Phase 4** — Planning, History, and Settings. **4A–4C done.**
- [x] **Phase 5** — Farmer-friendly visual intelligence: soil/tank/weather/irrigation
      pictures mapped from existing readings and thresholds (no new calculations).
- [x] **Phase 6** — Visual redesign: mint page, deep teal actions, outlined tabs, clearer
      cards and badges. Gold is a navigation accent (tab outlines and a small diamond
      mark). It is not used as a warning color. Full Adinkra patterning is not in this phase.
- [x] **Phase 7** — AquaFlow Assistant (text chat). Questions use existing farm data.
      Watering commands go through `safetyController` only — never a second control path.
- [x] **Phase 8A** — Speech input. Microphone in the existing assistant; Khaya AI ASR
      (`eng`) turns talk into text, then the same Phase 7 `/api/assistant/chat` path.
- [x] **Phase 8B** — Assistant speaks new replies with Khaya AI TTS (`eng`). Written
      answers stay on screen. No Ghanaian-language switching yet.
- [x] **Khaya voice layer** — microphone states, farmer-friendly voice errors, language
      catalog for later Ghanaian languages, and recording/playback that cannot stay stuck.
- [x] **Phase 8C** — Ghanaian-language selector in the existing Assistant. Khaya remains
      ears and mouth (ASR, translation to/from English, TTS). HUMIS remains the farm brain
      and safety gate. Default stays English.
- [x] **Sign-in** — email/password accounts, httpOnly sessions, protected farm screens and
      APIs, Settings account card, and password-reset tokens (SMTP optional).
- [x] **Phase 9** — ESP32 hardware framework behind the existing `DeviceProvider`. Practice
      farm stays the default (`USE_SIMULATED=true`). Real tank distance, Zone A soil, and
      the shared pump are wired. Rain, flow, valves, and a second soil probe are placeholders
      until GPIOs are assigned.
