/**
 * CoupleUI — interface do modo online (Jugar en Pareja).
 */
import CloudManager from './cloud-manager.js';
import PlayerIdentity from './player-identity.js';

const els = {};

/** @type {(() => void) | null} */
let unsubscribeRoom = null;

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

  if (!players || !players.length) {
    els.playersList.innerHTML = '<li class="couple-empty">Esperando jugadores…</li>';
    return;
  }

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

function renderRanking(ranking, coupleStats) {
  if (!els.rankingList) return;
  els.rankingList.innerHTML = '';

  if (!ranking || !ranking.length) {
    els.rankingList.innerHTML = '<li class="couple-empty">Sin partidas aún</li>';
    return;
  }

  ranking.forEach((entry, index) => {
    const li = document.createElement('li');
    const crown =
      coupleStats?.bestPlayerId === entry.id && entry.bestScore > 0 ? ' 👑' : '';
    li.className = 'couple-rank-item' + (index === 0 && entry.bestScore > 0 ? ' is-first' : '');
    li.innerHTML = `<span class="couple-rank-pos">${index + 1}.</span><span class="couple-rank-name">${escapeHtml(entry.name)}${crown}</span><span class="couple-rank-score">${entry.bestScore} 🍫</span>`;
    els.rankingList.appendChild(li);
  });
}

function renderCoupleSummary(couple) {
  if (!els.statsSummary || !couple) return;
  els.statsSummary.innerHTML = `
    <p><span>🎮 Partidas</span><strong>${couple.totalGames}</strong></p>
    <p><span>🍫 Chocolates juntos</span><strong>${couple.totalChocolate.toLocaleString('es')}</strong></p>
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
  }

  if (rankRes.success) {
    renderRanking(rankRes.ranking, coupleRes.success ? coupleRes.couple : null);
  }
}

async function handleRoomEvent(event) {
  if (event.type === 'room_removed') {
    showLobby();
    setStatus('La sala ya no existe.');
    return;
  }

  if (event.type === 'room_updated' || event.type === 'couple_updated') {
    await refreshRoomPanel();
  }
}

function bindRoomListener() {
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = CloudManager.subscribeToRoom(handleRoomEvent);
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
    await refreshRoomPanel();
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
    showToast(`🏆 ¡Nuevo récord! ${name} — ${score} 🍫`);
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
}

async function init() {
  cacheElements();
  if (!els.lobby) return;

  const identity = PlayerIdentity.getIdentity();
  if (els.nameInput && identity.name) {
    els.nameInput.value = identity.name;
  }

  els.createBtn?.addEventListener('click', onCreateRoom);
  els.joinBtn?.addEventListener('click', onJoinRoom);
  els.leaveBtn?.addEventListener('click', onLeaveRoom);
  els.copyBtn?.addEventListener('click', onCopyCode);
  els.startBtn?.addEventListener('click', onStartGame);

  els.joinCode?.addEventListener('input', () => {
    if (els.joinCode) {
      els.joinCode.value = els.joinCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
  });

  window.addEventListener('couple:score-submitted', onScoreSubmitted);

  await CloudManager.whenSessionReady();

  if (CloudManager.getCurrentRoom()) {
    bindRoomListener();
    await refreshRoomPanel();
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
