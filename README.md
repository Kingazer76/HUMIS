# HUMIS

**HUMIS — Smart Water Management for Smallholder Farmers**

HUMIS is a low-cost smart water-management system designed to help smallholder and open-field farmers in Ghana use limited water more efficiently.

Instead of relying on guesswork, HUMIS combines water-level information, soil conditions, crop information, growth stage, weather conditions and irrigation history to help farmers make better watering decisions.

The system is designed around one central principle:

> **Use the water you have as intelligently as possible.**

HUMIS is currently a working prototype. The public/demo version uses a simulated farm by default, while an ESP32-based hardware system is being developed to connect real sensors and actuators.

---

## What HUMIS Does

HUMIS brings several parts of farm water management into one system:

* Monitors the main water tank
* Tracks water entering, stored and used
* Monitors soil conditions by irrigation zone
* Uses crop type, soil type and growth stage when making irrigation decisions
* Considers current and forecast weather conditions
* Estimates how many days of water remain
* Predicts potential water shortages
* Provides irrigation recommendations
* Controls irrigation through a central safety system
* Supports manual and automatic watering
* Provides farm history and planning information
* Supports a farmer-friendly AI Assistant
* Supports voice interaction through Khaya AI
* Is designed to work with real ESP32 hardware
* Keeps simulated and estimated values clearly labelled rather than presenting them as real measurements

---

## The HUMIS Water Model

HUMIS uses **one central main storage tank** as the farm's available stored water.

Different sources can supply water to this tank, including:

* Rainwater harvesting
* Well/borehole water
* Reservoir or pond water
* Other manually configured sources

Irrigation draws water from the **main tank**.

Rainwater is therefore treated as an incoming source rather than as a separate storage tank or reserve.

The system tracks:

**Water In → Main Tank → Water Used**

This allows HUMIS to reason about how much water is available and how quickly the farm is using it.

---

## Irrigation Intelligence

HUMIS does not rely on a single farm-wide rule such as:

> "Water whenever soil moisture falls below 35%."

Instead, irrigation decisions can consider:

* Crop type
* Soil type
* Growth stage
* Current soil moisture
* Weather
* Rainfall
* Main tank availability
* Crop water requirements
* Previous water-management information

The irrigation model uses agricultural parameters such as crop coefficients (`Kc`) and allowable depletion where appropriate.

FAO-56 data is used as a reference for crops and soil-water calculations where applicable.

Because the prototype's soil sensor values are simulated or mapped from sensor readings, the conversion between a 0–100 soil reading and actual soil-water volumes remains an engineering assumption until properly calibrated in the field.

---

## Safety First

All pump and valve actions pass through the same central safety system:

**`safetyController`**

This is important because neither the Irrigation interface nor the AI Assistant should have its own independent path to physical hardware.

The Assistant can request an irrigation action, but it must still pass through the same safety controls used by the rest of HUMIS.

The safety layer is intended to prevent unclear commands or unsafe conditions from directly activating the pump or valves.

---

## Khaya AI Voice Assistant

HUMIS includes a farmer-facing Assistant integrated into the existing application.

The Assistant can:

* Answer questions about the farm
* Explain current water conditions
* Provide irrigation-related information
* Start or stop watering when an appropriate command is given
* Accept spoken input
* Read responses aloud

Voice interaction uses **Khaya AI** as the speech layer.

Khaya handles the communication between the farmer's voice and HUMIS. HUMIS remains responsible for the actual farm logic and safety decisions.

The intended language direction includes Ghanaian languages such as:

* Twi
* Ewe
* Ga
* Dagbani

The language layer is designed so that the farmer can communicate naturally while HUMIS continues to use its own internal farm logic.

The microphone uses a **hold-to-speak** interaction rather than continuously listening.

The Assistant moves through states such as:

**Hold to speak → Listening → Thinking → Speaking**

If speech is unclear, HUMIS should ask the farmer to try again or confirm the intended action instead of guessing.

---

## Hardware

HUMIS is designed around an ESP32-based hardware system.

The hardware communicates with the HUMIS server through a `DeviceProvider` architecture. This allows the application to use a simulated farm during development and switch to real hardware without redesigning the farm-management logic.

### Current hardware baseline

| Device             | GPIO |
| ------------------ | ---: |
| HC-SR04 TRIG       |    5 |
| HC-SR04 ECHO       |   18 |
| Zone A soil sensor |   34 |
| Rain sensor AO     |   35 |
| Rain sensor DO     |   32 |
| Water Flow IN      |   25 |
| Water Flow OUT     |   27 |
| Pump relay         |   26 |

The current hardware setup uses:

* ESP32 NodeMCU DevKit V1
* HC-SR04 ultrasonic tank-level sensor
* Soil-moisture sensor
* MH-RD / FC-37 rain sensor
* YF-S201 water-flow sensors
* SRD-05VDC-SL-C relay
* 12V DC pump

A solenoid-valve system is planned as part of the irrigation hardware, but valve GPIO assignments should not be treated as final until the hardware is actually wired and tested.

### Important

The real hardware is **not the default public operating mode**.

HUMIS should remain in:

```text
USE_SIMULATED=true
```

until the physical system has been properly tested.

A public website should never be able to accidentally activate a physical pump simply because somebody clicked a button on the demo.

---

## Simulated Farm vs Real Farm

HUMIS deliberately separates the software logic from the physical hardware.

### Simulated mode

The application can run without the ESP32.

This allows:

* UI development
* Irrigation testing
* Water-management testing
* Planning
* Weather integration
* Assistant testing
* Demonstrations

without requiring the physical farm system to be connected.

### Real hardware mode

The ESP32 can provide physical readings and receive approved commands from HUMIS.

The intended architecture is:

**ESP32 → HUMIS server → Farm logic → Safety controller → Hardware command**

The ESP32 should act as the hardware endpoint rather than containing the main farm-management intelligence.

---

## Flow Sensors

HUMIS distinguishes between actual sensor readings and calculated or simulated values.

Water flow is intended to provide information about water entering and being used by the system.

The YF-S201 sensors are assigned to:

* **Water IN — GPIO25**
* **Water OUT — GPIO27**

These measurements can eventually be used to improve water accounting and help identify abnormal water usage, leaks or system faults.

During development, any value that is simulated or estimated must be clearly labelled rather than presented as a confirmed physical measurement.

---

## Rainwater

Rain is treated as an incoming water source for the **main tank**.

HUMIS does not treat rainwater as a second independent tank.

When rainwater harvesting is active, the system can estimate how much water is entering the main tank.

Water beyond the configured storage capacity is treated as overflow rather than being incorrectly added to the available stored-water figure.

---

## Weather

HUMIS can use weather information for irrigation planning and shortage prediction.

Weather information can help the system determine whether upcoming rainfall may affect irrigation requirements and whether watering should be reconsidered.

The prototype uses Open-Meteo for weather data and does not require an API key for this service.

If weather information is unavailable, HUMIS should still be able to provide basic water-planning information using the available tank and usage data.

---

## Application Structure

The application is divided into three main parts:

### `client/`

The farmer-facing web application.

Built with:

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Router

The main sections are:

* Overview
* Irrigation
* Water
* Planning
* History
* Settings

The Assistant is integrated into the application interface rather than being a separate application.

### `server/`

The backend responsible for:

* Farm simulation
* Water-management logic
* Irrigation decisions
* Planning
* Shortage prediction
* Authentication
* Assistant requests
* Hardware communication
* Safety control
* Server-side secrets

### `shared/`

Shared TypeScript types used by both the client and server.

---

## Authentication

HUMIS includes email/password authentication.

Passwords are stored as hashes on the server rather than in the browser.

Authentication uses server-side sessions with an `httpOnly` cookie.

Password-reset functionality is also included.

The current prototype is not yet a full multi-farm production platform. Accounts exist, but the simulated farm data remains shared rather than being completely separated into independent farms for every account.

---

## Mobile Use

HUMIS is a web application designed to work on phones as well as computers.

On a supported phone, it can be added to the home screen and opened in an app-like manner.

It is still the same HUMIS web application rather than a separate native App Store or Play Store application.

---

## Running HUMIS Locally

HUMIS requires:

* Node.js 20+
* npm 10+

From the repository root:

```bash
npm install
npm run dev
```

The development application runs on:

```text
http://localhost:5417
```

The API health endpoint runs on:

```text
http://localhost:5418/api/health
```

The planning API is available at:

```text
http://localhost:5418/api/planning
```

The Vite development server proxies `/api/*` requests to the Express server.

---

## Voice Configuration

Typed Assistant functionality does not require Khaya.

Voice functionality requires a Khaya API key stored on the server.

Example:

```env
KHAYA_API_KEY=your-key
KHAYA_ASR_LANGUAGE=eng
KHAYA_TTS_LANGUAGE=eng
```

The API key must never be placed in:

* Client-side code
* `VITE_` variables
* Git
* `render.yaml`

The exact active language configuration may change as Ghanaian-language support is expanded.

---

## Environment

The most important environment settings include:

```env
USE_SIMULATED=true
AUTH_SESSION_SECRET=your-secret
HUMIS_HARDWARE_KEY=your-hardware-key
KHAYA_API_KEY=your-khaya-key
```

Keep secrets out of source control.

The public/demo version should remain on the simulated farm until the physical hardware has been properly tested.

---

## Production / Deployment

HUMIS is designed to run as one Node-based web application.

The production process uses:

```bash
npm run build
npm start
```

Render can be used to host the application using the repository's deployment configuration.

The production/demo deployment should keep:

```text
USE_SIMULATED=true
```

until real hardware testing is complete.

---

## Project Status

HUMIS has progressed from an initial smart-water-management concept into a working software and hardware prototype.

### Completed

* [x] Project architecture
* [x] Water-management foundation
* [x] Main tank water accounting
* [x] Irrigation zones
* [x] Irrigation decision logic
* [x] Safety controller
* [x] Planning and shortage prediction
* [x] History
* [x] Settings
* [x] Farmer-friendly visual interface
* [x] HUMIS Assistant
* [x] Voice input
* [x] Voice output
* [x] Khaya AI integration
* [x] Ghanaian-language voice architecture
* [x] User authentication
* [x] Password reset
* [x] ESP32 hardware framework
* [x] Real tank-level sensing
* [x] Real soil sensing
* [x] Pump relay control
* [x] Rain-sensor integration
* [x] Flow-sensor hardware integration framework

### In development

* [ ] Full field calibration of soil and water measurements
* [ ] Complete physical irrigation-zone valve system
* [ ] Expanded physical farm testing
* [ ] Leak/fault detection using flow information
* [ ] More robust water-use prediction
* [ ] Renewable-power integration
* [ ] Longer-term water-management behaviour analysis
* [ ] Expanded Ghanaian-language support
* [ ] Multi-farm data separation
* [ ] Production database and persistent storage

---

## Prototype vs Future HUMIS

The current HUMIS system should not be confused with the final commercial product.

The prototype focuses on proving that:

1. Farm water information can be brought into one system.
2. Irrigation decisions can use more than soil moisture alone.
3. Farmers can understand the information through a simple interface.
4. An AI voice layer can make the system more accessible.
5. The same software architecture can operate with simulated data and real hardware.
6. Physical irrigation actions can be controlled through a central safety layer.

Future versions can expand this foundation with more sensors, better calibration, renewable power, improved prediction, additional languages, larger-scale farm support and deeper analysis of historical water-management behaviour.

---

## Recognition

HUMIS was developed as part of the **Emerging Technologies Bootcamp 2026**, a collaboration involving Lancaster University Ghana and Stanbic Bank.

HUMIS won **1st place** in the competition.

The winning project received:

* **GHS 5,000 in gift vouchers**
* **A Stanbic Bank internship opportunity**

The project continues to be developed beyond the original prototype.

---

## Repository Structure

```text
HUMIS/
├── client/
├── server/
├── shared/
├── hardware/
├── docs/
├── data/
├── render.yaml
├── package.json
└── README.md
```

---

## Core Design Principles

HUMIS is built around several principles:

### 1. Water first

The system is fundamentally about helping farmers manage limited water better.

### 2. One main tank

The main tank is the central storage point for available irrigation water.

### 3. No false certainty

Estimated, simulated and forecast values should be clearly identified.

### 4. Farmer-friendly

The system should communicate in language that a farmer can understand without requiring technical knowledge.

### 5. Safety before automation

No AI recommendation or user interface should bypass the central safety controller.

### 6. Incremental development

The physical prototype and software should be expanded without unnecessarily changing the fundamental HUMIS architecture.

### 7. Hardware should support the software

The ESP32 provides physical sensing and actuation. The core farm-management intelligence remains in HUMIS.

---

## Current Repository

The current HUMIS development repository is maintained separately from the older versions of the project.

The latest development branch should be treated as the current working version rather than older `main` branches that may contain earlier versions of HUMIS.

---

## License

Add the project's chosen license here before public distribution.
