/**
 * `lucide-react`'s package only ships type declarations for its barrel
 * entry point (`import { X } from 'lucide-react'`), not for the individual
 * per-icon files under `lucide-react/dist/esm/icons/*.mjs`. Importing icons
 * individually (see components that do `import Droplets from
 * 'lucide-react/dist/esm/icons/droplets.mjs'`) avoids Vite's dev-mode
 * dependency optimizer pulling in the entire ~1500-icon barrel (a ~1.1 MB
 * dev-only bundle) just to use ~20 icons — this ambient declaration is
 * what keeps that import fully typed.
 */
declare module 'lucide-react/dist/esm/icons/*.mjs' {
  import type { LucideIcon } from 'lucide-react'

  const Icon: LucideIcon
  export default Icon
}
