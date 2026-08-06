/**
 * Detecta nova versão publicada no GitHub Pages e recarrega uma vez.
 * version.json é gerado no deploy com o hash do commit.
 */
(function checkAppVersion() {
  if (location.protocol === 'file:') return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  var STORAGE_KEY = 'ChocolateCerezaAppVersion';

  fetch('version.json?_=' + Date.now(), { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      if (!data || !data.version || data.version === '7cbf9eb') return;

      var previous = localStorage.getItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, data.version);

      if (previous && previous !== data.version) {
        var url = new URL(window.location.href);
        url.searchParams.set('_v', data.version);
        window.location.replace(url.toString());
      }
    })
    .catch(function () { /* offline ou version.json indisponível */ });
})();
