import { createApp } from './app.js'
import { PORT } from './env.js'
import { startAutoIrrigationLoop } from './irrigation/autoIrrigationLoop.js'
import { startSimulationEngine } from './simulation/simulationEngine.js'

const app = createApp()

startSimulationEngine()
startAutoIrrigationLoop()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AquaFlow server listening on http://127.0.0.1:${PORT}`)
})
