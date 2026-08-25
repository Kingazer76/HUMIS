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
 * Six-tab farm navigation. Layout is locked: outlined tabs, teal filled
 * active tab, two rows of three on phones. Gold is a secondary accent on
 * the outlines and a small diamond mark — not a status color.
 */
export function TabNav() {
  return (
    <nav
      aria-label="Main sections"
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              'aquaflow-tab rounded-lg border-2 px-2 py-2.5 text-center text-sm leading-tight transition-colors sm:px-3',
              isActive
                ? 'aquaflow-tab-active border-2 bg-primary font-semibold text-primary-foreground'
                : 'border-2 border-primary/50 bg-card font-medium text-foreground hover:border-primary hover:bg-secondary',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
