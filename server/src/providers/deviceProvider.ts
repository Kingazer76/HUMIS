import type {
  IrrigationZone,
  IrrigationZoneConfig,
  OperationMode,
  PumpStateReading,
  RainStatusReading,
  SystemStatusReading,
  TankState,
  WaterSource,
} from '@aquaflow/shared'

/**
 * Everything the rest of AquaFlow knows about "the farm's hardware" goes
 * through this interface. `SimulatedDeviceProvider` (practice farm) and
 * `ESP32DeviceProvider` (real board) both implement it, so nothing above
 * this layer needs to know which one is active.
 *
 * IMPORTANT: this interface only ever *reports* state and *requests*
 * actuator changes. It is not where irrigation decisions are made — that
 * is `irrigationEngine`/`safetyController`, arriving in Phase 3. Nothing
 * in Phase 1 ever calls `setPumpState` or `setZoneValve`.
 */
export interface DeviceProvider {
  getTankLevel(): Promise<TankState>
  getSources(): Promise<WaterSource[]>
  getZones(): Promise<IrrigationZone[]>
  getZoneConfig(zoneId: string): Promise<IrrigationZoneConfig | undefined>
  getRainStatus(): Promise<RainStatusReading>
  getPumpStatus(): Promise<PumpStateReading>
  getOperationMode(): Promise<OperationMode>
  getSystemStatus(): Promise<SystemStatusReading>

  /** Requests the pump be turned on/off. Only ever called by `safetyController` (Phase 3+). */
  setPumpState(isOn: boolean): Promise<void>
  /** Requests a zone's valve be opened/closed. Only ever called by `safetyController` (Phase 3+). */
  setZoneValve(zoneId: string, isOn: boolean): Promise<void>
  /** Switches Auto/Manual. Only ever called by `safetyController`. */
  setOperationMode(mode: OperationMode): Promise<void>
}

export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(`${feature} is not implemented yet`)
    this.name = 'NotImplementedError'
  }
}
