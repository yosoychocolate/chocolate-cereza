/**
 * Habitación de Teddy — osito vivo con memoria, humor, crecimiento e interacciones.
 */
(function (global) {
  'use strict';

  const FOODS = [
    { id: 'chocolate', emoji: '🍫', label: 'Chocolate', price: 10, mood: 8, msg: '¡Mmm! Chocolate delicioso.' },
    { id: 'strawberry', emoji: '🍓', label: 'Fresa', price: 15, mood: 10, msg: 'Qué fresa tan dulce.' },
    { id: 'honey', emoji: '🍯', label: 'Miel', price: 30, mood: 15, msg: 'Miel de abrazo.' },
  ];

  const OUTFITS = [
    { id: 'top_hat', emoji: '🎩', label: 'Cartola', price: 120 },
    { id: 'cap', emoji: '🧢', label: 'Gorra', price: 80 },
    { id: 'crown', emoji: '👑', label: 'Corona', price: 200 },
    { id: 'xmas', emoji: '🎅', label: 'Papá Noel', price: 150 },
    { id: 'halloween', emoji: '🎃', label: 'Halloween', price: 130 },
    { id: 'xmas_tree', emoji: '🎄', label: 'Navidad', price: 140 },
  ];

  const DECOR = [
    { id: 'bed', emoji: '🛏', label: 'Cama', price: 100 },
    { id: 'plant', emoji: '🪴', label: 'Planta', price: 60 },
    { id: 'frame', emoji: '🖼', label: 'Cuadro', price: 75 },
    { id: 'rug', emoji: '🧸', label: 'Alfombra', price: 90 },
    { id: 'lamp', emoji: '💡', label: 'Lámpara', price: 85 },
  ];

  const GIFTS = [
    { id: 'rose', emoji: '🌹', label: 'Rosa', price: 25, slot: 'rose' },
    { id: 'box', emoji: '🎁', label: 'Caja', price: 40, slot: 'box' },
    { id: 'choco_gift', emoji: '🍫', label: 'Chocolate', price: 15, slot: 'table' },
    { id: 'balloon', emoji: '🎈', label: 'Globo', price: 20, slot: 'ceiling' },
  ];

  const PROP_SLOTS = {
    rose: { emoji: '🌹', class: 'teddy-prop-rose' },
    choco_gift: { emoji: '🍫', class: 'teddy-prop-table' },
    balloon: { emoji: '🎈', class: 'teddy-prop-balloon' },
    box: { emoji: '🎁', class: 'teddy-prop-box' },
  };

  const HUG_MSGS = [
    'Me gustó el abrazo ❤️',
    'Qué abrazo tan cálido…',
    'Otra vez, por favor 🥹',
    'Así me siento seguro.',
    'Todavía recuerdo este abrazo.',
  ];

  const PET_MSGS = [
    'Mmm… qué cariño tan bonito.',
    'Me encanta cuando me acarician.',
    'Suave, suave… 🐻',
  ];

  const SLEEP_MSG = 'Shhh… Teddy está durmiendo.';
  const HIDE_SPOTS = ['bed', 'plant', 'window'];
  const MEMORY_CAP = 40;

  const IDLE_ACTIONS = [
    { id: 'sit', class: 'is-idle-sit', moods: ['neutral', 'tired', 'sad'] },
    { id: 'read', class: 'is-idle-read', moods: ['happy', 'neutral'] },
    { id: 'tea', class: 'is-idle-tea', moods: ['happy', 'neutral', 'tired'] },
    { id: 'play_toy', class: 'is-idle-toy', moods: ['ecstatic', 'happy'] },
  ];

  let root = null;
  let timers = [];
  let listeners = [];
  let ctxRef = null;
  let idleTimer = null;
  let lastMouse = { x: 0.5, y: 0.5 };
  let hideSeek = { active: false, spot: null };
  let presenceRef = null;
  let softAwake = false;

  function $(sel, el) { return (el || root)?.querySelector(sel); }
  function $$(sel, el) { return Array.from((el || root)?.querySelectorAll(sel) || []); }

  function esc(text) {
    const d = global.document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

  function teddySfx(name) {
    global.AudioManager?.resume?.();
    global.AudioManager?.playTeddy?.(name);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getTz() {
    return ctxRef?.state?.()?.settings?.chargeReminder?.timezone || 'America/New_York';
  }

  function localHour() {
    return Number(new Intl.DateTimeFormat('en-US', {
      timeZone: getTz(),
      hour: 'numeric',
      hour12: false,
    }).format(new Date()));
  }

  function getTimePhase() {
    const h = localHour();
    if (h >= 22 || h < 6) return 'sleep';
    if (h >= 18) return 'yawn';
    if (h >= 12) return 'happy';
    return 'morning';
  }

  function isSleeping() {
    if (softAwake) return false;
    return getTimePhase() === 'sleep';
  }

  function getLocalName() {
    const cm = global.CloudManager;
    if (cm?.getLocalPlayer) {
      const n = cm.getLocalPlayer()?.name;
      if (n) return n.trim();
    }
    try {
      const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
      if (raw) {
        const id = JSON.parse(raw);
        if (id?.name) return id.name.trim();
      }
    } catch (_) { /* ignore */ }
    return 'Roberto';
  }

  async function fetchPresence() {
    if (global.__FILE_PROTOCOL__ || !global.CloudManager) return null;
    const cm = global.CloudManager;
    const room = cm.getCurrentRoom?.();
    if (!room) return { inRoom: false, localName: getLocalName(), partnerName: 'Sophie' };
    const localId = cm.getLocalPlayer?.()?.id;
    const partner = room.players?.find((p) => p.id !== localId);
    const local = room.players?.find((p) => p.id === localId);
    const isOnline = (p) => cm.isPresenceOnline?.(p?.presence) === true;
    const partnerOnline = isOnline(partner);
    const localOnline = isOnline(local);
    return {
      inRoom: true,
      partnerName: partner?.name || 'Sophie',
      localName: local?.name || getLocalName(),
      partnerOnline,
      localOnline,
      together: partnerOnline && localOnline && room.players?.length >= 2,
    };
  }

  function getBirthdayEvent() {
    const events = ctxRef?.state?.()?.events || [];
    const today = new Date();
    const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return events.find((ev) => {
      if (!ev.date) return false;
      const parts = ev.date.split('-');
      if (parts.length < 3) return false;
      const evMd = `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return evMd === md && /cumple|birthday|anivers/i.test(ev.title || ev.emoji || '');
    }) || events.find((ev) => {
      if (!ev.date) return false;
      const parts = ev.date.split('-');
      if (parts.length < 3) return false;
      return `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}` === md;
    });
  }

  function isTeddyBirthday() {
    const t = getTeddy();
    const bday = t.birthday || '08-15';
    const today = new Date();
    const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return md === bday;
  }

  function getSeason() {
    const m = new Date().getMonth() + 1;
    const d = new Date().getDate();
    if (m === 12 || (m === 11 && d >= 25)) return 'xmas';
    if (m === 10) return 'halloween';
    if (m >= 3 && m <= 4) return 'easter';
    return null;
  }

  function defaultTeddy() {
    return {
      mood: 70,
      decor: [],
      gifts: [],
      roomProps: [],
      outfitsOwned: [],
      memory: [],
      dayHistory: [],
      backpack: { chocolate: 0, rose: 0, photo: 0, gift: 0 },
      birthday: '08-15',
      carePoints: 0,
    };
  }

  function getTeddy() {
    global.SaveManager?.init?.();
    const save = global.SaveManager?.getSave?.() || {};
    const nc = save.nossaCasa || {};
    if (!nc.teddy || typeof nc.teddy !== 'object') nc.teddy = defaultTeddy();
    const td = nc.teddy;
    ['decor', 'gifts', 'roomProps', 'outfitsOwned', 'memory', 'dayHistory'].forEach((k) => {
      if (!Array.isArray(td[k])) td[k] = [];
    });
    if (!td.backpack || typeof td.backpack !== 'object') {
      td.backpack = { chocolate: 0, rose: 0, photo: 0, gift: 0 };
    }
    if (!td.birthday) td.birthday = '08-15';
    return td;
  }

  function persistTeddy(partial) {
    const cur = getTeddy();
    global.SaveManager?.updateSection?.('nossaCasa', {
      teddy: { ...cur, ...partial },
    });
  }

  function pushMemory(entry) {
    const t = getTeddy();
    const memory = [{ ...entry, at: entry.at || Date.now() }, ...(t.memory || [])].slice(0, MEMORY_CAP);
    persistTeddy({ memory });
  }

  function addCare(n) {
    const t = getTeddy();
    persistTeddy({ carePoints: (t.carePoints || 0) + n });
  }

  function addBackpack(key, n) {
    const t = getTeddy();
    const bp = { ...t.backpack };
    bp[key] = (bp[key] || 0) + n;
    persistTeddy({ backpack: bp });
    refreshBackpackHint();
  }

  function clampMood(v) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  function getMoodTier(mood, phase) {
    if (phase === 'sleep') return 'sleep';
    if (mood >= 85) return 'ecstatic';
    if (mood >= 65) return 'happy';
    if (phase === 'yawn' && mood < 55) return 'tired';
    if (mood >= 35) return 'neutral';
    return 'sad';
  }

  function moodLabel(mood, phase) {
    const tier = getMoodTier(mood, phase);
    if (tier === 'ecstatic') return '🤩 Muy feliz';
    if (tier === 'happy') return '😊 Feliz';
    if (tier === 'tired') return '🥱 Cansado';
    if (tier === 'sad') return '😭 Triste';
    if (tier === 'sleep') return '😴 Durmiendo';
    return '🙂 Tranquilo';
  }

  function getStage(teddy) {
    const born = teddy.bornAt || teddy.lastVisitAt || Date.now();
    const days = daysSince(born);
    const care = teddy.carePoints || 0;
    if (days >= 90 || care >= 250) return 'adult';
    if (days >= 30 || care >= 80) return 'young';
    return 'baby';
  }

  function stageLabel(stage) {
    if (stage === 'adult') return 'Teddy adulto';
    if (stage === 'young') return 'Teddy joven';
    return 'Bebé Teddy';
  }

  function daysSince(ts) {
    if (!ts) return 999;
    return Math.floor((Date.now() - ts) / 86400000);
  }

  function wallet() {
    return global.GameShop?.getWallet?.() ?? 0;
  }

  function spend(price) {
    return global.GameShop?.spendCoins?.(price)?.ok === true;
  }

  function toast(msg, ms) {
    if (global.GameShop?.toast) global.GameShop.toast(msg, ms || 2800);
    else showBubble(msg, ms || 2800);
  }

  function showBubble(text, ms) {
    const bubble = $('#teddy-bubble');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('is-visible');
    clearTimeout(showBubble._t);
    showBubble._t = setTimeout(() => bubble.classList.remove('is-visible'), ms || 3200);
  }

  function syncDailyStats() {
    const save = global.SaveManager?.getSave?.() || {};
    const total = (save.stats?.cannonGamesPlayed || 0) + (save.stats?.totalGames || 0);
    const t = getTeddy();
    const today = todayKey();
    let daily = t.daily;

    if (!daily || daily.date !== today) {
      const history = [...(t.dayHistory || [])];
      if (daily?.date) {
        history.unshift({ date: daily.date, gamesPlayed: daily.gamesPlayed || 0, music: !!daily.musicPlayed });
        if (history.length > 14) history.length = 14;
      }
      daily = { date: today, gamesStart: total, gamesPlayed: 0, musicPlayed: false };
      persistTeddy({ daily, dayHistory: history, lastGamesTotal: total });
    } else {
      const played = Math.max(0, total - (daily.gamesStart ?? total));
      if (played !== daily.gamesPlayed) {
        daily = { ...daily, gamesPlayed: played };
        persistTeddy({ daily, lastGamesTotal: total });
      }
    }

    const nc = save.nossaCasa || {};
    if (nc.lastMusic && global.document.body.classList.contains('music-playing')) {
      if (!daily.musicPlayed) {
        daily = { ...getTeddy().daily, musicPlayed: true };
        persistTeddy({ daily });
      }
    }
  }

  function foodLabel(id) {
    return FOODS.find((f) => f.id === id)?.label?.toLowerCase() || 'comida';
  }

  function buildMemoryLines() {
    const lines = [];
    const t = getTeddy();
    const mem = t.memory || [];

    const lastFed = mem.find((m) => m.type === 'fed');
    if (lastFed) {
      const d = daysSince(lastFed.at);
      const food = foodLabel(lastFed.food);
      if (d === 0) lines.push(`Hoy ${lastFed.by} me dio ${food}.`);
      else lines.push(`Hace ${d} día${d === 1 ? '' : 's'} que ${lastFed.by} me dio ${food}.`);
    }

    if (t.lastHugAt && daysSince(t.lastHugAt) <= 3) {
      lines.push('Todavía recuerdo el abrazo que me diste.');
    }

    const playGap = daysSince(t.lastPlayAt);
    if (t.lastPlayAt && playGap >= 4) {
      lines.push('Hace tiempo que nadie juega conmigo…');
    }

    const daily = t.daily;
    if (daily?.gamesPlayed >= 1) {
      lines.push(`Hoy ya jugaron ${daily.gamesPlayed} partida${daily.gamesPlayed === 1 ? '' : 's'}.`);
    }

    const yesterday = (t.dayHistory || [])[0];
    if (yesterday?.gamesPlayed >= 1) {
      lines.push(`Ayer jugaron ${yesterday.gamesPlayed} partida${yesterday.gamesPlayed === 1 ? '' : 's'}.`);
    }

    if (daily?.musicPlayed) {
      lines.push('Hoy escucharon nuestra música.');
    }

    return lines;
  }

  function buildSmartLines() {
    const lines = buildMemoryLines();
    const st = ctxRef?.state?.() || {};
    const save = global.SaveManager?.getSave?.() || {};
    const nc = save.nossaCasa || {};
    const stats = save.stats || {};
    const settings = st.settings || {};
    const HS = global.HubShared || {};
    const daysUntil = HS.daysUntil || function () { return null; };
    const local = getLocalName();
    const partner = presenceRef?.partnerName || st.partnerName || 'Sophie';
    const until = daysUntil(settings.nextMeetingDate);
    const records = save.records || {};

    if (records.highScore >= 100) {
      lines.push(`${local} tiene un gran récord en el juego. 😄`);
    }
    if (records.spaceshipHighScore >= 500) {
      lines.push(`¡${partner} o ${local} batieron un récord nuevo!`);
    }
    if (nc.lastMusic) {
      lines.push(`La última canción fue «${nc.lastMusic}».`);
    }
    if (until != null && until >= 0) {
      lines.push(`Faltan ${until} días para el próximo encuentro.`);
    }
    if ((stats.cannonGamesPlayed || 0) + (stats.totalGames || 0) >= 10) {
      lines.push('Cada partida juntos me hace feliz.');
    }

    return lines.length ? lines : ['Me encanta cuando vienen a visitarme.'];
  }

  function buildGreeting() {
    const local = getLocalName();
    const partner = presenceRef?.partnerName || 'Sophie';
    if (presenceRef?.together) {
      return `¡Los dos llegaron! Eso deja la casa más feliz. 💕`;
    }
    return `¡Hola ${local}! 😊`;
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function moodBarHtml(mood, phase) {
    const filled = Math.round(mood / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `<div class="teddy-mood">
      <span class="teddy-mood-label">${moodLabel(mood, phase)}</span>
      <span class="teddy-mood-bar" aria-hidden="true">${bar}</span>
    </div>`;
  }

  function phaseEmoji() {
    const p = getTimePhase();
    if (p === 'sleep') return '😴';
    if (p === 'yawn') return '🥱';
    if (p === 'happy') return '😄';
    return '🙂';
  }

  function decorHtml(decor) {
    const map = Object.fromEntries(DECOR.map((d) => [d.id, d.emoji]));
    return decor.map((id) => `<span class="teddy-decor-item" data-decor-id="${esc(id)}">${map[id] || '✨'}</span>`).join('');
  }

  function roomPropsHtml(props) {
    return (props || []).map((p, i) => {
      const def = PROP_SLOTS[p.type] || { emoji: '✨', class: 'teddy-prop-floor' };
      const openable = p.type === 'box' ? ` data-prop-open="${i}" title="Abrir caja"` : '';
      return `<span class="teddy-prop ${def.class}" data-prop-type="${esc(p.type)}"${openable}>${def.emoji}</span>`;
    }).join('');
  }

  function backpackHtml(bp, photoCount) {
    const b = bp || {};
    return `<div class="teddy-backpack-panel hidden" id="teddy-backpack">
      <p class="teddy-panel-title">🎒 Mochila de Teddy</p>
      <ul class="teddy-backpack-list">
        <li>🍫 ${b.chocolate || 0} chocolates</li>
        <li>🌹 ${b.rose || 0} flores</li>
        <li>📷 ${photoCount} fotos</li>
        <li>🎁 ${b.gift || 0} regalos</li>
      </ul>
      <button type="button" class="teddy-panel-close" id="teddy-backpack-close">Cerrar</button>
    </div>`;
  }

  function countPhotos() {
    const letters = ctxRef?.state?.()?.letters || [];
    return letters.filter((l) => l.photoUrl).length;
  }

  function outfitEmoji(id) {
    return OUTFITS.find((o) => o.id === id)?.emoji || '';
  }

  function applyMoodVisuals() {
    const ch = $('#teddy-char');
    const wrap = $('#teddy-char-wrap');
    if (!ch) return;
    const t = getTeddy();
    const mood = clampMood(t.mood ?? 70);
    const phase = getTimePhase();
    const tier = getMoodTier(mood, phase);
    const stage = getStage(t);
    let displayTier = tier;
    if (global.CasaExperiences?.isTogether?.() && !isSleeping()) displayTier = 'ecstatic';
    ch.dataset.mood = displayTier;
    ch.dataset.stage = stage;
    if (wrap) wrap.dataset.stage = stage;
    ['ecstatic', 'happy', 'neutral', 'sad', 'tired', 'sleep'].forEach((c) => {
      ch.classList.remove(`is-mood-${c}`);
    });
    if (!hideSeek.active) ch.classList.add(`is-mood-${displayTier}`);
  }

  function buildHtml(teddy) {
    const phase = getTimePhase();
    const season = getSeason();
    const coupleBday = getBirthdayEvent();
    const teddyBday = isTeddyBirthday();
    const sleeping = phase === 'sleep';
    const dancing = global.document.body.classList.contains('music-playing');
    const mood = clampMood(teddy.mood ?? 70);
    const tier = getMoodTier(mood, phase);
    const stage = getStage(teddy);
    const walletStr = wallet();
    const photoCount = countPhotos();
    const together = global.CasaExperiences?.isTogether?.() === true;
    const weather = global.CasaExperiences?.getWeather?.() || { kind: 'sun' };
    const watching = global.CasaExperiences?.wasWatchingGames?.() === true;
    const emoLv = global.TeddyExperiences?.emotionalLevel?.(teddy) || 1;
    const sceneExtras = global.TeddyExperiences?.sceneExtrasHtml?.(teddy, { together, watchingGames: watching, sleeping }) || '';
    const belowExtras = global.TeddyExperiences?.belowSceneHtml?.(teddy) || '';
    const showWake = sleeping && !softAwake;
    const teddyHint = global.CoupleHub?.getUpcomingTeddyHint?.();
    const teddySoonHtml = teddyHint
      ? `<div class="teddy-event-soon">🐻 ${teddyHint.message.split('\n').map(esc).join('<br>')}</div>`
      : '';

    return `<div class="casa-room-theme theme-teddy teddy-live-room">
      <header class="teddy-room-header">
        <div>
          <h4>Habitación de Teddy</h4>
          <p class="teddy-phase-line">${phaseEmoji()} ${esc(stageLabel(stage))} · ${esc(moodLabel(mood, phase))} · ${esc(global.TeddyExperiences?.levelLabel?.(emoLv) || '')}</p>
        </div>
        ${moodBarHtml(mood, phase)}
        <p class="teddy-wallet">🍫 <strong>${walletStr}</strong> chocolates</p>
      </header>
      ${teddySoonHtml}

      <div class="teddy-room-scene ${sleeping ? 'is-night-room' : ''} ${season ? 'is-season-' + season : ''} ${coupleBday || teddyBday ? 'is-birthday' : ''} ${together ? 'is-together-warm' : ''} is-weather-${weather.kind}" id="teddy-scene">
        ${(coupleBday || teddyBday) ? '<div class="teddy-confetti" aria-hidden="true">🎉✨🎂</div>' : ''}
        <div class="teddy-room-wall"></div>
        <div class="teddy-side-table" aria-hidden="true"></div>
        <div class="teddy-room-window">
          <span class="teddy-window-glow"></span>
          <span class="teddy-moon ${sleeping ? '' : 'hidden'}" aria-hidden="true">🌙</span>
          ${season === 'xmas' ? '<span class="teddy-season-deco">🎄</span>' : ''}
          ${season === 'halloween' ? '<span class="teddy-season-deco">🎃</span>' : ''}
          ${season === 'easter' ? '<span class="teddy-season-deco">🥚</span>' : ''}
        </div>
        <div class="teddy-room-decor">${decorHtml(teddy.decor || [])}</div>
        <div class="teddy-room-props" id="teddy-props">${roomPropsHtml(teddy.roomProps)}</div>
        <div class="teddy-blanket ${sleeping ? '' : 'hidden'}"></div>
        <div class="teddy-paw-trail" id="teddy-paws" aria-hidden="true"></div>

        <div class="teddy-hide-spots hidden" id="teddy-hide-spots">
          ${HIDE_SPOTS.map((s) => `<button type="button" class="teddy-hide-spot" data-hide-spot="${s}">?</button>`).join('')}
        </div>

        <button type="button" class="teddy-char-wrap" id="teddy-char-wrap" data-stage="${stage}" aria-label="Tocar a Teddy">
          <div class="teddy-char is-mood-${tier} ${sleeping ? 'is-sleeping' : ''} ${dancing ? 'is-dancing' : ''} is-enter-wave"
               id="teddy-char" data-outfit="${esc(teddy.outfit || '')}" data-stage="${stage}" data-mood="${tier}">
            <span class="teddy-outfit-hat">${teddyBday ? '🎂' : coupleBday ? '🎉' : outfitEmoji(teddy.outfit)}</span>
            <div class="teddy-head">
              <span class="teddy-ear teddy-ear-l"></span>
              <span class="teddy-ear teddy-ear-r"></span>
              <div class="teddy-face">
                <div class="teddy-eyes">
                  <span class="teddy-eye teddy-eye-l"><i class="teddy-pupil"></i></span>
                  <span class="teddy-eye teddy-eye-r"><i class="teddy-pupil"></i></span>
                </div>
                <span class="teddy-snout"></span>
                <span class="teddy-mouth"></span>
              </div>
            </div>
            <div class="teddy-torso"></div>
            <span class="teddy-arm teddy-arm-l"></span>
            <span class="teddy-arm teddy-arm-r"></span>
            <span class="teddy-leg teddy-leg-l"></span>
            <span class="teddy-leg teddy-leg-r"></span>
            <span class="teddy-idle-prop hidden" id="teddy-idle-prop"></span>
            <span class="teddy-zzz ${sleeping ? '' : 'hidden'}">💤</span>
          </div>
          <span class="teddy-ball hidden" id="teddy-ball">🎾</span>
          <span class="teddy-hide-peek hidden" id="teddy-hide-peek">🧸</span>
        </button>

        <div class="teddy-hearts-layer" id="teddy-hearts" aria-hidden="true"></div>
        ${sceneExtras}
      </div>

      ${showWake ? `<button type="button" class="teddy-wake-btn" id="teddy-wake-btn">💕 Despertar a Teddy con cariño</button>
      <p class="teddy-sleep-hint">Teddy duerme de 22h a 6h (hora de Nueva York). Puedes despertarlo suavemente.</p>` : ''}

      <div class="teddy-bubble" id="teddy-bubble" role="status"></div>

      <p class="teddy-narrator" id="teddy-narrator" aria-live="polite"></p>

      <div class="teddy-below-panel">${belowExtras}</div>

      <div class="teddy-actions-panel hidden" id="teddy-panel">
        <p class="teddy-panel-title">🐻 Teddy</p>
        <div class="teddy-action-grid">
          <button type="button" data-teddy-action="hug">🤗 Abrazar</button>
          <button type="button" data-teddy-action="pet">💕 Caricias</button>
          <button type="button" data-teddy-action="feed">🍫 Alimentar</button>
          <button type="button" data-teddy-action="talk">💬 Conversar</button>
          <button type="button" data-teddy-action="dress">👕 Vestir</button>
          <button type="button" data-teddy-action="play">🎾 Jugar</button>
          <button type="button" data-teddy-action="gift">🎁 Regalo</button>
          <button type="button" data-teddy-action="decor">🏠 Decorar</button>
          <button type="button" data-teddy-action="hide">🙈 Escondite</button>
          <button type="button" data-teddy-action="backpack">🎒 Mochila</button>
        </div>
        <div class="teddy-sub-panel hidden" id="teddy-sub-feed"></div>
        <div class="teddy-sub-panel hidden" id="teddy-sub-dress"></div>
        <div class="teddy-sub-panel hidden" id="teddy-sub-gift"></div>
        <div class="teddy-sub-panel hidden" id="teddy-sub-decor"></div>
        <button type="button" class="teddy-panel-close" id="teddy-panel-close">Cerrar</button>
        <label class="teddy-sfx-row">
          <input type="checkbox" id="teddy-sfx-toggle" checked>
          <span>🔊 Sonidos de Teddy</span>
        </label>
      </div>

      ${backpackHtml(teddy.backpack, photoCount)}
    </div>`;
  }

  function addTimer(fn, ms) {
    const id = setInterval(fn, ms);
    timers.push(id);
    return id;
  }

  function addListener(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, fn);
    listeners.push({ el, ev, fn });
  }

  function spawnHeart() {
    const layer = $('#teddy-hearts');
    if (!layer) return;
    const h = global.document.createElement('span');
    h.className = 'teddy-heart';
    h.textContent = '❤️';
    h.style.left = `${40 + Math.random() * 20}%`;
    layer.appendChild(h);
    setTimeout(() => h.remove(), 1200);
  }

  function spawnPaw() {
    const trail = $('#teddy-paws');
    if (!trail || isSleeping() || hideSeek.active) return;
    const paw = global.document.createElement('span');
    paw.className = 'teddy-paw';
    paw.textContent = '🐾';
    paw.style.left = `${20 + Math.random() * 60}%`;
    trail.appendChild(paw);
    if (trail.children.length > 6) trail.firstChild?.remove();
    setTimeout(() => paw.classList.add('is-fade'), 800);
    setTimeout(() => paw.remove(), 2000);
  }

  function setLook(mx, my) {
    const char = $('#teddy-char');
    if (!char || isSleeping() || hideSeek.active) return;
    const tier = char.dataset.mood;
    if (tier === 'sad') {
      char.style.setProperty('--look-x', '0');
      char.style.setProperty('--look-y', '0.8');
      return;
    }
    const rect = char.getBoundingClientRect();
    if (!rect.width) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.35;
    const dx = (mx - cx) / rect.width;
    const dy = (my - cy) / rect.height;
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    char.style.setProperty('--look-x', String(clamp(dx * 3)));
    char.style.setProperty('--look-y', String(clamp(dy * 3)));
  }

  function blink() {
    const ch = $('#teddy-char');
    if (!ch || isSleeping() || hideSeek.active) return;
    ch.classList.add('is-blink');
    setTimeout(() => ch.classList.remove('is-blink'), 150);
  }

  function refreshMood() {
    const t = getTeddy();
    const mood = clampMood(t.mood ?? 70);
    const phase = getTimePhase();
    const bar = $('.teddy-mood-bar');
    const label = $('.teddy-mood-label');
    if (bar) {
      const filled = Math.round(mood / 10);
      bar.textContent = '█'.repeat(filled) + '░'.repeat(10 - filled);
    }
    if (label) label.textContent = moodLabel(mood, phase);
    applyMoodVisuals();
  }

  function refreshWallet() {
    const w = $('.teddy-wallet strong');
    if (w) w.textContent = String(wallet());
  }

  function refreshBackpackHint() {
    const bp = getTeddy().backpack || {};
    const total = (bp.chocolate || 0) + (bp.rose || 0) + (bp.gift || 0);
    if (total > 0) {
      const btn = $('[data-teddy-action="backpack"]');
      if (btn && !btn.textContent.includes('(')) {
        btn.textContent = `🎒 Mochila (${total})`;
      }
    }
  }

  function refreshProps() {
    const wrap = $('#teddy-props');
    if (wrap) wrap.innerHTML = roomPropsHtml(getTeddy().roomProps);
  }

  function hug() {
    const ch = $('#teddy-char');
    if (!ch) return;
    const who = getLocalName();
    ch.classList.add('is-hugging');
    teddySfx('hug');
    for (let i = 0; i < 5; i++) setTimeout(spawnHeart, i * 120);
    showBubble(randomItem(HUG_MSGS));
    const t = getTeddy();
    const now = Date.now();
    const totalHugs = (t.totalHugs || 0) + 1;
    persistTeddy({
      mood: clampMood((t.mood || 70) + 6),
      totalHugs,
      lastHugAt: now,
      lastHugBy: who,
    });
    pushMemory({ type: 'hug', by: who });
    addCare(3);
    global.TeddyExperiences?.onHug?.(totalHugs)?.then((n) => {
      if (n) showBubble(`📸 ¡Selfie #${n} desbloqueada! Va al álbum.`);
    });
    refreshMood();
    setTimeout(() => ch.classList.remove('is-hugging'), 1800);
  }

  function pet() {
    teddySfx('pet');
    showBubble(randomItem(PET_MSGS));
    const t = getTeddy();
    persistTeddy({ mood: clampMood((t.mood || 70) + 3) });
    addCare(1);
    refreshMood();
    spawnHeart();
  }

  function feed(id) {
    const food = FOODS.find((f) => f.id === id);
    if (!food) return;
    if (!spend(food.price)) {
      toast('🍫 No hay suficientes chocolates');
      return;
    }
    const who = getLocalName();
    showBubble(food.msg);
    teddySfx('feed');
    const t = getTeddy();
    persistTeddy({
      mood: clampMood((t.mood || 70) + food.mood),
      lastFedAt: Date.now(),
      lastFedBy: who,
      lastFedFood: id,
    });
    pushMemory({ type: 'fed', by: who, food: id });
    addBackpack('chocolate', 1);
    addCare(2);
    refreshMood();
    refreshWallet();
    const ch = $('#teddy-char');
    ch?.classList.add('is-eating', 'is-licking');
    setTimeout(() => ch?.classList.remove('is-eating', 'is-licking'), 1200);
  }

  function talk() {
    const ch = $('#teddy-char');
    ch?.classList.add('is-talking');
    teddySfx('talk');
    const t = getTeddy();
    const lv = global.TeddyExperiences?.emotionalLevel?.(t) || 1;
    const pool = global.TeddyExperiences?.buildTalkLine?.(lv, {
      memoryLines: buildMemoryLines(),
      smartLines: buildSmartLines(),
    }) || buildSmartLines();
    const line = randomItem(pool.length ? pool : buildSmartLines());
    showBubble('🧸 ' + line);
    const narr = $('#teddy-narrator');
    if (narr) narr.textContent = '🧸 ' + line;
    setTimeout(() => ch?.classList.remove('is-talking'), 1600);
  }

  function buyOutfit(id) {
    const item = OUTFITS.find((o) => o.id === id);
    if (!item) return;
    const t = getTeddy();
    const owned = [...(t.outfitsOwned || [])];
    if (!owned.includes(id)) {
      if (!spend(item.price)) {
        toast('🍫 No hay suficientes chocolates');
        return;
      }
      owned.push(id);
      persistTeddy({ outfitsOwned: owned });
      toast(`${item.emoji} ${item.label} comprado`);
      refreshWallet();
    }
    persistTeddy({ outfit: id });
    const ch = $('#teddy-char');
    if (ch) {
      ch.dataset.outfit = id;
      const hat = $('.teddy-outfit-hat', ch);
      if (hat && !isTeddyBirthday()) hat.textContent = item.emoji;
    }
    toast(`${item.emoji} ${item.label} puesto`);
  }

  function buyDecor(id) {
    const item = DECOR.find((d) => d.id === id);
    if (!item) return;
    const t = getTeddy();
    const decor = [...(t.decor || [])];
    if (decor.includes(id)) {
      toast('Ya tienes eso en la habitación');
      return;
    }
    if (!spend(item.price)) {
      toast('🍫 No hay suficientes chocolates');
      return;
    }
    decor.push(id);
    persistTeddy({ decor });
    toast(`${item.emoji} ${item.label} colocado`);
    refreshWallet();
    const wrap = $('.teddy-room-decor');
    if (wrap) wrap.innerHTML = decorHtml(decor);
  }

  function addRoomProp(type) {
    const t = getTeddy();
    let props = [...(t.roomProps || [])].filter((p) => p.type !== type);
    props.push({ type, at: Date.now() });
    persistTeddy({ roomProps: props });
    refreshProps();
  }

  function leaveGift(id) {
    const item = GIFTS.find((g) => g.id === id);
    if (!item) return;
    if (!spend(item.price)) {
      toast('🍫 No hay suficientes chocolates');
      return;
    }
    addRoomProp(id);
    const bpKey = id === 'rose' ? 'rose' : id === 'box' ? 'gift' : id === 'choco_gift' ? 'chocolate' : null;
    if (bpKey) addBackpack(bpKey, 1);
    toast(`${item.emoji} ${item.label} — ahora está en la habitación`);
    teddySfx('gift');
    refreshWallet();
  }

  function openRoomBox(idx) {
    const t = getTeddy();
    const props = [...(t.roomProps || [])];
    const p = props[idx];
    if (!p || p.type !== 'box') return;
    props.splice(idx, 1);
    persistTeddy({ roomProps: props, mood: clampMood((t.mood || 70) + 5) });
    addBackpack('gift', 1);
    refreshProps();
    refreshMood();
    showBubble('¡Sorpresa! Teddy guardó el regalo en su mochila.');
    teddySfx('gift');
    spawnHeart();
  }

  function playBall() {
    const ch = $('#teddy-char');
    const ball = $('#teddy-ball');
    if (!ch || !ball) return;
    ch.classList.add('is-playing');
    teddySfx('run');
    ball.classList.remove('hidden');
    ball.classList.add('is-thrown');
    setTimeout(() => teddySfx('ballBounce'), 180);
    let step = 0;
    const run = () => {
      step += 1;
      spawnPaw();
      if (step < 4) setTimeout(run, 400);
      else {
        teddySfx('ballCatch');
        ball.classList.remove('is-thrown');
        ball.classList.add('is-returned');
        showBubble('¡La traje de vuelta!');
        setTimeout(() => {
          ch.classList.remove('is-playing');
          ball.classList.add('hidden');
          ball.classList.remove('is-returned');
        }, 800);
      }
    };
    setTimeout(run, 300);
    const t = getTeddy();
    persistTeddy({ mood: clampMood((t.mood || 70) + 4), lastPlayAt: Date.now() });
    pushMemory({ type: 'play', by: getLocalName() });
    addCare(2);
    refreshMood();
  }

  function startHideSeek() {
    if (isSleeping()) {
      showBubble(SLEEP_MSG);
      return;
    }
    closePanel();
    hideSeek.active = true;
    hideSeek.spot = randomItem(HIDE_SPOTS);
    const ch = $('#teddy-char');
    const wrap = $('#teddy-char-wrap');
    const spots = $('#teddy-hide-spots');
    const peek = $('#teddy-hide-peek');
    ch?.classList.add('is-hidden-seek');
    wrap?.classList.add('is-seeking');
    spots?.classList.remove('hidden');
    peek?.classList.add('hidden');
    showBubble('¡Me escondí! ¿Dónde estoy?');
  }

  function endHideSeek(found) {
    hideSeek.active = false;
    const ch = $('#teddy-char');
    const wrap = $('#teddy-char-wrap');
    const spots = $('#teddy-hide-spots');
    const peek = $('#teddy-hide-peek');
    ch?.classList.remove('is-hidden-seek');
    wrap?.classList.remove('is-seeking');
    spots?.classList.add('hidden');
    peek?.classList.add('hidden');
    $$('.teddy-hide-spot').forEach((s) => s.classList.remove('is-wrong', 'is-right'));
    applyMoodVisuals();

    if (found) {
      const t = getTeddy();
      global.GameShop?.addCoins?.(5);
      persistTeddy({ hideSeekWins: (t.hideSeekWins || 0) + 1, mood: clampMood((t.mood || 70) + 5) });
      refreshMood();
      refreshWallet();
      teddySfx('found');
      showBubble('¡Me encontraste! +5 🍫');
      ch?.classList.add('is-enter-wave');
      setTimeout(() => ch?.classList.remove('is-enter-wave'), 2000);
    }
  }

  function onHideSpotClick(spot) {
    if (!hideSeek.active) return;
    const btn = $(`.teddy-hide-spot[data-hide-spot="${spot}"]`);
    if (spot === hideSeek.spot) {
      btn?.classList.add('is-right');
      endHideSeek(true);
    } else {
      btn?.classList.add('is-wrong');
      showBubble('Mmm… no estoy ahí.');
      setTimeout(() => btn?.classList.remove('is-wrong'), 600);
    }
  }

  function showBackpack() {
    $$('.teddy-sub-panel').forEach((p) => p.classList.add('hidden'));
    const bp = getTeddy().backpack || {};
    const photos = countPhotos();
    const panel = $('#teddy-backpack');
    if (!panel) return;
    panel.querySelector('.teddy-backpack-list').innerHTML = `
      <li>🍫 ${bp.chocolate || 0} chocolates</li>
      <li>🌹 ${bp.rose || 0} flores</li>
      <li>📷 ${photos} fotos</li>
      <li>🎁 ${bp.gift || 0} regalos</li>`;
    panel.classList.remove('hidden');
    $('#teddy-panel')?.classList.add('hidden');
  }

  function startIdleLoop() {
    clearTimeout(idleTimer);
    const tick = () => {
      if (!root || isSleeping() || hideSeek.active) {
        idleTimer = setTimeout(tick, 5000);
        return;
      }
      const ch = $('#teddy-char');
      if (!ch || ch.classList.contains('is-playing') || ch.classList.contains('is-hugging')) {
        idleTimer = setTimeout(tick, 5000);
        return;
      }

      const t = getTeddy();
      const tier = getMoodTier(clampMood(t.mood ?? 70), getTimePhase());
      IDLE_ACTIONS.forEach((a) => ch.classList.remove(a.class));

      let pool = IDLE_ACTIONS.filter((a) => a.moods.includes(tier));
      if (!pool.length) pool = IDLE_ACTIONS.filter((a) => a.id === 'sit');
      const action = randomItem(pool);
      ch.classList.add(action.class);

      const prop = $('#teddy-idle-prop');
      if (prop) {
        prop.classList.remove('hidden');
        prop.textContent = action.id === 'read' ? '📖' : action.id === 'tea' ? '🍵' : action.id === 'play_toy' ? '🧸' : '';
      }

      idleTimer = setTimeout(() => {
        ch.classList.remove(action.class);
        prop?.classList.add('hidden');
        idleTimer = setTimeout(tick, 4000 + Math.random() * 6000);
      }, 3500);
    };
    idleTimer = setTimeout(tick, 8000);
  }

  function renderSubPanel(id, items, onPick, ownedKey) {
    const panels = {
      feed: '#teddy-sub-feed',
      dress: '#teddy-sub-dress',
      gift: '#teddy-sub-gift',
      decor: '#teddy-sub-decor',
    };
    $$('.teddy-sub-panel').forEach((p) => p.classList.add('hidden'));
    $('#teddy-backpack')?.classList.add('hidden');
    const panel = $(panels[id]);
    if (!panel) return;
    const t = getTeddy();
    const owned = ownedKey ? (t[ownedKey] || []) : [];
    const decor = t.decor || [];
    panel.innerHTML = items.map((item) => {
      const has = ownedKey === 'decor' ? decor.includes(item.id) : owned.includes(item.id);
      const suffix = has ? ' ✓' : ` — 🍫${item.price}`;
      return `<button type="button" class="teddy-shop-btn" data-pick="${esc(item.id)}">${item.emoji} ${esc(item.label)}${suffix}</button>`;
    }).join('');
    panel.classList.remove('hidden');
    $$('[data-pick]', panel).forEach((btn) => {
      addListener(btn, 'click', () => onPick(btn.dataset.pick));
    });
  }

  function refreshSleepVisuals() {
    const sleeping = isSleeping();
    const phase = getTimePhase();
    const scene = $('#teddy-scene');
    const ch = $('#teddy-char');
    if (!scene || !ch) return;
    const realSleep = phase === 'sleep' && !softAwake;
    scene.classList.toggle('is-night-room', realSleep);
    ch.classList.toggle('is-sleeping', realSleep);
    $('.teddy-moon', scene)?.classList.toggle('hidden', !realSleep);
    $('.teddy-blanket', scene)?.classList.toggle('hidden', !realSleep);
    $('.teddy-zzz', ch)?.classList.toggle('hidden', !realSleep);
    $('#teddy-wake-btn')?.classList.toggle('hidden', !realSleep);
    $('.teddy-sleep-hint')?.classList.toggle('hidden', !realSleep);
    refreshMood();
  }

  function wakeTeddyGently() {
    softAwake = true;
    teddySfx('wake');
    refreshSleepVisuals();
    showBubble('*bosteza*… ¿Ya es de día? Me despertaste con cariño.');
    const narr = $('#teddy-narrator');
    if (narr) narr.textContent = '🧸 Gracias por despertarme… todavía tengo sueño.';
  }

  function openPanel() {
    if (isSleeping()) {
      showBubble(SLEEP_MSG);
      return;
    }
    $('#teddy-backpack')?.classList.add('hidden');
    $('#teddy-panel')?.classList.remove('hidden');
  }

  function closePanel() {
    $('#teddy-panel')?.classList.add('hidden');
    $('#teddy-backpack')?.classList.add('hidden');
    $$('.teddy-sub-panel').forEach((p) => p.classList.add('hidden'));
  }

  async function onVisit() {
    global.AudioManager?.resume?.();
    presenceRef = await fetchPresence();
    syncDailyStats();
    global.TeddyExperiences?.onVisit?.();

    const t = getTeddy();
    let mood = t.mood ?? 70;
    const absent = daysSince(t.lastVisitAt);
    if (absent >= 3) mood = Math.max(12, mood - 10);
    else mood = clampMood(mood + 4);

    const partial = { mood, lastVisitAt: Date.now() };
    if (!t.bornAt) partial.bornAt = Date.now();
    persistTeddy(partial);
    refreshMood();

    const ch = $('#teddy-char');
    if (ch && !isSleeping()) {
      ch.classList.add('is-enter-wave');
      teddySfx('wave');
      setTimeout(() => ch.classList.remove('is-enter-wave'), 2200);
    } else if (isSleeping()) {
      teddySfx('sleep');
    }

    setTimeout(() => showBubble('🧸 ' + buildGreeting()), 400);

    if (absent >= 3 && !isSleeping()) {
      setTimeout(() => {
        const mem = buildMemoryLines().find((l) => l.includes('nadie juega'));
        showBubble(mem || '*bosteza* Hace tiempo que no venían…');
      }, 1800);
    }

    const narr = $('#teddy-narrator');
    const memLine = randomItem(buildMemoryLines());
    const smartLine = randomItem(buildSmartLines());
    if (narr) narr.textContent = '🧸 ' + (memLine || smartLine);

    if (isTeddyBirthday()) {
      addBackpack('gift', 1);
      setTimeout(() => showBubble('🎂 ¡Es mi cumpleaños! Gracias por celebrar conmigo.'), 1200);
    } else if (getBirthdayEvent()) {
      setTimeout(() => showBubble('🎂 ¡Feliz cumpleaños! Teddy trajo confeti.'), 800);
    }

    refreshBackpackHint();
  }

  function bindEvents() {
    addListener($('#teddy-char-wrap'), 'click', (e) => {
      if (e.target.closest('[data-prop-open]')) return;
      if (hideSeek.active) return;
      if ($('#teddy-panel')?.classList.contains('hidden')) openPanel();
    });

    addListener($('#teddy-panel-close'), 'click', closePanel);
    addListener($('#teddy-backpack-close'), 'click', () => $('#teddy-backpack')?.classList.add('hidden'));

    $$('[data-teddy-action]').forEach((btn) => {
      addListener(btn, 'click', () => {
        const action = btn.dataset.teddyAction;
        $$('.teddy-sub-panel').forEach((p) => p.classList.add('hidden'));
        if (action === 'hug') hug();
        else if (action === 'pet') pet();
        else if (action === 'talk') talk();
        else if (action === 'play') playBall();
        else if (action === 'hide') startHideSeek();
        else if (action === 'backpack') showBackpack();
        else if (action === 'feed') renderSubPanel('feed', FOODS, feed);
        else if (action === 'dress') renderSubPanel('dress', OUTFITS, buyOutfit, 'outfitsOwned');
        else if (action === 'gift') renderSubPanel('gift', GIFTS, leaveGift);
        else if (action === 'decor') renderSubPanel('decor', DECOR, buyDecor, 'decor');
      });
    });

    addListener($('#teddy-props'), 'click', (e) => {
      const btn = e.target.closest('[data-prop-open]');
      if (!btn) return;
      e.stopPropagation();
      openRoomBox(Number(btn.dataset.propOpen));
    });

    $$('.teddy-hide-spot').forEach((btn) => {
      addListener(btn, 'click', (e) => {
        e.stopPropagation();
        onHideSpotClick(btn.dataset.hideSpot);
      });
    });

    const onMove = (e) => {
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      setLook(e.clientX, e.clientY);
    };
    addListener(global.document, 'mousemove', onMove);

    let obs = null;
    if (typeof MutationObserver !== 'undefined') {
      obs = new MutationObserver(() => {
        const ch = $('#teddy-char');
        if (!ch) return;
        ch.classList.toggle('is-dancing', global.document.body.classList.contains('music-playing'));
      });
      obs.observe(global.document.body, { attributes: true, attributeFilter: ['class'] });
      listeners.push({ el: null, ev: 'observer', fn: () => obs?.disconnect() });
    }

    addListener($('#teddy-wake-btn'), 'click', (e) => {
      e.stopPropagation();
      wakeTeddyGently();
    });

    const teddySfxToggle = $('#teddy-sfx-toggle');
    if (teddySfxToggle) {
      const settings = global.SaveManager?.getSave?.()?.settings || {};
      teddySfxToggle.checked = settings.teddySfx !== false;
      addListener(teddySfxToggle, 'change', () => {
        const cur = global.SaveManager?.getSave?.()?.settings || {};
        global.SaveManager?.updateSection?.('settings', {
          ...cur,
          teddySfx: !!teddySfxToggle.checked,
        });
        if (teddySfxToggle.checked) teddySfx('pet');
      });
    }

    addListener(global, 'gameshop:wallet-changed', refreshWallet);

    addListener($('#teddy-delivery'), 'click', (e) => {
      e.stopPropagation();
      const item = global.TeddyExperiences?.openDelivery?.();
      if (item) {
        teddySfx('gift');
        showBubble(`📦 ¡Llegó tu ${item.label}! ${item.emoji}`);
        refreshProps();
        const wrap = $('.teddy-room-decor');
        if (wrap && item.type === 'decor') wrap.innerHTML = decorHtml(getTeddy().decor || []);
      }
    });

    addListener(global, 'casa:together-changed', () => {
      const scene = $('#teddy-scene');
      const together = global.CasaExperiences?.isTogether?.() === true;
      scene?.classList.toggle('is-together-warm', together);
      applyMoodVisuals();
    });

    addListener(global, 'teddy:radio-hint', () => {
      showBubble('🎵 Teddy encendió la radio…');
    });
  }

  function startLoops() {
    addTimer(blink, 2800 + Math.random() * 2000);
    addTimer(spawnPaw, 4500);
    startIdleLoop();

    addTimer(() => {
      syncDailyStats();
      refreshSleepVisuals();
      const line = $('.teddy-phase-line');
      if (line) {
        const t = getTeddy();
        const mood = clampMood(t.mood ?? 70);
        const phase = getTimePhase();
        const stage = getStage(t);
        const emoLv = global.TeddyExperiences?.emotionalLevel?.(t) || 1;
        const status = isSleeping() ? '😴 Durmiendo' : moodLabel(mood, phase);
        line.textContent = `${phaseEmoji()} ${stageLabel(stage)} · ${status} · ${global.TeddyExperiences?.levelLabel?.(emoLv) || ''}`;
      }
    }, 30000);
  }

  function teardownRoom() {
    timers.forEach(clearInterval);
    timers = [];
    clearTimeout(idleTimer);
    listeners.forEach(({ el, ev, fn }) => {
      if (ev === 'observer') fn();
      else el?.removeEventListener?.(ev, fn);
    });
    listeners = [];
    hideSeek = { active: false, spot: null };
    softAwake = false;
    root = null;
    ctxRef = null;
    presenceRef = null;
  }

  const TeddyRoom = {
    render(body, ctx) {
      teardownRoom();
      ctxRef = ctx || {};
      global.SaveManager?.init?.();
      body.innerHTML = buildHtml(getTeddy());
      root = body.querySelector('.teddy-live-room');
      global.TeddyExperiences?.init?.(root, { showThought: true });
      bindEvents();
      startLoops();
      global.TeddyExperiences?.startLoops?.();
      onVisit();
      setLook(lastMouse.x, lastMouse.y);
    },
    destroy() {
      global.TeddyExperiences?.destroy?.();
      teardownRoom();
    },
    isActive() { return !!root; },
    /** Llamado cuando hay actividad en el hogar (juegos, cartas, etc.) */
    onActivity(kind) {
      if (kind === 'game') syncDailyStats();
    },
  };

  global.TeddyRoom = TeddyRoom;
})(typeof window !== 'undefined' ? window : globalThis);
