import { createApp } from './app.js'
import { bootstrapFirstUser } from './auth/index.js'
import { HOST, PORT } from './env.js'
import { startAutoIrrigationLoop } from './irrigation/autoIrrigationLoop.js'
import { startHardwareEngine } from './hardware/hardwareEngine.js'
import { startSimulationEngine } from './simulation/simulationEngine.js'
import { attachFrontend } from './serveFrontend.js'

const app = createApp()

startSimulationEngine()
startHardwareEngine()
startAutoIrrigationLoop()
attachFrontend(app)

void bootstrapFirstUser()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[HUMIS] Could not create the bootstrap account.', err instanceof Error ? err.message : err)
  })
  .finally(() => {
    app.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`HUMIS server listening on http://${HOST}:${PORT}`)
    })
  })
