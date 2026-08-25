# AquaFlow V3

AquaFlow is a low-cost smart water-management system for farms in Ghana. It helps
farmers monitor water, manage irrigation, conserve water, and predict shortages.
Later phases add a Ghanaian-language assistant; this repository is still
simulation-based.

V3 combines:

- **V1's water-management foundation** — dashboard, main tank + external water sources,
  crop-specific irrigation zones, irrigation controls, water-in/stored/used accounting,
  days-of-water-remaining, and shortage prediction.
- **V2's inclusivity goals** — a chatbot with Ghanaian-language voice support (via Khaya AI),
  planned for later phases, integrated into the existing dashboard rather than as a separate app.
- **Real-hardware readiness** — every sensor/actuator interaction goes through a swappable
  `DeviceProvider`, so a simulated farm today can become a real ESP32-driven farm later
  without a redesign.

This repository is being built in staged phases. **Phases 0–3 and 4A–4C are complete.**
Settings writes live farm numbers (tank size, warning levels, and field setup) while the server is running.

## Why a flow-sensor disclaimer matters

AquaFlow's target hardware has a tank-level sensor but **no flow sensor**. That means "water
in" and "water used" can never be physically measured — only estimated. Every screen in this
app is built to say so explicitly (e.g. "(estimated)", "(simulated)", "(forecast)") rather than
presenting an estimate as if it were a real sensor reading.

## Stack

- **`client/`** — React + Vite + TypeScript + Tailwind CSS + shadcn/ui. Renders the six tabs
  (Overview, Irrigation, Water, Planning, History, Settings) via `react-router-dom`.
- **`server/`** — Node + Express + TypeScript. Holds the simulation loop, the water/
  irrigation domain logic, planning/shortage prediction, and any secrets (e.g. a future Khaya
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

You can also run each side on its own:

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # Express dev server only (auto-restarts on change via tsx watch)
```

Build everything (type-checks + production bundles):

```bash
npm run build
```

Run the server test suite (includes shortage-prediction and weather fail-safe tests):

```bash
npm test --workspace server
```

Simulation state and Settings live in memory inside the Express process. Restarting the server
resets the farm, including tank size and field setup. Weather is optional: if the weather
provider is missing, returns nothing, or throws, planning still returns a valid days-remaining /
shortage result from tank level and usage.

## Project status

- [x] **Phase 0** — project scaffold, V1-matching visual shell, six placeholder tabs.
- [x] **Phase 1** — domain types, `SimulatedDeviceProvider`, water-accounting math, data APIs.
- [x] **Phase 2** — Overview and Water tabs wired to simulated data, with explicit
      measured/estimated/simulated labeling.
- [x] **Phase 3** — Irrigation tab, hysteresis-based irrigation engine, and the single
      safety-controller choke point for every pump/valve action.
- [x] **Phase 4** — Planning, History, and Settings. **4A done** (weather provider,
      shortage prediction, `/api/planning`, Overview/Planning days-remaining and shortage
      risk). **4B done** (History tab + in-memory `historyLog`). **4C done** (Settings tab
      writes tank capacity/thresholds and zone name/crop/watering-style/soil targets; those
      numbers drive tank %, available water, days remaining, shortage risk, and irrigation
      start/stop).
- [ ] **Phase 5** — Farmer-friendly visual intelligence (plan only).
- [ ] **Phase 6** — African-inspired visual polish (plan only).
- [ ] **Phase 7** — AquaFlow Assistant (text chat), actions routed through the safety controller.
- [ ] **Phase 8** — Khaya-backed speech recognition, translation, and text-to-speech.
- [ ] **Phase 9 (deferred)** — real ESP32 hardware integration. Not started; `USE_SIMULATED`
      stays `true` until this is explicitly requested.
