/**
 * Missão diária — 20:30 (horário EUA) — Sophie & Chocolate 🔋🐻
 */
(function (global) {
  'use strict';

  /** Horário de Sophie (EUA) — ajuste se mudar de fuso */
  const TIMEZONE = 'America/New_York';
  const UNLOCK_HOUR = 20;
  const UNLOCK_MINUTE = 30;
  const NUDGE_HOUR = 21;
  const NUDGE_MINUTE = 30;
  const REWARD_COINS = 20;
  const STREAK_BONUS_COINS = 100;
  /** Minutos após 20:30 NY em que ainda tentamos enviar a notificação (aba aberta). */
  const NOTIF_GRACE_MINUTES = 60;

  const MSGS = {
    main: [
      'Sophie... ¿llegaste a casa? 🥺',
      'El Chocolate está esperando un poquito de energía.',
      'No olvides poner el auto a cargar. 🔋❤️',
    ],
    nudge: [
      'Pssst...',
      'El Chocolate sigue despierto esperándote. 🥺🔋',
    ],
    thanks: 'Gracias por cuidarlo. ¡Buenas noches! 🌙❤️',
    streak: (days) => [
      '🏆 Cuidando del Chocolate',
      `🔥 Racha: ${days} días`,
      `Recompensa: 🍫 +${STREAK_BONUS_COINS} chocolates`,
    ],
  };

  let els = {};
  let tickTimer = null;
  let earlyWatchTimer = null;
  let inited = false;
  let celebrating = false;

  function getTzParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = {};
    fmt.formatToParts(date).forEach((p) => {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
    };
  }

  function getTodayKey(date = new Date()) {
    const p = getTzParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function getMinutesOfDay(date = new Date()) {
    const p = getTzParts(date);
    return p.hour * 60 + p.minute;
  }

  function isNotificationWindowOpen() {
    const unlock = UNLOCK_HOUR * 60 + UNLOCK_MINUTE;
    const mins = getMinutesOfDay();
    return mins >= unlock && mins < unlock + NOTIF_GRACE_MINUTES;
  }

  function isMissionWindowOpen() {
    const unlock = UNLOCK_HOUR * 60 + UNLOCK_MINUTE;
    return getMinutesOfDay() >= unlock;
  }

  function isNudgeWindow() {
    const nudge = NUDGE_HOUR * 60 + NUDGE_MINUTE;
    return getMinutesOfDay() >= nudge;
  }

  function getState() {
    const save = global.SaveManager.getSave();
    const dc = save.dailyCharge || {};
    return {
      lastClaimDate: dc.lastClaimDate || null,
      careStreak: dc.careStreak || 0,
      bestCareStreak: dc.bestCareStreak || 0,
      totalCareDays: dc.totalCareDays || 0,
      lastNudgeDate: dc.lastNudgeDate || null,
      lastNotifDate: dc.lastNotifDate || null,
      lastMainShownDate: dc.lastMainShownDate || null,
      streakBonusAt: dc.streakBonusAt || 0,
      notifEnabled: dc.notifEnabled !== false,
    };
  }

  function persistState(partial) {
    const save = global.SaveManager.getSave();
    const next = { ...(save.dailyCharge || {}), ...partial };
    global.SaveManager.updateSection('dailyCharge', next);
    return next;
  }

  function claimedToday() {
    return getState().lastClaimDate === getTodayKey();
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getTodayKey(d);
  }

  function computeNextStreak(state) {
    const today = getTodayKey();
    if (state.lastClaimDate === today) return state.careStreak;
    if (state.lastClaimDate === yesterdayKey()) return state.careStreak + 1;
    return 1;
  }

  function renderBear(celebrate = false) {
    if (!els.bear) return;
    els.bear.classList.toggle('is-celebrating', celebrate);
    els.bear.innerHTML = `
      <span class="daily-charge-bear-emoji" aria-hidden="true">🐻</span>
      <span class="daily-charge-bear-prop" aria-hidden="true">🔋</span>
    `;
  }

  function setMessage(lines, asHtml = false) {
    if (!els.message) return;
    if (asHtml) {
      els.message.innerHTML = lines;
      return;
    }
    const arr = Array.isArray(lines) ? lines : [lines];
    els.message.innerHTML = arr.map((line) => `<p>${line}</p>`).join('');
  }

  function showOverlay(mode) {
    if (!els.overlay) return;
    els.overlay.dataset.mode = mode;
    els.overlay.classList.remove('hidden');
    els.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('daily-charge-open');
    global.AudioManager?.playUi?.(mode === 'nudge' ? 'reminder' : 'notify');
  }

  function hideOverlay() {
    if (!els.overlay) return;
    els.overlay.classList.add('hidden');
    els.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('daily-charge-open');
    celebrating = false;
    renderBear(false);
    if (els.rain) els.rain.innerHTML = '';
    els.rewards?.classList.add('hidden');
    els.dismiss?.classList.add('hidden');
    if (els.action) {
      els.action.disabled = false;
      els.action.classList.remove('hidden');
    }
  }

  function startHeartRain() {
    if (!els.rain) return;
    els.rain.innerHTML = '';
    const hearts = ['❤️', '💕', '💗', '✨'];
    for (let i = 0; i < 22; i++) {
      const h = document.createElement('div');
      h.className = 'rain-heart';
      h.textContent = hearts[i % hearts.length];
      h.style.left = `${Math.random() * 100}%`;
      h.style.animationDuration = `${2.8 + Math.random() * 3.5}s`;
      h.style.animationDelay = `${Math.random() * 2.5}s`;
      els.rain.appendChild(h);
    }
  }

  function showRewards(extraLines = []) {
    if (!els.rewards) return;
    const lines = [
      `<span class="daily-charge-reward-line">✨ +${REWARD_COINS} 🍫 chocolates</span>`,
      '<span class="daily-charge-reward-line">❤️ +1 día de cuidado</span>',
      ...extraLines,
    ];
    els.rewards.innerHTML = lines.join('');
    els.rewards.classList.remove('hidden');
  }

  function showMainMission() {
    renderBear(false);
    if (els.label) els.label.textContent = '🐻 Teddy:';
    setMessage(MSGS.main);
    if (els.action) {
      els.action.textContent = '🔌 Lo conecté a cargar';
      els.action.classList.remove('hidden');
      els.action.disabled = false;
    }
    if (els.notifBtn) {
      els.notifBtn.classList.toggle('hidden', Notification.permission === 'granted');
      if (Notification.permission !== 'granted' && els.notifBtn.querySelector('span')) {
        els.notifBtn.querySelector('span').textContent = '🔔 Notificaciones';
      }
    }
    showOverlay('main');
    persistState({ lastMainShownDate: getTodayKey() });
  }

  function showNudgeMission() {
    renderBear(false);
    if (els.label) els.label.textContent = '🐻';
    setMessage(MSGS.nudge);
    if (els.action) {
      els.action.textContent = '🔌 Lo conecté a cargar';
      els.action.classList.remove('hidden');
      els.action.disabled = false;
    }
    showOverlay('nudge');
    persistState({ lastNudgeDate: getTodayKey() });
  }

  function showThankYou(extraHtml = '') {
    renderBear(true);
    if (els.label) els.label.textContent = '🐻 Teddy:';
    setMessage(extraHtml || MSGS.thanks);
    if (els.action) els.action.classList.add('hidden');
    if (els.dismiss) els.dismiss.classList.remove('hidden');
    if (els.notifBtn) els.notifBtn.classList.add('hidden');
  }

  function onClaim() {
    if (claimedToday() || celebrating) return;
    celebrating = true;

    const state = getState();
    const today = getTodayKey();
    const nextStreak = computeNextStreak(state);
    const bestStreak = Math.max(state.bestCareStreak, nextStreak);
    const totalCareDays = state.totalCareDays + 1;

    let bonusCoins = 0;
    const prevBonusAt = state.streakBonusAt || 0;
    if (nextStreak >= STREAK_MILESTONE && nextStreak > prevBonusAt && nextStreak % STREAK_MILESTONE === 0) {
      bonusCoins = STREAK_BONUS_COINS;
    }

    persistState({
      lastClaimDate: today,
      careStreak: nextStreak,
      bestCareStreak: bestStreak,
      totalCareDays,
      streakBonusAt: bonusCoins ? nextStreak : prevBonusAt,
    });

    if (global.GameShop?.addCoins) {
      global.GameShop.addCoins(REWARD_COINS + bonusCoins);
    }

    global.GameMeta?.refreshAchievements?.();
    global.GameMeta?.sounds?.playMilestone?.();

    startHeartRain();
    renderBear(true);
    showRewards(
      bonusCoins
        ? [`<span class="daily-charge-reward-line streak-bonus">🏆 +${bonusCoins} 🍫 bono de racha!</span>`]
        : []
    );

    if (els.action) {
      els.action.disabled = true;
      els.action.classList.add('hidden');
    }
    if (els.notifBtn) els.notifBtn.classList.add('hidden');

    setTimeout(() => {
      if (bonusCoins) {
        setMessage([...MSGS.streak(nextStreak), '', MSGS.thanks]);
      } else {
        showThankYou();
      }
      if (els.dismiss) els.dismiss.classList.remove('hidden');
    }, bonusCoins ? 2200 : 1400);
  }

  async function syncRemotePush() {
    if (!global.PushNotifications?.subscribe) return null;
    try {
      return await global.PushNotifications.subscribe();
    } catch (_) {
      return null;
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in global)) return false;
    if (Notification.permission === 'granted') {
      persistState({ notifEnabled: true });
      registerServiceWorker();
      await syncRemotePush();
      updateIntroNotificationButton();
      return true;
    }
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      const ok = result === 'granted';
      persistState({ notifEnabled: ok });
      if (ok) {
        registerServiceWorker();
        await syncRemotePush();
        updateIntroNotificationButton();
      }
      return ok;
    } catch (_) {
      return false;
    }
  }

  function setIntroNotifHint(text, kind = '') {
    const hint = document.getElementById('intro-notif-hint');
    if (!hint) return;
    hint.textContent = text || '';
    hint.classList.toggle('hidden', !text);
    hint.classList.remove('is-success', 'is-error');
    if (kind) hint.classList.add(kind);
  }

  function getClosedBrowserLabel() {
    if (global.IosPushGuide?.isIOS?.()) {
      return '✅ Activas · incluso con Safari cerrado';
    }
    return '✅ Activas · también con Chrome cerrado';
  }

  function updateIntroNotificationButton() {
    const btn = document.getElementById('btn-intro-notifications');
    if (!btn) return;

    if (global.IosPushGuide?.needsHomeScreenInstall?.()) {
      btn.classList.remove('hidden', 'is-active', 'is-denied');
      btn.innerHTML = '<span>📲 Instalar en iPhone</span>';
      btn.disabled = false;
      setIntroNotifHint('Paso 1: añade el sitio a la pantalla de inicio.', 'is-error');
      return;
    }

    if (!('Notification' in global)) {
      btn.classList.add('hidden');
      setIntroNotifHint('');
      return;
    }

    btn.classList.remove('hidden', 'is-active', 'is-denied');

    if (Notification.permission === 'granted') {
      const push = global.PushNotifications?.getStatus?.();
      const remote = push?.remote;
      const label = remote ? getClosedBrowserLabel() : '✅ Activas';
      btn.innerHTML = `<span>${label}</span>`;
      btn.disabled = false;
      btn.classList.add('is-active');
      if (push?.reason === 'vapid_missing') {
        setIntroNotifHint('Push remoto pendiente: falta la clave VAPID en firebase-config.js.', 'is-error');
      } else if (push?.reason === 'ios_needs_install') {
        setIntroNotifHint('Abre la app desde el icono 🍒 en la pantalla de inicio.', 'is-error');
      } else if (push?.reason && !remote) {
        setIntroNotifHint('Solo avisos con el sitio abierto por ahora.', 'is-error');
      } else if (remote && push?.device === 'desktop') {
        setIntroNotifHint('Registrado en PC. Para recibir en el móvil, abre el sitio en el celular y pulsa 🔔 otra vez.', 'is-error');
      } else if (remote && push?.origin && !/github\.io/i.test(push.origin)) {
        setIntroNotifHint('Registrado en localhost. Abre github.io en el celular y activa 🔔 allí.', 'is-error');
      } else if (remote) {
        setIntroNotifHint('Toca 🔔 otra vez para registrar de nuevo. Luego cierra Chrome y prueba el push.', 'is-success');
      } else {
        setIntroNotifHint('');
      }
      return;
    }

    if (Notification.permission === 'denied') {
      btn.innerHTML = '<span>🔕 Bloqueadas</span>';
      btn.disabled = true;
      btn.classList.add('is-denied');
      setIntroNotifHint('Actívalas en los ajustes del navegador.', 'is-error');
      return;
    }

    btn.innerHTML = '<span>🔔 Notificaciones</span>';
    btn.disabled = false;
    setIntroNotifHint('');
  }

  async function waitForPushModule(maxMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (global.PushNotifications?.subscribe) return true;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  }

  async function handleIntroNotificationClick(btn) {
    if (global.IosPushGuide?.needsHomeScreenInstall?.()) {
      global.IosPushGuide.showInstallGuide();
      setIntroNotifHint('Sigue los pasos y abre desde el icono 🍒.', 'is-error');
      return;
    }

    if (!('Notification' in global)) {
      setIntroNotifHint('Tu navegador no soporta notificaciones.', 'is-error');
      return;
    }

    btn.disabled = true;
    setIntroNotifHint('Activando notificaciones…', '');

    try {
      if (Notification.permission === 'granted') {
        registerServiceWorker();
        const pushReady = await waitForPushModule();
        if (!pushReady) {
          setIntroNotifHint('Cargando módulo de push… vuelve a pulsar 🔔 en un segundo.', 'is-error');
          return;
        }
        await syncRemotePush();
        updateIntroNotificationButton();
        return;
      }

      if (Notification.permission === 'denied') {
        setIntroNotifHint('Actívalas en Ajustes → Notificaciones → Chrome.', 'is-error');
        updateIntroNotificationButton();
        return;
      }

      const ok = await requestNotificationPermission();
      updateIntroNotificationButton();

      if (ok) {
        setIntroNotifHint('¡Listo! También te avisaremos con el navegador cerrado.', 'is-success');
        return;
      }

      if (Notification.permission === 'denied') {
        setIntroNotifHint('Actívalas en Ajustes → Notificaciones → Chrome.', 'is-error');
      } else {
        setIntroNotifHint('No se pudo activar. Pulsa 🔔 otra vez.', 'is-error');
      }
    } catch (err) {
      console.warn('[DailyCharge] intro notif:', err);
      setIntroNotifHint('Error al activar. Pulsa 🔔 otra vez.', 'is-error');
    } finally {
      btn.disabled = false;
      updateIntroNotificationButton();
    }
  }

  function bindIntroNotificationButton() {
    const btn = document.getElementById('btn-intro-notifications');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    updateIntroNotificationButton();

    const onActivate = (e) => {
      e.preventDefault();
      e.stopPropagation();
      void handleIntroNotificationClick(btn);
    };

    btn.addEventListener('click', onActivate);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const swPath = typeof global.assetUrl === 'function'
      ? global.assetUrl('sw.js?v=7cbf9eb')
      : 'sw.js?v=7cbf9eb';
    navigator.serviceWorker.register(swPath).catch(() => {});
  }

  async function sendDailyNotification() {
    const state = getState();
    if (!state.notifEnabled) return false;
    if (state.lastNotifDate === getTodayKey()) return false;
    if (!('Notification' in global) || Notification.permission !== 'granted') return false;
    if (!isNotificationWindowOpen()) return false;

    const title = '❤️ Chocolate & Cereza';
    const body = 'Hora de poner el auto a cargar. El Chocolate te está esperando. 🔋🐻';
    const opts = {
      body,
      icon: 'assets/chocolate.png',
      badge: 'assets/cherry.png',
      tag: 'daily-charge-mission',
      renotify: true,
    };

    const markSent = () => persistState({ lastNotifDate: getTodayKey() });

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, opts);
        markSent();
        return true;
      }
    } catch (_) { /* fallback abaixo */ }

    try {
      new Notification(title, opts);
      markSent();
      return true;
    } catch (_) {
      return false;
    }
  }

  function maybeAutoShow() {
    void sendDailyNotification();

    if (document.documentElement.classList.contains('intro-lock')) return;
    if (!els.overlay || celebrating) return;
    if (claimedToday()) return;
    if (!els.overlay.classList.contains('hidden')) return;

    const state = getState();
    const today = getTodayKey();

    if (!isMissionWindowOpen()) return;

    if (isNudgeWindow()) {
      if (state.lastNudgeDate !== today) showNudgeMission();
      return;
    }

    if (state.lastMainShownDate !== today) showMainMission();
  }

  function tick() {
    maybeAutoShow();
  }

  function bindEvents() {
    els.action?.addEventListener('click', onClaim);
    els.dismiss?.addEventListener('click', hideOverlay);
    els.notifBtn?.addEventListener('click', async () => {
      const ok = await requestNotificationPermission();
      if (ok) els.notifBtn.classList.add('hidden');
      updateIntroNotificationButton();
    });

    document.addEventListener('visibilitychange', tick);
    global.addEventListener('focus', tick);
  }

  function cacheElements() {
    els = {
      overlay: document.getElementById('daily-charge-overlay'),
      rain: document.getElementById('daily-charge-rain'),
      bear: document.getElementById('daily-charge-bear'),
      label: document.getElementById('daily-charge-label'),
      message: document.getElementById('daily-charge-message'),
      rewards: document.getElementById('daily-charge-rewards'),
      action: document.getElementById('daily-charge-action'),
      dismiss: document.getElementById('daily-charge-dismiss'),
      notifBtn: document.getElementById('daily-charge-notif-btn'),
    };
  }

  function startEarlyNotificationWatch() {
    if (earlyWatchTimer || !global.SaveManager) return;
    registerServiceWorker();
    try {
      const qs = new URLSearchParams(global.location?.search || '');
      if (qs.get('dailyCharge') === 'notif' && qs.get('force') === '1') {
        persistState({ lastNotifDate: null });
        setTimeout(() => { void sendDailyNotification(); }, 400);
      }
    } catch (_) { /* ignore */ }
    const run = () => { void sendDailyNotification(); };
    run();
    earlyWatchTimer = setInterval(run, 10000);
  }

  function init() {
    if (inited || !global.SaveManager) return;
    cacheElements();
    if (!els.overlay) return;
    inited = true;

    bindEvents();
    registerServiceWorker();

    if (Notification.permission === 'granted') {
      persistState({ notifEnabled: true });
      registerServiceWorker();
    }

    updateIntroNotificationButton();

    tick();
    tickTimer = setInterval(tick, 15000);

    try {
      const qs = new URLSearchParams(global.location?.search || '');
      const mode = qs.get('dailyCharge');
      const force = mode === 'preview' || qs.get('force') === '1';
      if (mode === 'notif' && force) {
        persistState({ lastNotifDate: null });
        setTimeout(() => { void sendDailyNotification(); }, 400);
      }
      if ((mode === '1' || mode === 'preview') && (force || !claimedToday())) {
        setTimeout(showMainMission, 600);
      }
    } catch (_) { /* ignore */ }
  }

  global.DailyChargeMission = {
    init,
    startEarlyNotificationWatch,
    bindIntroNotificationButton,
    requestNotificationPermission,
    updateIntroNotificationButton,
    sendDailyNotification,
    getTodayKey,
    getState,
    claimedToday,
    TIMEZONE,
  };

  function bootIntroNotifications() {
    bindIntroNotificationButton();
    updateIntroNotificationButton();
  }

  if (global.SaveManager) {
    startEarlyNotificationWatch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootIntroNotifications);
  } else {
    bootIntroNotifications();
  }
})(typeof window !== 'undefined' ? window : globalThis);
