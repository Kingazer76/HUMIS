import { Database } from '@/lib/icons'
import { SectionCard } from '@/components/shared/SectionCard'

/**
 * V1's History tab: a lightweight, clearly-labeled log of simulated
 * readings for future ML use. Populated by the simulation tick loop from
 * Phase 4 onward — simulated records stay labeled as such.
 */
export function HistoryPage() {
  return (
    <SectionCard
      icon={<Database className="h-4 w-4" />}
      title="Historical farm data"
      description="Lightweight operational log for future ML development. Simulated records are labelled so they can be separated from real farm data later."
    >
      <p className="py-6 text-center text-sm text-muted-foreground">Collecting data…</p>
    </SectionCard>
  )
}
