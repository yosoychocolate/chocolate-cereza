/**
 * PWA em segundo plano — service worker sempre ativo + instalar app + push com app fechado.
 * O site não pode executar JS para sempre com o app fechado; o SW recebe push do servidor (FCM).
 */
(function (global) {
  'use strict';

  const INSTALL_DISMISS_KEY = 'ChocolateCerezaPwaInstallDismissed';
  const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

  /** @type {BeforeInstallPromptEvent | null} */
  let deferredInstallPrompt = null;

  function swUrl() {
    if (typeof global.assetUrl === 'function') {
      return global.assetUrl('sw.js?v=__APP_VERSION__');
    }
    const root = global.__SITE_ROOT__ || '';
    return `${root}sw.js?v=__APP_VERSION__`;
  }

  function isStandalone() {
    try {
      if (global.matchMedia?.('(display-mode: standalone)')?.matches) return true;
      if (global.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
    } catch (_) { /* ignore */ }
    return global.navigator.standalone === true;
  }

  function isIOS() {
    const ua = global.navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return global.navigator.platform === 'MacIntel' && global.navigator.maxTouchPoints > 1;
  }

  function canUseBackgroundPush() {
    if (!('Notification' in global)) return false;
    if (isIOS() && !isStandalone()) return false;
    return true;
  }

  async function registerBackgroundWorker() {
    if (!('serviceWorker' in global.navigator)) return null;
    try {
      const reg = await global.navigator.serviceWorker.register(swUrl(), { scope: './' });
      await reg.update();
      await registerPeriodicHealthCheck(reg);
      return reg;
    } catch (err) {
      console.warn('[PWA] Service worker:', err);
      return null;
    }
  }

  async function registerPeriodicHealthCheck(reg) {
    if (!reg || !('periodicSync' in reg)) return;
    try {
      const perm = await global.navigator.permissions.query({ name: 'periodic-background-sync' });
      if (perm.state !== 'granted') return;
      await reg.periodicSync.register('push-health-check', {
        minInterval: 12 * 60 * 60 * 1000,
      });
    } catch (_) { /* só PWA instalado no Chrome/Android */ }
  }

  function ensureInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner hidden';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Instalar aplicación');
    banner.innerHTML = `
      <div class="pwa-install-banner-inner">
        <p class="pwa-install-banner-text">
          <strong>📲 Instala la app</strong> para recibir mensajes y avisos aunque la cierres por completo.
        </p>
        <div class="pwa-install-banner-actions">
          <button type="button" class="pwa-install-btn couple-btn couple-btn-small couple-btn-primary" id="pwa-install-btn">Instalar</button>
          <button type="button" class="pwa-install-btn couple-btn couple-btn-small couple-btn-ghost" id="pwa-install-dismiss">Ahora no</button>
        </div>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('#pwa-install-btn')?.addEventListener('click', () => {
      void promptInstall();
    });
    banner.querySelector('#pwa-install-dismiss')?.addEventListener('click', () => {
      hideInstallBanner(true);
    });
  }

  function shouldShowInstallBanner() {
    if (isStandalone()) return false;
    if (!('serviceWorker' in global.navigator)) return false;
    if (global.__FILE_PROTOCOL__) return false;
    try {
      const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (Number.isFinite(ts) && Date.now() - ts < INSTALL_DISMISS_MS) return false;
      }
    } catch (_) { /* ignore */ }
    return true;
  }

  function showInstallBanner() {
    ensureInstallBanner();
    const banner = document.getElementById('pwa-install-banner');
    if (!banner || !shouldShowInstallBanner()) return;
    banner.classList.remove('hidden');
    document.documentElement.classList.add('pwa-install-visible');
  }

  function hideInstallBanner(persistDismiss = false) {
    const banner = document.getElementById('pwa-install-banner');
    banner?.classList.add('hidden');
    document.documentElement.classList.remove('pwa-install-visible');
    if (persistDismiss) {
      try {
        localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
      } catch (_) { /* ignore */ }
    }
  }

  async function promptInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_) { /* ignore */ }
      deferredInstallPrompt = null;
      hideInstallBanner(true);
      return;
    }

    if (isIOS()) {
      global.IosPushGuide?.showInstallGuide?.();
      return;
    }

    showInstallBanner();
  }

  async function ensureBackgroundPush() {
    if (!canUseBackgroundPush()) return;
    if (Notification.permission !== 'granted') return;
    if (typeof global.PushNotifications?.subscribe !== 'function') return;
    try {
      await global.PushNotifications.subscribe();
    } catch (_) { /* ignore */ }
  }

  function bindInstallPrompt() {
    global.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallBanner();
    });

    global.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      hideInstallBanner(true);
      document.documentElement.classList.add('is-pwa-installed');
      void ensureBackgroundPush();
    });
  }

  function bindServiceWorkerMessages() {
    if (!('serviceWorker' in global.navigator)) return;
    global.navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'push:resubscribe') {
        void ensureBackgroundPush();
      }
    });
  }

  function init() {
    if (global.__FILE_PROTOCOL__) return;

    bindInstallPrompt();
    bindServiceWorkerMessages();
    void registerBackgroundWorker();

    if (isStandalone()) {
      document.documentElement.classList.add('is-pwa-installed');
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { void ensureBackgroundPush(); });
      } else {
        void ensureBackgroundPush();
      }
    } else if (shouldShowInstallBanner()) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showInstallBanner);
      } else {
        showInstallBanner();
      }
    }
  }

  global.BackgroundPwa = {
    registerBackgroundWorker,
    promptInstall,
    isStandalone,
    canUseBackgroundPush,
    showInstallBanner,
    hideInstallBanner,
    ensureBackgroundPush,
  };

  init();
})(typeof window !== 'undefined' ? window : globalThis);
