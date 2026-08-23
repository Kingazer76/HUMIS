# AquaFlow V3

AquaFlow is a low-cost smart water-management system for farms in Ghana. It helps
farmers monitor water, manage irrigation, conserve water, predict shortages, and
(from Phase 5 onward) interact with the system through an accessible, Ghanaian-language
AI assistant.

V3 combines:

- **V1's water-management foundation** — dashboard, main tank + external water sources,
  crop-specific irrigation zones, irrigation controls, water-in/stored/used accounting,
  days-of-water-remaining, shortage prediction, weather-aware planning, and conservation mode.
- **V2's inclusivity goals** — a chatbot with Ghanaian-language voice support (via Khaya AI),
  integrated directly into the existing dashboard rather than as a separate app.
- **Real-hardware readiness** — every sensor/actuator interaction goes through a swappable
  `DeviceProvider`, so a simulated farm today can become a real ESP32-driven farm later
  without a redesign.

This repository is being built in the staged phases described in the project's implementation
plan (Phase 0 → Phase 6, with real ESP32 hardware integration explicitly deferred to a future
Phase 7). **This is Phase 0**: the visual shell only — six tabs, V1's look and feel, and
placeholder cards. No real or simulated farm data exists yet.

## Why a flow-sensor disclaimer matters

AquaFlow's target hardware has a tank-level sensor but **no flow sensor**. That means "water
in" and "water used" can never be physically measured — only estimated. Every screen in this
app is built to say so explicitly (e.g. "(estimated)", "(simulated)", "(forecast)") rather than
presenting an estimate as if it were a real sensor reading.

## Stack

- **`client/`** — React + Vite + TypeScript + Tailwind CSS + shadcn/ui. Renders the six tabs
  (Overview, Irrigation, Water, Planning, History, Settings) via `react-router-dom`.
- **`server/`** — Node + Express + TypeScript. Holds the (future) simulation loop, the water/
  irrigation domain logic, and any secrets (e.g. a future Khaya API key) that must never reach
  the browser bundle.
- **`shared/`** — TypeScript types shared between `client` and `server`.

npm workspaces tie the three packages together — there's no separate build tooling beyond npm.

## Running it locally

Requires Node.js 20+ and npm 10+.

```bash
npm install        # installs all three workspaces from the repo root
npm run dev        # starts both the client (Vite) and the server (Express) together
```

- Client (the app you open in a browser): **http://localhost:5417**
- Server (API only, currently just a health check): **http://localhost:5418/api/health**

The Vite dev server proxies any `/api/*` request to the Express server, so the browser only
ever talks to port 5417.

You can also run each side on its own:

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express dev server only (auto-restarts on change via tsx watch)
```

Build everything (type-checks + production bundles):

```bash
npm run build
```

## Project status

- [x] **Phase 0** — project scaffold, V1-matching visual shell, six placeholder tabs.
- [ ] **Phase 1** — domain types, `SimulatedDeviceProvider`, water-accounting math, data APIs.
- [ ] **Phase 2** — Overview and Water tabs wired to simulated data, with explicit
      measured/estimated/simulated labeling.
- [ ] **Phase 3** — Irrigation tab, hysteresis-based irrigation engine, and the single
      safety-controller choke point for every pump/valve action.
- [ ] **Phase 4** — Planning, History, and Settings tabs; weather-aware shortage prediction
      that degrades safely if weather data is unavailable.
- [ ] **Phase 5** — AquaFlow Assistant (text chat) answering from real farm data, with actions
      routed through the same safety controller as manual controls.
- [ ] **Phase 6** — Khaya-backed speech recognition, translation, and text-to-speech, with a
      graceful "voice unavailable, please type" fallback.
- [ ] **Phase 7 (deferred)** — real ESP32 hardware integration. Not started; `USE_SIMULATED`
      stays `true` until this is explicitly requested.
