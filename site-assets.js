/**
 * Resolve caminhos de assets (portal na raiz vs /jugar/).
 * Defina window.__SITE_ROOT__ antes deste script ('' ou '../').
 */
(function (global) {
  'use strict';

  if (typeof global.assetUrl === 'function') return;

  global.assetUrl = function assetUrl(relativePath) {
    if (!relativePath) return relativePath;
    if (/^(https?:|data:|blob:)/i.test(relativePath)) return relativePath;
    const root = global.__SITE_ROOT__ || '';
    const path = String(relativePath).replace(/^\/+/, '');
    return root + path;
  };
})(typeof window !== 'undefined' ? window : globalThis);
