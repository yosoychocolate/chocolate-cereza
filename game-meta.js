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
  };

  const DEFAULT_SETTINGS = {
    sfx: true,
  };

  const ACHIEVEMENTS = [
    {
      id: 'first',
      icon: '🍫',
      title: 'Primer Chocolate',
      desc: 'Primer chocolate atrapado.',
    },
    {
      id: 'true_love',
      icon: '❤️',
      title: 'Amor Verdadero',
      desc: 'Alcanza 50 chocolates.',
    },
    {
      id: 'infinite_love',
      icon: '♾️',
      title: 'Amor Infinito',
      desc: 'Consigue 100 chocolates extra en el modo infinito.',
    },
    {
      id: 'master',
      icon: '👑',
      title: 'Maestro del Chocolate',
      desc: 'Alcanza 200 chocolates en una sola partida.',
    },
    {
      id: 'legend',
      icon: '💎',
      title: 'Leyenda del Chocolate',
      desc: 'Alcanza 300 chocolates en una sola partida.',
    },
  ];

  function formatUnlockDate(ts) {
    if (!ts) return 'Fecha desconocida';
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function loadFromSave() {
    const save = global.SaveManager.getSave();
    return {
      highScore: save.records.highScore || 0,
      stats: { ...DEFAULT_STATS, ...save.stats },
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

  const GameMeta = {
    sounds: new GameSounds(),
    highScore: 0,
    stats: { ...DEFAULT_STATS },
    settings: { ...DEFAULT_SETTINGS },
    unlockDates: {},
    currentStreak: 0,
    els: {},
    panels: {},
    perfLite: false,
    _openPanelId: null,
    _justUnlockedIds: [],
    _isMobileUI: false,

    init(options) {
      this.els = options || {};
      this.perfLite = !!options.perfLite;

      const data = loadFromSave();
      this.highScore = data.highScore;
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
      this.syncSettingsUI();
      this.bindPanelToggles();
      this.bindSettings();
      this._isMobileUI = window.matchMedia('(max-width: 768px)').matches;
      this.els.metaBackdrop = document.getElementById('game-meta-backdrop');
      this.els.metaBackdrop?.addEventListener('click', () => {
        if (this._openPanelId) this.closePanel(this._openPanelId);
      });
    },

    _syncSheetOverlay() {
      const mobile = window.matchMedia('(max-width: 768px)').matches;
      const backdrop = this.els.metaBackdrop;
      if (mobile && this._openPanelId) {
        document.body.classList.add('game-meta-sheet-open');
        backdrop?.classList.remove('hidden');
        backdrop?.setAttribute('aria-hidden', 'false');
      } else {
        document.body.classList.remove('game-meta-sheet-open');
        backdrop?.classList.add('hidden');
        backdrop?.setAttribute('aria-hidden', 'true');
      }
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
      this._playSaveAcc = (this._playSaveAcc || 0) + dt;
      if (this._playSaveAcc >= 5000) {
        this._playSaveAcc = 0;
        this.saveStats();
        if (this.els.statTime) this.els.statTime.textContent = formatPlayTime(this.stats.playTimeMs);
      }
    },

    getContext(score, endless, endlessBonus) {
      return {
        score,
        highScore: Math.max(this.highScore, score),
        endless,
        endlessBonus,
        totalChocolates: this.stats.totalChocolates,
      };
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
        default:
          return false;
      }
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
      const box = this.els.achievementToast;
      if (!box) return;
      box.innerHTML = `<span class="ach-icon">${achievement.icon}</span><span class="ach-text"><strong>${achievement.title}</strong><small>${achievement.desc}</small></span>`;
      box.classList.remove('hidden');
      box.classList.add('show', 'ach-toast-glow');
      clearTimeout(this._achToastTimer);
      this._achToastTimer = setTimeout(() => {
        box.classList.remove('show', 'ach-toast-glow');
        setTimeout(() => box.classList.add('hidden'), 400);
      }, 3200);
    },

    celebrate(kind) {
      const fx = this.els.celebrateFx;
      if (!fx || this.perfLite && kind === 'catch') return;

      const icons = kind === 'record'
        ? ['🏆', '✨', '⭐', '🍫', '💫']
        : kind === 'achievement'
          ? ['🎖️', '✨', '💖', '⭐']
          : ['🎉', '✨', '🍫', '⭐', '💕'];

      const count = this.perfLite ? 3 : Math.min(5, icons.length);
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'game-celebrate-particle';
        el.textContent = icons[i % icons.length];
        el.style.left = `${20 + Math.random() * 60}%`;
        el.style.top = `${25 + Math.random() * 40}%`;
        el.style.animationDelay = `${i * 0.06}s`;
        fx.appendChild(el);
        setTimeout(() => el.remove(), 900);
      }

      while (fx.children.length > 8) fx.firstChild?.remove();
    },

    handleCatch(ctx) {
      this.sounds.playCatch();
      this.stats.totalChocolates++;
      this.currentStreak++;
      if (this.currentStreak > this.stats.bestStreak) {
        this.stats.bestStreak = this.currentStreak;
      }
      this.saveStats();

      let recordBroken = false;
      if (ctx.score > this.highScore) {
        this.highScore = ctx.score;
        this.saveHighScore();
        recordBroken = true;
        this.sounds.playRecord();
        this.celebrate('record');
      }

      this.renderHighScore();
      this.renderStats();

      const newly = this.tryUnlockAchievements(ctx);
      for (let i = 0; i < newly.length; i++) {
        this.sounds.playAchievement();
        this.celebrate('achievement');
        this.showAchievementToast(newly[i]);
      }
      if (newly.length) {
        setTimeout(() => { this._justUnlockedIds = []; }, 800);
      }

      return { recordBroken, achievements: newly };
    },

    handleMiss() {
      this.currentStreak = 0;
      if (this._openPanelId === 'stats') this.renderStats();
    },

    resetSessionStreak() {
      this.currentStreak = 0;
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

      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        const a = ACHIEVEMENTS[i];
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
