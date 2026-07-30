/**
 * CloudPresence — presença online/offline dos jogadores na nuvem.
 * Usado exclusivamente por cloud-manager.js.
 *
 * Estrutura Firestore por jogador:
 * rooms/{code}/players/{playerId}/
 *   profile/data   → identidade (id, name, joinedAt)
 *   presence/state → online, lastSeen
 *   stats/data     → (futuro)
 *   achievements/data → (futuro)
 */
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';

const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const PROFILE_COLLECTION = 'profile';
const PRESENCE_COLLECTION = 'presence';
const PROFILE_DOC_ID = 'data';
const PRESENCE_DOC_ID = 'state';

/** @typedef {Object} CloudProfile
 * @property {string} id
 * @property {string} name
 * @property {number} joinedAt
 */

/** @typedef {Object} CloudPresence
 * @property {boolean} online
 * @property {number} lastSeen
 */

/** @typedef {Object} CloudPlayer
 * @property {string} id
 * @property {string} name
 * @property {number} joinedAt
 * @property {CloudPresence} presence
 */

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function playerRootRef(db, roomCode, playerId) {
  return doc(db, ROOMS_COLLECTION, roomCode, PLAYERS_SUBCOLLECTION, playerId);
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function profileRef(db, roomCode, playerId) {
  return doc(
    db,
    ROOMS_COLLECTION,
    roomCode,
    PLAYERS_SUBCOLLECTION,
    playerId,
    PROFILE_COLLECTION,
    PROFILE_DOC_ID
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function presenceRef(db, roomCode, playerId) {
  return doc(
    db,
    ROOMS_COLLECTION,
    roomCode,
    PLAYERS_SUBCOLLECTION,
    playerId,
    PRESENCE_COLLECTION,
    PRESENCE_DOC_ID
  );
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {CloudProfile} player
 */
export function transactionCreatePlayer(transaction, db, roomCode, player) {
  const now = Date.now();
  transaction.set(playerRootRef(db, roomCode, player.id), {
    id: player.id,
    createdAt: serverTimestamp(),
  });
  transaction.set(profileRef(db, roomCode, player.id), {
    id: player.id,
    name: player.name,
    joinedAt: player.joinedAt,
  });
  transaction.set(presenceRef(db, roomCode, player.id), {
    online: true,
    lastSeen: now,
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function transactionDeletePlayer(transaction, db, roomCode, playerId) {
  transaction.delete(profileRef(db, roomCode, playerId));
  transaction.delete(presenceRef(db, roomCode, playerId));
  transaction.delete(
    doc(db, ROOMS_COLLECTION, roomCode, PLAYERS_SUBCOLLECTION, playerId, 'stats', 'data')
  );
  transaction.delete(playerRootRef(db, roomCode, playerId));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export async function setPlayerOnline(db, roomCode, playerId) {
  const now = Date.now();
  await setDoc(
    presenceRef(db, roomCode, playerId),
    { online: true, lastSeen: now, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export async function setPlayerOffline(db, roomCode, playerId) {
  const now = Date.now();
  try {
    await setDoc(
      presenceRef(db, roomCode, playerId),
      { online: false, lastSeen: now, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[CloudPresence] Erro ao marcar offline:', err);
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export async function touchPlayerPresence(db, roomCode, playerId) {
  const now = Date.now();
  await setDoc(
    presenceRef(db, roomCode, playerId),
    { online: true, lastSeen: now, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {Promise<boolean>}
 */
export async function playerExistsInRoom(db, roomCode, playerId) {
  const profileSnap = await getDoc(profileRef(db, roomCode, playerId));
  if (profileSnap.exists()) return true;

  const rootSnap = await getDoc(playerRootRef(db, roomCode, playerId));
  return rootSnap.exists();
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {Promise<CloudPlayer | null>}
 */
export async function fetchCloudPlayer(db, roomCode, playerId) {
  const profileSnap = await getDoc(profileRef(db, roomCode, playerId));
  const presenceSnap = await getDoc(presenceRef(db, roomCode, playerId));
  const rootSnap = await getDoc(playerRootRef(db, roomCode, playerId));

  if (!profileSnap.exists() && !rootSnap.exists()) return null;

  let id = playerId;
  let name = '';
  let joinedAt = 0;

  if (profileSnap.exists()) {
    const profile = profileSnap.data();
    id = typeof profile.id === 'string' ? profile.id : playerId;
    name = typeof profile.name === 'string' ? profile.name : '';
    joinedAt = typeof profile.joinedAt === 'number' ? profile.joinedAt : 0;
  } else if (rootSnap.exists()) {
    const legacy = rootSnap.data();
    id = typeof legacy.id === 'string' ? legacy.id : playerId;
    name = typeof legacy.name === 'string' ? legacy.name : '';
    joinedAt = typeof legacy.joinedAt === 'number' ? legacy.joinedAt : 0;
  }

  let online = false;
  let lastSeen = 0;
  if (presenceSnap.exists()) {
    const presence = presenceSnap.data();
    online = presence.online === true;
    lastSeen = typeof presence.lastSeen === 'number' ? presence.lastSeen : 0;
  }

  return {
    id,
    name,
    joinedAt,
    presence: { online, lastSeen },
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string[]} playerIds
 * @returns {Promise<CloudPlayer[]>}
 */
export async function fetchCloudPlayers(db, roomCode, playerIds) {
  const players = [];
  for (let i = 0; i < playerIds.length; i++) {
    const player = await fetchCloudPlayer(db, roomCode, playerIds[i]);
    if (player) players.push(player);
  }
  return players;
}

/**
 * @param {number} lastSeen
 * @returns {string}
 */
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'desconhecido';
  const diffMs = Date.now() - lastSeen;
  if (diffMs < 60000) return 'agora';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `há ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

/**
 * @param {CloudPlayer} player
 * @returns {string}
 */
export function getPresenceLabel(player) {
  if (player.presence.online) return 'online';
  if (player.presence.lastSeen) return formatLastSeen(player.presence.lastSeen);
  return 'offline';
}

const HEARTBEAT_MS = 25000;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatTimer = null;

/** @type {(() => void) | null} */
let lifecycleBound = null;

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function startPresenceLifecycle(db, roomCode, playerId) {
  stopPresenceLifecycle();

  heartbeatTimer = setInterval(() => {
    touchPlayerPresence(db, roomCode, playerId).catch(() => {});
  }, HEARTBEAT_MS);

  const goOffline = () => {
    setPlayerOffline(db, roomCode, playerId);
  };

  window.addEventListener('pagehide', goOffline);
  window.addEventListener('beforeunload', goOffline);
  lifecycleBound = goOffline;
}

export function stopPresenceLifecycle() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (lifecycleBound && typeof window !== 'undefined') {
    window.removeEventListener('pagehide', lifecycleBound);
    window.removeEventListener('beforeunload', lifecycleBound);
    lifecycleBound = null;
  }
}
