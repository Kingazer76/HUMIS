import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/overview', label: 'Overview' },
  { to: '/irrigation', label: 'Irrigation' },
  { to: '/water', label: 'Water' },
  { to: '/planning', label: 'Planning' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
] as const

/**
 * Reproduces V1's tab bar: plain-text tabs, active tab shown as a white
 * pill with bold text. On narrow screens the six tabs wrap into two rows
 * of three (matches the V1 prototype's own mobile behavior).
 */
export function TabNav() {
  return (
    <nav
      aria-label="Main sections"
      className="grid grid-cols-3 gap-1 rounded-xl bg-secondary/60 p-1 sm:grid-cols-6"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'rounded-lg px-3 py-2 text-center text-sm transition-colors',
              isActive
                ? 'bg-card font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
