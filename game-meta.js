/**
 * Meta do mini game — sons, recorde, stats, conquistas, comemorações.
 * Persistência via SaveManager (save-manager.js).
 */
(function (global) {
  'use strict';

  const DEFAULT_STATS = {
    totalChocolates: 0,
    playTimeMs: 0,
    bestStreak: 0,
    gamesPlayed: 0,
    recordsBroken: 0,
    playTimeMutedMs: 0,
    panelsOpened: { stats: false, achievements: false, settings: false },
    cannonTotalHits: 0,
    cannonGamesPlayed: 0,
    cannonPlayTimeMs: 0,
    cannonBestStreak: 0,
    cannonRecordsBroken: 0,
  };

  const MIN = 60 * 1000;

  const ACHIEVEMENTS = [
    { id: 'first', icon: '🍫', title: 'Primer Chocolate', desc: 'Atrapa tu primer chocolate.' },
    { id: 'true_love', icon: '❤️', title: 'Amor Verdadero', desc: 'Alcanza 50 chocolates en una partida.' },
    { id: 'infinite_love', icon: '♾️', title: 'Amor Infinito', desc: 'Consigue 100 chocolates extra en el modo infinito.' },
    { id: 'master', icon: '👑', title: 'Maestro del Chocolate', desc: 'Alcanza 200 chocolates en una sola partida.' },
    { id: 'legend', icon: '💎', title: 'Leyenda del Chocolate', desc: 'Alcanza 300 chocolates en una sola partida.' },
    /* Tiempo de juego */
    { id: 'time_5m', icon: '⏱️', title: 'Primeros Minutos', desc: 'Juega 5 minutos en total.' },
    { id: 'time_20m', icon: '🕐', title: 'Tiempo Juntos', desc: 'Juega 20 minutos en total.' },
    { id: 'time_60m', icon: '🕰️', title: 'Hora Dulce', desc: 'Juega 1 hora en total.' },
    { id: 'time_180m', icon: '🌙', title: 'Noche de Chocolate', desc: 'Juega 3 horas en total.' },
    /* Colección total */
    { id: 'total_250', icon: '🧺', title: 'Cesta Romántica', desc: 'Atrapa 250 chocolates en total.' },
    { id: 'total_500', icon: '🎁', title: 'Cofre del Amor', desc: 'Atrapa 500 chocolates en total.' },
    { id: 'total_1000', icon: '🏺', title: 'Tesoro Chocolate', desc: 'Atrapa 1.000 chocolates en total.' },
    { id: 'total_2500', icon: '💰', title: 'Fortuna Dulce', desc: 'Atrapa 2.500 chocolates en total.' },
    /* Rachas */
    { id: 'streak_10', icon: '🔥', title: 'Racha Dulce', desc: 'Consigue una racha de 10 seguidos.' },
    { id: 'streak_25', icon: '⚡', title: 'Imparable', desc: 'Consigue una racha de 25 seguidos.' },
    { id: 'streak_50', icon: '🌟', title: 'Manos de Oro', desc: 'Consigue una racha de 50 seguidos.' },
    { id: 'streak_75', icon: '💫', title: 'Sin Fallar', desc: 'Consigue una racha de 75 seguidos.' },
    /* Puntuación en partida */
    { id: 'run_75', icon: '🍒', title: 'Cereza Veloz', desc: 'Alcanza 75 chocolates en una partida.' },
    { id: 'run_100', icon: '💯', title: 'Centenar de Amor', desc: 'Alcanza 100 chocolates en una partida.' },
    { id: 'run_150', icon: '🎯', title: 'Precisión Perfecta', desc: 'Alcanza 150 chocolates en una partida.' },
    /* Récords */
    { id: 'record_80', icon: '📈', title: 'Subiendo Nivel', desc: 'Consigue un récord de 80 o más.' },
    { id: 'record_120', icon: '🏅', title: 'Medalla de Honor', desc: 'Consigue un récord de 120 o más.' },
    { id: 'record_250', icon: '🥇', title: 'Campeón del Amor', desc: 'Consigue un récord de 250 o más.' },
    { id: 'first_record', icon: '✨', title: 'Nuevo Récord', desc: 'Supera tu récord personal por primera vez.' },
    /* Modo infinito */
    { id: 'endless_unlock', icon: '🌌', title: 'Más Allá del 50', desc: 'Desbloquea el modo infinito.' },
    { id: 'endless_25', icon: '✨', title: 'Estrellas Dulces', desc: 'Consigue 25 chocolates extra en infinito.' },
    { id: 'endless_50', icon: '🚀', title: 'Sin Límites', desc: 'Consigue 50 chocolates extra en infinito.' },
    /* Clicks de amor (sitio) */
    { id: 'love_25', icon: '💕', title: 'Pensando en Ti', desc: 'Haz 25 clicks de amor en el sitio.', toastScope: 'site' },
    { id: 'love_100', icon: '💗', title: 'Corazón Activo', desc: 'Haz 100 clicks de amor en el sitio.', toastScope: 'site' },
    { id: 'love_500', icon: '💖', title: 'Amor Sin Pausa', desc: 'Haz 500 clicks de amor en el sitio.', toastScope: 'site' },
    /* Sorpréndeme (sitio) */
    { id: 'surprise_1', icon: '🍒', title: 'Primera Sorpresa', desc: 'Pide tu primera sorpresa romántica.', toastScope: 'site' },
    { id: 'surprise_10', icon: '💌', title: 'Coleccionista de Frases', desc: 'Pide 10 sorpresas.', toastScope: 'site' },
    { id: 'surprise_25', icon: '🎀', title: 'Corazón Curioso', desc: 'Pide 25 sorpresas.', toastScope: 'site' },
    /* Poemas (sitio) */
    { id: 'poem_1', icon: '📜', title: 'Primer Poema', desc: 'Crea tu primer poema.', toastScope: 'site' },
    { id: 'poem_10', icon: '✒️', title: 'Poeta del Amor', desc: 'Crea 10 poemas.', toastScope: 'site' },
    { id: 'poem_50', icon: '📖', title: 'Libro de Versos', desc: 'Crea 50 poemas.', toastScope: 'site' },
    { id: 'poem_round', icon: '🏆', title: 'Cien Poemas', desc: 'Completa una ronda de 100 poemas únicos.', toastScope: 'site' },
    /* Medidor do amor (sitio) */
    { id: 'meter_full', icon: '❤️', title: 'Amor al Máximo', desc: 'Llena el medidor de amor al 100%.', toastScope: 'site' },
    { id: 'meter_infinite', icon: '♾️', title: 'Amor Infinito', desc: 'Descubre el secreto del medidor.', toastScope: 'site' },
    /* Momentos & hábitos */
    { id: 'night_owl', icon: '🦉', title: 'Búho Enamorado', desc: 'Juega después de las 22:00.' },
    { id: 'early_bird', icon: '🌅', title: 'Amanecer Juntos', desc: 'Juega antes de las 8:00.' },
    { id: 'weekend', icon: '📅', title: 'Fin de Semana', desc: 'Juega un sábado o domingo.' },
    { id: 'silent_heart', icon: '🤫', title: 'Amor Silencioso', desc: 'Juega 5 minutos con el sonido apagado.' },
    { id: 'explorer', icon: '🗺️', title: 'Explorador', desc: 'Abre estadísticas, logros y ajustes.', toastScope: 'site' },
    { id: 'charge_care_7', icon: '🏆', title: 'Cuidando do Chocolate', desc: '7 dias seguidos cuidando do Chocolate.', toastScope: 'site' },
    /* Supervivencia & partidas */
    { id: 'last_stand', icon: '🛡️', title: 'Última Vida', desc: 'Alcanza 35+ estando a 1 vida.' },
    { id: 'games_10', icon: '🎮', title: 'Jugador Fiel', desc: 'Completa 10 partidas.' },
    { id: 'games_50', icon: '🎲', title: 'Viciado al Amor', desc: 'Completa 50 partidas.' },
    { id: 'online_duo', icon: '🧸', title: 'Dúo Chocolate', desc: 'Atrapa un chocolate en modo pareja.' },
    /* Cañón Chocolate — misiones / logros persistentes */
    { id: 'cannon_first', icon: '🚀', title: 'Primer Disparo', desc: 'Acerta tu primera cereza con el cañón.', mode: 'cannon' },
    { id: 'cannon_score_50', icon: '⭐', title: 'Artillero Novato', desc: 'Alcanza 50 puntos en una partida.', mode: 'cannon' },
    { id: 'cannon_score_100', icon: '💯', title: 'Centenar Cañón', desc: 'Alcanza 100 puntos en una partida.', mode: 'cannon' },
    { id: 'cannon_score_200', icon: '🎯', title: 'Francotirador', desc: 'Alcanza 200 puntos en una partida.', mode: 'cannon' },
    { id: 'cannon_hits_10', icon: '🔫', title: 'Disparos Certeros', desc: '10 aciertos en una partida.', mode: 'cannon' },
    { id: 'cannon_hits_25', icon: '💥', title: 'Lluvia de Aciertos', desc: '25 aciertos en una partida.', mode: 'cannon' },
    { id: 'cannon_streak_5', icon: '🔥', title: 'Racha de Fuego', desc: '5 aciertos seguidos sin fallar.', mode: 'cannon' },
    { id: 'cannon_streak_10', icon: '⚡', title: 'Imparable Cañón', desc: '10 aciertos seguidos sin fallar.', mode: 'cannon' },
    { id: 'cannon_survive_60', icon: '⏱️', title: 'Minuto de Gloria', desc: 'Sobrevive 1 minuto en una partida.', mode: 'cannon' },
    { id: 'cannon_survive_180', icon: '🛡️', title: 'Bunker Chocolate', desc: 'Sobrevive 3 minutos en una partida.', mode: 'cannon' },
    { id: 'cannon_record_100', icon: '📈', title: 'Récord Artillero', desc: 'Consigue un récord cañón de 100+ puntos.', mode: 'cannon' },
    { id: 'cannon_record_200', icon: '🏅', title: 'Medalla Cañón', desc: 'Consigue un récord cañón de 200+ puntos.', mode: 'cannon' },
    { id: 'cannon_total_hits_100', icon: '🧺', title: 'Cazador de Cerezas', desc: '100 aciertos totales con el cañón.', mode: 'cannon' },
    { id: 'cannon_total_hits_500', icon: '🏺', title: 'Destructor Orbital', desc: '500 aciertos totales con el cañón.', mode: 'cannon' },
    { id: 'cannon_games_5', icon: '🎮', title: 'Artillero Fiel', desc: 'Completa 5 partidas cañón.', mode: 'cannon' },
    { id: 'cannon_games_25', icon: '🎲', title: 'Veterano Cañón', desc: 'Completa 25 partidas cañón.', mode: 'cannon' },
    { id: 'cannon_time_10m', icon: '🕐', title: 'En la Trinchera', desc: 'Juega 10 minutos en modo cañón.', mode: 'cannon' },
    { id: 'cannon_last_stand', icon: '❤️‍🔥', title: 'Última Munición', desc: '50+ puntos con solo 1 vida restante.', mode: 'cannon' },
    { id: 'cannon_online', icon: '🧸', title: 'Dúo Artillero', desc: 'Juega cañón estando en modo pareja.', mode: 'cannon' },
    { id: 'cannon_first_record', icon: '✨', title: 'Nuevo Récord Cañón', desc: 'Supera tu récord cañón por primera vez.', mode: 'cannon' },
  ];

  const DEFAULT_SETTINGS = {
    sfx: true,
  };

  function formatUnlockDate(ts) {
    if (!ts) return 'Fecha desconocida';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function loadFromSave() {
    const save = global.SaveManager.getSave();
    const mergedStats = {
      ...DEFAULT_STATS,
      ...save.stats,
      panelsOpened: {
        ...DEFAULT_STATS.panelsOpened,
        ...(save.stats?.panelsOpened || {}),
      },
    };
    return {
      highScore: save.records.highScore || 0,
      cannonHighScore: save.records.spaceshipHighScore || 0,
      stats: mergedStats,
      settings: { ...DEFAULT_SETTINGS, ...save.settings },
      unlockDates: { ...save.achievements },
    };
  }

  class GameSounds {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this._lastCatch = 0;
    }

    _acquireCtx() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    _tone(freqStart, freqEnd, duration, volume, type) {
      if (!this.enabled) return;
      try {
        const ctx = this._acquireCtx();
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freqStart, t);
        if (freqEnd !== freqStart) {
          o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + duration);
        }
        g.gain.setValueAtTime(volume, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + duration + 0.02);
      } catch (_) { /* autoplay policy */ }
    }

    playCatch() {
      const now = performance.now();
      if (now - this._lastCatch < 45) return;
      this._lastCatch = now;
      this._tone(480 + Math.random() * 60, 720, 0.1, 0.07, 'sine');
    }

    playMilestone() {
      this._tone(392, 523, 0.14, 0.09, 'triangle');
      setTimeout(() => this._tone(523, 659, 0.16, 0.08, 'triangle'), 90);
    }

    playAchievement() {
      this._tone(440, 554, 0.12, 0.1, 'sine');
      setTimeout(() => this._tone(554, 740, 0.18, 0.09, 'sine'), 100);
      setTimeout(() => this._tone(659, 880, 0.2, 0.07, 'triangle'), 200);
    }

    playRecord() {
      this._tone(523, 784, 0.22, 0.1, 'triangle');
    }

    playLoveUltra() {
      this._tone(392, 523, 0.18, 0.1, 'sine');
      setTimeout(() => this._tone(523, 659, 0.2, 0.09, 'triangle'), 110);
      setTimeout(() => this._tone(659, 880, 0.28, 0.08, 'sine'), 240);
      setTimeout(() => this._tone(880, 1046, 0.32, 0.07, 'triangle'), 380);
    }
  }

  function formatPlayTime(ms) {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}h ${rm}m`;
    }
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }

  function getToastScope(achievement) {
    if (achievement.toastScope === 'site') return 'site';
    const shipWrap = typeof document !== 'undefined'
      ? document.getElementById('spaceship-container')
      : null;
    if (shipWrap && !shipWrap.classList.contains('hidden')) return 'site';
    return 'game';
  }

  const GameMeta = {
    sounds: new GameSounds(),
    highScore: 0,
    cannonHighScore: 0,
    stats: { ...DEFAULT_STATS },
    settings: { ...DEFAULT_SETTINGS },
    unlockDates: {},
    currentStreak: 0,
    cannonStreak: 0,
    session: { hadOneLife: false, score: 0, endless: false, endlessBonus: 0, inOnlineRoom: false },
    cannonSession: { hadOneLife: false, score: 0, hits: 0, survivalMs: 0, inOnlineRoom: false },
    els: {},
    panels: {},
    perfLite: false,
    _openPanelId: null,
    _justUnlockedIds: [],
    _isMobileUI: false,
    _achFilter: 'all',

    init(options) {
      this.els = options || {};
      this.perfLite = !!options.perfLite;

      const data = loadFromSave();
      this.highScore = data.highScore;
      this.cannonHighScore = data.cannonHighScore;
      this.stats = data.stats;
      this.settings = data.settings;
      this.unlockDates = data.unlockDates;
      this.sounds.enabled = this.settings.sfx !== false;

      const initialScore = options.initialScore || 0;
      if (initialScore > this.highScore) {
        this.highScore = initialScore;
        global.SaveManager.updateSection('records', { highScore: this.highScore });
      }

      this.panels = {
        stats: {
          toggle: this.els.statsToggle,
          panel: this.els.statsPanel,
        },
        achievements: {
          toggle: this.els.achievementsToggle,
          panel: this.els.achievementsPanel,
        },
        settings: {
          toggle: this.els.settingsToggle,
          panel: this.els.settingsPanel,
        },
      };

      this.renderHighScore();
      this.renderStats();
      this.tryUnlockAchievements(this.getContext(
        initialScore,
        !!options.endless,
        options.endlessBonus || 0
      ));
      this.renderAchievementGallery();
      this.renderAchievementProgress();
      this.bindAchievementFilters();
      this.syncSettingsUI();
      this.bindPanelToggles();
      this.bindPanelScrollGuards();
      this.bindSettings();
      this._isMobileUI = window.matchMedia('(max-width: 768px)').matches;
      this.els.metaBackdrop = document.getElementById('game-meta-backdrop');
      this.els.siteAchievementToast = document.getElementById('site-achievement-toast');
      this.els.metaBackdrop?.addEventListener('click', () => {
        if (this._openPanelId) this.closePanel(this._openPanelId);
      });
    },

    _syncSheetOverlay() {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      const backdrop = this.els.metaBackdrop;
      if (mobile || !this._openPanelId) {
        document.body.classList.remove('game-meta-sheet-open');
        backdrop?.classList.add('hidden');
        backdrop?.setAttribute('aria-hidden', 'true');
        return;
      }
      document.body.classList.add('game-meta-sheet-open');
      backdrop?.classList.remove('hidden');
      backdrop?.setAttribute('aria-hidden', 'false');
    },

    _syncPanelBrowseMode(open, id) {
      document.body.classList.toggle('game-meta-panel-open', open);
      window.dispatchEvent(new CustomEvent('gamemeta:panel-change', {
        detail: { open, id: id || null },
      }));
    },

    isUnlocked(id) {
      return Object.prototype.hasOwnProperty.call(this.unlockDates, id);
    },

    unlockedCount() {
      let n = 0;
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        if (this.isUnlocked(ACHIEVEMENTS[i].id)) n++;
      }
      return n;
    },

    saveUnlockData() {
      global.SaveManager.updateSection('achievements', { ...this.unlockDates });
    },

    saveStats() {
      global.SaveManager.updateSection('stats', { ...this.stats });
    },

    saveSettings() {
      global.SaveManager.updateSection('settings', { ...this.settings });
    },

    saveHighScore() {
      global.SaveManager.updateSection('records', { highScore: this.highScore });
    },

    bindPanelToggles() {
      const ids = ['stats', 'achievements', 'settings'];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        this.panels[id]?.toggle?.addEventListener('click', () => {
          this.togglePanel(id);
        });
      }
    },

    togglePanel(id) {
      if (this._openPanelId === id) {
        this.closePanel(id);
        return;
      }
      if (this._openPanelId) this.closePanel(this._openPanelId, false);
      this.openPanel(id);
    },

    openPanel(id) {
      const entry = this.panels[id];
      if (!entry?.panel) return;
      if (this.stats.panelsOpened && id in this.stats.panelsOpened) {
        this.stats.panelsOpened[id] = true;
        this.saveStats();
        this._checkMetaAchievements();
      }
      entry.panel.classList.remove('hidden');
      requestAnimationFrame(() => entry.panel.classList.add('is-open'));
      entry.toggle?.setAttribute('aria-expanded', 'true');
      entry.toggle?.classList.add('is-active');
      this._openPanelId = id;
      if (id === 'achievements') {
        this.renderAchievementGallery();
        this.renderAchievementProgress();
      }
      if (id === 'stats') this.renderStats();
      this._syncSheetOverlay();
      this._syncPanelBrowseMode(true, id);
      if (!this._isMobileUI) {
        requestAnimationFrame(() => {
          entry.panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    },

    closePanel(id, clearActive = true) {
      const entry = this.panels[id];
      if (!entry?.panel) return;
      entry.panel.classList.remove('is-open');
      entry.toggle?.setAttribute('aria-expanded', 'false');
      entry.toggle?.classList.remove('is-active');
      setTimeout(() => {
        if (!entry.panel.classList.contains('is-open')) {
          entry.panel.classList.add('hidden');
        }
      }, 200);
      if (clearActive && this._openPanelId === id) {
        this._openPanelId = null;
        this._syncSheetOverlay();
        this._syncPanelBrowseMode(false);
      }
    },

    bindPanelScrollGuards() {
      const stopWheel = (event) => event.stopPropagation();
      for (const id of ['stats', 'achievements', 'settings']) {
        const panel = this.panels[id]?.panel;
        panel?.addEventListener('wheel', stopWheel, { passive: true });
      }
    },

    bindSettings() {
      this.els.sfxToggle?.addEventListener('change', () => {
        this.settings.sfx = !!this.els.sfxToggle.checked;
        this.sounds.enabled = this.settings.sfx;
        this.saveSettings();
      });
    },

    syncSettingsUI() {
      if (this.els.sfxToggle) this.els.sfxToggle.checked = this.settings.sfx !== false;
    },

    addPlayTime(dt) {
      if (dt <= 0) return;
      this.stats.playTimeMs += dt;
      if (this.settings.sfx === false) {
        this.stats.playTimeMutedMs = (this.stats.playTimeMutedMs || 0) + dt;
      }
      this._playSaveAcc = (this._playSaveAcc || 0) + dt;
      if (this._playSaveAcc >= 5000) {
        this._playSaveAcc = 0;
        this.saveStats();
        if (this.els.statTime) this.els.statTime.textContent = formatPlayTime(this.stats.playTimeMs);
        this._checkMetaAchievements();
      }
    },

    buildContext(partial) {
      const p = partial || {};
      const save = global.SaveManager.getSave();
      const panels = { stats: false, achievements: false, settings: false, ...(this.stats.panelsOpened || {}) };
      const now = new Date();
      const cannonScore = p.cannonScore ?? p.score ?? this.cannonSession.score ?? 0;
      const cannonHits = p.cannonHits ?? p.hits ?? this.cannonSession.hits ?? 0;
      const cannonSurvivalMs = p.cannonSurvivalMs ?? p.survivalMs ?? this.cannonSession.survivalMs ?? 0;
      return {
        score: p.score || 0,
        highScore: Math.max(this.highScore, p.score || 0),
        endless: !!p.endless,
        endlessBonus: p.endlessBonus || 0,
        totalChocolates: this.stats.totalChocolates,
        playTimeMs: this.stats.playTimeMs,
        playTimeMutedMs: this.stats.playTimeMutedMs || 0,
        bestStreak: this.stats.bestStreak,
        currentStreak: this.currentStreak,
        gamesPlayed: this.stats.gamesPlayed || 0,
        recordsBroken: this.stats.recordsBroken || 0,
        loveClicks: save.site?.loveClicks || 0,
        surpriseCount: save.site?.surpriseCount || 0,
        poemsCreated: save.site?.poemsCreated || 0,
        poemRoundsCompleted: save.site?.poemRoundsCompleted || 0,
        meterFullReached: !!save.site?.meterFullReached,
        meterSecretUnlocked: !!save.site?.meterSecretUnlocked,
        careStreak: save.dailyCharge?.careStreak || 0,
        bestCareStreak: save.dailyCharge?.bestCareStreak || 0,
        totalCareDays: save.dailyCharge?.totalCareDays || 0,
        panelsOpened: panels,
        hadOneLife: !!this.session.hadOneLife,
        inOnlineRoom: !!p.inOnlineRoom,
        hour: now.getHours(),
        day: now.getDay(),
        cannonScore,
        cannonHits,
        cannonSurvivalMs,
        cannonHighScore: Math.max(this.cannonHighScore, cannonScore),
        cannonBestStreak: this.stats.cannonBestStreak || 0,
        cannonCurrentStreak: this.cannonStreak,
        cannonTotalHits: this.stats.cannonTotalHits || 0,
        cannonGamesPlayed: this.stats.cannonGamesPlayed || 0,
        cannonPlayTimeMs: this.stats.cannonPlayTimeMs || 0,
        cannonRecordsBroken: this.stats.cannonRecordsBroken || 0,
        cannonHadOneLife: !!this.cannonSession.hadOneLife,
        cannonInOnlineRoom: !!p.cannonInOnlineRoom || !!p.inOnlineRoom,
      };
    },

    getContext(score, endless, endlessBonus) {
      return this.buildContext({ score, endless, endlessBonus });
    },

    checkAchievement(a, ctx) {
      switch (a.id) {
        case 'first':
          return ctx.score >= 1 || ctx.totalChocolates >= 1;
        case 'true_love':
          return ctx.score >= 50;
        case 'infinite_love':
          return ctx.endless && ctx.endlessBonus >= 100;
        case 'master':
          return ctx.score >= 200;
        case 'legend':
          return ctx.score >= 300;
        case 'time_5m':
          return ctx.playTimeMs >= 5 * MIN;
        case 'time_20m':
          return ctx.playTimeMs >= 20 * MIN;
        case 'time_60m':
          return ctx.playTimeMs >= 60 * MIN;
        case 'time_180m':
          return ctx.playTimeMs >= 180 * MIN;
        case 'total_250':
          return ctx.totalChocolates >= 250;
        case 'total_500':
          return ctx.totalChocolates >= 500;
        case 'total_1000':
          return ctx.totalChocolates >= 1000;
        case 'total_2500':
          return ctx.totalChocolates >= 2500;
        case 'streak_10':
          return ctx.bestStreak >= 10;
        case 'streak_25':
          return ctx.bestStreak >= 25;
        case 'streak_50':
          return ctx.bestStreak >= 50;
        case 'streak_75':
          return ctx.bestStreak >= 75;
        case 'run_75':
          return ctx.score >= 75;
        case 'run_100':
          return ctx.score >= 100;
        case 'run_150':
          return ctx.score >= 150;
        case 'record_80':
          return ctx.highScore >= 80;
        case 'record_120':
          return ctx.highScore >= 120;
        case 'record_250':
          return ctx.highScore >= 250;
        case 'first_record':
          return ctx.recordsBroken >= 1;
        case 'endless_unlock':
          return ctx.endless;
        case 'endless_25':
          return ctx.endless && ctx.endlessBonus >= 25;
        case 'endless_50':
          return ctx.endless && ctx.endlessBonus >= 50;
        case 'love_25':
          return ctx.loveClicks >= 25;
        case 'love_100':
          return ctx.loveClicks >= 100;
        case 'love_500':
          return ctx.loveClicks >= 500;
        case 'surprise_1':
          return ctx.surpriseCount >= 1;
        case 'surprise_10':
          return ctx.surpriseCount >= 10;
        case 'surprise_25':
          return ctx.surpriseCount >= 25;
        case 'poem_1':
          return ctx.poemsCreated >= 1;
        case 'poem_10':
          return ctx.poemsCreated >= 10;
        case 'poem_50':
          return ctx.poemsCreated >= 50;
        case 'poem_round':
          return ctx.poemRoundsCompleted >= 1;
        case 'meter_full':
          return ctx.meterFullReached;
        case 'meter_infinite':
          return ctx.meterSecretUnlocked;
        case 'night_owl':
          return ctx.hour >= 22 || ctx.hour < 5;
        case 'early_bird':
          return ctx.hour < 8;
        case 'weekend':
          return ctx.day === 0 || ctx.day === 6;
        case 'silent_heart':
          return ctx.playTimeMutedMs >= 5 * MIN;
        case 'explorer':
          return ctx.panelsOpened.stats && ctx.panelsOpened.achievements && ctx.panelsOpened.settings;
        case 'charge_care_7':
          return Math.max(ctx.bestCareStreak || 0, ctx.careStreak || 0) >= 7;
        case 'last_stand':
          return ctx.hadOneLife && ctx.score >= 35;
        case 'games_10':
          return ctx.gamesPlayed >= 10;
        case 'games_50':
          return ctx.gamesPlayed >= 50;
        case 'online_duo':
          return ctx.inOnlineRoom && ctx.totalChocolates >= 1;
        case 'cannon_first':
          return ctx.cannonHits >= 1 || ctx.cannonTotalHits >= 1;
        case 'cannon_score_50':
          return ctx.cannonScore >= 50;
        case 'cannon_score_100':
          return ctx.cannonScore >= 100;
        case 'cannon_score_200':
          return ctx.cannonScore >= 200;
        case 'cannon_hits_10':
          return ctx.cannonHits >= 10;
        case 'cannon_hits_25':
          return ctx.cannonHits >= 25;
        case 'cannon_streak_5':
          return ctx.cannonBestStreak >= 5;
        case 'cannon_streak_10':
          return ctx.cannonBestStreak >= 10;
        case 'cannon_survive_60':
          return ctx.cannonSurvivalMs >= 60 * 1000;
        case 'cannon_survive_180':
          return ctx.cannonSurvivalMs >= 180 * 1000;
        case 'cannon_record_100':
          return ctx.cannonHighScore >= 100;
        case 'cannon_record_200':
          return ctx.cannonHighScore >= 200;
        case 'cannon_total_hits_100':
          return ctx.cannonTotalHits >= 100;
        case 'cannon_total_hits_500':
          return ctx.cannonTotalHits >= 500;
        case 'cannon_games_5':
          return ctx.cannonGamesPlayed >= 5;
        case 'cannon_games_25':
          return ctx.cannonGamesPlayed >= 25;
        case 'cannon_time_10m':
          return ctx.cannonPlayTimeMs >= 10 * MIN;
        case 'cannon_last_stand':
          return ctx.cannonHadOneLife && ctx.cannonScore >= 50;
        case 'cannon_online':
          return ctx.cannonInOnlineRoom && ctx.cannonGamesPlayed >= 1;
        case 'cannon_first_record':
          return ctx.cannonRecordsBroken >= 1;
        default:
          return false;
      }
    },

    _notifyUnlocks(newly) {
      for (let i = 0; i < newly.length; i++) {
        const achievement = newly[i];
        this.sounds.playAchievement();
        if (getToastScope(achievement) === 'game') {
          this.celebrate('achievement');
        }
        this.showAchievementToast(achievement);
      }
      if (newly.length) {
        setTimeout(() => { this._justUnlockedIds = []; }, 800);
      }
    },

    _checkMetaAchievements() {
      const ctx = this.buildContext(this.session);
      const newly = this.tryUnlockAchievements(ctx);
      if (newly.length) this._notifyUnlocks(newly);
    },

    refreshAchievements() {
      this._checkMetaAchievements();
    },

    syncSession(partial) {
      Object.assign(this.session, partial || {});
      this._checkMetaAchievements();
    },

    tryUnlockAchievements(ctx) {
      const newly = [];
      const now = Date.now();
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const a = ACHIEVEMENTS[i];
        if (this.isUnlocked(a.id)) continue;
        if (this.checkAchievement(a, ctx)) {
          this.unlockDates[a.id] = now;
          newly.push(a);
        }
      }
      if (newly.length) {
        this.saveUnlockData();
        this._justUnlockedIds = newly.map((a) => a.id);
        this.renderAchievementGallery();
        this.renderAchievementProgress();
      }
      return newly;
    },

    showAchievementToast(achievement) {
      const scope = getToastScope(achievement);
      const box = scope === 'site'
        ? this.els.siteAchievementToast
        : this.els.achievementToast;
      if (!box) return;

      box.innerHTML = `<span class="ach-icon">${achievement.icon}</span><span class="ach-text"><strong>${achievement.title}</strong><small>${achievement.desc}</small></span>`;
      box.classList.remove('hidden');
      box.classList.add('show', 'ach-toast-glow');

      const timerKey = scope === 'site' ? '_siteAchToastTimer' : '_achToastTimer';
      clearTimeout(this[timerKey]);
      this[timerKey] = setTimeout(() => {
        box.classList.remove('show', 'ach-toast-glow');
        setTimeout(() => box.classList.add('hidden'), 400);
      }, 3200);
    },

    celebrate(kind) {
      const fx = this.els.celebrateFx;
      if (!fx || this.perfLite && kind === 'catch') return;

      const icons = kind === 'love'
        ? ['❤️', '💕', '💖', '💗', '🩷', '✨', '💓', '🌸']
        : kind === 'record'
        ? ['🏆', '✨', '⭐', '🍫', '💫']
        : kind === 'achievement'
          ? ['🎖️', '✨', '💖', '⭐']
          : ['🎉', '✨', '🍫', '⭐', '💕'];

      const count = kind === 'love'
        ? (this.perfLite ? 8 : 14)
        : this.perfLite ? 3 : Math.min(5, icons.length);
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'game-celebrate-particle';
        el.textContent = icons[i % icons.length];
        el.style.left = `${15 + Math.random() * 70}%`;
        el.style.top = `${15 + Math.random() * 55}%`;
        el.style.animationDelay = `${i * 0.05}s`;
        fx.appendChild(el);
        setTimeout(() => el.remove(), kind === 'love' ? 1200 : 900);
      }

      while (fx.children.length > (kind === 'love' ? 16 : 8)) fx.firstChild?.remove();
    },

    handleCatch(partial) {
      this.sounds.playCatch();
      this.stats.totalChocolates++;
      this.currentStreak++;
      if (this.currentStreak > this.stats.bestStreak) {
        this.stats.bestStreak = this.currentStreak;
      }

      let recordBroken = false;
      const runScore = partial?.score || 0;
      if (runScore > this.highScore) {
        if (this.highScore > 0) {
          this.stats.recordsBroken = (this.stats.recordsBroken || 0) + 1;
        }
        this.highScore = runScore;
        this.saveHighScore();
        recordBroken = true;
        this.sounds.playRecord();
        this.celebrate('record');
      }
      this.saveStats();

      const ctx = this.buildContext(partial);
      this.session = {
        hadOneLife: this.session.hadOneLife,
        score: ctx.score,
        endless: ctx.endless,
        endlessBonus: ctx.endlessBonus,
        inOnlineRoom: ctx.inOnlineRoom,
      };

      this.renderHighScore();
      this.renderStats();

      const newly = this.tryUnlockAchievements(ctx);
      this._notifyUnlocks(newly);

      return { recordBroken, achievements: newly };
    },

    onLifeUpdate(lives, score) {
      if (lives <= 1) this.session.hadOneLife = true;
      this.session.score = score || this.session.score;
      if (this.session.hadOneLife && (score || 0) >= 35) {
        this._checkMetaAchievements();
      }
    },

    onGameOver(score) {
      this.stats.gamesPlayed = (this.stats.gamesPlayed || 0) + 1;
      this.session.score = score || 0;
      this.saveStats();
      this._checkMetaAchievements();
    },

    handleMiss() {
      this.currentStreak = 0;
      if (this._openPanelId === 'stats') this.renderStats();
    },

    resetSessionStreak() {
      this.currentStreak = 0;
      this.session = { hadOneLife: false, score: 0, endless: false, endlessBonus: 0, inOnlineRoom: false };
    },

    resetCannonSession() {
      this.cannonStreak = 0;
      this.cannonSession = { hadOneLife: false, score: 0, hits: 0, survivalMs: 0, inOnlineRoom: false };
    },

    saveCannonHighScore() {
      const save = global.SaveManager.getSave();
      global.SaveManager.updateSection('records', {
        ...save.records,
        spaceshipHighScore: this.cannonHighScore,
      });
    },

    addCannonPlayTime(dt, partial) {
      if (!dt || dt <= 0) return;
      this.stats.cannonPlayTimeMs = (this.stats.cannonPlayTimeMs || 0) + dt;
      this._cannonPlaySaveAcc = (this._cannonPlaySaveAcc || 0) + dt;
      if (partial) {
        this.cannonSession.score = partial.score ?? this.cannonSession.score;
        this.cannonSession.hits = partial.hits ?? this.cannonSession.hits;
        this.cannonSession.survivalMs = partial.survivalMs ?? this.cannonSession.survivalMs;
      }
      this._cannonAchAcc = (this._cannonAchAcc || 0) + dt;
      if (this._cannonPlaySaveAcc >= 5000) {
        this._cannonPlaySaveAcc = 0;
        this.saveStats();
      }
      if (this._cannonAchAcc >= 3000) {
        this._cannonAchAcc = 0;
        const ctx = this.buildContext({
          cannonScore: this.cannonSession.score,
          cannonHits: this.cannonSession.hits,
          cannonSurvivalMs: this.cannonSession.survivalMs,
          cannonInOnlineRoom: partial?.inOnlineRoom,
        });
        const newly = this.tryUnlockAchievements(ctx);
        if (newly.length) this._notifyUnlocks(newly);
      }
    },

    handleCannonHit(partial) {
      this.sounds.playCatch();
      this.stats.cannonTotalHits = (this.stats.cannonTotalHits || 0) + 1;
      this.cannonStreak++;
      if (this.cannonStreak > (this.stats.cannonBestStreak || 0)) {
        this.stats.cannonBestStreak = this.cannonStreak;
      }

      const runScore = partial?.score || 0;
      let recordBroken = false;
      if (runScore > this.cannonHighScore) {
        if (this.cannonHighScore > 0) {
          this.stats.cannonRecordsBroken = (this.stats.cannonRecordsBroken || 0) + 1;
        }
        this.cannonHighScore = runScore;
        this.saveCannonHighScore();
        recordBroken = true;
        this.sounds.playRecord();
        this.celebrate('record');
      }
      this.saveStats();

      const ctx = this.buildContext({
        cannonScore: runScore,
        cannonHits: partial?.hits || 0,
        cannonSurvivalMs: partial?.survivalMs || 0,
        cannonInOnlineRoom: partial?.inOnlineRoom,
      });
      this.cannonSession = {
        hadOneLife: this.cannonSession.hadOneLife,
        score: ctx.cannonScore,
        hits: ctx.cannonHits,
        survivalMs: ctx.cannonSurvivalMs,
        inOnlineRoom: !!partial?.inOnlineRoom,
      };

      const newly = this.tryUnlockAchievements(ctx);
      this._notifyUnlocks(newly);
      return { recordBroken, achievements: newly };
    },

    onCannonLifeUpdate(lives, partial) {
      if (lives <= 1) this.cannonSession.hadOneLife = true;
      if (partial) {
        this.cannonSession.score = partial.score || this.cannonSession.score;
        this.cannonSession.hits = partial.hits || this.cannonSession.hits;
        this.cannonSession.survivalMs = partial.survivalMs || this.cannonSession.survivalMs;
      }
      if (this.cannonSession.hadOneLife && (this.cannonSession.score || 0) >= 50) {
        this._checkMetaAchievements();
      }
    },

    onCannonGameOver(partial) {
      this.stats.cannonGamesPlayed = (this.stats.cannonGamesPlayed || 0) + 1;
      this.cannonSession.score = partial?.score || 0;
      this.cannonSession.hits = partial?.hits || 0;
      this.cannonSession.survivalMs = partial?.survivalMs || 0;
      if (partial?.inOnlineRoom) this.cannonSession.inOnlineRoom = true;
      this.saveStats();
      const ctx = this.buildContext({
        cannonScore: this.cannonSession.score,
        cannonHits: this.cannonSession.hits,
        cannonSurvivalMs: this.cannonSession.survivalMs,
        cannonInOnlineRoom: this.cannonSession.inOnlineRoom,
      });
      const newly = this.tryUnlockAchievements(ctx);
      this._notifyUnlocks(newly);
    },

    handleCannonMiss() {
      this.cannonStreak = 0;
    },

    achievementMode(a) {
      return a.mode === 'cannon' ? 'cannon' : 'cherry';
    },

    bindAchievementFilters() {
      const wrap = document.getElementById('game-ach-filter');
      if (!wrap) return;
      wrap.querySelectorAll('[data-ach-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const filter = btn.getAttribute('data-ach-filter') || 'all';
          this._achFilter = filter;
          wrap.querySelectorAll('[data-ach-filter]').forEach((b) => {
            b.classList.toggle('is-active', b.getAttribute('data-ach-filter') === filter);
            b.setAttribute('aria-selected', b.getAttribute('data-ach-filter') === filter ? 'true' : 'false');
          });
          this.renderAchievementGallery();
        });
      });
    },

    renderHighScore() {
      if (this.els.highScoreEl) {
        this.els.highScoreEl.textContent = String(this.highScore);
      }
    },

    renderStats() {
      const s = this.stats;
      if (this.els.statChocolates) this.els.statChocolates.textContent = String(s.totalChocolates);
      if (this.els.statTime) this.els.statTime.textContent = formatPlayTime(s.playTimeMs);
      if (this.els.statStreak) this.els.statStreak.textContent = String(s.bestStreak);
      if (this.els.statStreakCurrent) {
        this.els.statStreakCurrent.textContent = String(this.currentStreak);
      }
    },

    renderAchievementProgress() {
      const total = ACHIEVEMENTS.length;
      const unlocked = this.unlockedCount();
      const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

      if (this.els.achCount) {
        this.els.achCount.textContent = `${unlocked} / ${total} desbloqueados`;
      }
      if (this.els.achPct) {
        this.els.achPct.textContent = `${pct}%`;
      }
      if (this.els.achProgressFill) {
        this.els.achProgressFill.style.width = `${pct}%`;
      }
      const countLabel = `${unlocked}/${total}`;
      const btn = this.els.achievementsToggle;
      if (btn) {
        const full = btn.querySelector('.meta-label-full');
        const short = btn.querySelector('.meta-label-short');
        if (full) full.textContent = unlocked > 0 ? `🏆 Galería de Logros (${countLabel})` : '🏆 Galería de Logros';
        if (short) short.textContent = unlocked > 0 ? `🏆 Logros (${countLabel})` : '🏆 Logros';
      }
    },

    renderAchievementGallery() {
      const list = this.els.achievementsGallery;
      if (!list) return;
      list.innerHTML = '';

      const filter = this._achFilter || 'all';

      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const a = ACHIEVEMENTS[i];
        const mode = this.achievementMode(a);
        if (filter === 'cherry' && mode === 'cannon') continue;
        if (filter === 'cannon' && mode !== 'cannon') continue;

        const unlocked = this.isUnlocked(a.id);
        const li = document.createElement('li');
        li.className = 'game-ach-card' + (unlocked ? ' unlocked' : ' locked');
        li.dataset.achId = a.id;
        if (this._justUnlockedIds.includes(a.id)) li.classList.add('just-unlocked');

        const statusIcon = unlocked ? '✅' : '🔒';
        const dateBlock = unlocked
          ? `<p class="ach-date"><span class="ach-date-label">Desbloqueado:</span> ${formatUnlockDate(this.unlockDates[a.id])}</p>`
          : '';

        li.innerHTML = `
          <div class="ach-card-head">
            <span class="ach-status" aria-hidden="true">${statusIcon}</span>
            <span class="ach-badge" aria-hidden="true">${a.icon}</span>
            <strong class="ach-title">${a.title}</strong>
          </div>
          <p class="ach-desc">${a.desc}</p>
          ${dateBlock}
        `;
        list.appendChild(li);
      }
    },
  };

  global.GameMeta = GameMeta;
  global.GAME_ACHIEVEMENTS = ACHIEVEMENTS;
})(typeof window !== 'undefined' ? window : globalThis);
