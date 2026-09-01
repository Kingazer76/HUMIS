/**
 * Every icon the app actually uses, imported from lucide-react's individual
 * per-icon files rather than the package barrel (`from 'lucide-react'`).
 *
 * Why: Vite's dev-mode dependency optimizer bundles an entire imported
 * package as one chunk. Because lucide-react re-exports ~1,500 icons from
 * a single barrel module, importing anything from `'lucide-react'`
 * pre-bundles all of them (~1.1 MB) even though this app only draws ~20.
 * Importing each icon from its own file keeps the bundled chunk limited to
 * what's actually used, with no change to how any icon looks or behaves.
 * See `src/types/lucide-icons.d.ts` for the matching type declaration.
 */
export { default as Activity } from 'lucide-react/dist/esm/icons/activity.mjs'
export { default as AlertTriangle } from 'lucide-react/dist/esm/icons/alert-triangle.mjs'
export { default as ArrowDown } from 'lucide-react/dist/esm/icons/arrow-down.mjs'
export { default as ArrowUp } from 'lucide-react/dist/esm/icons/arrow-up.mjs'
export { default as CalendarDays } from 'lucide-react/dist/esm/icons/calendar-days.mjs'
export { default as CloudRain } from 'lucide-react/dist/esm/icons/cloud-rain.mjs'
export { default as Cpu } from 'lucide-react/dist/esm/icons/cpu.mjs'
export { default as Database } from 'lucide-react/dist/esm/icons/database.mjs'
export { default as Droplets } from 'lucide-react/dist/esm/icons/droplets.mjs'
export { default as Eye } from 'lucide-react/dist/esm/icons/eye.mjs'
export { default as EyeOff } from 'lucide-react/dist/esm/icons/eye-off.mjs'
export { default as Gauge } from 'lucide-react/dist/esm/icons/gauge.mjs'
export { default as Layers } from 'lucide-react/dist/esm/icons/layers.mjs'
export { default as Leaf } from 'lucide-react/dist/esm/icons/leaf.mjs'
export { default as LogOut } from 'lucide-react/dist/esm/icons/log-out.mjs'
export { default as MapPin } from 'lucide-react/dist/esm/icons/map-pin.mjs'
export { default as MessageCircle } from 'lucide-react/dist/esm/icons/message-circle.mjs'
export { default as Mic } from 'lucide-react/dist/esm/icons/mic.mjs'
export { default as Plus } from 'lucide-react/dist/esm/icons/plus.mjs'
export { default as Power } from 'lucide-react/dist/esm/icons/power.mjs'
export { default as Send } from 'lucide-react/dist/esm/icons/send.mjs'
export { default as Settings2 } from 'lucide-react/dist/esm/icons/settings-2.mjs'
export { default as ShieldCheck } from 'lucide-react/dist/esm/icons/shield-check.mjs'
export { default as Sprout } from 'lucide-react/dist/esm/icons/sprout.mjs'
export { default as ToggleLeft } from 'lucide-react/dist/esm/icons/toggle-left.mjs'
export { default as User } from 'lucide-react/dist/esm/icons/user.mjs'
