/**
 * CannonMissions — missões da partida (run) no modo Cañón Chocolate.
 * Logros persistentes ficam em game-meta.js (mode: 'cannon').
 */
(function (global) {
  'use strict';

  /** @typedef {'score'|'hits'|'streak'|'time'} MissionMetric */

  /** @type {{ id: string, icon: string, title: string, desc: string, metric: MissionMetric, goal: number }[]} */
  const RUN_MISSIONS = [
    { id: 'run_hit_1', icon: '🎯', title: 'Calibrar', desc: 'Acerta 1 cereza', metric: 'hits', goal: 1 },
    { id: 'run_streak_3', icon: '🔥', title: 'Racha x3', desc: '3 aciertos seguidos', metric: 'streak', goal: 3 },
    { id: 'run_score_30', icon: '⭐', title: '30 puntos', desc: 'Alcanza 30 puntos', metric: 'score', goal: 30 },
    { id: 'run_hits_5', icon: '🎯', title: '5 aciertos', desc: 'Destruye 5 cerezas', metric: 'hits', goal: 5 },
    { id: 'run_score_50', icon: '💯', title: '50 puntos', desc: 'Alcanza 50 puntos', metric: 'score', goal: 50 },
    { id: 'run_time_45', icon: '⏱️', title: '45 segundos', desc: 'Sobrevive 45 s', metric: 'time', goal: 45000 },
    { id: 'run_streak_5', icon: '⚡', title: 'Racha x5', desc: '5 aciertos seguidos', metric: 'streak', goal: 5 },
    { id: 'run_score_80', icon: '🚀', title: '80 puntos', desc: 'Alcanza 80 puntos', metric: 'score', goal: 80 },
    { id: 'run_hits_15', icon: '💥', title: '15 aciertos', desc: 'Destruye 15 cerezas', metric: 'hits', goal: 15 },
    { id: 'run_time_90', icon: '🛡️', title: '90 segundos', desc: 'Sobrevive 1:30', metric: 'time', goal: 90000 },
    { id: 'run_score_120', icon: '👑', title: '120 puntos', desc: 'Alcanza 120 puntos', metric: 'score', goal: 120 },
    { id: 'run_streak_8', icon: '🌟', title: 'Racha x8', desc: '8 aciertos seguidos', metric: 'streak', goal: 8 },
  ];

  const MAX_VISIBLE_DESKTOP = 3;
  const MAX_VISIBLE_MOBILE = 2;

  function getMaxVisible() {
    if (typeof global.matchMedia !== 'function') return MAX_VISIBLE_DESKTOP;
    return global.matchMedia('(max-width: 768px)').matches ? MAX_VISIBLE_MOBILE : MAX_VISIBLE_DESKTOP;
  }

  /** @type {Set<string>} */
  let completedRun = new Set();

  /** @type {string[]} */
  let activeIds = [];

  /** @type {{ list?: HTMLElement, toast?: HTMLElement, panel?: HTMLElement }} */
  let els = {};

  /** @type {ReturnType<typeof setTimeout> | null} */
  let toastTimer = null;

  /** @type {boolean} */
  let toastShowing = false;

  /** @type {typeof RUN_MISSIONS[number][]} */
  let toastQueue = [];

  /** @type {string} */
  let lastPanelKey = '';

  /** @type {boolean} */
  let inited = false;

  /**
   * @param {{ score: number, hits: number, currentStreak: number, survivalMs: number }} state
   * @param {{ metric: MissionMetric, goal: number }} mission
   */
  function missionValue(state, mission) {
    switch (mission.metric) {
      case 'hits':
        return state.hits;
      case 'streak':
        return state.currentStreak;
      case 'time':
        return state.survivalMs;
      default:
        return state.score;
    }
  }

  /**
   * @param {{ score: number, hits: number, currentStreak: number, survivalMs: number }} state
   * @param {{ metric: MissionMetric, goal: number }} mission
   */
  function isMissionDone(state, mission) {
    return missionValue(state, mission) >= mission.goal;
  }

  /**
   * @param {{ score: number, hits: number, currentStreak: number, survivalMs: number }} state
   * @param {{ metric: MissionMetric, goal: number }} mission
   */
  function missionProgressPct(state, mission) {
    const val = missionValue(state, mission);
    return Math.max(0, Math.min(100, Math.round((val / mission.goal) * 100)));
  }

  function pickActiveMissions() {
    activeIds = RUN_MISSIONS
      .filter((m) => !completedRun.has(m.id))
      .slice(0, getMaxVisible())
      .map((m) => m.id);
    lastPanelKey = '';
  }

  /**
   * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
   */
  function buildState(engine) {
    return {
      score: engine?.score || 0,
      hits: engine?.hits || 0,
      currentStreak: global.GameMeta?.cannonStreak || 0,
      survivalMs: engine?.survivalMs || 0,
    };
  }

  function buildPanelKey(state) {
    if (!activeIds.length) return 'done-all';
    return activeIds.map((id) => {
      const mission = RUN_MISSIONS.find((m) => m.id === id);
      if (!mission) return `${id}:0`;
      return `${id}:${missionProgressPct(state, mission)}`;
    }).join('|');
  }

  function enqueueMissionToast(mission) {
    toastQueue.push(mission);
    drainToastQueue();
  }

  function drainToastQueue() {
    if (toastShowing || !toastQueue.length || !els.toast) return;

    toastShowing = true;
    const mission = toastQueue.shift();
    els.toast.textContent = `${mission.icon} ¡Misión completada! ${mission.title}`;
    els.toast.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast?.classList.remove('show');
      toastShowing = false;
      toastTimer = setTimeout(drainToastQueue, 220);
    }, 2600);
  }

  /**
   * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
   */
  function renderPanel(engine) {
    if (!els.list) return;

    const state = buildState(engine);
    const panelKey = buildPanelKey(state);
    if (panelKey === lastPanelKey) return;
    lastPanelKey = panelKey;

    els.list.replaceChildren();

    if (!activeIds.length) {
      const li = document.createElement('li');
      li.className = 'spaceship-mission-item is-done-all';
      li.textContent = '🏆 ¡Todas las misiones de esta partida!';
      els.list.appendChild(li);
      return;
    }

    for (let i = 0; i < activeIds.length; i++) {
      const mission = RUN_MISSIONS.find((m) => m.id === activeIds[i]);
      if (!mission) continue;
      const pct = missionProgressPct(state, mission);

      const li = document.createElement('li');
      li.className = 'spaceship-mission-item';
      li.dataset.missionId = mission.id;

      const icon = document.createElement('span');
      icon.className = 'spaceship-mission-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = mission.icon;

      const body = document.createElement('span');
      body.className = 'spaceship-mission-body';

      const title = document.createElement('span');
      title.className = 'spaceship-mission-title';
      title.textContent = mission.title;

      const desc = document.createElement('span');
      desc.className = 'spaceship-mission-desc';
      desc.textContent = mission.desc;

      const bar = document.createElement('span');
      bar.className = 'spaceship-mission-bar';
      bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      body.appendChild(title);
      body.appendChild(desc);
      body.appendChild(bar);
      li.appendChild(icon);
      li.appendChild(body);
      els.list.appendChild(li);
    }
  }

  /**
   * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
   */
  function checkMissions(engine) {
    const state = buildState(engine);
    let changed = false;
    const completedNow = [];

    for (let i = 0; i < activeIds.length; i++) {
      const id = activeIds[i];
      if (completedRun.has(id)) continue;
      const mission = RUN_MISSIONS.find((m) => m.id === id);
      if (!mission) continue;
      if (isMissionDone(state, mission)) {
        completedRun.add(id);
        completedNow.push(mission);
        changed = true;
      }
    }

    if (changed) {
      for (let i = 0; i < completedNow.length; i++) {
        enqueueMissionToast(completedNow[i]);
        global.GameMeta?.sounds?.playMilestone?.();
      }
      pickActiveMissions();
    }

    renderPanel(engine);
  }

  const CannonMissions = {
    init() {
      if (inited) return;
      inited = true;

      els.list = document.getElementById('spaceship-missions-list');
      els.toast = document.getElementById('spaceship-mission-toast');
      els.panel = document.getElementById('spaceship-missions');
      this.resetRun();
      if (typeof global.matchMedia === 'function') {
        global.matchMedia('(max-width: 768px)').addEventListener('change', () => {
          pickActiveMissions();
          renderPanel(null);
        });
      }
    },

    resetRun() {
      completedRun = new Set();
      toastQueue = [];
      toastShowing = false;
      clearTimeout(toastTimer);
      toastTimer = null;
      pickActiveMissions();
      renderPanel(null);
      els.toast?.classList.remove('show');
    },

    /**
     * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
     */
    onHit(engine) {
      checkMissions(engine);
    },

    /**
     * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
     */
    onTick(engine) {
      checkMissions(engine);
    },

    /**
     * @param {import('./spaceship-engine.js').SpaceshipEngine | null} engine
     */
    onGameOver(engine) {
      checkMissions(engine);
    },

    render(engine) {
      renderPanel(engine);
    },
  };

  global.CannonMissions = CannonMissions;
  global.CANNON_RUN_MISSIONS = RUN_MISSIONS;
})(typeof window !== 'undefined' ? window : globalThis);
