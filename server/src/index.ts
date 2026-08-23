import { createApp } from './app.js'
import { PORT } from './env.js'
import { startSimulationEngine } from './simulation/simulationEngine.js'

const app = createApp()

startSimulationEngine()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AquaFlow server listening on http://127.0.0.1:${PORT}`)
})
