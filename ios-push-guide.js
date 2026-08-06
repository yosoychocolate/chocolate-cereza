/**
 * Guía iPhone/iPad — push solo funciona como app en pantalla de inicio (iOS 16.4+).
 */
(function (global) {
  'use strict';

  function isIOS() {
    const ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function isStandalone() {
    try {
      if (global.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    } catch (_) { /* ignore */ }
    return global.navigator.standalone === true;
  }

  function needsHomeScreenInstall() {
    return isIOS() && !isStandalone();
  }

  function canUsePushOnThisDevice() {
    if (!isIOS()) return true;
    return isStandalone();
  }

  function getOverlay() {
    return document.getElementById('ios-install-overlay');
  }

  function showInstallGuide() {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ios-install-open');
  }

  function hideInstallGuide() {
    const overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ios-install-open');
  }

  function bindInstallGuide() {
    const overlay = getOverlay();
    if (!overlay || overlay.dataset.bound === '1') return;
    overlay.dataset.bound = '1';

    overlay.querySelector('[data-ios-install-close]')?.addEventListener('click', hideInstallGuide);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideInstallGuide();
    });
  }

  function maybeShowIntroHint() {
    if (!needsHomeScreenInstall()) return;
    const hint = document.getElementById('intro-notif-hint');
    if (!hint || hint.textContent) return;
    hint.textContent = 'En iPhone: primero añade el sitio a la pantalla de inicio.';
    hint.classList.remove('hidden');
    hint.classList.remove('is-success');
    hint.classList.add('is-error');
  }

  function init() {
    bindInstallGuide();
    if (needsHomeScreenInstall()) {
      document.documentElement.classList.add('is-ios-browser-tab');
      maybeShowIntroHint();
    }
    if (isStandalone()) {
      document.documentElement.classList.add('is-ios-standalone');
    }
  }

  global.IosPushGuide = {
    isIOS,
    isStandalone,
    needsHomeScreenInstall,
    canUsePushOnThisDevice,
    showInstallGuide,
    hideInstallGuide,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
