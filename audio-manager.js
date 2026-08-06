/**
 * AudioManager — BGM, SFX (jogos), Teddy e UI/notificações em canais independentes.
 */
(function (global) {
  'use strict';

  const DEFAULTS = { bgm: 0.75, sfx: 0.80, teddy: 0.65, ui: 0.40, ambient: 0.35 };

  const BGM_PROFILES = {
    home: { gain: 1, filterHz: 12000 },
    cherry: { gain: 0.94, filterHz: 10000 },
    cannon: { gain: 0.9, filterHz: 6500 },
  };

  let ctx = null;
  let master = null;
  let channels = {};
  let bgmProfileGain = null;
  let bgmDuckGain = null;
  let bgmFilter = null;
  let mediaEl = null;
  let profileMul = 1;
  let htmlDuckMul = 1;
  let htmlDuckTimer = null;
  let duckTimer = null;
  let ambientTimer = null;
  let ambientNodes = [];
  let currentProfile = 'home';
  let ready = false;
  let settingsBound = false;

  function clamp(v) {
    return Math.max(0, Math.min(1, Number(v) || 0));
  }

  function settings() {
    global.SaveManager?.init?.();
    return global.SaveManager?.getSave?.()?.settings || {};
  }

  function vol(channel) {
    const s = settings();
    switch (channel) {
      case 'bgm':
        return clamp(s.bgmVolume ?? s.musicVolume ?? DEFAULTS.bgm);
      case 'sfx':
        if (s.sfx === false) return 0;
        return clamp(s.sfxVolume ?? s.gameSfxVolume ?? DEFAULTS.sfx);
      case 'teddy':
        if (s.sfx === false || s.teddySfx === false) return 0;
        return clamp(s.teddyVolume ?? s.teddySfxVolume ?? DEFAULTS.teddy);
      case 'ui':
        return clamp(s.uiVolume ?? DEFAULTS.ui);
      case 'ambient':
        return clamp(s.ambientVolume ?? DEFAULTS.ambient) * clamp(s.bgmVolume ?? s.musicVolume ?? DEFAULTS.bgm);
      default:
        return 0;
    }
  }

  function init() {
    if (ready) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    ['bgm', 'sfx', 'teddy', 'ui', 'ambient'].forEach((id) => {
      channels[id] = ctx.createGain();
      channels[id].connect(master);
    });

    bgmProfileGain = ctx.createGain();
    bgmProfileGain.gain.value = 1;
    bgmFilter = ctx.createBiquadFilter();
    bgmFilter.type = 'lowpass';
    bgmFilter.frequency.value = BGM_PROFILES.home.filterHz;
    bgmDuckGain = ctx.createGain();
    bgmDuckGain.gain.value = 1;
    bgmProfileGain.connect(bgmFilter);
    bgmFilter.connect(bgmDuckGain);
    bgmDuckGain.connect(channels.bgm);

    applyVolumes();
    ready = true;
    return ctx;
  }

  function resume() {
    init();
    if (ctx?.state === 'suspended') {
      return ctx.resume().catch(() => {});
    }
    return Promise.resolve(ctx);
  }

  function applyVolumes() {
    if (!ready) return;
    channels.bgm.gain.value = vol('bgm');
    channels.sfx.gain.value = vol('sfx');
    channels.teddy.gain.value = vol('teddy');
    channels.ui.gain.value = vol('ui');
    channels.ambient.gain.value = vol('ambient');
    syncMediaVolume();
  }

  function persistVolume(channel, value) {
    const s = { ...settings() };
    const v = clamp(value);
    if (channel === 'bgm') {
      s.bgmVolume = v;
      s.musicVolume = v;
    } else if (channel === 'sfx') {
      s.sfxVolume = v;
      s.gameSfxVolume = v;
    } else if (channel === 'teddy') {
      s.teddyVolume = v;
      s.teddySfxVolume = v;
    } else if (channel === 'ui') {
      s.uiVolume = v;
    } else if (channel === 'ambient') {
      s.ambientVolume = v;
    }
    global.SaveManager?.updateSection?.('settings', s);
    applyVolumes();
    global.dispatchEvent(new CustomEvent('audio:volume-changed', { detail: { channel, value: v } }));
  }

  function setVolume(channel, value, persist) {
    if (persist !== false) persistVolume(channel, value);
    else if (ready) channels[channel].gain.value = clamp(value);
  }

  function syncMediaVolume() {
    if (!mediaEl) return;
    mediaEl.volume = clamp(vol('bgm') * profileMul * htmlDuckMul);
  }

  /** Regista o elemento audio da playlist — volume via HTML, sem Web Audio. */
  function registerMediaElement(el) {
    mediaEl = el || null;
    syncMediaVolume();
  }

  function attachMediaElement(el) {
    registerMediaElement(el);
  }

  function getMediaElement() {
    return mediaEl;
  }

  /** Destino para osciladores da música fallback (script.js) */
  function getBgmBus() {
    init();
    return channels.bgm;
  }

  function playTone(channel, opts) {
    init();
    resume();
    if (!ctx || vol(channel) <= 0) return;
    const {
      freq = 440,
      freqEnd = null,
      dur = 0.1,
      vol: peak = 0.08,
      type = 'sine',
      delay = 0,
    } = opts || {};
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd != null && freqEnd !== freq) {
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + dur);
    }
    const amp = peak * vol(channel);
    if (amp <= 0.0001) return;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(channels[channel]);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  function playNoise(channel, dur, peak, type) {
    init();
    resume();
    if (!ctx || vol(channel) <= 0) return;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (type === 'soft' ? 0.4 : 1);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = type === 'rain' ? 800 : 2000;
    f.Q.value = 0.6;
    const amp = peak * vol(channel);
    g.gain.setValueAtTime(amp, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(channels[channel]);
    src.start();
    return src;
  }

  function resetHtmlDuck() {
    clearTimeout(htmlDuckTimer);
    htmlDuckMul = 1;
    syncMediaVolume();
  }
    clearTimeout(htmlDuckTimer);
    clearTimeout(duckTimer);
    const to = opts?.to ?? 0.4;
    const hold = opts?.holdMs ?? 1000;
    const up = opts?.upMs ?? 350;

    if (mediaEl) {
      htmlDuckMul = to;
      syncMediaVolume();
      htmlDuckTimer = global.setTimeout(() => {
        htmlDuckMul = 1;
        syncMediaVolume();
      }, hold);
      return;
    }

    init();
    resume();
    if (!bgmDuckGain) return;
    const down = (opts?.downMs ?? 150) / 1000;
    const t = ctx.currentTime;
    bgmDuckGain.gain.cancelScheduledValues(t);
    bgmDuckGain.gain.setValueAtTime(bgmDuckGain.gain.value, t);
    bgmDuckGain.gain.linearRampToValueAtTime(to, t + down);
    duckTimer = global.setTimeout(() => {
      const t2 = ctx.currentTime;
      bgmDuckGain.gain.cancelScheduledValues(t2);
      bgmDuckGain.gain.setValueAtTime(bgmDuckGain.gain.value, t2);
      bgmDuckGain.gain.linearRampToValueAtTime(1, t2 + up / 1000);
    }, hold);
  }

  function setBgmProfile(name, fadeMs) {
    init();
    const prof = BGM_PROFILES[name] || BGM_PROFILES.home;
    currentProfile = name;
    profileMul = prof.gain;
    syncMediaVolume();
    const fade = (fadeMs ?? 800) / 1000;
    const t = ctx.currentTime;
    bgmProfileGain.gain.cancelScheduledValues(t);
    bgmProfileGain.gain.setValueAtTime(bgmProfileGain.gain.value, t);
    bgmProfileGain.gain.linearRampToValueAtTime(prof.gain, t + fade);
    bgmFilter.frequency.cancelScheduledValues(t);
    bgmFilter.frequency.setValueAtTime(bgmFilter.frequency.value, t);
    bgmFilter.frequency.linearRampToValueAtTime(prof.filterHz, t + fade);
  }

  function stopAmbient() {
    clearInterval(ambientTimer);
    ambientTimer = null;
    ambientNodes.forEach((n) => {
      try { n.stop?.(); n.disconnect?.(); } catch (_) { /* ignore */ }
    });
    ambientNodes = [];
  }

  function startAmbient(mode) {
    stopAmbient();
    init();
    if (vol('ambient') <= 0.001) return;
    const tick = () => {
      if (mode === 'rain') {
        const n = playNoise('ambient', 0.4, 0.015, 'rain');
        if (n) ambientNodes.push(n);
      } else if (mode === 'night') {
        playTone('ambient', { freq: 4200 + Math.random() * 800, dur: 0.04, vol: 0.012, type: 'sine' });
      } else if (mode === 'day') {
        playTone('ambient', { freq: 2800 + Math.random() * 400, dur: 0.06, vol: 0.01, type: 'sine' });
      } else if (mode === 'fire') {
        playNoise('ambient', 0.25, 0.012, 'soft');
      }
    };
    tick();
    ambientTimer = global.setInterval(tick, mode === 'rain' ? 180 : mode === 'fire' ? 220 : 3200);
  }

  /* —— Teddy (discreto, estilo Tamagotchi) —— */
  const Teddy = {
    sleep() {
      playTone('teddy', { freq: 110, dur: 0.5, vol: 0.025, type: 'sine' });
    },
    yawn() {
      playTone('teddy', { freq: 200, freqEnd: 150, dur: 0.4, vol: 0.04, type: 'sine' });
    },
    happy() {
      playTone('teddy', { freq: 520, freqEnd: 660, dur: 0.07, vol: 0.045, type: 'triangle' });
    },
    yay() {
      playTone('teddy', { freq: 440, freqEnd: 587, dur: 0.09, vol: 0.05, type: 'sine' });
      playTone('teddy', { freq: 587, dur: 0.08, vol: 0.035, type: 'sine', delay: 0.08 });
    },
    feed() {
      playTone('teddy', { freq: 380, freqEnd: 320, dur: 0.07, vol: 0.04, type: 'triangle' });
      playTone('teddy', { freq: 340, freqEnd: 300, dur: 0.06, vol: 0.035, type: 'triangle', delay: 0.09 });
      playTone('teddy', { freq: 490, dur: 0.1, vol: 0.03, type: 'sine', delay: 0.2 });
    },
    hug() {
      playTone('teddy', { freq: 350, freqEnd: 440, dur: 0.14, vol: 0.045, type: 'sine' });
      playTone('teddy', { freq: 523, dur: 0.12, vol: 0.035, type: 'sine', delay: 0.12 });
    },
    pet() {
      playTone('teddy', { freq: 600, freqEnd: 700, dur: 0.06, vol: 0.035, type: 'sine' });
    },
    wake() {
      playTone('teddy', { freq: 180, freqEnd: 260, dur: 0.3, vol: 0.04, type: 'sine' });
      global.setTimeout(() => Teddy.yawn(), 200);
    },
    talk() {
      playTone('teddy', { freq: 480, freqEnd: 520, dur: 0.08, vol: 0.03, type: 'sine' });
    },
    wave() {
      playTone('teddy', { freq: 700, dur: 0.04, vol: 0.025, type: 'sine' });
    },
    run() {
      for (let i = 0; i < 4; i++) {
        playTone('teddy', { freq: 200 + i * 20, dur: 0.04, vol: 0.02, type: 'triangle', delay: i * 0.07 });
      }
    },
    ballBounce() {
      playTone('teddy', { freq: 320, freqEnd: 280, dur: 0.05, vol: 0.035, type: 'sine' });
    },
    ballCatch() {
      playTone('teddy', { freq: 400, freqEnd: 500, dur: 0.08, vol: 0.04, type: 'triangle' });
    },
    gift() {
      playNoise('teddy', 0.08, 0.03, 'soft');
      playTone('teddy', { freq: 660, freqEnd: 880, dur: 0.12, vol: 0.04, type: 'sine', delay: 0.1 });
    },
    found() {
      playTone('teddy', { freq: 523, freqEnd: 784, dur: 0.1, vol: 0.05, type: 'triangle' });
    },
  };

  function playTeddy(name) {
    if (Teddy[name]) Teddy[name]();
    else if (Teddy.happy) Teddy.happy();
  }

  /* —— UI / notificações —— */
  const UI = {
    letter() {
      duckBgm({ to: 0.4, holdMs: 1200 });
      playTone('ui', { freq: 740, freqEnd: 988, dur: 0.18, vol: 0.09, type: 'sine' });
    },
    gift() {
      duckBgm({ to: 0.45, holdMs: 1000 });
      playTone('ui', { freq: 880, dur: 0.12, vol: 0.08, type: 'triangle' });
    },
    reminder() {
      duckBgm({ to: 0.5, holdMs: 900 });
      playTone('ui', { freq: 620, freqEnd: 740, dur: 0.15, vol: 0.07, type: 'sine' });
    },
    notify() {
      duckBgm({ to: 0.45, holdMs: 1100 });
      playTone('ui', { freq: 660, dur: 0.1, vol: 0.075, type: 'sine' });
    },
  };

  function playUi(name) {
    if (UI[name]) UI[name]();
  }

  function bindSettingsUI(root) {
    if (settingsBound) return;
    settingsBound = true;
    const el = root || global.document;
    const map = [
      { id: 'audio-bgm-volume', ch: 'bgm', label: 'audio-bgm-label' },
      { id: 'audio-sfx-volume', ch: 'sfx', label: 'audio-sfx-label' },
      { id: 'audio-teddy-volume', ch: 'teddy', label: 'audio-teddy-label' },
      { id: 'audio-ui-volume', ch: 'ui', label: 'audio-ui-label' },
    ];
    const sfxToggle = el.getElementById('game-sfx-toggle');
    const teddyToggle = el.getElementById('teddy-sfx-toggle');

    function syncLabels() {
      map.forEach(({ ch, label }) => {
        const lab = el.getElementById(label);
        if (lab) lab.textContent = `${Math.round(vol(ch) * 100)}%`;
      });
      global.document.querySelectorAll('.music-vol-label').forEach((lab) => {
        lab.textContent = `${Math.round(vol('bgm') * 100)}%`;
      });
    }

    map.forEach(({ id, ch }) => {
      const input = el.getElementById(id);
      if (!input) return;
      input.value = String(Math.round(vol(ch) * 100));
      input.addEventListener('input', () => {
        persistVolume(ch, Number(input.value) / 100);
        syncLabels();
      });
    });

    if (sfxToggle) {
      sfxToggle.checked = settings().sfx !== false;
      sfxToggle.addEventListener('change', () => {
        const s = { ...settings(), sfx: !!sfxToggle.checked };
        global.SaveManager?.updateSection?.('settings', s);
        applyVolumes();
        syncLabels();
      });
    }

    if (teddyToggle) {
      teddyToggle.checked = settings().teddySfx !== false;
      teddyToggle.addEventListener('change', () => {
        const s = { ...settings(), teddySfx: !!teddyToggle.checked };
        global.SaveManager?.updateSection?.('settings', s);
        applyVolumes();
        syncLabels();
        if (teddyToggle.checked) playTeddy('pet');
      });
    }

    syncLabels();
    global.addEventListener('audio:volume-changed', syncLabels);
  }

  function initRouting() {
    let cherryActive = false;
    let cannonActive = false;

    function goHomeBgm() {
      if (cherryActive || cannonActive) return;
      setBgmProfile('home', 800);
      global.CasaExperiences?.syncAmbientAudio?.();
    }

    global.addEventListener('cherrygame:activate', () => {
      cherryActive = true;
      setBgmProfile('cherry', 800);
      stopAmbient();
    });
    global.addEventListener('spaceship:activate', () => {
      cannonActive = true;
      setBgmProfile('cannon', 800);
      stopAmbient();
    });
    global.addEventListener('cherrygame:deactivate', () => {
      cherryActive = false;
      goHomeBgm();
    });
    global.addEventListener('spaceship:deactivate', () => {
      cannonActive = false;
      goHomeBgm();
    });
    global.addEventListener('hub:tab-changed', (e) => {
      if (e.detail?.tab === 'nossa-casa' && !cherryActive && !cannonActive) {
        setBgmProfile('home', 800);
        global.CasaExperiences?.syncAmbientAudio?.();
      }
    });
    global.addEventListener('casa:weather-changed', () => {
      if (!cherryActive && !cannonActive) global.CasaExperiences?.syncAmbientAudio?.();
    });
    global.addEventListener('casa:together-changed', () => {
      if (!cherryActive && !cannonActive) global.CasaExperiences?.syncAmbientAudio?.();
    });
  }

  const AudioManager = {
    DEFAULTS,
    init,
    resume,
    vol,
    setVolume,
    persistVolume,
    applyVolumes,
    registerMediaElement,
    attachMediaElement,
    getMediaElement,
    syncMediaVolume,
    resetHtmlDuck,
    getBgmBus,
    playTone,
    playNoise,
    duckBgm,
    setBgmProfile,
    startAmbient,
    stopAmbient,
    playTeddy,
    playUi,
    Teddy,
    UI,
    bindSettingsUI,
    initRouting,
    getContext: () => ctx,
  };

  global.AudioManager = AudioManager;
  initRouting();

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', () => {
      init();
      bindSettingsUI(global.document);
    });
  } else {
    init();
    bindSettingsUI(global.document);
  }

  /* Compatibilidade */
  global.SiteAudio = {
    DEFAULT_GAME_SFX_VOL: DEFAULTS.sfx,
    DEFAULT_TEDDY_SFX_VOL: DEFAULTS.teddy,
    getGameSfxVolume: () => vol('sfx'),
    getTeddySfxVolume: () => vol('teddy'),
    isGameSfxEnabled: () => settings().sfx !== false,
    isTeddySfxEnabled: () => settings().sfx !== false && settings().teddySfx !== false,
    playGameTone: (f, fe, d, v, t) => playTone('sfx', { freq: f, freqEnd: fe, dur: d, vol: v, type: t }),
    playTeddy,
    Teddy,
    resume,
  };
})(typeof window !== 'undefined' ? window : globalThis);
