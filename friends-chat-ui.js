/**
 * Amigos + mini chat flutuante (site inteiro, fora da sala).
 */
import CloudManager from './cloud-manager.js?v=__APP_VERSION__';
import PlayerIdentity from './player-identity.js?v=__APP_VERSION__';
import { goToJugarRoom } from './site-routes.js?v=__APP_VERSION__';

/** @type {Map<string, () => void>} */
const presenceUnsubs = new Map();

/** @type {(() => void) | null} */
let dmUnsub = null;

/** @type {(() => void) | null} */
let typingUnsub = null;

/** @type {boolean} */
let peerTyping = false;

/** @type {boolean} */
let localTypingActive = false;

/** @type {ReturnType<typeof setTimeout> | null} */
let typingStopTimer = null;

/** @type {ReturnType<typeof setInterval> | null} */
let typingHeartbeatTimer = null;

const TYPING_STOP_MS = 1600;
const TYPING_HEARTBEAT_MS = 2200;

/** @type {(() => void) | null} */
let friendsUnsub = null;

/** @type {(() => void) | null} */
let invitesUnsub = null;

/** @type {(() => void) | null} */
let friendRequestsUnsub = null;

/** @type {(() => void) | null} */
let dmInboxUnsub = null;

/** @type {(() => void) | null} */
let roomUnsub = null;

/** @type {Set<string>} */
let knownInboxMessageIds = new Set();

/** @type {boolean} */
let dmInboxReady = false;

/** @type {Record<string, number>} */
let unreadByFriend = {};

/** @type {Array<{ id: string, roomCode: string, fromPlayerId: string, fromName: string }>} */
let pendingInvites = [];

/** @type {Set<string>} */
let knownInviteIds = new Set();

/** @type {boolean} */
let invitesInboxReady = false;

/** @type {boolean} */
let friendRequestsInboxReady = false;

/** @type {Set<string>} */
let knownFriendRequestIds = new Set();

/** @type {Array<{ id: string, fromPlayerId: string, fromName: string }>} */
let friendRequests = [];

/** @type {Array<{ id: string, friendId: string, friendName: string }>} */
let friends = [];

/** @type {Record<string, { online: boolean, name: string }>} */
let presenceMap = {};

/** @type {{ friendId: string, friendName: string } | null} */
let activeChat = null;

/** @type {Array<{ id: string, fromPlayerId: string, message: string, createdAt: number|null }>} */
let dmMessages = [];

/** @type {boolean} */
let panelOpen = false;

/** @type {boolean} */
let chatMinimized = false;

/** @type {boolean} */
let stickBottom = true;

/** @type {string} */
let myUsername = '';

/** @type {string} */
let myPhotoUrl = '';

/** @type {Record<string, string>} */
let profilePhotos = {};

/** @type {Set<string>} */
const fetchedProfilePhotos = new Set();

function normalizeUsernameInput(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16);
}

function suggestUsernameFromName() {
  const name = getPlayerName();
  if (!name || name === 'Jugador') return '';
  const base = name.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
  if (!base || !/^[a-z]/.test(base)) return '';
  return base;
}

function renderUsernameUi() {
  if (myUsername) {
    els.usernameForm?.classList.add('hidden');
    els.usernameDisplay?.classList.remove('hidden');
    if (els.myUsername) els.myUsername.textContent = myUsername;
  } else {
    els.usernameForm?.classList.remove('hidden');
    els.usernameDisplay?.classList.add('hidden');
    if (els.usernameInput && !els.usernameInput.value) {
      const suggested = suggestUsernameFromName();
      if (suggested) els.usernameInput.value = suggested;
    }
  }
}

async function refreshMyUsername() {
  const cached = PlayerIdentity.getUsername();
  if (cached) myUsername = cached;
  myPhotoUrl = PlayerIdentity.getPhotoUrl() || '';

  const result = await CloudManager.loadPlayerUsername();
  if (result.success) {
    if (result.username) {
      myUsername = result.username;
      PlayerIdentity.setUsername(myUsername);
    }
    if (result.photoUrl) {
      myPhotoUrl = result.photoUrl;
      PlayerIdentity.setPhotoUrl(myPhotoUrl);
    }
  }

  renderUsernameUi();
  updateMyPhotoPreview();
}

async function onClaimUsername(event) {
  event.preventDefault();
  const raw = els.usernameInput?.value?.trim();
  if (!raw) {
    setFriendsStatus('Escribe un usuario (ej: sophie).', true);
    return;
  }

  setFriendsStatus('Guardando usuario…');
  const result = await CloudManager.setPlayerUsername(raw);
  if (!result.success) {
    setFriendsStatus(result.message || 'No se pudo guardar.', true);
    return;
  }

  myUsername = result.username || normalizeUsernameInput(raw);
  PlayerIdentity.setUsername(myUsername);
  if (els.usernameInput) els.usernameInput.value = myUsername;

  const nameInput = document.getElementById('couple-player-name');
  if (nameInput) nameInput.value = myUsername;
  renderUsernameUi();
  setFriendsStatus(`Usuario @${myUsername} listo — compártelo con amigos.`);
  showToast(`@${myUsername} guardado ✅`);

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && globalThis.PushNotifications?.subscribe) {
    globalThis.PushNotifications.subscribe().catch(() => {});
    showToast('Push de amigos actualizado 🔔');
  }

  if (invitesUnsub) invitesUnsub();
  invitesInboxReady = false;
  knownInviteIds = new Set();
  invitesUnsub = CloudManager.subscribeIncomingInvites(
    handleInvitesUpdate,
    () => showToast('Error al cargar invitaciones — recarga con Ctrl+F5.')
  );
}

const els = {};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text ?? '';
  return d.innerHTML;
}

function getPlayerName() {
  return (
    PlayerIdentity.getPlayerName()
    || document.getElementById('couple-player-name')?.value?.trim()
    || 'Jugador'
  );
}

function getPlayerId() {
  return PlayerIdentity.getOrCreatePlayerId();
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function showToast(msg, options = {}) {
  if (!els.toast) return;
  const { onClick, duration = 4500 } = options;
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  els.toast.classList.toggle('is-clickable', typeof onClick === 'function');
  els.toast.onclick = typeof onClick === 'function' ? onClick : null;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast?.classList.add('hidden');
    els.toast?.classList.remove('is-clickable');
    if (els.toast) els.toast.onclick = null;
  }, duration);
}

function getUnreadTotal() {
  return Object.values(unreadByFriend).reduce((sum, n) => sum + n, 0);
}

function isChatOpenWith(friendId) {
  if (!activeChat || activeChat.friendId !== friendId) return false;
  if (!els.chatWindow || els.chatWindow.classList.contains('hidden')) return false;
  return !chatMinimized;
}

function getFriendDisplayName(friendId, fallbackName = '') {
  const friend = friends.find((f) => f.friendId === friendId);
  return friend?.friendName || presenceMap[friendId]?.name || fallbackName || 'Amigo';
}

function safePhotoUrl(url) {
  return globalThis.ImageUpload?.safeSrc?.(url) || '';
}

function formatDisplayName(name) {
  return String(name || 'Amigo').replace(/^@+/, '').trim() || 'Amigo';
}

function chatAvatarInitial(name) {
  const clean = formatDisplayName(name);
  return (clean[0] || '?').toUpperCase();
}

function renderAvatarHtml(name, photoUrl, sizeClass = '', options = {}) {
  const { online = false, preview = false, playerId = '', rawName = '' } = options;
  const initial = chatAvatarInitial(name);
  const src = safePhotoUrl(photoUrl);
  const classes = [
    'social-chat-avatar',
    sizeClass,
    src ? 'social-avatar--photo' : '',
    online ? 'is-online' : '',
  ].filter(Boolean).join(' ');
  const inner = src
    ? `<img src="${escapeHtml(src)}" alt="">`
    : escapeHtml(initial);
  const avatar = `<span class="${classes}" aria-hidden="true">${inner}</span>`;
  if (preview && playerId) {
    const label = formatDisplayName(rawName || name);
    return `<button type="button" class="social-avatar-btn social-avatar-preview" data-player-id="${escapeHtml(playerId)}" data-friend-name="${escapeHtml(rawName || name)}" title="Ver foto de ${escapeHtml(label)}" aria-label="Ver foto de ${escapeHtml(label)}">${avatar}</button>`;
  }
  return avatar;
}

function getProfilePhoto(playerId) {
  if (!playerId) return '';
  if (playerId === getPlayerId()) return myPhotoUrl;
  return profilePhotos[playerId] || '';
}

function updateMyPhotoPreview() {
  if (!els.myPhotoPreview) return;
  const label = myUsername ? `@${myUsername}` : getPlayerName();
  const src = safePhotoUrl(myPhotoUrl);
  if (src) {
    els.myPhotoPreview.className = 'social-chat-avatar social-chat-avatar--sm social-avatar--photo';
    els.myPhotoPreview.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  } else {
    els.myPhotoPreview.className = 'social-chat-avatar social-chat-avatar--sm';
    els.myPhotoPreview.textContent = chatAvatarInitial(label);
  }
}

function renderChatPeerStatus(friendId) {
  if (peerTyping) {
    return `<span class="social-chat-peer-status is-typing">
      <span class="social-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>
      Escribiendo…
    </span>`;
  }
  const online = presenceMap[friendId]?.online;
  return `<span class="social-chat-peer-status${online ? ' is-online' : ''}">${online ? 'En línea' : 'Desconectado'}</span>`;
}

function renderChatHeader(friendId, friendName) {
  if (!els.chatTitle) return;
  const displayName = formatDisplayName(friendName);
  const photo = getProfilePhoto(friendId);
  const online = presenceMap[friendId]?.online;
  els.chatTitle.innerHTML = `
    ${renderAvatarHtml(displayName, photo, '', { online: online && !peerTyping, preview: true, playerId: friendId, rawName: friendName })}
    <span class="social-chat-peer">
      <span class="social-chat-peer-name">${escapeHtml(displayName)}</span>
      ${renderChatPeerStatus(friendId)}
    </span>`;
}

function setPeerTyping(typing) {
  if (peerTyping === typing) return;
  peerTyping = typing;
  if (activeChat) renderChatHeader(activeChat.friendId, activeChat.friendName);
}

function clearLocalTypingTimers() {
  if (typingStopTimer) {
    clearTimeout(typingStopTimer);
    typingStopTimer = null;
  }
  if (typingHeartbeatTimer) {
    clearInterval(typingHeartbeatTimer);
    typingHeartbeatTimer = null;
  }
}

async function stopLocalTyping() {
  clearLocalTypingTimers();
  if (!localTypingActive || !activeChat) return;
  localTypingActive = false;
  await CloudManager.setFriendTyping(activeChat.friendId, false);
}

function pulseLocalTyping() {
  if (!activeChat) return;
  if (!localTypingActive) {
    localTypingActive = true;
    CloudManager.setFriendTyping(activeChat.friendId, true);
    typingHeartbeatTimer = setInterval(() => {
      if (localTypingActive && activeChat) {
        CloudManager.setFriendTyping(activeChat.friendId, true);
      }
    }, TYPING_HEARTBEAT_MS);
  }

  if (typingStopTimer) clearTimeout(typingStopTimer);
  typingStopTimer = setTimeout(() => {
    stopLocalTyping();
  }, TYPING_STOP_MS);
}

function onChatInputActivity() {
  const value = els.chatInput?.value || '';
  if (!value.trim()) {
    stopLocalTyping();
    return;
  }
  pulseLocalTyping();
}

function bindFriendTyping(friendId) {
  if (typingUnsub) typingUnsub();
  peerTyping = false;
  typingUnsub = CloudManager.subscribeFriendTyping(friendId, setPeerTyping);
}

function ensureAvatarLightbox() {
  if (els.avatarLightbox) return;
  const wrap = document.createElement('div');
  wrap.id = 'social-avatar-lightbox';
  wrap.className = 'social-avatar-lightbox hidden';
  wrap.innerHTML = `
    <button type="button" class="social-avatar-lightbox-backdrop" aria-label="Cerrar"></button>
    <div class="social-avatar-lightbox-card" role="dialog" aria-modal="true" aria-labelledby="social-avatar-lightbox-name">
      <button type="button" class="social-avatar-lightbox-close" aria-label="Cerrar">✕</button>
      <div id="social-avatar-lightbox-visual" class="social-avatar-lightbox-visual"></div>
      <p id="social-avatar-lightbox-name" class="social-avatar-lightbox-name"></p>
    </div>`;
  document.body.appendChild(wrap);
  els.avatarLightbox = wrap;
  els.avatarLightboxVisual = wrap.querySelector('#social-avatar-lightbox-visual');
  els.avatarLightboxName = wrap.querySelector('#social-avatar-lightbox-name');
  wrap.querySelector('.social-avatar-lightbox-backdrop')?.addEventListener('click', closeAvatarLightbox);
  wrap.querySelector('.social-avatar-lightbox-close')?.addEventListener('click', closeAvatarLightbox);
}

function openAvatarLightbox(playerId, rawName) {
  ensureAvatarLightbox();
  const name = formatDisplayName(rawName);
  const photo = getProfilePhoto(playerId);
  const src = safePhotoUrl(photo);
  if (els.avatarLightboxVisual) {
    if (src) {
      els.avatarLightboxVisual.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
    } else {
      els.avatarLightboxVisual.innerHTML = `<span class="social-avatar-lightbox-fallback">${escapeHtml(chatAvatarInitial(name))}</span>`;
    }
  }
  if (els.avatarLightboxName) els.avatarLightboxName.textContent = name;
  els.avatarLightbox?.classList.remove('hidden');
}

function closeAvatarLightbox() {
  els.avatarLightbox?.classList.add('hidden');
}

async function refreshFriendPhotos(list) {
  const ids = (list || []).map((f) => f.friendId).filter(Boolean);
  await Promise.all(ids.map(async (friendId) => {
    if (fetchedProfilePhotos.has(friendId)) return;
    fetchedProfilePhotos.add(friendId);
    const result = await CloudManager.getPlayerProfile(friendId);
    if (result.success && result.profile?.photoUrl) {
      profilePhotos[friendId] = result.profile.photoUrl;
    }
  }));
  renderFriendsList();
  if (activeChat) renderChatHeader(activeChat.friendId, activeChat.friendName);
}

async function onProfilePhotoSelected(event) {
  const file = event.target?.files?.[0];
  if (event.target) event.target.value = '';
  if (!file) return;

  if (!globalThis.ImageUpload?.prepareImageFromFile) {
    showToast('Subida de fotos no disponible.');
    return;
  }

  setFriendsStatus('Elige la parte de la foto…');
  const prepared = globalThis.ImageUpload.prepareProfilePhotoFromFile
    ? await globalThis.ImageUpload.prepareProfilePhotoFromFile(file)
    : await globalThis.ImageUpload.prepareImageFromFile(file);
  if (!prepared.ok) {
    if (prepared.reason !== 'cancelled') {
      setFriendsStatus(globalThis.ImageUpload.reasonMessage(prepared.reason), true);
    } else {
      setFriendsStatus('');
    }
    return;
  }

  setFriendsStatus('Subiendo foto…');

  const result = await CloudManager.setPlayerPhotoUrl(prepared.dataUrl);
  if (!result.success) {
    setFriendsStatus(result.message || 'No se pudo guardar la foto.', true);
    return;
  }

  myPhotoUrl = result.photoUrl || prepared.dataUrl;
  PlayerIdentity.setPhotoUrl(myPhotoUrl);
  updateMyPhotoPreview();
  setFriendsStatus('Foto de perfil guardada ✅');
  showToast('Foto de perfil actualizada 📷');
  if (activeChat) renderDmMessages(dmMessages);
}

function assetUrl(relativePath) {
  const root = globalThis.__SITE_ROOT__ || '';
  return `${root}${relativePath}`;
}

async function showBrowserDmNotification(friendName, preview, friendId) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const title = `💬 ${friendName}`;
  const body = preview;
  const opts = {
    body,
    icon: assetUrl('assets/app-icon-192.png'),
    badge: assetUrl('assets/cherry.png'),
    tag: `dm-${friendId}`,
    renotify: true,
    data: { type: 'dm', friendId, friendName, url: location.href },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch (_) { /* fallback */ }

  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      openFloatingChat(friendId, friendName);
      n.close();
    };
  } catch (_) { /* ignore */ }
}

function notifyIncomingDm(msg) {
  const friendId = msg.fromPlayerId;
  const friendName = getFriendDisplayName(friendId, msg.fromName);
  const preview = msg.message.length > 72 ? `${msg.message.slice(0, 69)}…` : msg.message;

  if (isChatOpenWith(friendId)) return;

  unreadByFriend[friendId] = (unreadByFriend[friendId] || 0) + 1;
  updateOnlineBadge();
  renderFriendsList();

  showToast(`💬 ${friendName}: ${preview}`, {
    duration: 6000,
    onClick: () => openFloatingChat(friendId, friendName),
  });

  if (document.hidden || !document.hasFocus()) {
    showBrowserDmNotification(friendName, preview, friendId);
  }

  try {
    if (navigator.vibrate) navigator.vibrate(40);
  } catch (_) { /* ignore */ }
}

function handleDmInbox(messages) {
  const myId = getPlayerId();
  const incoming = (messages || []).filter((m) => m.fromPlayerId && m.fromPlayerId !== myId);

  if (!dmInboxReady) {
    incoming.forEach((m) => knownInboxMessageIds.add(m.id));
    dmInboxReady = true;
    return;
  }

  incoming.forEach((msg) => {
    if (knownInboxMessageIds.has(msg.id)) return;
    knownInboxMessageIds.add(msg.id);
    notifyIncomingDm(msg);
  });
}

function setFriendsStatus(text, isError = false) {
  if (!els.friendsStatus) return;
  els.friendsStatus.textContent = text || '';
  els.friendsStatus.classList.toggle('is-error', isError);
}

function updateOnlineBadge() {
  const onlineCount = friends.filter((f) => presenceMap[f.friendId]?.online).length;
  const pendingCount = friendRequests.length;
  const unreadTotal = getUnreadTotal();
  const inviteCount = pendingInvites.length;
  const badgeTotal = unreadTotal > 0
    ? unreadTotal
    : (inviteCount > 0
      ? inviteCount
      : (pendingCount > 0 ? pendingCount : onlineCount));

  if (els.friendsBadge) {
    els.friendsBadge.textContent = badgeTotal > 0 ? String(badgeTotal) : '';
    els.friendsBadge.classList.toggle('hidden', badgeTotal === 0);
    els.friendsBadge.classList.toggle('is-pending', (pendingCount > 0 || inviteCount > 0) && unreadTotal === 0);
    els.friendsBadge.classList.toggle('is-unread', unreadTotal > 0);
    els.friendsBadge.classList.toggle('is-invite', inviteCount > 0 && unreadTotal === 0);
  }
}

function renderFriendsList() {
  if (!els.friendsList) return;

  if (!friends.length) {
    els.friendsList.innerHTML = '<li class="social-empty">Añade amigos con su usuario para chatear y jugar.</li>';
    updateOnlineBadge();
    return;
  }

  els.friendsList.innerHTML = friends.map((f) => {
    const pres = presenceMap[f.friendId] || { online: false, name: f.friendName };
    const displayName = formatDisplayName(f.friendName);
    const unread = unreadByFriend[f.friendId] || 0;
    const unreadBadge = unread > 0
      ? `<span class="social-friend-unread" aria-label="${unread} sin leer">${unread > 9 ? '9+' : unread}</span>`
      : '';
    const room = CloudManager.getCurrentRoom?.();
    const roomFull = room && room.players.length >= room.maxPlayers;
    const inviteTitle = room
      ? (roomFull
        ? `Sala ${room.code} llena (${room.players.length}/${room.maxPlayers})`
        : `Invitar a sala ${room.code} (${room.players.length}/${room.maxPlayers})`)
      : 'Invitar a sala (crear party hasta 4)';
    const inviteDisabled = roomFull ? ' disabled' : '';
    return `<li class="social-friend-item${unread > 0 ? ' has-unread' : ''}" data-friend-id="${escapeHtml(f.friendId)}">
      <div class="social-friend-main">
        ${renderAvatarHtml(displayName, getProfilePhoto(f.friendId), 'social-chat-avatar--sm social-friend-avatar', {
          online: pres.online,
          preview: true,
          playerId: f.friendId,
          rawName: f.friendName,
        })}
        <span class="social-friend-name">${escapeHtml(displayName)}</span>
        ${unreadBadge}
      </div>
      <div class="social-friend-actions">
        <button type="button" class="social-icon-btn social-chat-open" data-friend-id="${escapeHtml(f.friendId)}" data-friend-name="${escapeHtml(f.friendName)}" title="Mensaje">💬</button>
        <button type="button" class="social-icon-btn social-room-invite" data-friend-id="${escapeHtml(f.friendId)}" data-friend-name="${escapeHtml(f.friendName)}" title="${escapeHtml(inviteTitle)}"${inviteDisabled}>🎮</button>
        <button type="button" class="social-icon-btn social-friend-remove" data-friend-id="${escapeHtml(f.friendId)}" title="Eliminar">✕</button>
      </div>
    </li>`;
  }).join('');

  updateOnlineBadge();
}

function bindFriendPresence(friendId) {
  if (presenceUnsubs.has(friendId)) return;
  const unsub = CloudManager.subscribeFriendPresence(friendId, (pres) => {
    presenceMap[friendId] = { online: pres.online, name: pres.name || presenceMap[friendId]?.name || '' };
    renderFriendsList();
    if (activeChat?.friendId === friendId) {
      renderChatHeader(friendId, activeChat.friendName);
    }
  });
  presenceUnsubs.set(friendId, unsub);
}

function syncFriendPresences(list) {
  const ids = new Set(list.map((f) => f.friendId));
  presenceUnsubs.forEach((unsub, id) => {
    if (!ids.has(id)) {
      unsub();
      presenceUnsubs.delete(id);
      delete presenceMap[id];
    }
  });
  list.forEach((f) => bindFriendPresence(f.friendId));
}

function renderFriendRequests(requests) {
  friendRequests = requests || [];
  updateOnlineBadge();

  if (!els.friendRequestsWrap) return;
  if (!friendRequests.length) {
    els.friendRequestsWrap.classList.add('hidden');
    els.friendRequestsWrap.innerHTML = '';
    return;
  }

  els.friendRequestsWrap.classList.remove('hidden');
  els.friendRequestsWrap.innerHTML = `
    <p class="social-invites-title">Solicitudes de amistad</p>
    ${friendRequests.map((req) => `
      <div class="social-invite-card" data-from-id="${escapeHtml(req.fromPlayerId)}">
        <p><strong>${escapeHtml(formatDisplayName(req.fromName))}</strong> quiere ser tu amigo/a</p>
        <div class="social-invite-btns">
          <button type="button" class="couple-btn couple-btn-small couple-btn-primary social-friend-accept" data-from-id="${escapeHtml(req.fromPlayerId)}">Aceptar</button>
          <button type="button" class="couple-btn couple-btn-small couple-btn-ghost social-friend-decline" data-from-id="${escapeHtml(req.fromPlayerId)}">Rechazar</button>
        </div>
      </div>
    `).join('')}
  `;
}

async function showBrowserFriendRequestNotification(fromName, fromPlayerId, pushKey = '') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const title = `👥 ${fromName}`;
  const body = 'Te envió una solicitud de amistad';
  const tag = pushKey
    ? `friend-request-${fromPlayerId}-${pushKey}`
    : `friend-request-${fromPlayerId}-${Date.now()}`;
  const opts = {
    body,
    icon: assetUrl('assets/app-icon-192.png'),
    badge: assetUrl('assets/cherry.png'),
    tag,
    renotify: true,
    data: { type: 'friend-request', fromPlayerId, pushKey, url: location.href },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch (_) { /* fallback */ }

  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      openFriendsPanel();
      n.close();
    };
  } catch (_) { /* ignore */ }
}

function notifyIncomingFriendRequest(req) {
  const fromName = formatDisplayName(req.fromName);
  updateOnlineBadge();

  showToast(`👥 ${fromName} quiere ser tu amigo/a`, {
    duration: 8000,
    onClick: () => openFriendsPanel(),
  });

  if (document.hidden || !document.hasFocus()) {
    showBrowserFriendRequestNotification(fromName, req.fromPlayerId, req.pushKey || String(Date.now()));
  }

  try {
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
  } catch (_) { /* ignore */ }
}

function handleFriendRequestsUpdate(requests) {
  const list = requests || [];
  const currentIds = new Set(list.map((r) => r.fromPlayerId));

  for (const knownId of [...knownFriendRequestIds]) {
    if (!currentIds.has(knownId)) knownFriendRequestIds.delete(knownId);
  }

  if (!friendRequestsInboxReady) {
    list.forEach((r) => knownFriendRequestIds.add(r.fromPlayerId));
    friendRequestsInboxReady = true;
    renderFriendRequests(list);
    return;
  }

  list.forEach((req) => {
    if (knownFriendRequestIds.has(req.fromPlayerId)) return;
    knownFriendRequestIds.add(req.fromPlayerId);
    notifyIncomingFriendRequest(req);
  });

  renderFriendRequests(list);
}

function renderInvites(invites) {
  if (!els.invitesWrap) return;
  if (!invites?.length) {
    els.invitesWrap.classList.add('hidden');
    els.invitesWrap.innerHTML = '';
    return;
  }

  els.invitesWrap.classList.remove('hidden');
  els.invitesWrap.innerHTML = `
    <p class="social-invites-title">Invitaciones de sala</p>
    ${invites.map((inv) => `
      <div class="social-invite-card" data-invite-id="${escapeHtml(inv.id)}">
        <p><strong>${escapeHtml(formatDisplayName(inv.fromName))}</strong> te invita · sala <code>${escapeHtml(inv.roomCode)}</code></p>
        <div class="social-invite-btns">
          <button type="button" class="couple-btn couple-btn-small couple-btn-primary social-invite-accept" data-invite-id="${escapeHtml(inv.id)}" data-room="${escapeHtml(inv.roomCode)}">Entrar</button>
          <button type="button" class="couple-btn couple-btn-small couple-btn-ghost social-invite-decline" data-invite-id="${escapeHtml(inv.id)}">Ignorar</button>
        </div>
      </div>
    `).join('')}
  `;
}

function ensureSocialReady() {
  globalThis.skipIntroToMain?.();
  if (!els.dock) cacheElements();
  startSocial();
}

function handleSocialPushAction(data) {
  if (!data?.type) return;
  ensureSocialReady();

  if (data.type === 'friend-request' || data.type === 'social:open-friend-requests') {
    openFriendsPanel();
    return;
  }
  if (data.type === 'dm' || data.type === 'social:open-dm') {
    if (data.friendId) openFloatingChat(data.friendId, data.friendName || 'Amigo');
    return;
  }
  if (data.type === 'room-invite' || data.type === 'social:open-invites') {
    openFriendsPanel();
    if (data.roomCode) goToJugarRoom(data.roomCode);
  }
}

function handleDeepLinkHash() {
  const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
  if (!hash) return;
  if (hash === 'amigos' || hash === 'social-friend-requests' || hash === 'friend-requests') {
    ensureSocialReady();
    openFriendsPanel();
    history.replaceState(null, '', location.pathname + location.search);
  }
}

globalThis.handleSocialPushAction = handleSocialPushAction;

const SOCIAL_DOCK_POS_KEY = 'ChocolateCerezaSocialDockPos';
let suppressSocialToggleClick = false;

function restoreSocialDockPosition() {
  const dock = els.dock;
  if (!dock) return;
  try {
    const raw = localStorage.getItem(SOCIAL_DOCK_POS_KEY);
    if (!raw) return;
    const pos = JSON.parse(raw);
    if (typeof pos?.x !== 'number' || typeof pos?.y !== 'number') return;
    dock.style.left = `${pos.x}px`;
    dock.style.top = `${pos.y}px`;
    dock.style.bottom = 'auto';
    dock.style.right = 'auto';
    dock.classList.add('is-custom-position');
  } catch (_) { /* ignore */ }
}

function clampSocialDockPosition(x, y) {
  const dock = els.dock;
  if (!dock) return { x, y };
  const rect = dock.getBoundingClientRect();
  const pad = 8;
  const maxX = Math.max(pad, window.innerWidth - rect.width - pad);
  const maxY = Math.max(pad, window.innerHeight - rect.height - pad);
  return {
    x: Math.min(maxX, Math.max(pad, x)),
    y: Math.min(maxY, Math.max(pad, y)),
  };
}

function applySocialDockPosition(x, y) {
  const dock = els.dock;
  if (!dock) return;
  const pos = clampSocialDockPosition(x, y);
  dock.style.left = `${pos.x}px`;
  dock.style.top = `${pos.y}px`;
  dock.style.bottom = 'auto';
  dock.style.right = 'auto';
  dock.classList.add('is-custom-position');
}

function saveSocialDockPosition() {
  const dock = els.dock;
  if (!dock) return;
  const rect = dock.getBoundingClientRect();
  try {
    localStorage.setItem(SOCIAL_DOCK_POS_KEY, JSON.stringify({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
    }));
  } catch (_) { /* ignore */ }
}

function bindSocialDockDrag() {
  const dock = els.dock;
  const handle = els.friendsToggle;
  if (!dock || !handle || handle.dataset.dragBound === '1') return;
  handle.dataset.dragBound = '1';

  restoreSocialDockPosition();

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let dragging = false;
  const DRAG_THRESHOLD = 10;

  handle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    const rect = dock.getBoundingClientRect();
    originX = rect.left;
    originY = rect.top;
    dragging = false;
    handle.setPointerCapture?.(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (pointerId !== e.pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!dragging) {
      dragging = true;
      suppressSocialToggleClick = true;
      dock.classList.add('is-dragging');
    }
    e.preventDefault();
    applySocialDockPosition(originX + dx, originY + dy);
  });

  const finishDrag = (e) => {
    if (pointerId !== e.pointerId) return;
    handle.releasePointerCapture?.(e.pointerId);
    dock.classList.remove('is-dragging');
    if (dragging) {
      saveSocialDockPosition();
      setTimeout(() => { suppressSocialToggleClick = false; }, 50);
    }
    pointerId = null;
    dragging = false;
  };

  handle.addEventListener('pointerup', finishDrag);
  handle.addEventListener('pointercancel', finishDrag);
}

function openFriendsPanel() {
  panelOpen = true;
  els.friendsPanel?.classList.remove('hidden');
}

async function showBrowserInviteNotification(fromName, roomCode) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const title = `🎮 Invitación de ${fromName}`;
  const body = `Sala ${roomCode} — pulsa para entrar`;
  const opts = {
    body,
    icon: 'assets/app-icon-192.png',
    badge: 'assets/cherry.png',
    tag: `room-invite-${roomCode}`,
    renotify: true,
    data: { type: 'room-invite', roomCode, url: location.href },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
    } else {
      new Notification(title, opts);
    }
  } catch (_) { /* ignore */ }
}

function notifyIncomingInvite(inv) {
  const fromName = inv.fromName || 'Amigo';
  const roomCode = inv.roomCode || '????';

  showToast(`🎮 ${fromName} te invita · sala ${roomCode}`, {
    duration: 8000,
    onClick: () => {
      openFriendsPanel();
      goToJugarRoom(roomCode);
    },
  });

  if (document.hidden || !document.hasFocus()) {
    showBrowserInviteNotification(fromName, roomCode);
  }

  try {
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  } catch (_) { /* ignore */ }
}

function dedupeInvites(list) {
  const byKey = new Map();
  for (const inv of list || []) {
    const key = `${inv.fromPlayerId}:${inv.roomCode}`;
    const prev = byKey.get(key);
    if (!prev || (inv.createdAt || 0) >= (prev.createdAt || 0)) {
      byKey.set(key, inv);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function handleInvitesUpdate(invites) {
  pendingInvites = dedupeInvites(invites);
  updateOnlineBadge();

  if (!invitesInboxReady) {
    pendingInvites.forEach((inv) => knownInviteIds.add(inv.id));
    invitesInboxReady = true;
    renderInvites(pendingInvites);
    return;
  }

  pendingInvites.forEach((inv) => {
    if (knownInviteIds.has(inv.id)) return;
    knownInviteIds.add(inv.id);
    notifyIncomingInvite(inv);
  });

  renderInvites(pendingInvites);
}

function renderDmMessages(messages) {
  if (!els.chatMessages) return;
  dmMessages = messages || [];
  const localId = getPlayerId();
  els.chatMessages.innerHTML = '';

  if (!dmMessages.length) {
    els.chatMessages.innerHTML = '<p class="social-chat-empty">Di hola 👋</p>';
    return;
  }

  dmMessages.forEach((msg) => {
    const mine = msg.fromPlayerId === localId;
    const senderId = mine ? localId : (msg.fromPlayerId || activeChat?.friendId || '');
    const senderName = mine
      ? (myUsername ? `@${myUsername}` : getPlayerName())
      : getFriendDisplayName(senderId, activeChat?.friendName || 'Amigo');
    const avatar = renderAvatarHtml(senderName, getProfilePhoto(senderId), 'social-chat-avatar--xs');
    const row = document.createElement('div');
    row.className = `social-chat-msg ${mine ? 'is-mine' : 'is-theirs'}${String(msg.id).startsWith('pending-') ? ' is-pending' : ''}`;
    row.innerHTML = `${avatar}<div class="social-chat-bubble">
      <span class="social-chat-text">${escapeHtml(msg.message)}</span>
      <time class="social-chat-time">${escapeHtml(formatTime(msg.createdAt))}</time>
    </div>`;
    els.chatMessages.appendChild(row);
  });

  if (stickBottom) {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}

function openFloatingChat(friendId, friendName) {
  activeChat = { friendId, friendName };
  chatMinimized = false;
  peerTyping = false;
  delete unreadByFriend[friendId];
  updateOnlineBadge();
  renderFriendsList();
  if (els.chatWindow) els.chatWindow.classList.remove('hidden', 'is-minimized');
  renderChatHeader(friendId, friendName);
  bindFriendTyping(friendId);

  if (dmUnsub) dmUnsub();
  dmUnsub = CloudManager.subscribeFriendMessages(
    friendId,
    renderDmMessages,
    () => showToast('Error al cargar mensajes — recarga con Ctrl+F5.')
  );
  stickBottom = true;
  panelOpen = false;
  if (els.friendsPanel) els.friendsPanel.classList.add('hidden');
}

function closeFloatingChat() {
  stopLocalTyping();
  if (typingUnsub) {
    typingUnsub();
    typingUnsub = null;
  }
  peerTyping = false;
  activeChat = null;
  dmMessages = [];
  if (dmUnsub) {
    dmUnsub();
    dmUnsub = null;
  }
  if (els.chatWindow) els.chatWindow.classList.add('hidden');
}

function toggleFriendsPanel() {
  panelOpen = !panelOpen;
  els.friendsPanel?.classList.toggle('hidden', !panelOpen);
  if (panelOpen && els.chatWindow && !chatMinimized) {
    els.chatWindow.classList.add('hidden');
  }
}

async function sendActiveChatMessage(text) {
  if (!activeChat) return;
  const msg = (text || '').trim();
  if (!msg) return;

  await stopLocalTyping();

  const pendingId = `pending-${Date.now()}`;
  const optimistic = {
    id: pendingId,
    fromPlayerId: getPlayerId(),
    message: msg,
    createdAt: Date.now(),
  };
  renderDmMessages([...dmMessages, optimistic]);
  stickBottom = true;

  if (els.chatInput) {
    els.chatInput.value = '';
    els.chatInput.disabled = true;
  }

  const result = await CloudManager.sendFriendMessage(activeChat.friendId, msg);
  if (!result.success) {
    renderDmMessages(dmMessages.filter((m) => m.id !== pendingId));
    showToast(result.message || 'No se pudo enviar.');
  }

  if (els.chatInput) els.chatInput.disabled = false;
  els.chatInput?.focus({ preventScroll: true });
}

async function onAddFriend(event) {
  event.preventDefault();

  if (!myUsername) {
    setFriendsStatus('Primero elige tu usuario arriba.', true);
    els.usernameInput?.focus({ preventScroll: true });
    return;
  }

  const userInput = normalizeUsernameInput(els.addFriendUser?.value);
  if (!userInput || userInput.length < 3) {
    setFriendsStatus('Escribe el usuario del amigo (ej: sophie).', true);
    return;
  }

  if (userInput === myUsername) {
    setFriendsStatus('No puedes añadirte a ti mismo.', true);
    return;
  }

  const result = await CloudManager.addFriend(userInput);
  if (!result.success) {
    setFriendsStatus(result.message || 'No se pudo enviar.', true);
    return;
  }

  if (els.addFriendUser) els.addFriendUser.value = '';
  setFriendsStatus(result.message || `Solicitud enviada a @${userInput}.`);
  showToast('Solicitud enviada 📨');
}

async function onAcceptFriendRequest(fromPlayerId) {
  setFriendsStatus('Aceptando…');
  const result = await CloudManager.acceptFriendRequestFrom(fromPlayerId);
  if (!result.success) {
    setFriendsStatus(result.message || 'No se pudo aceptar.', true);
    return;
  }
  setFriendsStatus('¡Ahora sois amigos!');
  showToast('Amigo/a añadido/a ✅');
}

async function onDeclineFriendRequest(fromPlayerId) {
  await CloudManager.declineFriendRequestFrom(fromPlayerId);
  setFriendsStatus('Solicitud rechazada.');
}

async function onInviteFriend(friendId, friendName = '') {
  const currentRoom = CloudManager.getCurrentRoom?.();
  setFriendsStatus(
    currentRoom
      ? `Invitando a la sala ${currentRoom.code}…`
      : 'Creando sala e invitando…'
  );
  const result = await CloudManager.inviteFriendToRoom(friendId, friendName);
  if (!result.success) {
    setFriendsStatus(result.message || 'No se pudo invitar.', true);
    return;
  }

  if (result.roomCreated) {
    setFriendsStatus(`Sala ${result.roomCode} creada — invitación enviada.`);
    showToast(`Sala ${result.roomCode} · abriendo juego…`);
    goToJugarRoom(result.roomCode);
    return;
  }

  const room = CloudManager.getCurrentRoom?.();
  const count = room?.players?.length ?? '?';
  const max = room?.maxPlayers ?? 4;
  setFriendsStatus(`Invitación enviada · sala ${result.roomCode} (${count}/${max}).`);
  showToast(`Invitación enviada 🎮 · ${count}/${max} en sala`);
}

async function onAcceptInvite(inviteId, roomCode) {
  await CloudManager.respondToRoomInvite(inviteId, true);
  showToast(`Entrando en sala ${roomCode}…`);
  goToJugarRoom(roomCode);
}

function revealDock() {
  if (globalThis.__FILE_PROTOCOL__) return;
  els.dock?.classList.remove('hidden');
  bindSocialDockDrag();
}

function initSocialListeners() {
  const name = getPlayerName();
  if (name && name !== 'Jugador') PlayerIdentity.setPlayerName(name);
  CloudManager.initSocialLayer(getPlayerName());

  refreshMyUsername();

  if (friendsUnsub) friendsUnsub();
  friendsUnsub = CloudManager.subscribeFriendsList((list) => {
    friends = list;
    syncFriendPresences(list);
    renderFriendsList();
    refreshFriendPhotos(list);
  });

  if (invitesUnsub) invitesUnsub();
  invitesInboxReady = false;
  knownInviteIds = new Set();
  invitesUnsub = CloudManager.subscribeIncomingInvites(
    handleInvitesUpdate,
    () => showToast('Error al cargar invitaciones — recarga con Ctrl+F5.')
  );

  if (friendRequestsUnsub) friendRequestsUnsub();
  friendRequestsInboxReady = false;
  knownFriendRequestIds = new Set();
  friendRequestsUnsub = CloudManager.subscribeFriendRequests(handleFriendRequestsUpdate);

  if (dmInboxUnsub) dmInboxUnsub();
  dmInboxReady = false;
  knownInboxMessageIds = new Set();
  dmInboxUnsub = CloudManager.subscribeIncomingFriendDms(handleDmInbox);

  if (roomUnsub) roomUnsub();
  roomUnsub = CloudManager.subscribeToRoom?.(() => {
    renderFriendsList();
  }) || null;

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && globalThis.PushNotifications?.subscribe) {
    globalThis.PushNotifications.subscribe().catch(() => {});
  }
}

function startSocial() {
  if (globalThis.__FILE_PROTOCOL__) return;
  revealDock();
  initSocialListeners();
  CloudManager.whenSessionReady?.().catch(() => {});
}

function cacheElements() {
  els.dock = $('social-dock');
  els.friendsToggle = $('social-friends-toggle');
  els.friendsPanel = $('social-friends-panel');
  els.friendsList = $('social-friends-list');
  els.friendsStatus = $('social-friends-status');
  els.friendsBadge = $('social-friends-badge');
  els.usernameForm = $('social-username-form');
  els.usernameInput = $('social-username-input');
  els.usernameDisplay = $('social-username-display');
  els.myUsername = $('social-my-username');
  els.myPhotoPreview = $('social-my-photo-preview');
  els.profilePhotoBtn = $('social-profile-photo-btn');
  els.profilePhotoInput = $('social-profile-photo-input');
  els.copyUsernameBtn = $('social-copy-username');
  els.addFriendForm = $('social-add-friend-form');
  els.addFriendUser = $('social-add-friend-user');
  els.invitesWrap = $('social-invites-wrap');
  els.friendRequestsWrap = $('social-friend-requests-wrap');
  els.chatWindow = $('social-chat-window');
  els.chatTitle = $('social-chat-title');
  els.chatMessages = $('social-chat-messages');
  els.chatForm = $('social-chat-form');
  els.chatInput = $('social-chat-input');
  els.chatMinBtn = $('social-chat-minimize');
  els.chatCloseBtn = $('social-chat-close');
  els.toast = $('social-toast');
}

function bindEvents() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      handleSocialPushAction(event.data || {});
    });
  }

  els.friendsToggle?.addEventListener('click', (e) => {
    if (suppressSocialToggleClick) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    toggleFriendsPanel();
  });
  els.usernameForm?.addEventListener('submit', onClaimUsername);
  els.addFriendForm?.addEventListener('submit', onAddFriend);

  els.copyUsernameBtn?.addEventListener('click', async () => {
    if (!myUsername) return;
    const text = `@${myUsername}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Usuario copiado');
    } catch (_) {
      showToast(text);
    }
  });

  els.profilePhotoBtn?.addEventListener('click', () => {
    els.profilePhotoInput?.click();
  });
  els.profilePhotoInput?.addEventListener('change', onProfilePhotoSelected);

  els.friendsList?.addEventListener('click', (e) => {
    const previewBtn = e.target.closest('.social-avatar-preview');
    if (previewBtn) {
      openAvatarLightbox(previewBtn.dataset.playerId, previewBtn.dataset.friendName || '');
      return;
    }
    const chatBtn = e.target.closest('.social-chat-open');
    if (chatBtn) {
      openFloatingChat(chatBtn.dataset.friendId, chatBtn.dataset.friendName || 'Amigo');
      return;
    }
    const inviteBtn = e.target.closest('.social-room-invite');
    if (inviteBtn) {
      onInviteFriend(inviteBtn.dataset.friendId, inviteBtn.dataset.friendName || '');
      return;
    }
    const removeBtn = e.target.closest('.social-friend-remove');
    if (removeBtn) {
      CloudManager.removeFriend(removeBtn.dataset.friendId);
      setFriendsStatus('Amigo eliminado.');
    }
  });

  els.friendRequestsWrap?.addEventListener('click', (e) => {
    const accept = e.target.closest('.social-friend-accept');
    if (accept) {
      onAcceptFriendRequest(accept.dataset.fromId);
      return;
    }
    const decline = e.target.closest('.social-friend-decline');
    if (decline) {
      onDeclineFriendRequest(decline.dataset.fromId);
    }
  });

  els.invitesWrap?.addEventListener('click', (e) => {
    const accept = e.target.closest('.social-invite-accept');
    if (accept) {
      onAcceptInvite(accept.dataset.inviteId, accept.dataset.room);
      return;
    }
    const decline = e.target.closest('.social-invite-decline');
    if (decline) {
      CloudManager.respondToRoomInvite(decline.dataset.inviteId, false);
    }
  });

  els.chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    sendActiveChatMessage(els.chatInput?.value || '');
  });

  els.chatInput?.addEventListener('input', onChatInputActivity);
  els.chatInput?.addEventListener('blur', () => {
    stopLocalTyping();
  });

  els.chatMinBtn?.addEventListener('click', () => {
    chatMinimized = !chatMinimized;
    els.chatWindow?.classList.toggle('is-minimized', chatMinimized);
  });

  els.chatCloseBtn?.addEventListener('click', closeFloatingChat);

  els.chatTitle?.addEventListener('click', (e) => {
    const previewBtn = e.target.closest('.social-avatar-preview');
    if (previewBtn && activeChat) {
      openAvatarLightbox(previewBtn.dataset.playerId, previewBtn.dataset.friendName || activeChat.friendName);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAvatarLightbox();
  });

  els.chatMessages?.addEventListener('scroll', () => {
    if (!els.chatMessages) return;
    const el = els.chatMessages;
    stickBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  });

  document.addEventListener('click', (e) => {
    if (!panelOpen || !els.friendsPanel || !els.dock) return;
    if (els.dock.contains(e.target)) return;
    panelOpen = false;
    els.friendsPanel.classList.add('hidden');
  });
}

export function initFriendsChatUi() {
  cacheElements();
  if (!els.dock) return;
  bindEvents();
  bindSocialDockDrag();
  handleDeepLinkHash();

  document.getElementById('btn-enter')?.addEventListener('click', () => {
    setTimeout(startSocial, 700);
  });

  if (!document.documentElement.classList.contains('intro-lock')) {
    startSocial();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFriendsChatUi);
} else {
  initFriendsChatUi();
}

export default { initFriendsChatUi };
