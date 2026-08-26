import { createApp } from './app.js'
import { HOST, PORT } from './env.js'
import { startAutoIrrigationLoop } from './irrigation/autoIrrigationLoop.js'
import { startSimulationEngine } from './simulation/simulationEngine.js'
import { attachFrontend } from './serveFrontend.js'

const app = createApp()

startSimulationEngine()
startAutoIrrigationLoop()
attachFrontend(app)

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`AquaFlow server listening on http://${HOST}:${PORT}`)
})
