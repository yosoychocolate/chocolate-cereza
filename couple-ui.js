/**
 * CoupleUI — interface do modo online (Jugar en Pareja).
 */
import CloudManager from './cloud-manager.js?v=__APP_VERSION__';
import PlayerIdentity from './player-identity.js?v=__APP_VERSION__';
import CoupleMascots from './couple-mascots.js?v=__APP_VERSION__';

const {
  resolveMascotType,
  buildMascotScene,
  renderRankingRow,
  renderChatRow,
  renderStreakBadge,
  renderGuardianPair,
  renderFooterGuardians,
  renderScoreHudRow,
  playGuardianAnim,
  detectSceneMode,
} = CoupleMascots;

const els = {};

/** @type {(() => void) | null} */
let unsubscribeRoom = null;

/** @type {(() => void) | null} */
let unsubscribeChat = null;

/** @type {boolean} */
let chatStickToBottom = true;

/** @type {number} */
let lastPlayerCount = 0;

/** @type {string | null} */
let lastBestPlayerId = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let hugTimer = null;

/** @type {'waiting' | 'together' | 'alone' | 'hugging' | null} */
let forcedSceneMode = null;

function $(id) {
  return document.getElementById(id);
}

function setStatus(message, isError = false) {
  if (!els.statusMsg) return;
  els.statusMsg.textContent = message || '';
  els.statusMsg.classList.toggle('is-error', isError);
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast?.classList.add('hidden');
  }, 4200);
}

function showLobby() {
  els.lobby?.classList.remove('hidden');
  els.roomPanel?.classList.add('hidden');
}

function showRoomPanel() {
  els.lobby?.classList.add('hidden');
  els.roomPanel?.classList.remove('hidden');
}

function getPlayerPayload() {
  const name = (els.nameInput?.value || '').trim() || PlayerIdentity.getPlayerName() || 'Jugador';
  PlayerIdentity.setPlayerName(name);
  return {
    id: PlayerIdentity.getOrCreatePlayerId(),
    name,
    joinedAt: Date.now(),
  };
}

function formatUpdatedAt(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Ahora';
  const min = Math.floor(diff / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleString('es');
}

function renderPlayers(players) {
  if (!els.playersList) return;
  els.playersList.innerHTML = '';

  if (!players || !players.length) return;

  players.forEach((player) => {
    const li = document.createElement('li');
    const online = player.presence?.online === true;
    const icon = online ? '🟢' : '🔴';
    const status = online ? 'online' : CloudManager.formatLastSeen(player.presence?.lastSeen || 0);
    li.className = 'couple-player-item';
    li.innerHTML = `<span class="couple-player-icon">${icon}</span><span class="couple-player-name">${escapeHtml(player.name || player.id)}</span><span class="couple-player-status">${escapeHtml(status)}</span>`;
    els.playersList.appendChild(li);
  });
}

function getLocalPlayerId() {
  return CloudManager.getLocalPlayer()?.id || PlayerIdentity.getOrCreatePlayerId();
}

function triggerMascotFx(fxClass, durationMs = 1200) {
  if (!els.mascotScene) return;
  els.mascotScene.classList.remove('fx-record', 'fx-crown', 'fx-join');
  els.mascotScene.classList.add(fxClass);
  clearTimeout(triggerMascotFx._timer);
  triggerMascotFx._timer = setTimeout(() => {
    els.mascotScene?.classList.remove(fxClass);
  }, durationMs);

  if (fxClass === 'fx-join') {
    playGuardianAnim(els.guardians, 'chocolate', 'wave');
    playGuardianAnim(els.guardians, 'cereza', 'blink');
  }
}

function initGuardians() {
  if (els.guardians) {
    els.guardians.innerHTML = renderGuardianPair({ size: 48 });
  }
  if (els.footerMascots) {
    els.footerMascots.innerHTML = renderFooterGuardians();
  }
}

function renderCoupleScoreHud(ranking, coupleStats) {
  if (!els.scoreHud) return;

  const room = CloudManager.getCurrentRoom();
  if (!room || !ranking || ranking.length < 1) {
    els.scoreHud.classList.add('hidden');
    els.scoreHud.setAttribute('aria-hidden', 'true');
    return;
  }

  const leaderId = coupleStats?.bestPlayerId;
  const players = room.players || [];
  const rows = ranking.slice(0, 2).map((entry) => {
    const type = resolveMascotType(entry.name, entry.id, players);
    const isLeader = leaderId === entry.id && entry.bestScore > 0;
    return renderScoreHudRow(type, entry.bestScore, isLeader);
  });

  els.scoreHud.innerHTML = rows.join('');
  els.scoreHud.classList.remove('hidden');
  els.scoreHud.setAttribute('aria-hidden', 'false');
}

function hideCoupleScoreHud() {
  if (!els.scoreHud) return;
  els.scoreHud.classList.add('hidden');
  els.scoreHud.setAttribute('aria-hidden', 'true');
  els.scoreHud.innerHTML = '';
}

function scheduleHugScene(partnerName) {
  forcedSceneMode = 'hugging';
  triggerMascotFx('fx-join');
  clearTimeout(hugTimer);
  hugTimer = setTimeout(() => {
    forcedSceneMode = null;
    refreshMascotScene();
  }, 3200);
}

function renderMascotScene(room, couple, overrideMode) {
  if (!els.mascotStage || !els.mascotScene) return;

  const localId = getLocalPlayerId();
  const localPlayer = room.players.find((p) => p.id === localId) || CloudManager.getLocalPlayer();
  const localName = localPlayer?.name || 'Jugador';
  const localType = resolveMascotType(localName, localId, room.players);
  const partner = room.players.find((p) => p.id !== localId);
  const partnerName = partner?.name || '';
  const partnerType = partner ? resolveMascotType(partner.name, partner.id, room.players) : localType === 'chocolate' ? 'cereza' : 'chocolate';

  const mode = overrideMode || forcedSceneMode || detectSceneMode(room, localId);

  const scene = buildMascotScene(mode, {
    localType,
    partnerType,
    localName,
    partnerName,
    localOnline: localPlayer?.presence?.online !== false,
    partnerOnline: partner?.presence?.online === true,
  });

  els.mascotStage.innerHTML = scene.html;
  if (els.mascotCaption) els.mascotCaption.textContent = scene.caption;
  els.mascotScene.className = `couple-mascot-scene ${scene.className}`;

  if (els.streakWrap) {
    const streakHtml = couple?.playStreak >= 2 ? renderStreakBadge(couple.playStreak) : '';
    els.streakWrap.innerHTML = streakHtml;
  }
}

async function refreshMascotScene(overrideMode) {
  const room = CloudManager.getCurrentRoom();
  if (!room) return;

  let couple = null;
  const coupleRes = await CloudManager.getCoupleStats();
  if (coupleRes.success) couple = coupleRes.couple;

  renderMascotScene(room, couple, overrideMode);
}

function renderChatMessages(messages) {
  if (!els.chatMessages) return;

  els.chatMessages.innerHTML = '';
  if (!messages || !messages.length) return;

  const room = CloudManager.getCurrentRoom();
  const players = room?.players || [];

  messages.forEach((msg) => {
    if (msg.type === 'system') {
      const div = document.createElement('div');
      div.className = 'couple-chat-msg is-system';
      div.textContent = msg.message;
      els.chatMessages.appendChild(div);
      return;
    }

    const type = resolveMascotType(msg.playerName, msg.playerId, players);
    const wrap = document.createElement('div');
    wrap.innerHTML = renderChatRow(type, msg.playerName || 'Jugador', msg.message);
    els.chatMessages.appendChild(wrap.firstElementChild);
  });

  if (chatStickToBottom) {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}

function handleChatEvent(event) {
  if (event.type === 'chat_updated') {
    renderChatMessages(event.messages);
  }
}

function bindChatListener() {
  if (unsubscribeChat) unsubscribeChat();
  unsubscribeChat = CloudManager.subscribeToChat(handleChatEvent);
}

function setChatEnabled(enabled) {
  if (els.chatInput) els.chatInput.disabled = !enabled;
  if (els.chatSend) els.chatSend.disabled = !enabled;
  els.chatEmojis?.querySelectorAll('.couple-chat-emoji').forEach((btn) => {
    btn.disabled = !enabled;
  });
}

async function sendChat(text) {
  const message = (text || '').trim();
  if (!message) return;

  setChatEnabled(false);
  try {
    const result = await CloudManager.sendChatMessage(message);
    if (!result.success) {
      setStatus(result.message || 'No se pudo enviar.', true);
      return;
    }
    if (els.chatInput) els.chatInput.value = '';
    setStatus('');
  } finally {
    setChatEnabled(true);
    els.chatInput?.focus({ preventScroll: true });
  }
}

async function onChatSubmit(event) {
  event.preventDefault();
  const text = els.chatInput?.value || '';
  await sendChat(text);
}

async function onEmojiClick(event) {
  const btn = event.target.closest('.couple-chat-emoji');
  if (!btn || btn.disabled) return;
  const emoji = btn.dataset.emoji;
  if (emoji) await sendChat(emoji);
}

function renderRanking(ranking, coupleStats) {
  if (!els.rankingList) return;
  els.rankingList.innerHTML = '';

  if (!ranking || !ranking.length) {
    els.rankingList.innerHTML = '<li class="couple-empty">Sin partidas aún</li>';
    return;
  }

  const room = CloudManager.getCurrentRoom();
  const players = room?.players || [];
  const leaderId = coupleStats?.bestPlayerId;

  ranking.forEach((entry, index) => {
    const type = resolveMascotType(entry.name, entry.id, players);
    const isLeader = leaderId === entry.id && entry.bestScore > 0;
    const wrap = document.createElement('div');
    wrap.innerHTML = renderRankingRow(type, entry.name, entry.bestScore, {
      isLeader,
      rank: index + 1,
    });
    if (wrap.firstElementChild) {
      els.rankingList.appendChild(wrap.firstElementChild);
    }
  });
}

function renderCoupleSummary(couple) {
  if (!els.statsSummary || !couple) return;
  const streakLine =
    couple.playStreak >= 2 ?
      `<p><span>🔥 Racha</span><strong>${couple.playStreak} días</strong></p>`
    : '';
  els.statsSummary.innerHTML = `
    <p><span>🎮 Partidas</span><strong>${couple.totalGames}</strong></p>
    <p><span>🍫 Chocolates juntos</span><strong>${couple.totalChocolate.toLocaleString('es')}</strong></p>
    ${streakLine}
    <p><span>🕒 Última actividad</span><strong>${formatUpdatedAt(couple.updatedAt)}</strong></p>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function refreshRoomPanel() {
  const room = CloudManager.getCurrentRoom();
  if (!room) {
    showLobby();
    return;
  }

  showRoomPanel();
  if (els.roomCode) els.roomCode.textContent = room.code;

  renderPlayers(room.players);

  const [coupleRes, rankRes] = await Promise.all([
    CloudManager.getCoupleStats(),
    CloudManager.getCoupleRanking(),
  ]);

  if (coupleRes.success) {
    renderCoupleSummary(coupleRes.couple);
    renderMascotScene(room, coupleRes.couple);
  } else {
    renderMascotScene(room, null);
  }

  if (rankRes.success) {
    renderRanking(rankRes.ranking, coupleRes.success ? coupleRes.couple : null);
    renderCoupleScoreHud(rankRes.ranking, coupleRes.success ? coupleRes.couple : null);
  }
}

function handleCoupleUpdated(couple) {
  if (!couple) return;

  const newLeader = couple.bestPlayerId;
  if (lastBestPlayerId && newLeader && lastBestPlayerId !== newLeader) {
    triggerMascotFx('fx-crown');
    const room = CloudManager.getCurrentRoom();
    const leaderType = resolveMascotType(couple.bestPlayerName, newLeader, room?.players);
    playGuardianAnim(els.guardians, leaderType, 'crown');
  }
  lastBestPlayerId = newLeader;
}

async function handleRoomEvent(event) {
  if (event.type === 'room_removed') {
    if (unsubscribeChat) {
      unsubscribeChat();
      unsubscribeChat = null;
    }
    renderChatMessages([]);
    setChatEnabled(false);
    lastPlayerCount = 0;
    lastBestPlayerId = null;
    forcedSceneMode = null;
    hideCoupleScoreHud();
    showLobby();
    setStatus('La sala ya no existe.');
    return;
  }

  if (event.type === 'couple_updated') {
    handleCoupleUpdated(event.couple);
    await refreshRoomPanel();
    return;
  }

  if (event.type === 'room_updated') {
    const room = event.room || CloudManager.getCurrentRoom();
    const count = room?.players?.length || 0;

    if (lastPlayerCount === 1 && count >= 2) {
      const localId = getLocalPlayerId();
      const partner = room?.players?.find((p) => p.id !== localId);
      scheduleHugScene(partner?.name || 'Tu pareja');
    }

    lastPlayerCount = count;
    await refreshRoomPanel();
  }
}

function bindRoomListener() {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = CloudManager.subscribeToRoom(handleRoomEvent);
  bindChatListener();
  setChatEnabled(true);
}

async function onCreateRoom() {
  setStatus('Creando sala…');
  els.createBtn.disabled = true;

  try {
    await CloudManager.whenSessionReady();
    const player = getPlayerPayload();
    const result = await CloudManager.createRoom(player);

    if (!result.success) {
      console.error('[CoupleUI] createRoom failed:', result.error, result.message);
      setStatus(result.message || 'No se pudo crear la sala.', true);
      return;
    }

    setStatus('');
    bindRoomListener();
    lastPlayerCount = result.room?.players?.length || 1;
    await refreshRoomPanel();
    showToast(`Sala ${result.room.code} creada — comparte el código`);
  } catch (err) {
    console.error('[CoupleUI] createRoom error:', err);
    if (err instanceof Error) console.error(err.stack);
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.createBtn.disabled = false;
  }
}

async function onJoinRoom() {
  const code = (els.joinCode?.value || '').trim().toUpperCase();
  if (code.length !== 6) {
    setStatus('Introduce un código de 6 caracteres.', true);
    return;
  }

  setStatus('Entrando en la sala…');
  els.joinBtn.disabled = true;

  try {
    await CloudManager.whenSessionReady();
    const player = getPlayerPayload();
    const result = await CloudManager.joinRoom(code, player);

    if (!result.success) {
      console.error('[CoupleUI] joinRoom failed:', result.error, result.message);
      setStatus(result.message || 'No se pudo entrar.', true);
      return;
    }

    setStatus('');
    bindRoomListener();
    lastPlayerCount = result.room?.players?.length || 0;
    await refreshRoomPanel();
    if ((result.room?.players?.length || 0) >= 2) {
      const localId = getLocalPlayerId();
      const partner = result.room.players.find((p) => p.id !== localId);
      scheduleHugScene(partner?.name || 'Tu pareja');
    }
    showToast(`Conectado a la sala ${code}`);
  } catch (err) {
    console.error('[CoupleUI] joinRoom error:', err);
    if (err instanceof Error) console.error(err.stack);
    setStatus(err instanceof Error ? err.message : String(err), true);
  } finally {
    els.joinBtn.disabled = false;
  }
}

async function onLeaveRoom() {
  els.leaveBtn.disabled = true;
  try {
    const result = await CloudManager.leaveRoom();

    if (unsubscribeRoom) {
      unsubscribeRoom();
      unsubscribeRoom = null;
    }
    if (unsubscribeChat) {
      unsubscribeChat();
      unsubscribeChat = null;
    }
    renderChatMessages([]);
    setChatEnabled(false);
    lastPlayerCount = 0;
    lastBestPlayerId = null;
    forcedSceneMode = null;
    hideCoupleScoreHud();

    showLobby();
    setStatus(
      result.success
        ? ''
        : 'Saliste localmente; la sincronización con la nube puede tardar.'
    );
  } finally {
    els.leaveBtn.disabled = false;
  }
}

async function onCopyCode() {
  const code = CloudManager.getCurrentRoom()?.code || els.roomCode?.textContent;
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    showToast('Código copiado');
  } catch (_) {
    showToast(`Código: ${code}`);
  }
}

function onStartGame() {
  CloudManager.notifyGameStarted().catch((err) => {
    console.warn('[CoupleUI] notifyGameStarted:', err);
  });

  const container = document.getElementById('game-container');
  if (container) {
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showToast('¡Buena suerte! 🍫');
}

function onScoreSubmitted(event) {
  const detail = event.detail;
  if (!detail?.success) return;

  if (detail.isNewBest) {
    const name = detail.couple?.bestPlayerName || 'Alguien';
    const score = detail.couple?.bestScore || 0;
    const leaderType = resolveMascotType(name, detail.couple?.bestPlayerId, CloudManager.getCurrentRoom()?.players);
    showToast(`🏆 ¡Nuevo récord! ${name} — ${score} 🍫`);
    triggerMascotFx('fx-record');
    playGuardianAnim(els.guardians, leaderType, 'record');
    refreshMascotScene();
  }

  if (detail.couple?.playStreak >= 7 && detail.couple.playStreak % 7 === 0) {
    showToast(`🔥 ¡${detail.couple.playStreak} días juntos! 🧸❤️🧸`);
  }
}

function cacheElements() {
  els.lobby = $('couple-lobby');
  els.roomPanel = $('couple-room-panel');
  els.nameInput = $('couple-player-name');
  els.joinCode = $('couple-join-code');
  els.createBtn = $('couple-create-btn');
  els.joinBtn = $('couple-join-btn');
  els.leaveBtn = $('couple-leave-room');
  els.startBtn = $('couple-start-game');
  els.copyBtn = $('couple-copy-code');
  els.roomCode = $('couple-room-code');
  els.playersList = $('couple-players-list');
  els.rankingList = $('couple-ranking-list');
  els.statsSummary = $('couple-stats-summary');
  els.statusMsg = $('couple-status-msg');
  els.toast = $('couple-toast');
  els.chatMessages = $('couple-chat-messages');
  els.chatForm = $('couple-chat-form');
  els.chatInput = $('couple-chat-input');
  els.chatSend = $('couple-chat-send');
  els.chatEmojis = $('couple-chat-emojis');
  els.mascotScene = $('couple-mascot-scene');
  els.mascotStage = $('couple-mascot-stage');
  els.mascotCaption = $('couple-mascot-caption');
  els.streakWrap = $('couple-streak-wrap');
  els.guardians = $('couple-guardians');
  els.scoreHud = $('couple-score-hud');
  els.footerMascots = $('site-footer-mascots');
}

async function init() {
  cacheElements();
  if (!els.lobby) return;

  initGuardians();

  const identity = PlayerIdentity.getIdentity();
  if (els.nameInput && identity.name) {
    els.nameInput.value = identity.name;
  }

  els.createBtn?.addEventListener('click', onCreateRoom);
  els.joinBtn?.addEventListener('click', onJoinRoom);
  els.leaveBtn?.addEventListener('click', onLeaveRoom);
  els.copyBtn?.addEventListener('click', onCopyCode);
  els.startBtn?.addEventListener('click', onStartGame);
  els.chatForm?.addEventListener('submit', onChatSubmit);
  els.chatEmojis?.addEventListener('click', onEmojiClick);

  els.chatMessages?.addEventListener('scroll', () => {
    if (!els.chatMessages) return;
    const el = els.chatMessages;
    chatStickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  });

  els.joinCode?.addEventListener('input', () => {
    if (els.joinCode) {
      els.joinCode.value = els.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
  });

  window.addEventListener('couple:score-submitted', onScoreSubmitted);

  await CloudManager.whenSessionReady();

  if (CloudManager.getCurrentRoom()) {
    bindRoomListener();
    const room = CloudManager.getCurrentRoom();
    lastPlayerCount = room?.players?.length || 0;
    await refreshRoomPanel();
    const coupleRes = await CloudManager.getCoupleStats();
    if (coupleRes.success) {
      lastBestPlayerId = coupleRes.couple?.bestPlayerId ?? null;
    }
  } else {
    showLobby();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init };
