import type { ReactNode } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { TabNav } from '@/components/layout/TabNav'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 sm:px-6">
        <AppHeader />
        <div className="pt-4">
          <TabNav />
        </div>
        <main className="flex-1 py-5 sm:py-6">{children}</main>
      </div>
    </div>
  )
}
