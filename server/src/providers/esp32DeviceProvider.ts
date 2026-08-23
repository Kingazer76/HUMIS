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
import { type DeviceProvider, NotImplementedError } from './deviceProvider.js'

/**
 * Stub only — real ESP32 hardware integration is Phase 7, explicitly
 * deferred. This class exists so the provider-selection seam
 * (`providers/index.ts`) is already wired end-to-end; every method throws
 * until that phase is explicitly requested. Do not implement hardware
 * communication here yet.
 */
export class ESP32DeviceProvider implements DeviceProvider {
  async getTankLevel(): Promise<TankState> {
    throw new NotImplementedError('ESP32DeviceProvider.getTankLevel')
  }

  async getSources(): Promise<WaterSource[]> {
    throw new NotImplementedError('ESP32DeviceProvider.getSources')
  }

  async getZones(): Promise<IrrigationZone[]> {
    throw new NotImplementedError('ESP32DeviceProvider.getZones')
  }

  async getZoneConfig(_zoneId: string): Promise<IrrigationZoneConfig | undefined> {
    throw new NotImplementedError('ESP32DeviceProvider.getZoneConfig')
  }

  async getRainStatus(): Promise<RainStatusReading> {
    throw new NotImplementedError('ESP32DeviceProvider.getRainStatus')
  }

  async getPumpStatus(): Promise<PumpStateReading> {
    throw new NotImplementedError('ESP32DeviceProvider.getPumpStatus')
  }

  async getOperationMode(): Promise<OperationMode> {
    throw new NotImplementedError('ESP32DeviceProvider.getOperationMode')
  }

  async getSystemStatus(): Promise<SystemStatusReading> {
    throw new NotImplementedError('ESP32DeviceProvider.getSystemStatus')
  }

  async setPumpState(_isOn: boolean): Promise<void> {
    throw new NotImplementedError('ESP32DeviceProvider.setPumpState')
  }

  async setZoneValve(_zoneId: string, _isOn: boolean): Promise<void> {
    throw new NotImplementedError('ESP32DeviceProvider.setZoneValve')
  }

  async setOperationMode(_mode: OperationMode): Promise<void> {
    throw new NotImplementedError('ESP32DeviceProvider.setOperationMode')
  }
}
