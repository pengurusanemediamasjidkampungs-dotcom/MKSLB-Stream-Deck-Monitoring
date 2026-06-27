/**
 * app.js
 * ─────────────────────────────────────────────────────────────
 * Entry point — Initialization & Service Worker registration
 * Import: ui-controller (yang seterusnya import obs-api)
 * ─────────────────────────────────────────────────────────────
 */

import { uiController } from './ui-controller.js';

/* ════════════════════════════════
   INIT on DOM ready
════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[StreamDeck] Initialising MKSLB Stream Deck…');

  // Mulakan UI controller (daftar semua event listeners)
  uiController.init();

  // Auto-connect jika sudah ada settings tersimpan
  const hasHost = localStorage.getItem('obs_host');
  if (hasHost) {
    console.log('[StreamDeck] Settings ditemui — auto-connecting…');
    // Delay sedikit supaya UI sempat render dulu
    setTimeout(() => {
      document.getElementById('connectBtn')?.click();
    }, 600);
  } else {
    // Tunjuk modal settings jika first time
    console.log('[StreamDeck] Tiada settings — buka settings modal…');
    setTimeout(() => {
      document.getElementById('settingsBtn')?.click();
    }, 800);
  }

  // Register Service Worker (PWA)
  registerServiceWorker();
});

/* ════════════════════════════════
   SERVICE WORKER REGISTRATION
════════════════════════════════ */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        console.log('[SW] Registered. Scope:', reg.scope);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Update tersedia — boleh notify user
                console.log('[SW] Update tersedia! Reload untuk gunakan versi terbaru.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration gagal:', err);
      });
  } else {
    console.warn('[SW] Service Worker tidak disokong oleh browser ini.');
  }
}

/* ════════════════════════════════
   PWA INSTALL PROMPT (optional)
════════════════════════════════ */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] Install prompt available');
  // Boleh paparkan butang install custom di sini jika perlu
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] App berjaya dipasang!');
  deferredInstallPrompt = null;
});

// Export untuk kegunaan lain jika perlu
export function triggerInstallPrompt() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      console.log('[PWA] User choice:', choice.outcome);
      deferredInstallPrompt = null;
    });
  }
}
