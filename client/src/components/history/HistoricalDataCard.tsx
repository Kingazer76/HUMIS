import type { HistoryRecord } from '@aquaflow/shared'
import { EstimateBadge } from '@/components/shared/EstimateBadge'
import { formatLiters, formatSoilCondition, formatWateringAction, formatWhen } from '@/lib/format'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * One History row. Farmer-facing columns only — ids, tank litres, and
 * record kind stay off this card.
 */
export function HistoricalDataCard({ record }: { record: HistoryRecord }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{formatWhen(record.recordedAt)}</p>
        <EstimateBadge tag={record.tag} className="capitalize" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Row label="Field" value={record.zoneName} />
        <Row label="Crop" value={record.cropName} />
        <Row label="Soil" value={formatSoilCondition(record.soilCondition)} />
        <Row label="Watering" value={formatWateringAction(record.wateringAction)} />
        <Row label="Water used" value={formatLiters(record.waterUsedL)} />
      </div>
    </div>
  )
}
