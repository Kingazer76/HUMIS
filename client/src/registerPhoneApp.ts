/**
 * Lets phones install HUMIS as a home-screen app.
 * Farm APIs stay on the live server — this only registers the helper.
 */
export function registerPhoneApp(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
