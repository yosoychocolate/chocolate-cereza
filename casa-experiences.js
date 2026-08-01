/**
 * Casa — experiências vivas: os dois juntos, clima, tempo na sala de jogos.
 */
(function (global) {
  'use strict';

  const DEFAULT_WEATHER = { lat: 40.71, lon: -74.01, label: 'Nueva York' };
  const POLL_MS = 12000;
  const WEATHER_TTL = 3600000;

  let pollTimer = null;
  let presenceFn = null;
  let together = false;
  let togetherDetail = { localName: 'Roberto', partnerName: 'Sophie', together: false };
  let weather = { kind: 'sun', temp: null, fetchedAt: 0 };
  let gamesEnteredAt = null;

  function weatherKind(code) {
    if (code == null) return 'sun';
    if (code >= 71 && code <= 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
    if (code === 0 || code === 1) return 'sun';
    return 'cloudy';
  }

  async function fetchWeather() {
    const nc = global.SaveManager?.getSave?.()?.nossaCasa || {};
    const cached = nc.weather;
    if (cached?.fetchedAt && Date.now() - cached.fetchedAt < WEATHER_TTL) {
      weather = cached;
      return weather;
    }
    const lat = nc.weatherLat ?? DEFAULT_WEATHER.lat;
    const lon = nc.weatherLon ?? DEFAULT_WEATHER.lon;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,temperature_2m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather');
      const data = await res.json();
      const code = data.current?.weather_code;
      weather = {
        kind: weatherKind(code),
        temp: data.current?.temperature_2m ?? null,
        fetchedAt: Date.now(),
        lat,
        lon,
      };
      global.SaveManager?.updateSection?.('nossaCasa', { weather });
    } catch (_) {
      weather = { kind: 'sun', temp: null, fetchedAt: Date.now() };
    }
    global.dispatchEvent(new CustomEvent('casa:weather-changed', { detail: weather }));
    return weather;
  }

  async function pollPresence() {
    if (!presenceFn) return;
    try {
      const pres = await presenceFn();
      const wasTogether = together;
      together = pres?.together === true;
      togetherDetail = {
        together,
        localName: pres?.localName || 'Roberto',
        partnerName: pres?.partnerName || 'Sophie',
        inRoom: pres?.inRoom,
      };
      global.document.body.classList.toggle('casa-together-complete', together);
      if (together !== wasTogether) {
        global.dispatchEvent(new CustomEvent('casa:together-changed', { detail: togetherDetail }));
        global.NossaCasa?.refresh?.();
      }
    } catch (_) { /* offline */ }
  }

  function getSeasonBird() {
    const m = new Date().getMonth() + 1;
    if (m >= 12 || m <= 2) return null;
    if (m >= 3 && m <= 5) return '🐦';
    if (m >= 6 && m <= 8) return '🕊️';
    return '🐦';
  }

  function completeBannerHtml() {
    if (!together) return '';
    const a = togetherDetail.localName;
    const b = togetherDetail.partnerName;
    return `<div class="casa-complete-banner" role="status">
      <span class="casa-complete-icon">🏡</span>
      <p class="casa-complete-title">La casa está completa.</p>
      <p class="casa-complete-sub">❤️ ${escapeHtml(a)} y ${escapeHtml(b)} están juntos.</p>
    </div>
    <div class="casa-complete-particles" aria-hidden="true"></div>`;
  }

  function escapeHtml(text) {
    const d = global.document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

  function onEnterRoom(roomId) {
    if (roomId === 'jogos') gamesEnteredAt = Date.now();
  }

  function onExitRoom(roomId) {
    if (roomId !== 'jogos' || !gamesEnteredAt) return;
    const mins = Math.floor((Date.now() - gamesEnteredAt) / 60000);
    gamesEnteredAt = null;
    if (mins < 1) return;
    const nc = global.SaveManager?.getSave?.()?.nossaCasa || {};
    global.SaveManager?.updateSection?.('nossaCasa', {
      lastGamesSessionAt: Date.now(),
      lastGamesSessionMins: mins,
      gamesWatchMinutes: (nc.gamesWatchMinutes || 0) + mins,
    });
    global.dispatchEvent(new CustomEvent('casa:games-session', { detail: { mins } }));
  }

  function wasWatchingGames() {
    const nc = global.SaveManager?.getSave?.()?.nossaCasa || {};
    if (!nc.lastGamesSessionAt) return false;
    if (Date.now() - nc.lastGamesSessionAt > 86400000) return false;
    return (nc.lastGamesSessionMins || 0) >= 8;
  }

  function watchingGamesLine() {
    const nc = global.SaveManager?.getSave?.()?.nossaCasa || {};
    const mins = nc.lastGamesSessionMins || 0;
    return `Teddy estuvo mirándolos jugar ${mins} minutos. 🧸🎮`;
  }

  function syncAmbientAudio() {
    const AM = global.AudioManager;
    if (!AM) return;
    if (together) {
      AM.startAmbient('fire');
      return;
    }
    const kind = weather.kind;
    if (kind === 'rain' || kind === 'snow') {
      AM.startAmbient('rain');
      return;
    }
    const h = new Date().getHours();
    if (h >= 22 || h < 6) AM.startAmbient('night');
    else AM.startAmbient('day');
  }

  const CasaExperiences = {
    init(opts) {
      presenceFn = opts?.presence || null;
      pollPresence();
      fetchWeather();
      clearInterval(pollTimer);
      pollTimer = setInterval(pollPresence, POLL_MS);
      global.addEventListener('casa:weather-changed', syncAmbientAudio);
      setTimeout(syncAmbientAudio, 1200);
    },

    destroy() {
      clearInterval(pollTimer);
      pollTimer = null;
      global.document.body.classList.remove('casa-together-complete');
    },

    isTogether() { return together; },
    getTogetherDetail() { return { ...togetherDetail }; },
    getWeather() { return { ...weather }; },
    getSeasonBird,
    completeBannerHtml,
    onEnterRoom,
    onExitRoom,
    wasWatchingGames,
    watchingGamesLine,
    refreshWeather: fetchWeather,
    syncAmbientAudio,
  };

  global.CasaExperiences = CasaExperiences;
})(typeof window !== 'undefined' ? window : globalThis);
