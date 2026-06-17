
export function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => {
        console.warn('SW registration failed:', e);
      });
    });
  }
}
