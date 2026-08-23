import type { ReactNode } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { TabNav } from '@/components/layout/TabNav'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 sm:px-6">
        <AppHeader />
        <TabNav />
        <main className="flex-1 py-6">{children}</main>
      </div>
    </div>
  )
}
