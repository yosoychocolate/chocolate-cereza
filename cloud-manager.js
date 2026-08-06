/**
 * CloudManager — camada única entre o jogo e serviços online.
 * Etapa 5: presença online/offline + estrutura escalável por jogador.
 * Nenhum outro arquivo do projeto deve importar firebase-manager.js diretamente.
 */
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  runTransaction,
  serverTimestamp,
  getFirestoreDb,
  initFirebase,
  isFirebaseReady,
  isFirebaseConfigValid,
  getFirebaseInitError,
} from './firebase-manager.js?v=7cbf9eb';
import { getSession, saveSession, clearSession, hasSession, saveLastRoomCode, getLastRoomCode } from './room-session.js?v=7cbf9eb';
import {
  playerRootRef,
  profileRef,
  transactionCreatePlayer,
  transactionDeletePlayer,
  setPlayerOnline,
  setPlayerOffline,
  playerExistsInRoom,
  fetchCloudPlayers,
  startPresenceLifecycle,
  stopPresenceLifecycle,
  getPresenceLabel,
  formatLastSeen,
  isPresenceOnline,
  normalizePresence,
} from './cloud-presence.js?v=7cbf9eb';
import { createRoomListener } from './cloud-listener.js?v=7cbf9eb';
import {
  createChatListener,
  sendPlayerMessage,
  sendSystemMessage,
  normalizeChatText,
  MAX_CHAT_LENGTH,
} from './cloud-chat.js?v=7cbf9eb';
import {
  startGlobalPresenceLifecycle,
  stopGlobalPresenceLifecycle,
  fetchGlobalPresence,
  isPresenceOnline as isGlobalPresenceOnline,
  globalPresenceRef,
} from './cloud-global-presence.js?v=7cbf9eb';
import {
  addFriendContact,
  removeFriendContact,
  subscribeFriends,
  fetchFriendProfileName,
} from './cloud-friends.js?v=7cbf9eb';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  friendRequestRef,
  subscribeIncomingFriendRequests,
} from './cloud-friend-requests.js?v=7cbf9eb';
import {
  sendGlobalDm,
  subscribeGlobalDm,
  subscribeIncomingGlobalDm,
  buildDmThreadId,
} from './cloud-global-dm.js?v=7cbf9eb';
import {
  setDmTyping,
  subscribePeerDmTyping,
} from './cloud-dm-typing.js?v=7cbf9eb';
import {
  sendGlobalLetter,
  deleteGlobalLetter,
  subscribeIncomingGlobalLetters,
  subscribeGlobalLettersThread,
  buildLetterThreadId,
  fetchLettersForPlayer,
} from './cloud-global-letters.js?v=7cbf9eb';
import {
  sendRoomInvite,
  subscribePendingInvites,
  subscribePendingInvitesByName,
  updateInviteStatus,
  updateInviteStatusByName,
} from './cloud-room-invites.js?v=7cbf9eb';
import {
  claimUsername,
  resolvePlayerId,
  fetchPlayerProfile,
  setPlayerPhotoUrl as persistPlayerPhotoUrl,
  setPlayerChatLang as persistPlayerChatLang,
  normalizeUsername,
} from './cloud-usernames.js?v=7cbf9eb';
import PlayerIdentity from './player-identity.js?v=7cbf9eb';
import { onSnapshot } from './firebase-manager.js?v=7cbf9eb';
import {
  coupleRef,
  createDefaultCoupleStats,
  fetchCoupleStats,
  applyScoreToCouple,
  applyPlayerStats,
  playerStatsRef,
  playerStatsFromSnapshot,
  transactionDeleteCouple,
} from './cloud-couple.js?v=7cbf9eb';
import {
  createChocolateGift,
  claimGiftTransaction,
  createGiftListener,
  normalizeGiftAmount,
  MIN_GIFT_AMOUNT,
  MAX_GIFT_AMOUNT,
} from './cloud-gifts.js?v=7cbf9eb';
import {
  ensureHubInitialized,
  subscribeHub,
  fetchHubSnapshot,
  updateHubSettings,
  addHubTask,
  toggleHubTask,
  deleteHubTask,
  addHubEvent,
  updateHubEvent,
  deleteHubEvent,
  addHubLetter,
  addHubMemory,
  deleteHubMemory,
  deleteHubLetter,
  completeHubDailyMission,
} from './cloud-hub.js?v=7cbf9eb';

/** @typedef {'ready' | 'config_invalid' | 'error' | 'disconnected'} ConnectionStatusCode */
/** @typedef {'waiting' | 'full' | 'closed'} RoomStatus */

/**
 * @typedef {Object} PlayerPresence
 * @property {boolean} online
 * @property {number} lastSeen
 */

/**
 * @typedef {Object} RoomPlayer
 * @property {string} id
 * @property {string} name
 * @property {number} joinedAt
 * @property {PlayerPresence} presence
 */

/**
 * @typedef {Object} LocalPlayer
 * @property {string} id
 * @property {string} name
 * @property {number} joinedAt
 */

/**
 * @typedef {Object} CoupleStats
 * @property {number} bestScore
 * @property {string|null} bestPlayerId
 * @property {string} bestPlayerName
 * @property {number} totalGames
 * @property {number} totalChocolate
 * @property {number|null} updatedAt
 */

/**
 * @typedef {Object} Room
 * @property {string} id
 * @property {string} code
 * @property {RoomStatus} status
 * @property {RoomPlayer[]} players
 * @property {number} maxPlayers
 * @property {'couple'|'party'} [roomKind]
 * @property {number|null} createdAt
 * @property {number|null} updatedAt
 */

const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const MAX_PLAYERS_COUPLE = 2;
const MAX_PLAYERS_PARTY = 4;
const MAX_PLAYERS = MAX_PLAYERS_COUPLE;
const CODE_LENGTH = 6;
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CODE_ATTEMPTS = 40;

/** @type {Room | null} */
let currentRoom = null;

/** @type {string | null} */
let currentPlayerId = null;

/** @type {Set<(event: object) => void>} */
const hubCallbacks = new Set();

/** @type {(() => void) | null} */
let hubUnsubscribe = null;

/** @type {CoupleStats | null} */
let currentCoupleStats = null;

/** @type {Promise<unknown> | null} */
let restorePromise = null;

/** Incrementado ao limpar sessão — evita restore concluir depois de sair. */
let restoreGeneration = 0;

const roomListener = createRoomListener(fetchRoom);
const chatListener = createChatListener();
const giftListener = createGiftListener();

/** @type {boolean} */
let socialPresenceActive = false;

/** @type {(() => void) | null} */
let unsubscribeFriendRequests = null;

/** @type {(() => void) | null} */
let unsubscribeFriends = null;

/** @type {(() => void) | null} */
let unsubscribeInvites = null;

/** @type {(() => void) | null} */
let unsubscribeInvitesByName = null;

/** @type {(() => void) | null} */
let unsubscribeIncomingDms = null;

/** @type {(() => void) | null} */
let unsubscribePersonalLetters = null;

/** @type {Set<string>} */
const processedGiftIds = new Set();

/** @type {boolean} */
let giftClaimInFlight = false;

roomListener.subscribe((event) => {
  if (event.type === 'room_updated' && event.room) {
    currentRoom = /** @type {Room} */ (event.room);
  } else if (event.type === 'presence_updated' && event.playerId && currentRoom) {
    const player = currentRoom.players.find((p) => p.id === event.playerId);
    if (player && event.presence) {
      player.presence = normalizePresence(event.presence);
    }
  } else if (event.type === 'couple_updated' && event.couple) {
    currentCoupleStats = /** @type {CoupleStats} */ (event.couple);
  } else if (event.type === 'room_removed') {
    clearLocalRoom();
  }
});

function notifyHubListeners(payload) {
  hubCallbacks.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.warn('[CloudManager] hub callback:', err);
    }
  });
}

function stopHubSync() {
  if (hubUnsubscribe) {
    hubUnsubscribe();
    hubUnsubscribe = null;
  }
}

function startHubSync() {
  stopHubSync();
  if (!currentRoom || hubCallbacks.size === 0) return;

  const db = requireDb();
  const code = currentRoom.code;

  ensureHubInitialized(db, code).catch((err) => {
    console.warn('[CloudManager] ensureHubInitialized:', err);
  });

  hubUnsubscribe = subscribeHub(db, code, notifyHubListeners);
}

function startRoomListener() {
  if (!currentRoom) return;
  try {
    const db = requireDb();
    roomListener.start(db, currentRoom.code);
    chatListener.start(db, currentRoom.code);
    if (currentPlayerId) {
      giftListener.start(db, currentRoom.code, currentPlayerId);
    }
  } catch (err) {
    console.warn('[CloudManager] Listener não iniciado:', err);
  }
}

function stopRoomListener() {
  roomListener.stop();
  chatListener.stop();
  giftListener.stop();
  processedGiftIds.clear();
}

/**
 * Envia mensagens românticas/leves após pontuação (fire-and-forget).
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} score
 * @param {{ isNewBest: boolean, stats: CoupleStats }} result
 * @param {CoupleStats | null} prevCouple
 */
async function postScoreChatMessages(db, roomCode, playerId, playerName, score, result, prevCouple) {
  const prevBestId = prevCouple?.bestPlayerId ?? null;
  const prevBestName = prevCouple?.bestPlayerName ?? '';
  const prevBestScore = prevCouple?.bestScore ?? 0;

  if (result.isNewBest) {
    if (prevBestId && prevBestId !== playerId && prevBestName) {
      await sendSystemMessage(
        db,
        roomCode,
        `🏆 ¡${playerName} le robó la corona a ${prevBestName}!`
      );
    } else {
      await sendSystemMessage(db, roomCode, `🏆 ¡${playerName} batió el récord!`);
    }
    return;
  }

  if (prevBestId && prevBestId !== playerId && prevBestScore > 0) {
    const gap = prevBestScore - score;
    if (gap > 0 && gap <= 30) {
      await sendSystemMessage(db, roomCode, `🍒 ${playerName} está casi alcanzándote…`);
    }
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerName
 */
async function postJoinChatMessage(db, roomCode, playerName) {
  await sendSystemMessage(
    db,
    roomCode,
    `❤️ ${playerName} llegó. ¡Ahora la disputa comenzó!`
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerName
 */
async function postLeaveChatMessage(db, roomCode, playerName) {
  await sendSystemMessage(db, roomCode, `🍫 ${playerName} salió de la sala.`);
}

function refreshConnection() {
  initFirebase();
}

refreshConnection();

function fail(code, message) {
  return { success: false, error: code, message };
}

function ok(payload) {
  if (
    payload
    && typeof payload === 'object'
    && !Array.isArray(payload)
    && typeof payload.code === 'string'
    && Array.isArray(payload.players)
  ) {
    return { success: true, room: payload };
  }
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return { success: true, ...payload };
  }
  return { success: true, value: payload };
}

/**
 * @returns {import('firebase/firestore').Firestore}
 */
function requireDb() {
  refreshConnection();
  if (!isFirebaseReady()) {
    throw new Error('Firebase no conectado.');
  }
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore no disponible.');
  }
  return db;
}

function playersCollection(db, roomCode) {
  return collection(db, ROOMS_COLLECTION, roomCode, PLAYERS_SUBCOLLECTION);
}

function roomDocRef(db, roomCode) {
  return doc(db, ROOMS_COLLECTION, roomCode);
}

/**
 * @param {unknown} player
 * @returns {LocalPlayer | null}
 */
function normalizePlayer(player) {
  if (!player || typeof player !== 'object') return null;
  const id = typeof player.id === 'string' ? player.id.trim() : '';
  if (!id) return null;
  const name = typeof player.name === 'string' ? player.name.trim() : '';
  const joinedAt =
    typeof player.joinedAt === 'number' && Number.isFinite(player.joinedAt)
      ? player.joinedAt
      : Date.now();
  return { id, name, joinedAt };
}

function randomRoomCode() {
  let code = '';
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return code;
}

/**
 * @param {import('firebase/firestore').DocumentSnapshot} roomSnap
 * @param {RoomPlayer[]} players
 * @returns {Room}
 */
function buildRoom(roomSnap, players) {
  const data = roomSnap.data() || {};
  const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : MAX_PLAYERS_COUPLE;
  const roomKind = data.roomKind === 'party' || maxPlayers > MAX_PLAYERS_COUPLE ? 'party' : 'couple';
  return {
    id: roomSnap.id,
    code: typeof data.code === 'string' ? data.code : roomSnap.id,
    status: data.status === 'full' || data.status === 'closed' ? data.status : 'waiting',
    players,
    maxPlayers,
    roomKind,
    createdAt: data.createdAt?.toMillis?.() ?? null,
    updatedAt: data.updatedAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @returns {Promise<Room | null>}
 */
async function fetchRoom(db, roomCode) {
  const roomSnap = await getDoc(roomDocRef(db, roomCode));
  if (!roomSnap.exists()) return null;

  const playersSnap = await getDocs(query(playersCollection(db, roomCode)));
  const playerIds = playersSnap.docs.map((d) => d.id);
  const players = await fetchCloudPlayers(db, roomCode, playerIds);
  return buildRoom(roomSnap, players);
}

function resolvePlayerCount(roomData, listedPlayerCount) {
  const listed = Math.max(0, listedPlayerCount);
  const stored =
    typeof roomData.playerCount === 'number' && Number.isFinite(roomData.playerCount)
      ? Math.max(0, roomData.playerCount)
      : null;
  // Si el contador guardado es mayor que los documentos reales, está desactualizado.
  if (stored !== null && stored > listed) return listed;
  if (stored !== null) return Math.max(stored, listed);
  return listed;
}

/** Repara profile/presencia si el jugador ya está en la sala pero incompleto. */
async function repairPlayerMembership(db, roomCode, player) {
  const profileSnap = await getDoc(profileRef(db, roomCode, player.id));
  if (!profileSnap.exists()) {
    await writePlayerCloud(db, roomCode, player);
    return;
  }
  await setDoc(
    profileRef(db, roomCode, player.id),
    { id: player.id, name: player.name, joinedAt: player.joinedAt },
    { merge: true }
  );
  await setPlayerOnline(db, roomCode, player.id);
}

function persistSession(room, player) {
  saveSession({
    roomCode: room.code,
    playerId: player.id,
    playerName: player.name,
    joinedAt: player.joinedAt,
  });
}

function setLocalRoom(room, playerId) {
  currentRoom = room;
  currentPlayerId = playerId;
  if (room && hubCallbacks.size > 0) {
    startHubSync();
  }
}

function clearLocalRoom() {
  restoreGeneration += 1;
  stopRoomListener();
  stopPresenceLifecycle();
  stopHubSync();
  currentRoom = null;
  currentPlayerId = null;
  currentCoupleStats = null;
  processedGiftIds.clear();
  clearSession();
}

/**
 * Credita chocolates recebidos de presentes pendentes.
 * @param {import('./cloud-gifts.js').ChocolateGift[]} gifts
 */
async function processPendingGifts(gifts) {
  if (!currentRoom || !currentPlayerId || !gifts?.length || giftClaimInFlight) return;

  giftClaimInFlight = true;
  try {
    const db = requireDb();
    for (let i = 0; i < gifts.length; i++) {
      const gift = gifts[i];
      if (!gift?.id || processedGiftIds.has(gift.id)) continue;
      if (gift.status !== 'pending' || gift.toPlayerId !== currentPlayerId) continue;

      processedGiftIds.add(gift.id);

      let claimed = null;
      try {
        claimed = await claimGiftTransaction(db, currentRoom.code, gift.id, currentPlayerId);
      } catch (err) {
        processedGiftIds.delete(gift.id);
        console.warn('[CloudManager] claim gift failed:', err);
        continue;
      }

      if (!claimed?.amount) continue;

      const shop = typeof globalThis !== 'undefined' ? globalThis.GameShop : null;
      if (shop?.addCoins) {
        shop.addCoins(claimed.amount);
      }

      if (typeof globalThis !== 'undefined') {
        globalThis.dispatchEvent(new CustomEvent('couple:gift-received', {
          detail: {
            amount: claimed.amount,
            fromName: claimed.fromPlayerName || gift.fromPlayerName || 'Tu pareja',
            giftId: gift.id,
          },
        }));
      }
    }
  } finally {
    giftClaimInFlight = false;
  }
}

giftListener.subscribe((event) => {
  if (event.type === 'gift_pending') {
    processPendingGifts(event.gifts).catch((err) => {
      console.warn('[CloudManager] processPendingGifts:', err);
    });
  }
});

/**
 * Parceiro(a) na sala atual (outro jogador).
 * @returns {RoomPlayer | null}
 */
export function getPartnerPlayer() {
  if (!currentRoom || !currentPlayerId) return null;
  return currentRoom.players.find((p) => p.id !== currentPlayerId) || null;
}

/**
 * Envia chocolates 🍫 da carteira local para o parceiro na sala.
 * @param {number} amount
 */
export async function sendChocolateGift(amount) {
  if (!currentRoom || !currentPlayerId) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  const partner = getPartnerPlayer();
  if (!partner) {
    return fail('NO_PARTNER', 'Tu pareja aún no está en la sala.');
  }

  const normalized = normalizeGiftAmount(amount);
  if (!normalized) {
    return fail('INVALID_AMOUNT', `Cantidad inválida (${MIN_GIFT_AMOUNT}–${MAX_GIFT_AMOUNT}).`);
  }

  const shop = typeof globalThis !== 'undefined' ? globalThis.GameShop : null;
  if (!shop?.getWallet || shop.getWallet() < normalized) {
    return fail('INSUFFICIENT_WALLET', 'No tienes suficientes chocolates 🍫.');
  }

  const local = getLocalPlayer();
  const fromName = local?.name || 'Jugador';

  try {
    const db = requireDb();
    const created = await createChocolateGift(db, currentRoom.code, {
      fromPlayerId: currentPlayerId,
      fromPlayerName: fromName,
      toPlayerId: partner.id,
      toPlayerName: partner.name || 'Pareja',
      amount: normalized,
    });

    const spent = shop.spendCoins(normalized);
    if (!spent.ok) {
      return fail('INSUFFICIENT_WALLET', 'No tienes suficientes chocolates 🍫.');
    }

    await sendSystemMessage(
      db,
      currentRoom.code,
      `🎁 ${fromName} envió ${normalized.toLocaleString('es')} 🍫 a ${partner.name || 'su pareja'}`
    );

    if (typeof globalThis !== 'undefined') {
      globalThis.dispatchEvent(new CustomEvent('couple:gift-sent', {
        detail: {
          amount: normalized,
          toName: partner.name || 'Pareja',
          giftId: created.id,
        },
      }));
    }

    return { success: true, amount: normalized, partnerName: partner.name, giftId: created.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('GIFT_FAILED', message);
  }
}

/**
 * Remove estado local obsoleto (sessão órfã, sala apagada/fechada ou jogador removido).
 */
async function reconcileLocalRoomState() {
  const session = getSession();

  if (!currentRoom && session) {
    try {
      const db = requireDb();
      const roomSnap = await getDoc(roomDocRef(db, session.roomCode));
      if (!roomSnap.exists()) {
        clearLocalRoom();
        return;
      }
      const data = roomSnap.data() || {};
      if (data.status === 'closed') {
        clearLocalRoom();
        return;
      }
      const exists = await playerExistsInRoom(db, session.roomCode, session.playerId);
      if (!exists) {
        clearLocalRoom();
      }
    } catch (err) {
      console.warn('[CloudManager] reconcileLocalRoomState (session):', err);
      clearLocalRoom();
    }
    return;
  }

  if (!currentRoom || !currentPlayerId) return;

  try {
    const db = requireDb();
    const roomSnap = await getDoc(roomDocRef(db, currentRoom.code));
    if (!roomSnap.exists()) {
      clearLocalRoom();
      return;
    }
    const data = roomSnap.data() || {};
    if (data.status === 'closed') {
      clearLocalRoom();
      return;
    }
    const exists = await playerExistsInRoom(db, currentRoom.code, currentPlayerId);
    if (!exists) {
      clearLocalRoom();
    }
  } catch (err) {
    console.warn('[CloudManager] reconcileLocalRoomState:', err);
    clearLocalRoom();
  }
}

/** Valida la sala local contra Firebase y limpia sesiones obsoletas. */
export async function ensureCleanRoomState() {
  await reconcileLocalRoomState();
}

/** Limpia por completo la sesión local de sala (recuperación manual). */
export function forceClearRoomSession() {
  clearLocalRoom();
  return { success: true };
}

/** Reentra en una sala — limpia estado local y vuelve a unir. */
export async function rejoinRoom(code, player) {
  forceClearRoomSession();
  await reconcileLocalRoomState();
  return joinRoom(code, player);
}

export function getSavedRoomCode() {
  return getLastRoomCode() || getSession()?.roomCode || null;
}

/**
 * Marca o jogador local como online e inicia heartbeat + lifecycle.
 */
async function activateLocalPresence() {
  if (!currentRoom || !currentPlayerId) return;

  const db = requireDb();
  await setPlayerOnline(db, currentRoom.code, currentPlayerId);
  startPresenceLifecycle(db, currentRoom.code, currentPlayerId);

  const refreshed = await fetchRoom(db, currentRoom.code);
  if (refreshed) {
    currentRoom = refreshed;
  }
  startRoomListener();
}

/**
 * @returns {boolean}
 */
export function isConnected() {
  refreshConnection();
  return isFirebaseReady();
}

/**
 * @returns {{
 *   connected: boolean,
 *   status: ConnectionStatusCode,
 *   provider: string,
 *   error: string | null
 * }}
 */
export function getConnectionStatus() {
  refreshConnection();

  if (!isFirebaseConfigValid()) {
    return {
      connected: false,
      status: 'config_invalid',
      provider: 'firebase',
      error: 'Configuración de Firebase inválida.',
    };
  }

  const initError = getFirebaseInitError();
  if (initError) {
    return {
      connected: false,
      status: 'error',
      provider: 'firebase',
      error: initError.message,
    };
  }

  if (isFirebaseReady()) {
    return {
      connected: true,
      status: 'ready',
      provider: 'firebase',
      error: null,
    };
  }

  return {
    connected: false,
    status: 'disconnected',
    provider: 'firebase',
    error: null,
  };
}

/**
 * @returns {LocalPlayer | null}
 */
export function getLocalPlayer() {
  const session = getSession();
  if (session) {
    return {
      id: session.playerId,
      name: session.playerName,
      joinedAt: session.joinedAt,
    };
  }

  if (currentPlayerId && currentRoom) {
    const found = currentRoom.players.find((p) => p.id === currentPlayerId);
    if (found) {
      return { id: found.id, name: found.name, joinedAt: found.joinedAt };
    }
  }

  return null;
}

/**
 * Retorna presença atualizada de todos os jogadores da sala.
 */
export async function getRoomPresence() {
  if (!currentRoom) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  try {
    const db = requireDb();
    const playerIds = currentRoom.players.map((p) => p.id);
    const players = await fetchCloudPlayers(db, currentRoom.code, playerIds);

    const roomSnap = await getDoc(roomDocRef(db, currentRoom.code));
    if (roomSnap.exists()) {
      currentRoom = buildRoom(roomSnap, players);
    }

    return {
      success: true,
      players: players.map((p) => ({
        ...p,
        presenceLabel: getPresenceLabel(p),
        lastSeenLabel: isPresenceOnline(p.presence) ? 'online' : formatLastSeen(p.presence.lastSeen),
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('PRESENCE_FAILED', message);
  }
}

/**
 * Retorna estatísticas compartilhadas do casal na sala atual.
 */
export async function getCoupleStats() {
  if (!currentRoom) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  try {
    const db = requireDb();
    const couple = await fetchCoupleStats(db, currentRoom.code);
    currentCoupleStats = couple;
    return { success: true, couple };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('COUPLE_STATS_FAILED', message);
  }
}

/**
 * Envia pontuação de uma partida para o ranking compartilhado do casal.
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} score
 */
export async function submitScore(playerId, playerName, score) {
  if (!currentRoom) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  const pid = typeof playerId === 'string' ? playerId.trim() : '';
  const pname = typeof playerName === 'string' ? playerName.trim() : '';

  if (!pid) {
    return fail('INVALID_PLAYER', 'playerId inválido.');
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return fail('INVALID_SCORE', 'Puntuación inválida.');
  }

  try {
    const db = requireDb();
    const roomCode = currentRoom.code;
    const prevCouple = currentCoupleStats ? { ...currentCoupleStats } : null;

    const result = await runTransaction(db, async (transaction) => {
      const coupleSnap = await transaction.get(coupleRef(db, roomCode));
      const statsSnap = await transaction.get(playerStatsRef(db, roomCode, pid));
      const coupleResult = applyScoreToCouple(transaction, coupleSnap, db, roomCode, pid, pname, score);
      const playerStats = applyPlayerStats(transaction, statsSnap, db, roomCode, pid, score);
      return { ...coupleResult, playerStats };
    });

    currentCoupleStats = result.stats;

    postScoreChatMessages(db, roomCode, pid, pname, score, result, prevCouple).catch((err) => {
      console.warn('[CloudManager] postScoreChatMessages:', err);
    });

    return {
      success: true,
      couple: result.stats,
      isNewBest: result.isNewBest,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('SUBMIT_SCORE_FAILED', message);
  }
}

/**
 * Ranking da sala (melhor pontuação por jogador).
 */
export async function getCoupleRanking() {
  if (!currentRoom) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  try {
    const db = requireDb();
    const room = currentRoom;
    const ranking = [];

    for (let i = 0; i < room.players.length; i++) {
      const player = room.players[i];
      const statsSnap = await getDoc(playerStatsRef(db, room.code, player.id));
      const stats = playerStatsFromSnapshot(statsSnap);
      ranking.push({
        id: player.id,
        name: player.name,
        bestScore: stats.bestScore,
        lastScore: stats.lastScore,
        gamesPlayed: stats.gamesPlayed,
        online: isPresenceOnline(player.presence),
        isCoupleBest: currentCoupleStats?.bestPlayerId === player.id,
      });
    }

    ranking.sort((a, b) => b.bestScore - a.bestScore);

    return { success: true, ranking };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('RANKING_FAILED', message);
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<string>}
 */
async function generateUniqueRoomCode(db) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomRoomCode();
    const snap = await getDoc(roomDocRef(db, code));
    if (!snap.exists()) return code;
  }
  throw new Error('No se pudo generar un código de sala único.');
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {LocalPlayer} player
 */
async function writePlayerCloud(db, roomCode, player) {
  await setDoc(playerRootRef(db, roomCode, player.id), {
    id: player.id,
    createdAt: serverTimestamp(),
  });
  await setDoc(profileRef(db, roomCode, player.id), {
    id: player.id,
    name: player.name,
    joinedAt: player.joinedAt,
  });
  await setPlayerOnline(db, roomCode, player.id);
}

export async function restoreSession() {
  const generation = restoreGeneration;
  const session = getSession();
  if (!session) {
    return fail('NO_SESSION', 'No hay sesión de sala guardada.');
  }

  if (currentRoom) {
    return { success: true, room: getCurrentRoom(), restored: true };
  }

  try {
    const db = requireDb();
    const roomSnap = await getDoc(roomDocRef(db, session.roomCode));
    if (generation !== restoreGeneration) {
      return fail('RESTORE_CANCELLED', 'Restauración cancelada.');
    }
    if (!roomSnap.exists()) {
      clearLocalRoom();
      return fail('ROOM_NOT_FOUND', 'La sala ya no existe.');
    }

    const roomData = roomSnap.data() || {};
    if (roomData.status === 'closed') {
      clearLocalRoom();
      return fail('ROOM_CLOSED', 'La sala está cerrada.');
    }

    const exists = await playerExistsInRoom(db, session.roomCode, session.playerId);
    if (generation !== restoreGeneration) {
      return fail('RESTORE_CANCELLED', 'Restauración cancelada.');
    }
    if (!exists) {
      saveLastRoomCode(session.roomCode);
      const rejoinPlayer = {
        id: session.playerId,
        name: session.playerName,
        joinedAt: session.joinedAt,
      };
      clearLocalRoom();
      if (generation !== restoreGeneration) {
        return fail('RESTORE_CANCELLED', 'Restauración cancelada.');
      }
      const rejoin = await joinRoom(session.roomCode, rejoinPlayer);
      if (rejoin.success) {
        return { success: true, room: getCurrentRoom(), restored: true, rejoined: true };
      }
      return fail('PLAYER_NOT_FOUND', rejoin.message || 'Ya no estás en esta sala. Pulsa Entrar con el código.');
    }

    const room = await fetchRoom(db, session.roomCode);
    if (!room) {
      clearLocalRoom();
      return fail('ROOM_NOT_FOUND', 'La sala ya no existe.');
    }

    if (room.status === 'closed') {
      clearLocalRoom();
      return fail('ROOM_CLOSED', 'La sala está cerrada.');
    }

    if (generation !== restoreGeneration) {
      return fail('RESTORE_CANCELLED', 'Restauración cancelada.');
    }

    setLocalRoom(room, session.playerId);
    persistSession(room, { id: session.playerId, name: session.playerName, joinedAt: session.joinedAt });
    await activateLocalPresence();
    await ensureHubInitialized(db, session.roomCode).catch((err) => {
      console.warn('[CloudManager] ensureHubInitialized restore:', err);
    });
    startRoomListener();
    return { success: true, room: getCurrentRoom(), restored: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('RESTORE_FAILED', message);
  }
}

export async function whenSessionReady() {
  if (!restorePromise) return;
  const RESTORE_TIMEOUT_MS = 20000;
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Tiempo de espera al restaurar la sesión — recarga la página (Ctrl+F5).')),
      RESTORE_TIMEOUT_MS
    );
  });
  try {
    await Promise.race([restorePromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createRoom(player, options = {}) {
  const normalized = normalizePlayer(player);
  if (!normalized) {
    return fail('INVALID_PLAYER', 'Jugador inválido — indica un id.');
  }

  const maxPlayers = typeof options.maxPlayers === 'number'
    ? Math.min(MAX_PLAYERS_PARTY, Math.max(MAX_PLAYERS_COUPLE, options.maxPlayers))
    : MAX_PLAYERS_COUPLE;
  const roomKind = options.roomKind === 'party' || maxPlayers > MAX_PLAYERS_COUPLE ? 'party' : 'couple';

  await reconcileLocalRoomState();

  if (currentRoom) {
    return fail('ALREADY_IN_ROOM', 'Ya estás en una sala. Sal antes de crear otra.');
  }

  try {
    const db = requireDb();
    const code = await generateUniqueRoomCode(db);
    const roomRef = roomDocRef(db, code);

    await setDoc(roomRef, {
      code,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'waiting',
      maxPlayers,
      roomKind,
      playerCount: 1,
    });

    await setDoc(coupleRef(db, code), {
      ...createDefaultCoupleStats(),
      updatedAt: serverTimestamp(),
    });

    await ensureHubInitialized(db, code);

    await writePlayerCloud(db, code, normalized);

    const room = await fetchRoom(db, code);
    if (!room) {
      return fail('CREATE_FAILED', 'Sala creada, pero no se pudo cargar.');
    }

    setLocalRoom(room, normalized.id);
    persistSession(room, normalized);
    startPresenceLifecycle(db, code, normalized.id);
    currentRoom = await fetchRoom(db, code);
    startRoomListener();

    return ok(getCurrentRoom());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail('CREATE_FAILED', message);
  }
}

export async function joinRoom(code, player) {
  const normalized = normalizePlayer(player);
  if (!normalized) {
    return fail('INVALID_PLAYER', 'Jugador inválido — indica al menos un id.');
  }

  const roomCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (roomCode.length !== CODE_LENGTH) {
    return fail('INVALID_CODE', 'Código inválido — usa 6 caracteres.');
  }

  await reconcileLocalRoomState();

  if (currentRoom) {
    if (currentRoom.code === roomCode) {
      try {
        const db = requireDb();
        const room = await fetchRoom(db, roomCode);
        if (room) {
          setLocalRoom(room, normalized.id);
          persistSession(room, normalized);
          await activateLocalPresence();
          startRoomListener();
          return ok(getCurrentRoom());
        }
      } catch (err) {
        console.warn('[CloudManager] joinRoom rejoin:', err);
      }
    }
    return fail('ALREADY_IN_ROOM', 'Ya estás en una sala. Sal antes de entrar en otra.');
  }

  try {
    const db = requireDb();
    const roomRef = roomDocRef(db, roomCode);
    const rootRef = playerRootRef(db, roomCode, normalized.id);
    let joinedExisting = false;

    const playersListSnap = await getDocs(query(playersCollection(db, roomCode)));
    const listedPlayerCount = playersListSnap.size;

    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const data = roomSnap.data();
      const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : MAX_PLAYERS_COUPLE;
      const existingPlayerSnap = await transaction.get(rootRef);
      const activeCount = resolvePlayerCount(data, listedPlayerCount);

      if (existingPlayerSnap.exists()) {
        joinedExisting = true;
        const repairedStatus = activeCount >= maxPlayers ? 'full' : 'waiting';
        if (
          data.playerCount !== activeCount
          || data.status === 'closed'
          || (data.status === 'full' && activeCount < maxPlayers)
        ) {
          transaction.update(roomRef, {
            playerCount: activeCount,
            status: repairedStatus,
            updatedAt: serverTimestamp(),
          });
        }
        return;
      }

      if (data.status === 'closed' && activeCount >= maxPlayers) {
        throw new Error('ROOM_CLOSED');
      }

      if (activeCount >= maxPlayers) {
        throw new Error('ROOM_FULL');
      }

      transactionCreatePlayer(transaction, db, roomCode, normalized);

      const newCount = activeCount + 1;
      transaction.update(roomRef, {
        playerCount: newCount,
        status: newCount >= maxPlayers ? 'full' : 'waiting',
        updatedAt: serverTimestamp(),
      });
    });

    if (joinedExisting) {
      await repairPlayerMembership(db, roomCode, normalized);
    } else {
      await setPlayerOnline(db, roomCode, normalized.id);
      postJoinChatMessage(db, roomCode, normalized.name).catch((err) => {
        console.warn('[CloudManager] postJoinChatMessage:', err);
      });
    }

    const room = await fetchRoom(db, roomCode);
    if (!room) {
      return fail('JOIN_FAILED', 'No se pudo entrar en la sala.');
    }

    setLocalRoom(room, normalized.id);
    persistSession(room, normalized);
    await activateLocalPresence();
    await ensureHubInitialized(db, roomCode).catch((err) => {
      console.warn('[CloudManager] ensureHubInitialized join:', err);
    });

    return ok(getCurrentRoom());
  } catch (err) {
    console.error('[CloudManager] joinRoom error:', err);
    if (err instanceof Error) console.error(err.stack);

    const message = err instanceof Error ? err.message : String(err);
    if (message === 'ROOM_NOT_FOUND') {
      return fail('ROOM_NOT_FOUND', 'Sala no encontrada.');
    }
    if (message === 'ROOM_FULL') {
      let cap = MAX_PLAYERS_COUPLE;
      try {
        const snap = await getDoc(roomDocRef(requireDb(), roomCode));
        if (snap.exists() && typeof snap.data()?.maxPlayers === 'number') {
          cap = snap.data().maxPlayers;
        }
      } catch (_) { /* ignore */ }
      return fail('ROOM_FULL', `Sala llena (${cap} jugadores). Crea otra sala o espera a que alguien salga.`);
    }
    if (message === 'ROOM_CLOSED') {
      return fail('ROOM_CLOSED', 'La sala está cerrada. Crea una nueva sala.');
    }
    return fail('JOIN_FAILED', message);
  }
}

export async function leaveRoom() {
  if (!currentRoom || !currentPlayerId) {
    clearLocalRoom();
    return { success: true };
  }

  const roomId = currentRoom.id;
  const playerId = currentPlayerId;
  const playerName = getLocalPlayer()?.name || 'Jugador';

  stopRoomListener();
  stopPresenceLifecycle();

  let cloudError = null;

  try {
    const db = requireDb();
    await postLeaveChatMessage(db, roomId, playerName).catch((err) => {
      console.warn('[CloudManager] postLeaveChatMessage:', err);
    });
    await setPlayerOffline(db, roomId, playerId);

    const roomRef = roomDocRef(db, roomId);
    const playersListSnap = await getDocs(query(playersCollection(db, roomId)));
    const listedPlayerCount = playersListSnap.size;

    await runTransaction(db, async (transaction) => {
      const roomSnap = await transaction.get(roomRef);
      if (!roomSnap.exists()) return;

      const data = roomSnap.data();
      transactionDeletePlayer(transaction, db, roomId, playerId);

      const newCount = Math.max(0, listedPlayerCount - 1);

      if (newCount === 0) {
        transactionDeleteCouple(transaction, db, roomId);
        transaction.delete(roomRef);
        return;
      }

      transaction.update(roomRef, {
        playerCount: newCount,
        status: 'waiting',
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    cloudError = err instanceof Error ? err : new Error(String(err));
    console.error('[CloudManager] leaveRoom cloud cleanup:', cloudError);
  } finally {
    clearLocalRoom();
  }

  if (cloudError) {
    return fail('LEAVE_FAILED', cloudError.message);
  }

  return { success: true };
}

/**
 * Envia mensagem de chat do jogador local.
 * @param {string} message
 */
export async function sendChatMessage(message) {
  if (!currentRoom || !currentPlayerId) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  const text = normalizeChatText(message);
  if (!text) {
    return fail('EMPTY_MESSAGE', 'Escribe un mensaje.');
  }

  const player = getLocalPlayer();
  const playerName = player?.name || 'Jugador';

  try {
    const db = requireDb();
    await sendPlayerMessage(db, currentRoom.code, currentPlayerId, playerName, text);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail('CHAT_FAILED', msg);
  }
}

/**
 * Notifica no chat que o jogador local iniciou uma partida.
 */
export async function notifyGameStarted() {
  if (!currentRoom || !currentPlayerId) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }

  const player = getLocalPlayer();
  const playerName = player?.name || 'Jugador';

  try {
    const db = requireDb();
    await sendSystemMessage(db, currentRoom.code, `🍫 ${playerName} inició una partida.`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail('CHAT_FAILED', msg);
  }
}

/**
 * Inscreve callback para mensagens de chat em tempo real.
 * @param {(event: import('./cloud-chat.js').ChatUpdateEvent) => void} callback
 * @returns {() => void}
 */
export function subscribeToChat(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  const unsubscribe = chatListener.subscribe(callback);

  if (currentRoom) {
    if (!chatListener.isActive()) {
      try {
        const db = requireDb();
        chatListener.start(db, currentRoom.code);
      } catch (err) {
        console.warn('[CloudManager] Chat listener não iniciado:', err);
      }
    }
  }

  return unsubscribe;
}

/**
 * @param {(event: import('./cloud-chat.js').ChatUpdateEvent) => void} [callback]
 */
export function unsubscribeFromChat(callback) {
  chatListener.unsubscribe(callback);
}

function requirePlayerId() {
  if (currentPlayerId) return currentPlayerId;
  const id = ensureSocialIdentity();
  currentPlayerId = id;
  return id;
}

function getSocialPlayerPayload() {
  const id = ensureSocialIdentity();
  let name = 'Jugador';
  try {
    const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.username) name = `@${parsed.username}`;
      else if (parsed.name?.trim()) name = parsed.name.trim();
    }
  } catch (_) { /* ignore */ }
  return { id, name, joinedAt: Date.now() };
}

/**
 * Inicia presença global + listeners sociais (amigos, convites).
 * @param {string} [displayName]
 */
export function initSocialLayer(displayName = '') {
  if (!isFirebaseConfigValid() || !isFirebaseReady()) return fail('NOT_READY', 'Firebase no listo.');
  initFirebase();
  const db = getFirestoreDb();
  if (!db) return fail('NO_DB', 'Sin conexión.');

  const id = ensureSocialIdentity();
  if (!currentRoom) currentPlayerId = id;
  let name = 'Jugador';
  try {
    const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.username) name = `@${parsed.username}`;
      else if (parsed.name?.trim()) name = parsed.name.trim();
      else if (displayName?.trim()) name = displayName.trim();
    }
  } catch (_) {
    name = (displayName || getLocalPlayer()?.name || '').trim() || 'Jugador';
  }

  if (!socialPresenceActive) {
    startGlobalPresenceLifecycle(db, id, name);
    socialPresenceActive = true;
  }

  return { success: true, playerId: id };
}

function getOrCreatePlayerIdFromIdentity() {
  try {
    const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    }
  } catch (_) { /* ignore */ }

  const id = crypto.randomUUID();
  try {
    const raw = localStorage.getItem('ChocolateCerezaPlayerIdentity');
    let name = '';
    if (raw) {
      const parsed = JSON.parse(raw);
      name = typeof parsed?.name === 'string' ? parsed.name : '';
    }
    localStorage.setItem('ChocolateCerezaPlayerIdentity', JSON.stringify({ id, name }));
  } catch (_) { /* ignore */ }
  return id;
}

/**
 * ID estável para amigos, convites e DM — sempre o da identidade local.
 * @returns {string}
 */
function ensureSocialIdentity() {
  const identityId = getOrCreatePlayerIdFromIdentity();
  if (!identityId) throw new Error('Jugador no identificado.');

  const session = getSession();
  if (session && session.playerId !== identityId) {
    clearSession();
  }

  return identityId;
}

function requireSocialPlayerId() {
  const id = ensureSocialIdentity();
  if (!currentRoom) {
    currentPlayerId = id;
  }
  return id;
}

export function stopSocialLayer() {
  if (!socialPresenceActive) return;
  try {
    const db = getFirestoreDb();
    const id = currentPlayerId || getOrCreatePlayerIdFromIdentity();
    if (db && id) stopGlobalPresenceLifecycle();
  } catch (_) { /* ignore */ }
  socialPresenceActive = false;
}

/**
 * Sai do perfil atual neste dispositivo e cria identidade nova (novo @usuario).
 */
export async function resetPlayerProfile() {
  try {
    if (currentRoom && currentPlayerId) {
      try {
        await leaveRoom();
      } catch (err) {
        console.warn('[CloudManager] leaveRoom on reset:', err);
        forceClearRoomSession();
      }
    } else {
      forceClearRoomSession();
    }

    stopSocialLayer();

    if (unsubscribePersonalLetters) {
      unsubscribePersonalLetters();
      unsubscribePersonalLetters = null;
    }

    currentPlayerId = null;
    clearSession();

    const newId = PlayerIdentity.resetIdentity();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('couple:profileChanged', { detail: { playerId: newId } }));
    }

    return ok({ playerId: newId });
  } catch (err) {
    return fail('RESET_PROFILE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Envia pedido de amizade por @usuario (ou UUID legado).
 * @param {string} friendIdentifier @usuario ou UUID
 * @param {string} [friendName]
 */
export async function addFriend(friendIdentifier, friendName = '') {
  try {
    const db = requireDb();
    const ownerId = requireSocialPlayerId();
    const fid = await resolvePlayerId(db, friendIdentifier);
    if (fid === ownerId) return fail('SELF', 'No puedes añadirte a ti mismo.');

    const player = getLocalPlayer();
    const myProfile = await fetchPlayerProfile(db, ownerId);
    const fromName = myProfile.username
      ? `@${myProfile.username}`
      : (friendName.trim() || player?.name || getSocialPlayerPayload().name || 'Jugador');

    await sendFriendRequest(db, ownerId, fromName, fid);
    const profile = await fetchPlayerProfile(db, fid);
    const label = profile.username ? `@${profile.username}` : (profile.displayName || 'Amigo');
    return { success: true, friendId: fid, pending: true, message: `Solicitud enviada a ${label}.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail('ADD_FRIEND_FAILED', msg);
  }
}

/**
 * @param {string} rawUsername
 */
export async function setPlayerUsername(rawUsername) {
  try {
    const db = requireDb();
    const playerId = requireSocialPlayerId();
    const username = await claimUsername(db, playerId, `@${normalizeUsername(rawUsername)}`, rawUsername);
    const displayName = `@${username}`;

    if (currentRoom && currentPlayerId) {
      await setDoc(profileRef(db, currentRoom.code, currentPlayerId), { name: displayName }, { merge: true });
      const refreshed = await fetchRoom(db, currentRoom.code);
      if (refreshed) {
        currentRoom = refreshed;
        window.dispatchEvent(new CustomEvent('couple:roomChanged'));
      }
    }

    return { success: true, username, displayName };
  } catch (err) {
    return fail('USERNAME_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Atualiza o nome na sala atual para @usuario (se definido).
 */
export async function syncLocalRoomDisplayName() {
  if (!currentRoom || !currentPlayerId) {
    return fail('NOT_IN_ROOM', 'No estás en una sala.');
  }
  try {
    const db = requireDb();
    const { name } = getSocialPlayerPayload();
    if (!name || name === 'Jugador') {
      return fail('NO_NAME', 'Sin usuario configurado.');
    }
    await setDoc(profileRef(db, currentRoom.code, currentPlayerId), { name }, { merge: true });
    const refreshed = await fetchRoom(db, currentRoom.code);
    if (refreshed) currentRoom = refreshed;
    persistSession(currentRoom, {
      id: currentPlayerId,
      name,
      joinedAt: getLocalPlayer()?.joinedAt || Date.now(),
    });
    return { success: true, name };
  } catch (err) {
    return fail('SYNC_NAME_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @returns {Promise<{ success: boolean, username?: string, photoUrl?: string, message?: string }>}
 */
export async function loadPlayerUsername() {
  try {
    const db = requireDb();
    const playerId = requirePlayerId();
    const profile = await fetchPlayerProfile(db, playerId);
    return {
      success: true,
      username: profile.username || '',
      photoUrl: profile.photoUrl || '',
      chatLang: profile.chatLang || '',
    };
  } catch (err) {
    return fail('USERNAME_LOAD_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} playerId
 * @returns {Promise<{ success: boolean, profile?: { username: string, displayName: string, photoUrl: string }, message?: string }>}
 */
export async function getPlayerProfile(playerId) {
  try {
    const db = requireDb();
    const id = String(playerId || '').trim();
    if (!id) return fail('NO_PLAYER', 'Jugador no identificado.');
    const profile = await fetchPlayerProfile(db, id);
    return { success: true, profile };
  } catch (err) {
    return fail('PROFILE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} photoUrl
 * @returns {Promise<{ success: boolean, photoUrl?: string, message?: string }>}
 */
export async function setPlayerPhotoUrl(photoUrl) {
  try {
    const db = requireDb();
    const playerId = requireSocialPlayerId();
    const url = await persistPlayerPhotoUrl(db, playerId, photoUrl);
    return { success: true, photoUrl: url };
  } catch (err) {
    return fail('PHOTO_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} chatLang pt | es | en
 */
export async function setPlayerChatLang(chatLang) {
  try {
    const db = requireDb();
    const playerId = requireSocialPlayerId();
    const lang = await persistPlayerChatLang(db, playerId, chatLang);
    return { success: true, chatLang: lang };
  } catch (err) {
    return fail('CHAT_LANG_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} fromPlayerId
 */
export async function acceptFriendRequestFrom(fromPlayerId) {
  try {
    const db = requireDb();
    const myId = requirePlayerId();
    const myName = getSocialPlayerPayload().name || 'Jugador';
    await acceptFriendRequest(db, myId, fromPlayerId, myName);
    return { success: true };
  } catch (err) {
    return fail('ACCEPT_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} fromPlayerId
 */
export async function declineFriendRequestFrom(fromPlayerId) {
  try {
    const db = requireDb();
    await declineFriendRequest(db, requirePlayerId(), fromPlayerId);
    return { success: true };
  } catch (err) {
    return fail('DECLINE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {(requests: import('./cloud-friend-requests.js').FriendRequest[]) => void} callback
 */
export function subscribeFriendRequests(callback) {
  if (typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const id = requirePlayerId();
    if (unsubscribeFriendRequests) unsubscribeFriendRequests();
    unsubscribeFriendRequests = subscribeIncomingFriendRequests(db, id, callback);
    return () => {
      if (unsubscribeFriendRequests) {
        unsubscribeFriendRequests();
        unsubscribeFriendRequests = null;
      }
    };
  } catch (err) {
    console.warn('[CloudManager] subscribeFriendRequests:', err);
    return () => {};
  }
}

/**
 * @param {string} friendId
 */
export async function removeFriend(friendId) {
  try {
    const db = requireDb();
    const ownerId = requireSocialPlayerId();
    await removeFriendContact(db, ownerId, friendId);
    await removeFriendContact(db, friendId, ownerId);
    try {
      await deleteDoc(friendRequestRef(db, ownerId, friendId));
      await deleteDoc(friendRequestRef(db, friendId, ownerId));
    } catch (_) { /* pedidos antigos — ok */ }
    return { success: true };
  } catch (err) {
    return fail('REMOVE_FRIEND_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {(friends: import('./cloud-friends.js').ReturnType<typeof import('./cloud-friends.js').friendFromDoc>[]) => void} callback
 */
export function subscribeFriendsList(callback) {
  if (typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const ownerId = requirePlayerId();
    if (unsubscribeFriends) unsubscribeFriends();
    unsubscribeFriends = subscribeFriends(db, ownerId, callback);
    return () => {
      if (unsubscribeFriends) {
        unsubscribeFriends();
        unsubscribeFriends = null;
      }
    };
  } catch (err) {
    console.warn('[CloudManager] subscribeFriendsList:', err);
    return () => {};
  }
}

/**
 * @param {string} friendId
 * @param {(presence: { online: boolean, lastSeen: number, name: string }) => void} callback
 */
export function subscribeFriendPresence(friendId, callback) {
  if (!friendId || typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    return onSnapshot(
      globalPresenceRef(db, friendId),
      (snap) => {
        if (!snap.exists()) {
          callback({ online: false, lastSeen: 0, name: '' });
          return;
        }
        const data = snap.data();
        const lastSeen = typeof data.lastSeen === 'number' ? data.lastSeen : 0;
        callback({
          name: typeof data.name === 'string' ? data.name : '',
          lastSeen,
          online: isGlobalPresenceOnline({ online: data.online === true, lastSeen }),
        });
      },
      () => callback({ online: false, lastSeen: 0, name: '' })
    );
  } catch (err) {
    console.warn('[CloudManager] subscribeFriendPresence:', err);
    return () => {};
  }
}

/**
 * @param {string} friendId
 * @param {string} message
 * @param {{ id?: string, text?: string, fromName?: string, fromPlayerId?: string } | null} [replyTo]
 */
export async function sendFriendMessage(friendId, message, replyTo = null) {
  try {
    const db = requireDb();
    const fromId = requirePlayerId();
    const player = getLocalPlayer();
    const fromName = player?.name || getSocialPlayerPayload().name || 'Jugador';
    const threadId = buildDmThreadId(fromId, friendId);
    await setDmTyping(db, threadId, fromId, false);
    await sendGlobalDm(db, fromId, friendId, fromName, message, replyTo);
    return { success: true };
  } catch (err) {
    return fail('DM_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Marca que o jogador local está a digitar para um amigo.
 * @param {string} friendId
 * @param {boolean} typing
 */
export async function setFriendTyping(friendId, typing) {
  try {
    const db = requireDb();
    const fromId = requirePlayerId();
    const threadId = buildDmThreadId(fromId, friendId);
    await setDmTyping(db, threadId, fromId, typing);
    return { success: true };
  } catch (err) {
    return fail('TYPING_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} friendId
 * @param {(typing: boolean) => void} callback
 */
export function subscribeFriendTyping(friendId, callback) {
  if (!friendId || typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const myId = requirePlayerId();
    const threadId = buildDmThreadId(myId, friendId);
    return subscribePeerDmTyping(db, threadId, friendId, callback);
  } catch (err) {
    console.warn('[CloudManager] subscribeFriendTyping:', err);
    return () => {};
  }
}

/**
 * @param {string} friendId
 * @param {(messages: import('./cloud-global-dm.js').GlobalDmMessage[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeFriendMessages(friendId, callback, onError) {
  if (!friendId || typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const threadId = buildDmThreadId(requirePlayerId(), friendId);
    return subscribeGlobalDm(db, threadId, callback, onError);
  } catch (err) {
    console.warn('[CloudManager] subscribeFriendMessages:', err);
    if (typeof onError === 'function') {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return () => {};
  }
}

/**
 * Resolve amigo por @usuario (ID pode estar desatualizado na lista).
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} friendId
 * @param {string} [friendName]
 */
async function resolveFriendTargetId(db, friendId, friendName = '') {
  const label = (friendName || '').trim();
  if (label.startsWith('@')) {
    try {
      return await resolvePlayerId(db, label);
    } catch (_) { /* fallback to stored id */ }
  }

  const normalized = normalizeUsername(label);
  if (normalized) {
    try {
      return await resolvePlayerId(db, normalized);
    } catch (_) { /* fallback */ }
  }

  return friendId;
}

/**
 * Amplía una sala de pareja (2) a party (4) para seguir invitando amigos.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
async function upgradeRoomToParty(db, roomCode) {
  const roomRef = roomDocRef(db, roomCode);
  await updateDoc(roomRef, {
    maxPlayers: MAX_PLAYERS_PARTY,
    roomKind: 'party',
    status: 'waiting',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reutiliza la sala actual si tiene huecos; si no, crea una party nueva.
 * @returns {Promise<{ action: 'reuse'|'create', room: Room } | { action: 'fail', result: ReturnType<typeof fail> }>}
 */
async function resolveRoomForFriendInvite(db, targetId) {
  await reconcileLocalRoomState();

  if (currentRoom) {
    let live = await fetchRoom(db, currentRoom.code);
    if (!live || live.status === 'closed') {
      forceClearRoomSession();
      await reconcileLocalRoomState();
      live = null;
    }

    if (live) {
      if (live.players.some((p) => p.id === targetId)) {
        return {
          action: 'fail',
          result: fail('FRIEND_IN_ROOM', 'Tu amigo/a ya está en tu sala.'),
        };
      }

      if (live.maxPlayers < MAX_PLAYERS_PARTY) {
        await upgradeRoomToParty(db, live.code);
        live = await fetchRoom(db, live.code);
      }

      if (live) {
        currentRoom = live;
        if (currentPlayerId) setLocalRoom(live, currentPlayerId);

        if (live.players.length >= live.maxPlayers) {
          return {
            action: 'fail',
            result: fail(
              'ROOM_FULL',
              `Sala llena (${live.maxPlayers} jugadores). Espera a que alguien salga.`
            ),
          };
        }

        return { action: 'reuse', room: live };
      }
    }
  }

  const created = await createRoom(getSocialPlayerPayload(), {
    maxPlayers: MAX_PLAYERS_PARTY,
    roomKind: 'party',
  });
  if (!created.success) {
    return { action: 'fail', result: created };
  }

  return { action: 'create', room: created.room };
}

/**
 * Convida amigo à sala atual (até 4 jogadores) ou cria uma party nova se necessário.
 * @param {string} friendId
 * @param {string} [friendName]
 */
export async function inviteFriendToRoom(friendId, friendName = '') {
  try {
    const db = requireDb();
    const fromId = requireSocialPlayerId();
    const targetId = await resolveFriendTargetId(db, friendId, friendName);

    if (!targetId) return fail('INVALID_FRIEND', 'Amigo inválido.');
    if (targetId === fromId) return fail('SELF', 'No puedes invitarte a ti mismo.');

    const resolved = await resolveRoomForFriendInvite(db, targetId);
    if (resolved.action === 'fail') return resolved.result;

    const room = resolved.room;
    const roomCreated = resolved.action === 'create';
    if (roomCreated) {
      window.dispatchEvent(new CustomEvent('couple:roomChanged'));
    }

    const myProfile = await fetchPlayerProfile(db, fromId);
    const fromName = myProfile.username
      ? `@${myProfile.username}`
      : (getSocialPlayerPayload().name || 'Jugador');

    let targetUsername = '';
    if ((friendName || '').trim().startsWith('@')) {
      targetUsername = normalizeUsername(friendName);
    } else {
      const targetProfile = await fetchPlayerProfile(db, targetId);
      targetUsername = targetProfile.username || '';
    }

    const inviteId = await sendRoomInvite(db, targetId, {
      roomCode: room.code,
      fromPlayerId: fromId,
      fromName,
    }, targetUsername);

    return { success: true, roomCode: room.code, inviteId, roomCreated };
  } catch (err) {
    return fail('INVITE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {(messages: import('./cloud-global-dm.js').GlobalDmMessage[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeIncomingFriendDms(callback, onError) {
  if (typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const id = requireSocialPlayerId();
    if (unsubscribeIncomingDms) unsubscribeIncomingDms();
    unsubscribeIncomingDms = subscribeIncomingGlobalDm(db, id, callback, onError);
    return () => {
      if (unsubscribeIncomingDms) {
        unsubscribeIncomingDms();
        unsubscribeIncomingDms = null;
      }
    };
  } catch (err) {
    console.warn('[CloudManager] subscribeIncomingFriendDms:', err);
    if (typeof onError === 'function') {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return () => {};
  }
}

/**
 * @param {(invites: import('./cloud-room-invites.js').RoomInvite[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeIncomingInvites(callback, onError) {
  if (typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const id = requireSocialPlayerId();
    if (unsubscribeInvites) unsubscribeInvites();
    if (unsubscribeInvitesByName) unsubscribeInvitesByName();

    /** @type {import('./cloud-room-invites.js').RoomInvite[]} */
    let uuidInvites = [];
    /** @type {import('./cloud-room-invites.js').RoomInvite[]} */
    let nameInvites = [];

    const emitMerged = () => {
      const byKey = new Map();
      [...uuidInvites, ...nameInvites].forEach((inv) => {
        const key = `${inv.fromPlayerId}:${inv.roomCode}`;
        const prev = byKey.get(key);
        if (!prev || (inv.createdAt || 0) >= (prev.createdAt || 0)) {
          byKey.set(key, inv);
        }
      });
      const merged = Array.from(byKey.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(merged);
    };

    unsubscribeInvites = subscribePendingInvites(db, id, (list) => {
      uuidInvites = list;
      emitMerged();
    }, onError);

    fetchPlayerProfile(db, id).then((profile) => {
      if (!profile.username) return;
      if (unsubscribeInvitesByName) unsubscribeInvitesByName();
      unsubscribeInvitesByName = subscribePendingInvitesByName(
        db,
        profile.username,
        (list) => {
          nameInvites = list;
          emitMerged();
        },
        onError
      );
    }).catch(() => {});

    return () => {
      if (unsubscribeInvites) {
        unsubscribeInvites();
        unsubscribeInvites = null;
      }
      if (unsubscribeInvitesByName) {
        unsubscribeInvitesByName();
        unsubscribeInvitesByName = null;
      }
    };
  } catch (err) {
    console.warn('[CloudManager] subscribeIncomingInvites:', err);
    if (typeof onError === 'function') {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return () => {};
  }
}

/**
 * @param {string} inviteId
 * @param {boolean} accept
 */
export async function respondToRoomInvite(inviteId, accept) {
  try {
    const db = requireDb();
    const id = requireSocialPlayerId();
    const status = accept ? 'accepted' : 'declined';
    await updateInviteStatus(db, id, inviteId, status);

    const profile = await fetchPlayerProfile(db, id);
    if (profile.username) {
      await updateInviteStatusByName(db, profile.username, inviteId, status);
    }

    return { success: true };
  } catch (err) {
    return fail('INVITE_RESPONSE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function fetchFriendPresence(friendId) {
  try {
    const db = requireDb();
    return { success: true, presence: await fetchGlobalPresence(db, friendId) };
  } catch (err) {
    return fail('PRESENCE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export { MAX_CHAT_LENGTH };

/**
 * Inscreve callback para atualizações em tempo real da sala atual.
 * @param {(event: import('./cloud-listener.js').RoomUpdateEvent) => void} callback
 * @returns {() => void}
 */
export function subscribeToRoom(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  const unsubscribe = roomListener.subscribe(callback);

  if (currentRoom) {
    if (!roomListener.isActive()) {
      startRoomListener();
    }

    try {
      callback({
        type: 'room_updated',
        room: getCurrentRoom(),
        players: getCurrentRoom()?.players ?? [],
        timestamp: Date.now(),
        source: 'local',
      });
    } catch (err) {
      console.warn('[CloudManager] Erro no callback inicial:', err);
    }
  }

  return unsubscribe;
}

/**
 * Remove inscrição de callback ou todas as inscrições.
 * @param {(event: import('./cloud-listener.js').RoomUpdateEvent) => void} [callback]
 */
export function unsubscribeFromRoom(callback) {
  roomListener.unsubscribe(callback);
}

/**
 * @returns {boolean}
 */
export function isListeningToRoom() {
  return roomListener.isActive();
}

/**
 * @returns {Room | null}
 */
export function getCurrentRoom() {
  return currentRoom ? { ...currentRoom, players: currentRoom.players.map((p) => ({ ...p, presence: { ...p.presence } })) } : null;
}

function requireRoomCode() {
  const room = getCurrentRoom();
  if (!room) throw new Error('NO_ROOM');
  return room.code;
}

export function subscribeToHub(callback) {
  if (typeof callback !== 'function') return () => {};
  hubCallbacks.add(callback);
  if (currentRoom) startHubSync();
  return () => {
    hubCallbacks.delete(callback);
    if (hubCallbacks.size === 0) stopHubSync();
  };
}

export async function fetchHubData() {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await ensureHubInitialized(db, code);
    const snap = await fetchHubSnapshot(db, code);
    return ok(snap);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'NO_ROOM') return fail('NO_ROOM', 'Entra en una sala para sincronizar.');
    return fail('HUB_FETCH_FAILED', message);
  }
}

export async function updateHubDataSettings(partial) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await updateHubSettings(db, code, partial);
    return ok(true);
  } catch (err) {
    return fail('HUB_UPDATE_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function createHubTask(task) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const id = await addHubTask(db, code, task);
    return ok({ id });
  } catch (err) {
    return fail('HUB_TASK_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function setHubTaskDone(taskId, done, doneBy) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await toggleHubTask(db, code, taskId, done, doneBy);
    return ok(true);
  } catch (err) {
    return fail('HUB_TASK_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function removeHubTask(taskId) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await deleteHubTask(db, code, taskId);
    return ok(true);
  } catch (err) {
    return fail('HUB_TASK_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function createHubEvent(event, playerName, playerId) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const id = await addHubEvent(db, code, event, playerName, playerId);
    return ok({ id });
  } catch (err) {
    return fail('HUB_EVENT_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function patchHubEvent(eventId, partial) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await updateHubEvent(db, code, eventId, partial);
    return ok(true);
  } catch (err) {
    return fail('HUB_EVENT_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function removeHubEvent(eventId) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await deleteHubEvent(db, code, eventId);
    return ok(true);
  } catch (err) {
    return fail('HUB_EVENT_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {string} username
 */
export async function resolveUsernameToPlayerId(username) {
  try {
    const db = requireDb();
    const playerId = await resolvePlayerId(db, normalizeUsername(username));
    return ok({ playerId });
  } catch (err) {
    return fail('NOT_FOUND', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Envía carta directa a una persona (sin sala).
 * @param {string} toPlayerId
 * @param {object} letter
 */
export async function sendPersonalLetter(toPlayerId, letter) {
  try {
    const db = requireDb();
    const fromId = requirePlayerId();
    const player = getLocalPlayer();
    const fromName = letter.fromName || player?.name || getSocialPlayerPayload().name || 'Jugador';
    const id = await sendGlobalLetter(db, fromId, toPlayerId, {
      fromPlayerId: fromId,
      fromName,
      toName: letter.toName || '',
      text: letter.text || '',
      type: letter.type || 'inbox',
      deliverDate: letter.deliverDate || null,
      openAfter: letter.openAfter || null,
      photoUrl: letter.photoUrl || '',
      audioUrl: letter.audioUrl || '',
      reactions: letter.reactions || {},
    });
    return ok({ id });
  } catch (err) {
    return fail('LETTER_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function fetchPersonalLetters() {
  try {
    const db = requireDb();
    const myId = requirePlayerId();
    const letters = await fetchLettersForPlayer(db, myId);
    return ok({ letters });
  } catch (err) {
    return fail('LETTER_FETCH_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function removePersonalLetter(letterId) {
  try {
    const db = requireDb();
    await deleteGlobalLetter(db, letterId);
    return ok(true);
  } catch (err) {
    return fail('LETTER_FAILED', err instanceof Error ? err.message : String(err));
  }
}

/**
 * @param {(letters: import('./cloud-global-letters.js').GlobalLetter[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribePersonalLetters(callback, onError) {
  if (typeof callback !== 'function') return () => {};
  try {
    const db = requireDb();
    const myId = requirePlayerId();
    if (unsubscribePersonalLetters) unsubscribePersonalLetters();
    unsubscribePersonalLetters = subscribeIncomingGlobalLetters(db, myId, callback, onError);
    return () => {
      if (unsubscribePersonalLetters) {
        unsubscribePersonalLetters();
        unsubscribePersonalLetters = null;
      }
    };
  } catch (err) {
    if (typeof onError === 'function') {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return () => {};
  }
}

export async function createHubLetter(letter) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const id = await addHubLetter(db, code, letter);
    return ok({ id });
  } catch (err) {
    return fail('HUB_LETTER_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function createHubMemory(memory) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const id = await addHubMemory(db, code, memory);
    return ok({ id });
  } catch (err) {
    return fail('HUB_MEMORY_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function removeHubMemory(memoryId) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await deleteHubMemory(db, code, memoryId);
    return ok(true);
  } catch (err) {
    return fail('HUB_MEMORY_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function removeHubLetter(letterId) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    await deleteHubLetter(db, code, letterId);
    return ok(true);
  } catch (err) {
    return fail('HUB_LETTER_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export async function completeHubMission(dateKey, missionId, currentSettings) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const completed = await completeHubDailyMission(db, code, dateKey, missionId, currentSettings);
    return ok({ completed });
  } catch (err) {
    return fail('HUB_MISSION_FAILED', err instanceof Error ? err.message : String(err));
  }
}

export const CloudManager = {
  isConnected,
  getConnectionStatus,
  createRoom,
  joinRoom,
  leaveRoom,
  forceClearRoomSession,
  ensureCleanRoomState,
  rejoinRoom,
  getSavedRoomCode,
  submitScore,
  getCoupleStats,
  getCoupleRanking,
  getCurrentRoom,
  getLocalPlayer,
  getPartnerPlayer,
  getRoomPresence,
  sendChocolateGift,
  subscribeToRoom,
  unsubscribeFromRoom,
  isListeningToRoom,
  sendChatMessage,
  initSocialLayer,
  stopSocialLayer,
  resetPlayerProfile,
  addFriend,
  setPlayerUsername,
  loadPlayerUsername,
  getPlayerProfile,
  setPlayerPhotoUrl,
  setPlayerChatLang,
  syncLocalRoomDisplayName,
  acceptFriendRequestFrom,
  declineFriendRequestFrom,
  subscribeFriendRequests,
  removeFriend,
  subscribeFriendsList,
  subscribeFriendPresence,
  sendFriendMessage,
  setFriendTyping,
  subscribeFriendTyping,
  subscribeFriendMessages,
  subscribeIncomingFriendDms,
  inviteFriendToRoom,
  subscribeIncomingInvites,
  respondToRoomInvite,
  fetchFriendPresence,
  notifyGameStarted,
  subscribeToChat,
  unsubscribeFromChat,
  MAX_CHAT_LENGTH,
  MIN_GIFT_AMOUNT,
  MAX_GIFT_AMOUNT,
  restoreSession,
  whenSessionReady,
  hasSession,
  getPresenceLabel,
  formatLastSeen,
  isPresenceOnline,
  subscribeToHub,
  fetchHubData,
  updateHubDataSettings,
  createHubTask,
  setHubTaskDone,
  removeHubTask,
  createHubEvent,
  patchHubEvent,
  removeHubEvent,
  createHubLetter,
  createHubMemory,
  removeHubMemory,
  removeHubLetter,
  resolveUsernameToPlayerId,
  sendPersonalLetter,
  fetchPersonalLetters,
  removePersonalLetter,
  subscribePersonalLetters,
  completeHubMission,
};

if (typeof window !== 'undefined') {
  window.CloudManager = CloudManager;
}

if (hasSession()) {
  restorePromise = restoreSession();
}

export default CloudManager;
