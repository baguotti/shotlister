import { registerSW } from 'virtual:pwa-register';

export function initPWA() {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('New content available, background update complete! Tap refresh to apply.');
    },
    onOfflineReady() {
      console.log('App ready to work offline.');
    },
  });
}
