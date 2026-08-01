/**
 * Teddy — experiências emocionais: diário, pensamentos, planta, entregas, segredos.
 */
(function (global) {
  'use strict';

  const THOUGHTS = [
    '¿Jugarán hoy?',
    'Quiero un sombrero nuevo…',
    'Espero que vengan pronto.',
    'La casa está muy tranquila.',
    'Me pregunto qué canción pondrán.',
    '¿Sophie ya despertó?',
    'Hoy hace buen día para un abrazo.',
  ];

  const JOKES = [
    '¿Sabes por qué no uso reloj? Siempre tengo tiempo para un abrazo.',
    'Un chocolate al día… ¡y soy feliz!',
    'Mi superpoder es escuchar el buzón desde aquí.',
  ];

  const SECRETS = [
    { id: 'hugs_100', emoji: '🤗', hint: '???', label: 'Abrazar a Teddy 100 veces', test: (t) => (t.totalHugs || 0) >= 100 },
    { id: 'streak_30', emoji: '📅', hint: '???', label: 'Entrar 30 días seguidos', test: (t) => (t.visitStreak || 0) >= 30 },
    { id: 'plant_bloom', emoji: '🌸', hint: '???', label: 'Cuidar la planta hasta florecer', test: (t) => t.plantStage === 'bloom' },
    { id: 'diary_year', emoji: '📖', hint: '???', label: 'Un año de páginas en el diario', test: (t) => (t.diary || []).length >= 52 },
  ];

  const DELIVERY_ITEMS = [
    { type: 'outfit', id: 'cap', emoji: '🧢', label: 'gorra nueva' },
    { type: 'outfit', id: 'top_hat', emoji: '🎩', label: 'cartola' },
    { type: 'decor', id: 'lamp', emoji: '💡', label: 'lámpara' },
    { type: 'decor', id: 'rug', emoji: '🧸', label: 'alfombra' },
    { type: 'toy', id: 'ball', emoji: '🎾', label: 'pelota' },
  ];

  const SELFIE_MILESTONES = [10, 25, 50, 100];

  let root = null;
  let showThoughtFn = null;
  let thoughtTimer = null;
  let radioTimer = null;
  let getPresenceFn = null;

  function weekKey(d) {
    const date = d || new Date();
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - start) / 86400000);
    const w = Math.ceil((days + start.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(w).padStart(2, '0')}`;
  }

  function formatDiaryDate(d) {
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
  }

  function getTeddy() {
    global.SaveManager?.init?.();
    return global.SaveManager?.getSave?.()?.nossaCasa?.teddy || {};
  }

  function persistTeddy(partial) {
    const cur = getTeddy();
    global.SaveManager?.updateSection?.('nossaCasa', { teddy: { ...cur, ...partial } });
  }

  function emotionalLevel(t) {
    const born = t.bornAt || t.lastVisitAt || Date.now();
    const days = Math.floor((Date.now() - born) / 86400000);
    const care = t.carePoints || 0;
    if (days >= 180 || care >= 400) return 5;
    if (days >= 90 || care >= 250) return 4;
    if (days >= 45 || care >= 150) return 3;
    if (days >= 14 || care >= 50) return 2;
    return 1;
  }

  function levelLabel(lv) {
    if (lv >= 5) return 'Osito sabio';
    if (lv >= 4) return 'Osito gracioso';
    if (lv >= 3) return 'Osito narrador';
    if (lv >= 2) return 'Osito hablador';
    return 'Osito tímido';
  }

  function composeWeeklyPage(t, mem, daily) {
    const parts = [];
    const fed = mem.find((m) => m.type === 'fed');
    const hug = mem.find((m) => m.type === 'hug');
    const play = mem.find((m) => m.type === 'play');
    if (fed) parts.push(`${fed.by} me dio ${fed.food || 'comida'}.`);
    if (hug) parts.push(`${hug.by} me abrazó.`);
    if (play) parts.push('Jugamos en la habitación.');
    if (daily?.gamesPlayed) parts.push(`Jugaron ${daily.gamesPlayed} partidas.`);
    if (global.CasaExperiences?.isTogether?.()) parts.push('La casa estuvo completa un rato.');
    if (!parts.length) parts.push('Semana tranquila, pero los extraño.');
    return `Hoy ${parts.join(' ')} La casa ${parts.length > 1 ? 'estuvo muy feliz' : 'espera visitas'}.`;
  }

  function maybeWriteDiaryPage() {
    const t = getTeddy();
    const wk = weekKey();
    const diary = [...(t.diary || [])];
    if (diary.some((p) => p.weekKey === wk)) return;
    const text = composeWeeklyPage(t, t.memory || [], t.daily);
    diary.unshift({
      weekKey: wk,
      date: formatDiaryDate(new Date()),
      text,
      at: Date.now(),
    });
    if (diary.length > 60) diary.length = 60;
    persistTeddy({ diary });
  }

  function updateVisitStreak() {
    const t = getTeddy();
    const today = new Date().toISOString().slice(0, 10);
    if (t.lastVisitDay === today) return;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yKey = y.toISOString().slice(0, 10);
    const streak = t.lastVisitDay === yKey ? (t.visitStreak || 0) + 1 : 1;
    persistTeddy({ lastVisitDay: today, visitStreak: streak });
    checkSecrets();
  }

  function updatePlant() {
    const t = getTeddy();
    const watered = t.plantWateredAt || t.lastVisitAt || Date.now();
    const dryDays = Math.floor((Date.now() - watered) / 86400000);
    let stage = 'ok';
    if (dryDays >= 5) stage = 'wilt';
    else if (dryDays <= 1 && (t.visitStreak || 0) >= 3) stage = 'bloom';
    if (stage !== t.plantStage) persistTeddy({ plantStage: stage });
    return stage;
  }

  function waterPlant() {
    persistTeddy({ plantWateredAt: Date.now(), plantStage: 'ok' });
    updatePlant();
  }

  function maybeSpawnDelivery() {
    const t = getTeddy();
    if (t.pendingDelivery) return t.pendingDelivery;
    const last = t.lastDeliveryAt || t.bornAt || Date.now();
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days < 7) return null;
    const item = DELIVERY_ITEMS[Math.floor(Math.random() * DELIVERY_ITEMS.length)];
    const delivery = { ...item, at: Date.now() };
    persistTeddy({ pendingDelivery: delivery });
    return delivery;
  }

  function openDelivery() {
    const t = getTeddy();
    const d = t.pendingDelivery;
    if (!d) return null;
    const patch = { pendingDelivery: null, lastDeliveryAt: Date.now() };
    if (d.type === 'outfit') {
      const owned = [...(t.outfitsOwned || [])];
      if (!owned.includes(d.id)) owned.push(d.id);
      patch.outfitsOwned = owned;
      patch.outfit = d.id;
    } else if (d.type === 'decor') {
      const decor = [...(t.decor || [])];
      if (!decor.includes(d.id)) decor.push(d.id);
      patch.decor = decor;
    }
    persistTeddy(patch);
    checkSecrets();
    return d;
  }

  function checkSecrets() {
    const t = getTeddy();
    const unlocked = [...(t.secrets || [])];
    let changed = false;
    SECRETS.forEach((s) => {
      if (!unlocked.includes(s.id) && s.test(t)) {
        unlocked.push(s.id);
        changed = true;
      }
    });
    if (changed) persistTeddy({ secrets: unlocked });
    return unlocked;
  }

  async function checkSelfieMilestone(totalHugs) {
    if (!SELFIE_MILESTONES.includes(totalHugs)) return;
    const t = getTeddy();
    const taken = t.selfiesTaken || [];
    if (taken.includes(totalHugs)) return;
    const hub = global.CoupleHub;
    if (hub?.addMemory) {
      await hub.addMemory(`Selfie con Teddy 🤗 #${totalHugs}`, 'teddy:selfie');
    }
    taken.push(totalHugs);
    persistTeddy({ selfiesTaken: taken });
    return totalHugs;
  }

  function buildTalkLine(level, ctx) {
    const lines = [];
    const t = getTeddy();
    const diary = t.diary || [];

    if (level === 1) {
      lines.push('…', 'Hola.', 'Me alegra verte.');
    } else if (level === 2) {
      lines.push(...(ctx.memoryLines || []));
    } else if (level === 3) {
      if (diary[0]) lines.push(`En mi diario escribí: «${diary[0].text.slice(0, 80)}…»`);
      lines.push(...(ctx.smartLines || []));
    } else if (level === 4) {
      lines.push(...JOKES);
      lines.push(...(ctx.smartLines || []));
    } else {
      const dow = new Date().getDay();
      if (dow === 0 || dow === 6) lines.push('Los fines de semana suelen jugar más… ¿hoy también?');
      if (t.lastFedBy) lines.push(`${t.lastFedBy} suele cuidarme.`);
      lines.push(...JOKES);
      lines.push(...(ctx.smartLines || []));
    }

    return lines.filter(Boolean);
  }

  function diaryHtml(t) {
    const pages = (t.diary || []).slice(0, 8);
    if (!pages.length) {
      return `<div class="teddy-diary teddy-diary-empty">
        <span class="teddy-diary-icon">📖</span>
        <p>Cada semana Teddy escribe una página…</p>
      </div>`;
    }
    const items = pages.map((p) =>
      `<article class="teddy-diary-page">
        <time>${escapeHtml(p.date)}</time>
        <p>"${escapeHtml(p.text)}"</p>
      </article>`
    ).join('');
    return `<div class="teddy-diary"><h5>📖 Diario de Teddy</h5><div class="teddy-diary-scroll">${items}</div></div>`;
  }

  function secretsHtml(t) {
    const unlocked = t.secrets || [];
    const rows = SECRETS.map((s) => {
      const ok = unlocked.includes(s.id);
      return `<li class="${ok ? 'is-unlocked' : 'is-secret'}">${ok ? s.emoji + ' ' : '<span class="teddy-secret-lock" aria-hidden="true">🔒</span> '}${ok ? escapeHtml(s.label) : '???'}</li>`;
    }).join('');
    return `<div class="teddy-secrets"><h5>⭐ Logros secretos</h5><ul>${rows}</ul></div>`;
  }

  function sceneExtrasHtml(t, opts) {
    const sleeping = opts?.sleeping;
    const plant = t.plantStage || updatePlant();
    const plantEmoji = plant === 'wilt' ? '🥀' : plant === 'bloom' ? '🌸' : '🪴';
    const w = global.CasaExperiences?.getWeather?.() || { kind: 'sun' };
    const bird = !sleeping ? global.CasaExperiences?.getSeasonBird?.() : null;
    const delivery = t.pendingDelivery || maybeSpawnDelivery();
    const watching = opts?.watchingGames;

    let weatherIcon = '';
    if (!sleeping) {
      weatherIcon = w.kind === 'rain' ? '🌧️' : w.kind === 'snow' ? '🌨️' : w.kind === 'cloudy' ? '☁️' : '☀️';
    }

    return `
      ${weatherIcon ? `<div class="teddy-window-fx is-weather-${w.kind}" aria-hidden="true">
        <span class="teddy-weather-icon">${weatherIcon}</span>
        ${bird ? `<span class="teddy-window-bird">${bird}</span>` : ''}
      </div>` : ''}
      <div class="teddy-plant" data-plant="${plant}" title="Planta de Teddy">${plantEmoji}</div>
      ${delivery ? `<button type="button" class="teddy-delivery" id="teddy-delivery" title="Abrir encomenda">📦</button>` : ''}
      ${watching ? `<p class="teddy-watching">${escapeHtml(global.CasaExperiences?.watchingGamesLine?.() || '')}</p>` : ''}
      ${opts?.together ? '<p class="teddy-together-glow">La casa está completa — Teddy sonríe más. 💕</p>' : ''}
      <div class="teddy-thought" id="teddy-thought" aria-live="polite"></div>`;
  }

  function belowSceneHtml(t) {
    return `${diaryHtml(t)}${secretsHtml(t)}`;
  }

  function extrasHtml(t, opts) {
    return sceneExtrasHtml(t, opts) + belowSceneHtml(t);
  }

  function escapeHtml(text) {
    const d = global.document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

  function scheduleThought() {
    clearTimeout(thoughtTimer);
    thoughtTimer = setTimeout(() => {
      if (!root) return;
      const el = root.querySelector('#teddy-thought');
      if (el && showThoughtFn) {
        const t = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)];
        el.textContent = `💭 ${t}`;
        el.classList.add('is-visible');
        setTimeout(() => el.classList.remove('is-visible'), 4500);
      }
      scheduleThought();
    }, 35000 + Math.random() * 40000);
  }

  function scheduleRadio() {
    clearTimeout(radioTimer);
    radioTimer = setTimeout(() => {
      if (!root || global.document.body.classList.contains('music-playing')) {
        scheduleRadio();
        return;
      }
      scheduleRadio();
    }, 60000);
    radioTimer = setTimeout(() => {
      if (!root) return;
      if (Math.random() > 0.35) { scheduleRadio(); return; }
      if (global.document.body.classList.contains('music-playing')) { scheduleRadio(); return; }
      const el = root.querySelector('#teddy-thought');
      if (el) {
        el.textContent = '🎵 Teddy puso música…';
        el.classList.add('is-visible');
        setTimeout(() => el.classList.remove('is-visible'), 4000);
      }
      global.dispatchEvent(new CustomEvent('teddy:radio-hint'));
      scheduleRadio();
    }, 90000 + Math.random() * 60000);
  }

  const TeddyExperiences = {
    init(container, opts) {
      this.destroy();
      root = container;
      showThoughtFn = opts?.showThought;
      getPresenceFn = opts?.getPresence;
    },

    destroy() {
      clearTimeout(thoughtTimer);
      clearTimeout(radioTimer);
      root = null;
    },

    onVisit() {
      maybeWriteDiaryPage();
      updateVisitStreak();
      waterPlant();
      checkSecrets();
      maybeSpawnDelivery();
    },

    onHug(totalHugs) {
      waterPlant();
      return checkSelfieMilestone(totalHugs);
    },

    emotionalLevel,
    levelLabel,
    buildTalkLine,
    sceneExtrasHtml,
    belowSceneHtml,
    extrasHtml,
    openDelivery,
    startLoops() {
      scheduleThought();
      scheduleRadio();
    },

    getPlantStage: updatePlant,
    checkSecrets,
  };

  global.TeddyExperiences = TeddyExperiences;
})(typeof window !== 'undefined' ? window : globalThis);
