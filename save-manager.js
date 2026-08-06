/**
 * SaveManager — persistência unificada, migração e backup.
 * Único módulo autorizado a acessar localStorage do jogo.
 */
(function (global) {
  'use strict';

  const SAVE_KEY = 'ChocolateCerezaSave';
  const BACKUP_KEY = 'ChocolateCerezaSave_backup';
  const SAVE_VERSION = 39;

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
      settings: {
        sfx: true,
        bgmVolume: 0.75,
        musicVolume: 0.75,
        sfxVolume: 0.80,
        gameSfxVolume: 0.80,
        teddyVolume: 0.65,
        teddySfxVolume: 0.65,
        teddySfx: true,
        uiVolume: 0.40,
        ambientVolume: 0.35,
      },
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
      dailyCharge: {
        lastClaimDate: null,
        careStreak: 0,
        bestCareStreak: 0,
        totalCareDays: 0,
        lastNudgeDate: null,
        lastNotifDate: null,
        lastMainShownDate: null,
        streakBonusAt: 0,
        notifEnabled: true,
      },
      coupleHub: {
        settings: {
          relationshipStart: null,
          nextMeetingDate: null,
          chargeReminder: {
            enabled: true,
            time: '20:30',
            timezone: 'America/New_York',
          },
          dailyMissions: {
            dateKey: '',
            completed: [],
          },
        },
        tasks: [],
        events: [],
        letters: [],
        memories: [],
      },
      nossaCasa: {
        lettersReadAt: 0,
        lastPlayDate: null,
        fireplaceStreak: 0,
        lastVisitDate: null,
        gardenLog: [],
        recipes: [
          { id: 'r1', text: 'Lasanha', done: false },
          { id: 'r2', text: 'Bolo', done: false },
          { id: 'r3', text: 'Pizza', done: false },
        ],
        movies: [
          { id: 'm1', title: 'Your Name', watched: false, rating: 0 },
          { id: 'm2', title: 'A Viagem de Chihiro', watched: true, rating: 5 },
          { id: 'm3', title: 'Interestelar', watched: true, rating: 5 },
        ],
        travelChecklist: [],
        lastMusic: null,
        lastGame: null,
        lastMessage: null,
        togetherSince: null,
        weather: null,
        weatherLat: 40.71,
        weatherLon: -74.01,
        gamesWatchMinutes: 0,
        lastGamesSessionAt: null,
        lastGamesSessionMins: 0,
        teddy: {
          mood: 70,
          lastVisitAt: null,
          lastFedAt: null,
          outfit: null,
          outfitsOwned: [],
          decor: [],
          gifts: [],
          roomProps: [],
          totalHugs: 0,
          welcomedSession: false,
          bornAt: null,
          carePoints: 0,
          birthday: '08-15',
          memory: [],
          dayHistory: [],
          daily: null,
          lastGamesTotal: 0,
          lastHugAt: null,
          lastHugBy: null,
          lastPlayAt: null,
          lastFedBy: null,
          lastFedFood: null,
          backpack: { chocolate: 0, rose: 0, photo: 0, gift: 0 },
          hideSeekWins: 0,
          diary: [],
          plantStage: 'ok',
          plantWateredAt: null,
          visitStreak: 0,
          lastVisitDay: null,
          secrets: [],
          pendingDelivery: null,
          lastDeliveryAt: null,
          selfiesTaken: [],
        },
      },
    };
  }

  function createDefaultCoupleHubTasks() {
    return [
      { id: 'seed_1', text: 'Cargar el auto', emoji: '🔋', done: false, order: 0 },
      { id: 'seed_2', text: 'Comprar café', emoji: '☕', done: false, order: 1 },
      { id: 'seed_3', text: 'Comprar chocolate', emoji: '🍫', done: false, order: 2 },
      { id: 'seed_4', text: 'Llamar a mamá', emoji: '📞', done: false, order: 3 },
      { id: 'seed_5', text: 'Ir ao mercado', emoji: '🛒', done: false, order: 4 },
    ];
  }

  function createDefaultCoupleHubEvents() {
    const year = new Date().getFullYear();
    return [
      { id: 'ev_1', title: 'Nuestro encuentro', date: `${year}-08-15`, emoji: '❤️', note: '' },
      { id: 'ev_2', title: 'Revisión del auto', date: `${year}-08-20`, emoji: '🚗', note: '' },
      { id: 'ev_3', title: 'Cumpleaños', date: `${year}-09-02`, emoji: '🎂', note: '' },
      { id: 'ev_4', title: 'Viaje', date: `${year}-10-18`, emoji: '✈️', note: '' },
    ];
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

    if (!isObject(save.dailyCharge)) {
      save.dailyCharge = { ...createDefaultSave().dailyCharge };
    }
    const dc = save.dailyCharge;
    if (typeof dc.lastClaimDate !== 'string' && dc.lastClaimDate !== null) dc.lastClaimDate = null;
    if (!isFiniteNumber(dc.careStreak) || dc.careStreak < 0) dc.careStreak = 0;
    if (!isFiniteNumber(dc.bestCareStreak) || dc.bestCareStreak < 0) dc.bestCareStreak = 0;
    if (!isFiniteNumber(dc.totalCareDays) || dc.totalCareDays < 0) dc.totalCareDays = 0;
    if (typeof dc.lastNudgeDate !== 'string' && dc.lastNudgeDate !== null) dc.lastNudgeDate = null;
    if (typeof dc.lastNotifDate !== 'string' && dc.lastNotifDate !== null) dc.lastNotifDate = null;
    if (typeof dc.lastMainShownDate !== 'string' && dc.lastMainShownDate !== null) dc.lastMainShownDate = null;
    if (!isFiniteNumber(dc.streakBonusAt) || dc.streakBonusAt < 0) dc.streakBonusAt = 0;
    if (typeof dc.notifEnabled !== 'boolean') dc.notifEnabled = true;

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

    if (version < 31) {
      fillMissing(save, { dailyCharge: createDefaultSave().dailyCharge });
      version = 31;
    }

    if (version < 32) {
      const hubDefault = createDefaultSave().coupleHub;
      fillMissing(save, { coupleHub: hubDefault });
      if (!Array.isArray(save.coupleHub.tasks) || save.coupleHub.tasks.length === 0) {
        save.coupleHub.tasks = createDefaultCoupleHubTasks();
      }
      if (!Array.isArray(save.coupleHub.events) || save.coupleHub.events.length === 0) {
        save.coupleHub.events = createDefaultCoupleHubEvents();
      }
      version = 32;
    }

    if (version < 33) {
      fillMissing(save, { nossaCasa: createDefaultSave().nossaCasa });
      version = 33;
    }

    if (version < 34) {
      fillMissing(save, { nossaCasa: createDefaultSave().nossaCasa });
      if (!Array.isArray(save.nossaCasa.gardenLog)) save.nossaCasa.gardenLog = [];
      if (!Array.isArray(save.nossaCasa.recipes) || !save.nossaCasa.recipes.length) {
        save.nossaCasa.recipes = createDefaultSave().nossaCasa.recipes;
      }
      if (!Array.isArray(save.nossaCasa.movies) || !save.nossaCasa.movies.length) {
        save.nossaCasa.movies = createDefaultSave().nossaCasa.movies;
      }
      version = 34;
    }

    if (version < 35) {
      fillMissing(save, { nossaCasa: createDefaultSave().nossaCasa });
      fillMissing(save.nossaCasa, { teddy: createDefaultSave().nossaCasa.teddy });
      version = 35;
    }

    if (version < 36) {
      fillMissing(save.nossaCasa, { teddy: createDefaultSave().nossaCasa.teddy });
      const td = save.nossaCasa.teddy;
      if (!Array.isArray(td.memory)) td.memory = [];
      if (!Array.isArray(td.roomProps)) td.roomProps = [];
      if (!Array.isArray(td.dayHistory)) td.dayHistory = [];
      if (!td.backpack || typeof td.backpack !== 'object') {
        td.backpack = { chocolate: 0, rose: 0, photo: 0, gift: 0 };
      }
      if (!td.birthday) td.birthday = '08-15';
      version = 36;
    }

    if (version < 37) {
      fillMissing(save, { nossaCasa: createDefaultSave().nossaCasa });
      if (!save.nossaCasa.teddy) save.nossaCasa.teddy = createDefaultSave().nossaCasa.teddy;
      fillMissing(save.nossaCasa.teddy, createDefaultSave().nossaCasa.teddy);
      if (!Array.isArray(save.nossaCasa.teddy.diary)) save.nossaCasa.teddy.diary = [];
      if (!Array.isArray(save.nossaCasa.teddy.secrets)) save.nossaCasa.teddy.secrets = [];
      if (!Array.isArray(save.nossaCasa.teddy.selfiesTaken)) save.nossaCasa.teddy.selfiesTaken = [];
      if (!save.nossaCasa.teddy.plantStage) save.nossaCasa.teddy.plantStage = 'ok';
      version = 37;
    }

    if (version < 38) {
      fillMissing(save.settings, {
        gameSfxVolume: 0.75,
        teddySfx: true,
        teddySfxVolume: 0.65,
      });
      if (typeof save.settings.gameSfxVolume !== 'number') save.settings.gameSfxVolume = 0.75;
      if (save.settings.teddySfx == null) save.settings.teddySfx = true;
      if (typeof save.settings.teddySfxVolume !== 'number') save.settings.teddySfxVolume = 0.65;
      version = 38;
    }

    if (version < 39) {
      fillMissing(save.settings, createDefaultSave().settings);
      if (save.settings.musicVolume != null && save.settings.bgmVolume == null) {
        save.settings.bgmVolume = save.settings.musicVolume;
      }
      if (save.settings.gameSfxVolume != null && save.settings.sfxVolume == null) {
        save.settings.sfxVolume = save.settings.gameSfxVolume;
      }
      if (save.settings.teddySfxVolume != null && save.settings.teddyVolume == null) {
        save.settings.teddyVolume = save.settings.teddySfxVolume;
      }
      if (typeof save.settings.uiVolume !== 'number') save.settings.uiVolume = 0.4;
      if (typeof save.settings.ambientVolume !== 'number') save.settings.ambientVolume = 0.35;
      version = 39;
    }

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
