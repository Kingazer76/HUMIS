function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  const safari = window.navigator as Navigator & { standalone?: boolean }
  return safari.standalone === true
}

/**
 * One-line phone tip on sign-in. Hidden once HUMIS is already opened
 * from a home-screen icon. Does not change the farm screens.
 */
export function AddToHomeHint() {
  if (isStandaloneApp()) return null

  return (
    <p className="mx-auto mt-4 max-w-sm text-center text-xs leading-relaxed text-muted-foreground">
      On a phone, open the browser menu and tap <span className="font-medium text-foreground">Add to Home Screen</span>.
      HUMIS then opens like an app. Same farm. Same practice water.
    </p>
  )
}
