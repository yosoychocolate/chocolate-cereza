/**
 * SaveManager — persistência unificada, migração e backup.
 * Único módulo autorizado a acessar localStorage do jogo.
 */
(function (global) {
  'use strict';

  const SAVE_KEY = 'ChocolateCerezaSave';
  const BACKUP_KEY = 'ChocolateCerezaSave_backup';
  const SAVE_VERSION = 30;

  const LEGACY = {
    highScore: 'chocolateCereza_highScore',
    stats: 'chocolateCereza_stats',
    achievements: 'chocolateCereza_achievements',
    achievementUnlocks: 'chocolateCereza_achievementUnlocks',
    settings: 'chocolateCereza_gameSettings',
    loveClicks: 'chocolateCereza_loveClicks',
    meterClicks: 'chocolateCereza_meterClicks',
    secretUnlocked: 'chocolateCereza_secretUnlocked',
    gameScore: 'chocolateCereza_gameScore',
    gameMilestones: 'chocolateCereza_gameMilestones',
    gameLives: 'chocolateCereza_gameLives',
  };

  function createDefaultSave() {
    return {
      version: SAVE_VERSION,
      settings: { sfx: true },
      stats: {
        totalChocolates: 0,
        playTimeMs: 0,
        bestStreak: 0,
        cannonTotalHits: 0,
        cannonGamesPlayed: 0,
        cannonPlayTimeMs: 0,
        cannonBestStreak: 0,
        cannonRecordsBroken: 0,
      },
      records: {
        highScore: 0,
        spaceshipHighScore: 0,
        spaceshipBestTime: 0,
      },
      achievements: {},
      session: {
        score: 0,
        lives: 5,
        milestones: { 50: false },
      },
      site: {
        loveClicks: 0,
      },
    };
  }

  function readRaw(key) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : null;
    } catch (_) {
      return null;
    }
  }

  function readSessionRaw(key) {
    try {
      const v = sessionStorage.getItem(key);
      return v !== null ? JSON.parse(v) : null;
    } catch (_) {
      return null;
    }
  }

  function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }

  function fillMissing(target, defaults) {
    if (!isObject(defaults)) return target;
    if (!isObject(target)) target = {};
    for (const key of Object.keys(defaults)) {
      if (target[key] === undefined || target[key] === null) {
        target[key] = Array.isArray(defaults[key])
          ? defaults[key].slice()
          : isObject(defaults[key])
            ? fillMissing({}, defaults[key])
            : defaults[key];
      } else if (isObject(defaults[key]) && isObject(target[key])) {
        fillMissing(target[key], defaults[key]);
      }
    }
    return target;
  }

  function validateSave(save) {
    const base = createDefaultSave();
    save = fillMissing(save, base);

    if (!isFiniteNumber(save.version)) save.version = 0;

    if (!isObject(save.settings)) save.settings = { sfx: true };
    if (typeof save.settings.sfx !== 'boolean') save.settings.sfx = true;

    if (!isObject(save.stats)) save.stats = { ...base.stats };
    if (!isFiniteNumber(save.stats.totalChocolates) || save.stats.totalChocolates < 0) {
      save.stats.totalChocolates = 0;
    }
    if (!isFiniteNumber(save.stats.playTimeMs) || save.stats.playTimeMs < 0) {
      save.stats.playTimeMs = 0;
    }
    if (!isFiniteNumber(save.stats.bestStreak) || save.stats.bestStreak < 0) {
      save.stats.bestStreak = 0;
    }
    if (!isFiniteNumber(save.stats.cannonTotalHits) || save.stats.cannonTotalHits < 0) {
      save.stats.cannonTotalHits = 0;
    }
    if (!isFiniteNumber(save.stats.cannonGamesPlayed) || save.stats.cannonGamesPlayed < 0) {
      save.stats.cannonGamesPlayed = 0;
    }
    if (!isFiniteNumber(save.stats.cannonPlayTimeMs) || save.stats.cannonPlayTimeMs < 0) {
      save.stats.cannonPlayTimeMs = 0;
    }
    if (!isFiniteNumber(save.stats.cannonBestStreak) || save.stats.cannonBestStreak < 0) {
      save.stats.cannonBestStreak = 0;
    }
    if (!isFiniteNumber(save.stats.cannonRecordsBroken) || save.stats.cannonRecordsBroken < 0) {
      save.stats.cannonRecordsBroken = 0;
    }

    if (!isObject(save.records)) save.records = { highScore: 0 };
    if (!isFiniteNumber(save.records.highScore) || save.records.highScore < 0) {
      save.records.highScore = 0;
    }
    if (!isFiniteNumber(save.records.spaceshipHighScore) || save.records.spaceshipHighScore < 0) {
      save.records.spaceshipHighScore = 0;
    }
    if (!isFiniteNumber(save.records.spaceshipBestTime) || save.records.spaceshipBestTime < 0) {
      save.records.spaceshipBestTime = 0;
    }

    if (!isObject(save.achievements)) save.achievements = {};
    for (const id of Object.keys(save.achievements)) {
      const ts = save.achievements[id];
      if (ts !== null && (!isFiniteNumber(ts) || ts < 0)) {
        save.achievements[id] = null;
      }
    }

    if (!isObject(save.session)) save.session = { ...base.session };
    if (!isFiniteNumber(save.session.score) || save.session.score < 0) save.session.score = 0;
    if (!isFiniteNumber(save.session.lives) || save.session.lives < 0) save.session.lives = 5;
    if (!isObject(save.session.milestones)) save.session.milestones = { 50: false };
    if (typeof save.session.milestones[50] !== 'boolean') save.session.milestones[50] = false;

    if (!isObject(save.site)) save.site = { loveClicks: 0 };
    if (!isFiniteNumber(save.site.loveClicks) || save.site.loveClicks < 0) {
      save.site.loveClicks = 0;
    }

    return save;
  }

  function importLegacyAchievements(save) {
    let unlocks = readRaw(LEGACY.achievementUnlocks);
    if (isObject(unlocks) && !Array.isArray(unlocks)) {
      for (const id of Object.keys(unlocks)) {
        if (save.achievements[id] === undefined) {
          save.achievements[id] = unlocks[id];
        }
      }
    }

    const legacyArr = readRaw(LEGACY.achievements);
    if (Array.isArray(legacyArr)) {
      for (let i = 0; i < legacyArr.length; i++) {
        const id = legacyArr[i];
        if (typeof id === 'string' && save.achievements[id] === undefined) {
          save.achievements[id] = null;
        }
      }
    }
  }

  function importLegacyStats(save) {
    const legacy = readRaw(LEGACY.stats);
    if (!isObject(legacy)) return;

    if (isFiniteNumber(legacy.totalChocolates)) {
      save.stats.totalChocolates = Math.max(save.stats.totalChocolates, legacy.totalChocolates);
    }
    if (isFiniteNumber(legacy.playTimeMs)) {
      save.stats.playTimeMs = Math.max(save.stats.playTimeMs, legacy.playTimeMs);
    }
    if (isFiniteNumber(legacy.bestStreak)) {
      save.stats.bestStreak = Math.max(save.stats.bestStreak, legacy.bestStreak);
    }
  }

  function importLegacyRecords(save) {
    const legacy = readRaw(LEGACY.highScore);
    if (isFiniteNumber(legacy)) {
      save.records.highScore = Math.max(save.records.highScore, legacy);
    }
  }

  function importLegacySettings(save) {
    const legacy = readRaw(LEGACY.settings);
    if (!isObject(legacy)) return;
    if (legacy.sfx !== undefined && save.settings.sfx == null) {
      save.settings.sfx = !!legacy.sfx;
    } else if (typeof legacy.sfx === 'boolean' && legacy.sfx === false && save.settings.sfx === true) {
      save.settings.sfx = false;
    }
  }

  function importLegacySession(save) {
    let score = readSessionRaw(LEGACY.gameScore);
    if (score === null) score = readRaw(LEGACY.gameScore);
    if (save.session.score === 0 && isFiniteNumber(score) && score > 0) {
      save.session.score = score;
    }

    let lives = readSessionRaw(LEGACY.gameLives);
    if (lives === null) lives = readRaw(LEGACY.gameLives);
    if (save.session.lives === 5 && isFiniteNumber(lives) && lives !== 5) {
      save.session.lives = Math.max(0, Math.min(5, lives));
    }

    let milestones = readSessionRaw(LEGACY.gameMilestones);
    if (milestones === null) milestones = readRaw(LEGACY.gameMilestones);
    if (isObject(milestones) && milestones[50] === true && save.session.milestones[50] === false) {
      save.session.milestones[50] = true;
    }
  }

  function importLegacySite(save) {
    const love = readRaw(LEGACY.loveClicks);
    if (save.site.loveClicks === 0 && isFiniteNumber(love) && love > 0) {
      save.site.loveClicks = love;
    }
  }

  function importAllLegacy(save) {
    importLegacyRecords(save);
    importLegacyStats(save);
    importLegacySettings(save);
    importLegacyAchievements(save);
    importLegacySession(save);
    importLegacySite(save);
  }

  function migrateSave(save) {
    let version = save.version || 0;

    if (version < 29) {
      importAllLegacy(save);
      fillMissing(save, createDefaultSave());
      version = 29;
    }

    if (version < 30) {
      fillMissing(save.stats, createDefaultSave().stats);
      fillMissing(save.records, createDefaultSave().records);
      version = 30;
    }

    /* Futuras migrações — apenas adicionar campos novos:
    if (version < 31) {
      version = 31;
    }
    if (version < 32) {
      version = 32;
    }
    */

    save.version = SAVE_VERSION;
    return save;
  }

  function writeBackup(raw) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch (_) { /* quota */ }
  }

  function restoreBackup() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return validateSave(parsed);
    } catch (_) {
      return null;
    }
  }

  const SaveManager = {
    _save: null,
    _flushTimer: null,
    _ready: false,

    init() {
      if (this._ready) return this._save;

      let raw = null;
      try {
        raw = localStorage.getItem(SAVE_KEY);
      } catch (_) {
        raw = null;
      }

      if (raw) {
        writeBackup(raw);
        try {
          let parsed = JSON.parse(raw);
          parsed = validateSave(parsed);
          parsed = migrateSave(parsed);
          this._save = parsed;
          this.flush();
        } catch (err) {
          console.warn('[SaveManager] Migração falhou, restaurando backup:', err);
          const restored = restoreBackup();
          this._save = restored || createDefaultSave();
          this._save = migrateSave(validateSave(this._save));
          this.flush();
        }
      } else {
        this._save = createDefaultSave();
        this._save = migrateSave(this._save);
        this.flush();
      }

      this._ready = true;
      return this._save;
    },

    getSave() {
      if (!this._ready) this.init();
      return this._save;
    },

    getVersion() {
      return this.getSave().version;
    },

    flush() {
      if (!this._save) return;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this._save));
      } catch (err) {
        console.warn('[SaveManager] Erro ao salvar:', err);
      }
    },

    scheduleFlush() {
      if (this._flushTimer) clearTimeout(this._flushTimer);
      this._flushTimer = setTimeout(() => {
        this._flushTimer = null;
        this.flush();
      }, 250);
    },

    updateSection(section, partial) {
      if (!this._ready) this.init();
      if (!isObject(partial)) return;
      if (!isObject(this._save[section])) this._save[section] = {};
      for (const key of Object.keys(partial)) {
        if (partial[key] !== undefined) {
          this._save[section][key] = partial[key];
        }
      }
      this.scheduleFlush();
    },

    setAchievementUnlock(id, timestamp) {
      if (!this._ready) this.init();
      if (this._save.achievements[id] == null) {
        this._save.achievements[id] = timestamp;
        this.scheduleFlush();
      }
    },

    resetSession() {
      if (!this._ready) this.init();
      this._save.session = {
        score: 0,
        lives: 5,
        milestones: { 50: false },
      };
      this.scheduleFlush();
    },
  };

  SaveManager.VERSION = SAVE_VERSION;
  SaveManager.KEY = SAVE_KEY;
  global.SaveManager = SaveManager;
})(typeof window !== 'undefined' ? window : globalThis);
