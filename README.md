# AquaFlow V3

AquaFlow is a low-cost smart water-management system for farms in Ghana. It helps
farmers monitor water, manage irrigation, conserve water, and predict shortages.
Later phases add a Ghanaian-language assistant; this repository is still
simulation-based.

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
Recognized speech appears in the chat as your message, then the same AquaFlow Assistant
answers it. Ghanaian-language switching is Phase 8C. Only African English (`eng`) is active.

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

Run tests:

```bash
npm test --workspace server
```

On Render, use a **Web Service** with the root of this repo. Build `npm install && npm run build`, start `npm start`. Set `USE_SIMULATED=true`. Typed assistant works without Khaya. For voice, set `KHAYA_API_KEY` in the Render dashboard Environment page — not in `render.yaml`.

Simulation state and Settings live in memory inside the Express process. Restarting the server
resets the farm, including tank size, field setup, and farm location. Weather planning uses
Open-Meteo (no API key) at the farm's configured coordinates. If the forecast is missing,
returns nothing, or throws, planning still returns a valid days-remaining / shortage result
from tank level and usage. The farm rain sensor used for irrigation stays simulated.
When that sensor detects rain, AquaFlow estimates rainwater inflow into the **main tank**.
Extra rain is overflow and is not stored. Rainwater is not a separate reserve.

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
- [ ] **Phase 8C** — Ghanaian-language support (translation).
- [ ] **Phase 9 (deferred)** — real ESP32 hardware integration. Not started; `USE_SIMULATED`
      stays `true` until this is explicitly requested.
