import { AlertTriangle, Database } from '@/lib/icons'
import type { HistoryRecord } from '@aquaflow/shared'
import { HistoricalDataCard } from '@/components/history/HistoricalDataCard'
import { SectionCard } from '@/components/shared/SectionCard'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolling } from '@/hooks/usePolling'
import { api } from '@/lib/api'
import { formatLiters, formatSoilCondition, formatWateringAction, formatWhen } from '@/lib/format'

function HistoryTable({ records }: { records: HistoryRecord[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Time</th>
            <th className="py-2 pr-3 font-medium">Field</th>
            <th className="py-2 pr-3 font-medium">Crop</th>
            <th className="py-2 pr-3 font-medium">Soil</th>
            <th className="py-2 pr-3 font-medium">Watering</th>
            <th className="py-2 pr-3 font-medium">Water used</th>
            <th className="py-2 font-medium">Source</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="border-b border-border/60">
              <td className="py-2 pr-3 text-foreground">{formatWhen(record.recordedAt)}</td>
              <td className="py-2 pr-3 font-medium text-foreground">{record.zoneName}</td>
              <td className="py-2 pr-3 text-foreground">{record.cropName}</td>
              <td className="py-2 pr-3 text-foreground">{formatSoilCondition(record.soilCondition)}</td>
              <td className="py-2 pr-3 text-foreground">{formatWateringAction(record.wateringAction)}</td>
              <td className="py-2 pr-3 text-foreground">{formatLiters(record.waterUsedL)}</td>
              <td className="py-2 capitalize text-muted-foreground">{record.tag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * V1's History tab: a simple log of watering and field checks from the
 * simulated farm. Simulated records stay labelled Simulated.
 */
export function HistoryPage() {
  const { data: history, error } = usePolling(api.getHistory)

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <SectionCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          title="Can't reach the AquaFlow server"
          description="History will appear once the connection is back. Retrying automatically."
        />
      ) : null}

      <SectionCard
        icon={<Database className="h-4 w-4" />}
        title="Farm history"
        description="Watering and field checks from this session. Simulated records are labelled Simulated so they can be told apart from real farm data later. The log resets when the server restarts."
      >
        {history === undefined ? (
          <div className="flex flex-col gap-2 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : history.records.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No history yet. Watering and field checks will show up here as the farm runs.
          </p>
        ) : (
          <>
            <div className="hidden sm:block">
              <HistoryTable records={history.records} />
            </div>
            <div className="flex flex-col gap-3 sm:hidden">
              {history.records.map((record) => (
                <HistoricalDataCard key={record.id} record={record} />
              ))}
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}
