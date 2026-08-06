/**
 * CoupleHub — Central do Casal (agenda, calendário, cartinhas, memórias…)
 * Sincroniza via Firebase quando em sala; fallback local via SaveManager.
 */
(function (global) {
  'use strict';

  const HS = global.HubShared || {};
  const DAILY_MISSION_DEFS = HS.DAILY_MISSION_DEFS || [];
  const todayDateKeyInTz = HS.todayDateKeyInTz || function () { return ''; };
  const daysBetween = HS.daysBetween || function () { return null; };
  const daysUntil = HS.daysUntil || function () { return null; };
  const createDefaultHubData = HS.createDefaultHubData || function () { return {}; };

  const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const els = {};
/** @type {import('./cloud-manager.js').default | null} */
let CloudManager = null;
/** @type {(() => void) | null} */
let unsubscribeHub = null;
/** @type {(() => void) | null} */
let unsubscribePersonalLetters = null;
/** @type {'local' | 'cloud'} */
let mode = 'local';

/** @type {Set<string>} */
let knownLetterIds = new Set();
/** @type {boolean} */
let lettersInboxReady = false;

/** @type {{ settings: object, tasks: object[], events: object[], letters: object[], memories: object[] }} */
let hubState = {
  settings: createDefaultHubData(),
  tasks: [],
  events: [],
  letters: [],
  memories: [],
};

let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let selectedDate = null;
let activeTab = 'nossa-casa';
let reminderTimer = null;

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function localId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readIdentity() {
  try {
    const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        id: typeof parsed.id === 'string' ? parsed.id : '',
        name: typeof parsed.name === 'string' ? parsed.name.trim() : '',
      };
    }
  } catch (_) { /* ignore */ }
  try {
    return {
      id: localStorage.getItem('ChocolateCerezaPlayerId') || '',
      name: (localStorage.getItem('ChocolateCerezaPlayerName') || '').trim(),
    };
  } catch (_) { /* ignore */ }
  return { id: '', name: '' };
}

function getPlayerName() {
  const fromInput = document.getElementById('couple-player-name')?.value?.trim();
  if (fromInput) return fromInput;

  const identity = readIdentity();
  if (identity.name) return identity.name;

  try {
    const local = global.CloudManager?.getLocalPlayer?.();
    if (local?.name) return local.name;
  } catch (_) { /* ignore */ }

  return 'Jugador';
}

function getPlayerId() {
  const identity = readIdentity();
  if (identity.id) return identity.id;

  try {
    const local = global.CloudManager?.getLocalPlayer?.();
    if (local?.id) return local.id;
  } catch (_) { /* ignore */ }

  return 'local_player';
}

function normalizeUsernameInput(input) {
  return String(input || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]/g, '').slice(0, 16);
}

async function resolvePartnerTarget(toNameOverride = '', options = {}) {
  const strict = !!options.strict;
  const cm = CloudManager || global.CloudManager;
  if (!cm) return null;

  const tryResolve = async (raw) => {
    const u = normalizeUsernameInput(raw);
    if (!u || u.length < 3) return null;
    try {
      const res = await cm.resolveUsernameToPlayerId?.(u);
      const playerId = res?.playerId || res?.room?.playerId;
      if (res?.success && playerId) return { id: playerId, name: `@${u}` };
      if (!res?.success && res?.message) {
        return { error: res.message, username: `@${u}` };
      }
    } catch (_) { /* ignore */ }
    return null;
  };

  const override = await tryResolve(toNameOverride);
  if (override?.id) return override;
  if (strict) {
    if (override?.error) return override;
    const u = normalizeUsernameInput(toNameOverride);
    return u ? { error: 'NOT_FOUND', username: `@${u}` } : null;
  }

  try {
    const partner = cm.getPartnerPlayer?.();
    if (partner?.id) return { id: partner.id, name: partner.name || getPartnerName() };
  } catch (_) { /* ignore */ }

  const saved = hubState.settings?.partnerUsername;
  const fromSaved = await tryResolve(saved);
  if (fromSaved?.id) return fromSaved;

  const pn = getPartnerName();
  if (pn.startsWith('@')) {
    const fromPartner = await tryResolve(pn.slice(1));
    if (fromPartner?.id) return fromPartner;
  }

  return null;
}

function getPartnerName() {
  try {
    const partner = global.CloudManager?.getPartnerPlayer?.();
    if (partner?.name) return partner.name;

    const room = global.CloudManager?.getCurrentRoom?.();
    const localId = getPlayerId();
    const other = room?.players?.find((p) => p.id !== localId);
    if (other?.name) return other.name;
  } catch (_) { /* ignore */ }

  const nick = hubState.settings?.partnerNickname;
  if (typeof nick === 'string' && nick.trim()) return nick.trim();

  return 'Mi amor';
}

function formatLetterHeading(letter) {
  const from = (letter?.fromName || '').trim() || 'Alguien';
  const to = (letter?.toName || '').trim();
  if (to) return `${from} para ${to}`;
  return from;
}

function readLocalHub() {
  SaveManager.init();
  const save = SaveManager.getSave();
  const hub = save.coupleHub || {};
  return {
    settings: { ...createDefaultHubData(), ...(hub.settings || {}) },
    tasks: Array.isArray(hub.tasks) ? hub.tasks.slice() : [],
    events: Array.isArray(hub.events) ? hub.events.slice() : [],
    letters: Array.isArray(hub.letters) ? hub.letters.slice() : [],
    memories: Array.isArray(hub.memories) ? hub.memories.slice() : [],
  };
}

function writeLocalHub(state) {
  SaveManager.init();
  SaveManager.updateSection('coupleHub', {
    settings: state.settings,
    tasks: state.tasks,
    events: state.events,
    letters: state.letters,
    memories: state.memories,
  });
}

function applyHubPayload(payload) {
  if (!payload || payload.type !== 'hub_updated') return;
  hubState = {
    settings: payload.settings || createDefaultHubData(),
    tasks: payload.tasks || [],
    events: payload.events || [],
    letters: payload.letters || [],
    memories: payload.memories || [],
  };
  writeLocalHub(hubState);
  renderAll();
}

async function loadCloudManager() {
  if (global.__FILE_PROTOCOL__) return null;
  if (CloudManager) return CloudManager;
  if (global.CloudManager) {
    CloudManager = global.CloudManager;
    await CloudManager.whenSessionReady?.();
    return CloudManager;
  }
  try {
    const mod = await import('./cloud-manager.js?v=__APP_VERSION__');
    CloudManager = mod.default || mod.CloudManager;
    await CloudManager.whenSessionReady?.();
    return CloudManager;
  } catch (err) {
    console.warn('[CoupleHub] Cloud indisponível:', err);
    return null;
  }
}

async function detectMode() {
  const cm = await loadCloudManager();
  const playerId = getPlayerId();
  const hasCloudIdentity = playerId && playerId !== 'local_player' && cm?.isConnected?.();
  if (hasCloudIdentity || cm?.getCurrentRoom?.()) {
    mode = 'cloud';
    return;
  }
  mode = 'local';
  hubState = readLocalHub();
}

function setSyncBadge() {
  if (!els.syncBadge) return;
  if (mode === 'cloud') {
    const room = CloudManager?.getCurrentRoom?.();
    els.syncBadge.textContent = room
      ? `📬 Buzón directo · sala ${room.code} (solo juego)`
      : '📬 Buzón directo · sin sala';
    els.syncBadge.classList.add('is-cloud');
  } else {
    els.syncBadge.textContent = '📱 Solo en este dispositivo — conecta tu cuenta para cartas directas';
    els.syncBadge.classList.remove('is-cloud');
  }
}

function switchTab(tab) {
  activeTab = tab;
  els.tabBtns?.forEach((btn) => {
    const on = btn.dataset.hubTab === tab;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  els.panels?.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.hubPanel !== tab);
  });
  global.dispatchEvent(new CustomEvent('hub:tab-changed', { detail: { tab } }));
}

function openHubTab(tab) {
  switchTab(tab);
  els.root?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTasks() {
  if (!els.taskList) return;
  const tasks = [...hubState.tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!tasks.length) {
    els.taskList.innerHTML = '<li class="hub-empty">Ninguna tarea todavía.</li>';
    return;
  }
  els.taskList.innerHTML = tasks.map((task) => {
    const checked = task.done ? 'checked' : '';
    const doneClass = task.done ? ' is-done' : '';
    return `<li class="hub-task-item${doneClass}" data-task-id="${escapeHtml(task.id)}">
      <label class="hub-task-label">
        <input type="checkbox" class="hub-task-check" data-task-id="${escapeHtml(task.id)}" ${checked}>
        <span class="hub-task-text">${escapeHtml(task.emoji || '✓')} ${escapeHtml(task.text)}</span>
      </label>
      <button type="button" class="hub-icon-btn hub-task-del" data-task-id="${escapeHtml(task.id)}" aria-label="Eliminar">🗑</button>
    </li>`;
  }).join('');
}

function updateLetterRouteHint() {
  const from = getPlayerName();
  const toField = els.letterToInput?.value?.trim() || hubState.settings?.partnerUsername || '';
  const to = toField ? (toField.startsWith('@') ? toField : `@${toField}`) : getPartnerName();
  if (els.letterRoute) {
    els.letterRoute.textContent = `${from} para ${to}`;
  }
}

function showLetterToast(letter) {
  const toast = document.getElementById('letter-toast');
  const textEl = document.getElementById('letter-toast-text');
  if (!toast || !textEl) return;
  const from = (letter.fromName || 'Alguien').replace(/^@+/, '@');
  const preview = (letter.text || '').trim();
  const body = preview.length > 64 ? `${preview.slice(0, 61)}…` : preview;
  textEl.textContent = body ? `💌 ${from}: ${body}` : `💌 Nueva cartita de ${from}`;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  clearTimeout(showLetterToast._t);
  showLetterToast._t = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 450);
  }, 5200);
  toast.onclick = () => {
    document.getElementById('section-couple-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    openHubTab('nossa-casa');
    global.NossaCasa?.enterRoom?.('correio');
    toast.classList.remove('show');
    toast.classList.add('hidden');
  };
}

function notifyIncomingLetters(incoming) {
  const myId = getPlayerId();
  (incoming || []).forEach((letter) => {
    if (letter.toPlayerId && letter.toPlayerId !== myId) return;
    if (knownLetterIds.has(letter.id)) return;
    knownLetterIds.add(letter.id);
    if (!lettersInboxReady) return;
    showLetterToast(letter);
    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch (_) { /* ignore */ }
  });
}

async function refreshPersonalLetters() {
  if (mode !== 'cloud' || !CloudManager) return;
  try {
    const res = await CloudManager.fetchPersonalLetters();
    if (res?.success) {
      hubState.letters = res.letters || res.room?.letters || [];
      writeLocalHub(hubState);
      renderLetters();
      global.NossaCasa?.refresh?.();
    }
  } catch (err) {
    console.warn('[CoupleHub] fetchPersonalLetters:', err);
  }
}

async function startPersonalLettersSync() {
  if (unsubscribePersonalLetters) {
    unsubscribePersonalLetters();
    unsubscribePersonalLetters = null;
  }
  if (mode !== 'cloud' || !CloudManager) return;

  await refreshPersonalLetters();
  (hubState.letters || []).forEach((l) => knownLetterIds.add(l.id));
  lettersInboxReady = true;

  unsubscribePersonalLetters = CloudManager.subscribePersonalLetters(async (incoming) => {
    notifyIncomingLetters(incoming);
    await refreshPersonalLetters();
  });
}

function renderLetters() {
  if (!els.letterList) return;
  const letters = [...hubState.letters].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!letters.length) {
    els.letterList.innerHTML = '<p class="hub-empty">Ninguna cartita todavía. Escribe la primera ❤️</p>';
    return;
  }
  els.letterList.innerHTML = letters.map((letter) => {
    const when = letter.createdAt ? new Date(letter.createdAt).toLocaleString('es') : '';
    const photoSrc = global.ImageUpload?.safeSrc?.(letter.photoUrl) || '';
    const photo = photoSrc
      ? `<img src="${escapeHtml(photoSrc)}" alt="" class="hub-letter-photo" loading="lazy">`
      : '';
    return `<article class="hub-letter-card" data-letter-id="${escapeHtml(letter.id)}">
      <header class="hub-letter-head">
        <strong>${escapeHtml(formatLetterHeading(letter))}</strong>
        <div class="hub-letter-head-actions">
          <time>${escapeHtml(when)}</time>
          <button type="button" class="hub-icon-btn hub-letter-del" data-letter-id="${escapeHtml(letter.id)}" aria-label="Eliminar cartita" title="Eliminar">🗑</button>
        </div>
      </header>
      <p>${escapeHtml(letter.text)}</p>
      ${photo}
    </article>`;
  }).join('');
}

function renderMemories() {
  if (!els.memoryGrid) return;
  const memories = [...hubState.memories].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!memories.length) {
    els.memoryGrid.innerHTML = '<p class="hub-empty">Añade fotos favoritas 📸</p>';
    return;
  }
  els.memoryGrid.innerHTML = memories.map((mem) => {
    const imgSrc = global.ImageUpload?.safeSrc?.(mem.imageUrl) || '';
    const img = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" alt="" loading="lazy">`
      : '<div class="hub-memory-placeholder">📷</div>';
    return `<figure class="hub-memory-card" data-memory-id="${escapeHtml(mem.id)}">
      ${img}
      <figcaption>${escapeHtml(mem.title || 'Recuerdo')}</figcaption>
      <button type="button" class="hub-icon-btn hub-memory-del" data-memory-id="${escapeHtml(mem.id)}" aria-label="Eliminar">🗑</button>
    </figure>`;
  }).join('');
}

function renderCounter() {
  if (!els.counterTogether || !els.counterMeeting) return;
  const { relationshipStart, nextMeetingDate } = hubState.settings;
  const together = daysBetween(relationshipStart);
  if (together !== null) {
    els.counterTogether.innerHTML = `<span class="hub-counter-num">❤️ ${together.toLocaleString('es')}</span><span class="hub-counter-label">días juntos</span>`;
  } else {
    els.counterTogether.innerHTML = '<span class="hub-counter-hint">Define la fecha en que empezaron 💕</span>';
  }

  const until = daysUntil(nextMeetingDate);
  if (until !== null && until >= 0) {
    els.counterMeeting.innerHTML = `<span class="hub-counter-num">⏳ ${until}</span><span class="hub-counter-label">${until === 1 ? 'día' : 'días'} para nuestro encuentro</span>`;
  } else if (until !== null && until < 0) {
    els.counterMeeting.innerHTML = '<span class="hub-counter-hint">El encuentro ya pasó — marquen el próximo ✈️</span>';
  } else {
    els.counterMeeting.innerHTML = '<span class="hub-counter-hint">Marquen la fecha del próximo encuentro</span>';
  }

  if (els.inputRelationshipStart) els.inputRelationshipStart.value = relationshipStart || '';
  if (els.inputNextMeeting) els.inputNextMeeting.value = nextMeetingDate || '';
}

function renderMissions() {
  if (!els.missionList) return;
  const tz = hubState.settings.chargeReminder?.timezone || 'America/New_York';
  const dateKey = todayDateKeyInTz(tz);
  const dm = hubState.settings.dailyMissions || { dateKey: '', completed: [] };
  const completed = dm.dateKey === dateKey ? new Set(dm.completed || []) : new Set();

  els.missionList.innerHTML = DAILY_MISSION_DEFS.map((m) => {
    const done = completed.has(m.id);
    return `<li class="hub-mission-item${done ? ' is-done' : ''}">
      <label>
        <input type="checkbox" class="hub-mission-check" data-mission-id="${escapeHtml(m.id)}" ${done ? 'checked disabled' : ''}>
        <span>${escapeHtml(m.emoji)} ${escapeHtml(m.text)}</span>
        <small>+${m.reward} 🍫</small>
      </label>
    </li>`;
  }).join('');
}

function renderReminder() {
  const cr = hubState.settings.chargeReminder || createDefaultHubData().chargeReminder;
  if (els.reminderEnabled) els.reminderEnabled.checked = cr.enabled !== false;
  if (els.reminderTime) els.reminderTime.value = cr.time || '20:30';
  if (els.reminderTz) els.reminderTz.value = cr.timezone || 'America/New_York';
  scheduleReminderCheck();
}

function renderCalendar() {
  if (!els.calGrid || !els.calTitle) return;
  els.calTitle.textContent = `${MONTH_NAMES[calendarMonth]} ${calendarYear}`;

  const first = new Date(calendarYear, calendarMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const eventsByDate = {};
  hubState.events.forEach((ev) => {
    if (!ev.date) return;
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  let html = '';
  for (let i = 0; i < startDay; i++) {
    html += '<div class="hub-cal-cell is-empty"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const evs = eventsByDate[iso] || [];
    const hasEvent = evs.length > 0;
    const selected = selectedDate === iso ? ' is-selected' : '';
    const dots = evs.slice(0, 3).map((e) => `<span class="hub-cal-dot" title="${escapeHtml(e.title)}">${escapeHtml(e.emoji || '•')}</span>`).join('');
    html += `<button type="button" class="hub-cal-cell${hasEvent ? ' has-event' : ''}${selected}" data-cal-date="${iso}">
      <span class="hub-cal-day">${day}</span>
      <span class="hub-cal-dots">${dots}</span>
    </button>`;
  }
  els.calGrid.innerHTML = html;
  renderDayPanel();
}

function renderDayPanel() {
  if (!els.dayPanel) return;
  if (!selectedDate) {
    els.dayPanel.innerHTML = '<p class="hub-empty">Toca un día para ver o añadir eventos.</p>';
    return;
  }
  const events = hubState.events.filter((e) => e.date === selectedDate);
  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const list = events.length
    ? events.map((ev) => `<div class="hub-day-event" data-event-id="${escapeHtml(ev.id)}">
        <span>${escapeHtml(ev.emoji)} ${escapeHtml(ev.title)}</span>
        <div class="hub-day-event-actions">
          <button type="button" class="hub-icon-btn hub-event-edit" data-event-id="${escapeHtml(ev.id)}">📝</button>
          <button type="button" class="hub-icon-btn hub-event-del" data-event-id="${escapeHtml(ev.id)}">🗑</button>
        </div>
      </div>`).join('')
    : '<p class="hub-empty">Ningún evento en este día.</p>';

  els.dayPanel.innerHTML = `
    <h4 class="hub-day-title">${escapeHtml(dateLabel)}</h4>
    ${list}
    <button type="button" class="couple-btn couple-btn-small couple-btn-primary hub-add-event-btn">➕ Añadir evento</button>
  `;
}

function renderAll() {
  setSyncBadge();
  renderTasks();
  renderCalendar();
  renderLetters();
  renderMemories();
  renderCounter();
  renderMissions();
  renderReminder();
  updateLetterRouteHint();
  if (els.letterToInput && hubState.settings?.partnerUsername && !els.letterToInput.value.trim()) {
    els.letterToInput.value = `@${hubState.settings.partnerUsername}`;
    updateLetterRouteHint();
  }
  global.dispatchEvent(new CustomEvent('hub:updated', { detail: { state: hubState, mode } }));
  global.NossaCasa?.refresh?.();
}

function getHubState() {
  return { ...hubState, mode };
}

async function persistSettings(partial) {
  hubState.settings = { ...hubState.settings, ...partial };
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.updateHubDataSettings(partial);
  } else {
    writeLocalHub(hubState);
    renderAll();
  }
}

async function addTask(text, emoji, extra) {
  extra = extra || {};
  const payload = {
    text: text.trim(),
    emoji: emoji || '✓',
    order: hubState.tasks.length,
    priority: extra.priority || 'normal',
  };
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.createHubTask(payload);
    return;
  }
  hubState.tasks.push({ id: localId('task'), done: false, ...payload });
  writeLocalHub(hubState);
  renderTasks();
}

async function toggleTask(taskId, done) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.setHubTaskDone(taskId, done, getPlayerName());
    return;
  }
  const task = hubState.tasks.find((t) => t.id === taskId);
  if (task) {
    task.done = done;
    task.doneBy = done ? getPlayerName() : null;
    writeLocalHub(hubState);
    renderTasks();
    if (done) logGardenAction('task');
  }
}

async function removeTask(taskId) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.removeHubTask(taskId);
    return;
  }
  hubState.tasks = hubState.tasks.filter((t) => t.id !== taskId);
  writeLocalHub(hubState);
  renderTasks();
}

async function addEvent(data) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.createHubEvent(data, getPlayerName());
    return;
  }
  hubState.events.push({ id: localId('ev'), createdAt: Date.now(), createdBy: getPlayerName(), ...data });
  writeLocalHub(hubState);
  renderCalendar();
}

async function patchEvent(eventId, partial) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.patchHubEvent(eventId, partial);
    return;
  }
  const ev = hubState.events.find((e) => e.id === eventId);
  if (ev) Object.assign(ev, partial);
  writeLocalHub(hubState);
  renderCalendar();
}

async function removeEvent(eventId) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.removeHubEvent(eventId);
    return;
  }
  hubState.events = hubState.events.filter((e) => e.id !== eventId);
  writeLocalHub(hubState);
  renderCalendar();
}

async function addLetter(text) {
  await addLetterExtended({ text, type: 'inbox' });
}

async function addLetterExtended(opts) {
  const toField = (opts.toName || els.letterToInput?.value || '').trim();
  const hasExplicitTo = !!toField;
  const letter = {
    fromPlayerId: getPlayerId(),
    fromName: getPlayerName(),
    toName: toField || getPartnerName(),
    text: (opts.text || '').trim(),
    type: opts.type || 'inbox',
    deliverDate: opts.deliverDate || null,
    openAfter: opts.openAfter || null,
    photoUrl: opts.photoUrl || '',
    audioUrl: opts.audioUrl || '',
    reactions: opts.reactions || {},
  };

  if (!letter.text && !letter.photoUrl) {
    showHubToast('Escribe algo o adjunta una foto 💌');
    return false;
  }

  if (!CloudManager || mode !== 'cloud' || !CloudManager.isConnected?.()) {
    showHubToast('Conecta tu cuenta en 👥 Amigos (crea tu @usuario) para enviar cartas.');
    return false;
  }

  const target = await resolvePartnerTarget(toField || letter.toName, { strict: hasExplicitTo });
  if (!target?.id) {
    if (target?.username || hasExplicitTo) {
      const who = target?.username || `@${normalizeUsernameInput(toField)}`;
      showHubToast(`Usuario ${who} no encontrado — debe crear su @ en Amigos.`);
    } else {
      showHubToast('Indica el @usuario de la persona (ej: cherry) 💌');
    }
    return false;
  }

  letter.toName = target.name || letter.toName;
  if (target.name?.startsWith('@')) {
    hubState.settings.partnerUsername = target.name.replace(/^@+/, '');
    await persistSettings({ partnerUsername: hubState.settings.partnerUsername });
  }

  try {
    const res = await CloudManager.sendPersonalLetter(target.id, letter);
    if (res?.success) {
      logGardenAction('letter');
      global.AudioManager?.playUi?.('letter');
      global.NossaCasa?.logActivity?.('letter', getPlayerName());
      await refreshPersonalLetters();
      global.NossaCasa?.refresh?.();
      showHubToast(`Carta enviada a ${letter.toName} 💌`);
      return { ok: true, toName: letter.toName };
    }
    console.warn('[CoupleHub] sendPersonalLetter:', res?.error, res?.message);
    showHubToast(res?.message || 'No se pudo enviar la carta.');
  } catch (err) {
    console.warn('[CoupleHub] sendPersonalLetter failed:', err);
    showHubToast('Error al enviar la carta.');
  }
  return false;
}

async function removeLetter(letterId) {
  if (!letterId) return false;
  if (!global.confirm('¿Eliminar esta cartita?')) return false;

  if (mode === 'cloud' && CloudManager) {
    try {
      const res = await CloudManager.removePersonalLetter(letterId);
      if (res?.success) {
        hubState.letters = hubState.letters.filter((l) => l.id !== letterId);
        writeLocalHub(hubState);
        renderLetters();
        global.NossaCasa?.refresh?.();
        return true;
      }
    } catch (err) {
      console.warn('[CoupleHub] removePersonalLetter failed:', err);
    }
  }

  hubState.letters = hubState.letters.filter((l) => l.id !== letterId);
  writeLocalHub(hubState);
  renderLetters();
  global.NossaCasa?.refresh?.();
  return true;
}

async function reactToLetter(letterId, emoji) {
  const letter = hubState.letters.find((l) => l.id === letterId);
  if (!letter) return;
  const reactions = { ...(letter.reactions || {}) };
  reactions[getPlayerId()] = emoji;
  if (mode === 'cloud' && CloudManager) {
    /* letters are append-only in cloud — patch via re-write settings or local merge on sync */
    letter.reactions = reactions;
    writeLocalHub(hubState);
  } else {
    letter.reactions = reactions;
    writeLocalHub(hubState);
  }
  renderAll();
}

function getVisibleLetters(letters) {
  const now = Date.now();
  return (letters || []).filter((l) => {
    if (l.type === 'scheduled' && l.deliverDate) {
      return new Date(l.deliverDate + 'T08:00:00').getTime() <= now;
    }
    if (l.type === 'capsule' && l.openAfter) {
      return new Date(l.openAfter + 'T00:00:00').getTime() <= now;
    }
    if (l.type === 'scheduled' || l.type === 'capsule') {
      return false;
    }
    return true;
  });
}

function getInboxLetters(letters) {
  const myId = getPlayerId();
  return getVisibleLetters(letters).filter((l) => {
    if (myId && myId !== 'local_player' && l.toPlayerId) {
      return l.toPlayerId === myId;
    }
    return true;
  });
}

function getSentLetters(letters) {
  const myId = getPlayerId();
  return getVisibleLetters(letters).filter((l) => {
    if (myId && myId !== 'local_player' && l.fromPlayerId) {
      return l.fromPlayerId === myId;
    }
    return false;
  });
}

function getNossaCasaMeta() {
  SaveManager.init();
  const save = SaveManager.getSave();
  return save.nossaCasa || {};
}

function readNossaCasa() {
  SaveManager.init();
  return SaveManager.getSave().nossaCasa || {};
}

function writeNossaCasa(partial) {
  SaveManager.updateSection('nossaCasa', partial);
}

function recordVisit() {
  const nc = readNossaCasa();
  const today = new Date().toISOString().slice(0, 10);
  let streak = nc.fireplaceStreak || 0;
  const last = nc.lastVisitDate;
  if (last === today) {
    writeNossaCasa({ lastVisitDate: today });
    return streak;
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (last === yesterday) streak += 1;
  else streak = 1;
  writeNossaCasa({ lastVisitDate: today, fireplaceStreak: streak });
  logGardenAction('visit');
  return streak;
}

function logGardenAction(actionKey) {
  const HS = global.HubShared || {};
  const def = HS.GARDEN_ACTIONS?.[actionKey];
  if (!def) return;
  const nc = readNossaCasa();
  const log = Array.isArray(nc.gardenLog) ? nc.gardenLog.slice() : [];
  const today = new Date().toISOString().slice(0, 10);
  log.push({ action: actionKey, emoji: def.emoji, label: def.label, date: today, at: Date.now() });
  if (log.length > 200) log.splice(0, log.length - 200);
  writeNossaCasa({ gardenLog: log });
}

function getFireplaceLevel() {
  const streak = readNossaCasa().fireplaceStreak || 0;
  if (streak >= 30) return 5;
  if (streak >= 14) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  if (streak >= 1) return 1;
  return 0;
}

async function addMemory(title, imageUrl) {
  if (mode === 'cloud' && CloudManager) {
    try {
      const res = await CloudManager.createHubMemory({ title, imageUrl });
      if (res?.success) {
        global.NossaCasa?.refresh?.();
        return true;
      }
      console.warn('[CoupleHub] createHubMemory:', res?.error);
    } catch (err) {
      console.warn('[CoupleHub] createHubMemory failed:', err);
    }
  }
  hubState.memories.unshift({ id: localId('mem'), title, imageUrl, createdAt: Date.now() });
  writeLocalHub(hubState);
  renderMemories();
  global.NossaCasa?.refresh?.();
  return true;
}

async function removeMemory(memoryId) {
  if (mode === 'cloud' && CloudManager) {
    await CloudManager.removeHubMemory(memoryId);
    return;
  }
  hubState.memories = hubState.memories.filter((m) => m.id !== memoryId);
  writeLocalHub(hubState);
  renderMemories();
}

async function completeMission(missionId) {
  const tz = hubState.settings.chargeReminder?.timezone || 'America/New_York';
  const dateKey = todayDateKeyInTz(tz);
  const def = DAILY_MISSION_DEFS.find((m) => m.id === missionId);
  if (!def) return;

  if (mode === 'cloud' && CloudManager) {
    const res = await CloudManager.completeHubMission(dateKey, missionId, hubState.settings);
    if (res.success) {
      rewardMission(def.reward);
    }
    return;
  }

  const dm = hubState.settings.dailyMissions || { dateKey: '', completed: [] };
  let completed = dm.dateKey === dateKey ? [...(dm.completed || [])] : [];
  if (completed.includes(missionId)) return;
  completed.push(missionId);
  hubState.settings.dailyMissions = { dateKey, completed };
  writeLocalHub(hubState);
  rewardMission(def.reward);
  renderMissions();
}

function rewardMission(amount) {
  if (window.GameShop?.addCoins) {
    window.GameShop.addCoins(amount);
  }
  showHubToast(`¡Misión completada! +${amount} 🍫`);
}

function showHubToast(msg) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(showHubToast._t);
  showHubToast._t = setTimeout(() => els.toast?.classList.add('hidden'), 3500);
}

function promptEvent(existing) {
  const title = window.prompt('Título del evento:', existing?.title || '');
  if (title === null) return null;
  const emoji = window.prompt('Emoji (opcional):', existing?.emoji || '❤️') || '❤️';
  const note = window.prompt('Nota (opcional):', existing?.note || '') || '';
  return { title: title.trim(), emoji, note };
}

function scheduleReminderCheck() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkReminder, 10000);
  checkReminder();
}

function checkReminder() {
  const cr = hubState.settings.chargeReminder;
  if (!cr?.enabled) return;
  const tz = cr.timezone || 'America/New_York';
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = {};
  fmt.formatToParts(now).forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  const nowMins = Number(parts.hour) * 60 + Number(parts.minute);
  const targetParts = (cr.time || '20:30').slice(0, 5).split(':');
  const targetMins = Number(targetParts[0]) * 60 + Number(targetParts[1] || 0);
  const dateKey = todayDateKeyInTz(tz);
  const flagKey = `hubReminder_${dateKey}_${cr.time || '20:30'}`;
  if (nowMins >= targetMins && nowMins < targetMins + 60 && !sessionStorage.getItem(flagKey)) {
    sessionStorage.setItem(flagKey, '1');
    showHubToast('❤️ Chocolate & Cereza — Hora de cargar el auto. 🔋🐻');
    if (Notification?.permission === 'granted') {
      try {
        new Notification('Chocolate & Cereza 🔋', {
          body: 'Hora de poner el auto a cargar. 🔋🐻',
          icon: 'assets/cherry.png',
        });
      } catch (_) { /* ignore */ }
    }
  }
}

function bindEvents() {
  els.tabBtns?.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.hubTab || 'agenda'));
  });

  document.querySelectorAll('[data-hub-open]').forEach((btn) => {
    btn.addEventListener('click', () => openHubTab(btn.getAttribute('data-hub-open') || 'agenda'));
  });

  document.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-scroll');
      const target = id ? document.getElementById(id) : null;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  els.taskForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.taskInput?.value?.trim();
    if (!text) return;
    const emoji = els.taskEmoji?.value?.trim() || '✓';
    await addTask(text, emoji);
    if (els.taskInput) els.taskInput.value = '';
    if (els.taskEmoji) els.taskEmoji.value = '';
  });

  els.taskList?.addEventListener('change', async (e) => {
    const t = e.target;
    if (!t.classList?.contains('hub-task-check')) return;
    await toggleTask(t.dataset.taskId, t.checked);
  });

  els.taskList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.hub-task-del');
    if (!btn) return;
    await removeTask(btn.dataset.taskId);
  });

  els.calPrev?.addEventListener('click', () => {
    calendarMonth -= 1;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear -= 1; }
    renderCalendar();
  });

  els.calNext?.addEventListener('click', () => {
    calendarMonth += 1;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear += 1; }
    renderCalendar();
  });

  els.calGrid?.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-cal-date]');
    if (!cell) return;
    selectedDate = cell.dataset.calDate;
    renderDayPanel();
  });

  els.dayPanel?.addEventListener('click', async (e) => {
    if (e.target.closest('.hub-add-event-btn')) {
      if (!selectedDate) return;
      const data = promptEvent(null);
      if (!data?.title) return;
      await addEvent({ ...data, date: selectedDate });
      return;
    }
    const editBtn = e.target.closest('.hub-event-edit');
    if (editBtn) {
      const ev = hubState.events.find((x) => x.id === editBtn.dataset.eventId);
      const data = promptEvent(ev);
      if (!data?.title) return;
      await patchEvent(editBtn.dataset.eventId, data);
      return;
    }
    const delBtn = e.target.closest('.hub-event-del');
    if (delBtn) {
      await removeEvent(delBtn.dataset.eventId);
    }
  });

  els.letterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = els.letterInput?.value?.trim();
    let photoUrl = '';
    const file = els.letterFile?.files?.[0];
    if (file) {
      const prepared = await global.ImageUpload?.prepareImageFromFile?.(file);
      if (!prepared?.ok) {
        showHubToast(global.ImageUpload?.reasonMessage?.(prepared?.reason) || 'Error con la foto');
        return;
      }
      photoUrl = prepared.dataUrl;
    }
    if (!text && !photoUrl) {
      showHubToast('Escribe algo o elige una foto 💌');
      return;
    }
    const ok = await addLetterExtended({ text, type: 'inbox', photoUrl });
    if (!ok?.ok) return;
    if (els.letterInput) els.letterInput.value = '';
    if (els.letterFile) els.letterFile.value = '';
    if (els.letterFileName) els.letterFileName.textContent = 'Sin foto';
    if (els.letterPhotoPreview) {
      els.letterPhotoPreview.src = '';
      els.letterPhotoPreview.classList.add('hidden');
    }
  });

  els.letterPickBtn?.addEventListener('click', () => els.letterFile?.click());

  els.letterFile?.addEventListener('change', async () => {
    const file = els.letterFile?.files?.[0];
    if (!file) return;
    const prepared = await global.ImageUpload?.prepareImageFromFile?.(file);
    if (!prepared?.ok) {
      showHubToast(global.ImageUpload?.reasonMessage?.(prepared?.reason) || 'Error con la foto');
      els.letterFile.value = '';
      return;
    }
    if (els.letterFileName) els.letterFileName.textContent = file.name;
    if (els.letterPhotoPreview) {
      els.letterPhotoPreview.src = prepared.dataUrl;
      els.letterPhotoPreview.classList.remove('hidden');
    }
  });

  els.memoryPickBtn?.addEventListener('click', () => els.memoryFile?.click());

  els.memoryForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = els.memoryTitle?.value?.trim();
    const file = els.memoryFile?.files?.[0];
    const prepared = await global.ImageUpload?.resolveImageInput?.({
      file,
      url: els.memoryUrl?.value,
    });
    if (!prepared?.ok) {
      if (prepared?.reason !== 'no_image') {
        showHubToast(global.ImageUpload?.reasonMessage?.(prepared?.reason) || 'Error con la foto');
        return;
      }
    }
    const imageUrl = prepared?.ok ? prepared.dataUrl : '';
    if (!title && !imageUrl) return;
    await addMemory(title || 'Recuerdo', imageUrl);
    els.memoryForm?.reset();
    if (els.memoryFileName) els.memoryFileName.textContent = 'Sin foto';
    if (els.memoryPreview) {
      els.memoryPreview.src = '';
      els.memoryPreview.classList.add('hidden');
    }
    showHubToast('Recuerdo guardado 📸');
  });

  els.memoryFile?.addEventListener('change', async () => {
    const file = els.memoryFile?.files?.[0];
    if (!file || !els.memoryPreview) return;
    if (els.memoryFileName) els.memoryFileName.textContent = 'Procesando…';
    const prepared = await global.ImageUpload?.prepareImageFromFile?.(file);
    if (!prepared?.ok) {
      showHubToast(global.ImageUpload?.reasonMessage?.(prepared?.reason) || 'Error con la foto');
      els.memoryFile.value = '';
      if (els.memoryFileName) els.memoryFileName.textContent = 'Sin foto';
      return;
    }
    if (els.memoryFileName) els.memoryFileName.textContent = file.name;
    els.memoryPreview.src = prepared.dataUrl;
    els.memoryPreview.classList.remove('hidden');
  });

  els.memoryGrid?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.hub-memory-del');
    if (!btn) return;
    await removeMemory(btn.dataset.memoryId);
  });

  els.letterList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.hub-letter-del');
    if (!btn) return;
    const ok = await removeLetter(btn.dataset.letterId);
    if (ok) showHubToast('Cartita eliminada');
  });

  els.counterForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await persistSettings({
      relationshipStart: els.inputRelationshipStart?.value || null,
      nextMeetingDate: els.inputNextMeeting?.value || null,
    });
  });

  els.missionList?.addEventListener('change', async (e) => {
    const t = e.target;
    if (!t.classList?.contains('hub-mission-check') || !t.checked) return;
    await completeMission(t.dataset.missionId);
  });

  els.reminderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await persistSettings({
      chargeReminder: {
        enabled: !!els.reminderEnabled?.checked,
        time: els.reminderTime?.value || '20:30',
        timezone: els.reminderTz?.value || 'America/New_York',
      },
    });
    showHubToast('Recordatorio guardado ❤️');
    window.dispatchEvent(new CustomEvent('hub:reminderChanged'));
  });

  window.addEventListener('couple:roomChanged', async () => {
    await setupSync();
    renderAll();
  });

  window.addEventListener('couple:profileChanged', async () => {
    await setupSync();
    renderAll();
  });
}

async function setupSync() {
  if (unsubscribeHub) {
    unsubscribeHub();
    unsubscribeHub = null;
  }
  if (unsubscribePersonalLetters) {
    unsubscribePersonalLetters();
    unsubscribePersonalLetters = null;
  }
  lettersInboxReady = false;
  knownLetterIds = new Set();
  await detectMode();
  setSyncBadge();
  if (mode === 'cloud' && CloudManager) {
    const room = CloudManager.getCurrentRoom?.();
    if (room) {
      unsubscribeHub = CloudManager.subscribeToHub((payload) => {
        if (!payload || payload.type !== 'hub_updated') return;
        hubState.settings = payload.settings || hubState.settings;
        hubState.tasks = payload.tasks || [];
        hubState.events = payload.events || [];
        hubState.memories = payload.memories || [];
        writeLocalHub(hubState);
        renderAll();
      });
    }
    await startPersonalLettersSync();
  } else {
    hubState = readLocalHub();
  }
}

function cacheElements() {
  els.root = $('section-couple-hub');
  els.syncBadge = $('hub-sync-badge');
  els.tabBtns = document.querySelectorAll('.hub-tab');
  els.panels = document.querySelectorAll('[data-hub-panel]');
  els.taskList = $('hub-task-list');
  els.taskForm = $('hub-task-form');
  els.taskInput = $('hub-task-input');
  els.taskEmoji = $('hub-task-emoji');
  els.calGrid = $('hub-cal-grid');
  els.calTitle = $('hub-cal-title');
  els.calPrev = $('hub-cal-prev');
  els.calNext = $('hub-cal-next');
  els.dayPanel = $('hub-day-panel');
  els.letterList = $('hub-letter-list');
  els.letterForm = $('hub-letter-form');
  els.letterInput = $('hub-letter-input');
  els.letterToInput = $('hub-letter-to');
  els.letterRoute = $('hub-letter-route');
  els.letterFile = $('hub-letter-file');
  els.letterFileName = $('hub-letter-file-name');
  els.letterPhotoPreview = $('hub-letter-photo-preview');
  els.letterPickBtn = document.querySelector('[data-hub-pick-photo]');
  els.letterToInput?.addEventListener('input', updateLetterRouteHint);
  els.memoryGrid = $('hub-memory-grid');
  els.memoryForm = $('hub-memory-form');
  els.memoryTitle = $('hub-memory-title');
  els.memoryUrl = $('hub-memory-url');
  els.memoryFile = $('hub-memory-file');
  els.memoryFileName = $('hub-memory-file-name');
  els.memoryPreview = $('hub-memory-preview');
  els.memoryPickBtn = document.querySelector('[data-hub-pick-memory]');
  els.counterTogether = $('hub-counter-together');
  els.counterMeeting = $('hub-counter-meeting');
  els.counterForm = $('hub-counter-form');
  els.inputRelationshipStart = $('hub-relationship-start');
  els.inputNextMeeting = $('hub-next-meeting');
  els.missionList = $('hub-mission-list');
  els.reminderForm = $('hub-reminder-form');
  els.reminderEnabled = $('hub-reminder-enabled');
  els.reminderTime = $('hub-reminder-time');
  els.reminderTz = $('hub-reminder-tz');
  els.toast = $('hub-toast');
}

  function getChargeReminderSettings() {
    SaveManager.init();
    const local = readLocalHub().settings.chargeReminder;
    return local || createDefaultHubData().chargeReminder;
  }

  async function init() {
    if (!document.getElementById('section-couple-hub')) return;
    cacheElements();
    bindEvents();
    await setupSync();
    recordVisit();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CoupleHub = {
    getChargeReminderSettings,
    openTab: openHubTab,
    getState: getHubState,
    getMeta: getNossaCasaMeta,
    getVisibleLetters,
    getInboxLetters,
    getSentLetters,
    formatLetterHeading,
    getPlayerName,
    getPartnerName,
    resolvePartnerTarget,
    updateLetterRouteHint,
    recordVisit,
    logGardenAction,
    getFireplaceLevel,
    addTask,
    toggleTask,
    removeTask,
    addLetter,
    addLetterExtended,
    reactToLetter,
    removeLetter,
    addMemory,
    removeMemory,
    addEvent,
    persistSettings,
    showToast: showHubToast,
  };
})(typeof window !== 'undefined' ? window : globalThis);
