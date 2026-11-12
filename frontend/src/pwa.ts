// Installable app (PWA): the service worker is registered only in a production build,
// so the dev server always serves fresh code.
export function registerServiceWorker(enabled: boolean = import.meta.env.PROD) {
  if (!enabled || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not fatal: the app works the same, it just can't be installed
    });
  });
}
