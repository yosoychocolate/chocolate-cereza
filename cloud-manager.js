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
  collection,
  query,
  runTransaction,
  serverTimestamp,
  getFirestoreDb,
  initFirebase,
  isFirebaseReady,
  isFirebaseConfigValid,
  getFirebaseInitError,
} from './firebase-manager.js?v=__APP_VERSION__';
import { getSession, saveSession, clearSession, hasSession } from './room-session.js?v=__APP_VERSION__';
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
} from './cloud-presence.js?v=__APP_VERSION__';
import { createRoomListener } from './cloud-listener.js?v=__APP_VERSION__';
import {
  createChatListener,
  sendPlayerMessage,
  sendSystemMessage,
  normalizeChatText,
  MAX_CHAT_LENGTH,
} from './cloud-chat.js?v=__APP_VERSION__';
import {
  coupleRef,
  createDefaultCoupleStats,
  fetchCoupleStats,
  applyScoreToCouple,
  applyPlayerStats,
  playerStatsRef,
  playerStatsFromSnapshot,
  transactionDeleteCouple,
} from './cloud-couple.js?v=__APP_VERSION__';
import {
  createChocolateGift,
  claimGiftTransaction,
  createGiftListener,
  normalizeGiftAmount,
  MIN_GIFT_AMOUNT,
  MAX_GIFT_AMOUNT,
} from './cloud-gifts.js?v=__APP_VERSION__';
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
  completeHubDailyMission,
} from './cloud-hub.js?v=__APP_VERSION__';

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
 * @property {number|null} createdAt
 * @property {number|null} updatedAt
 */

const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const MAX_PLAYERS = 2;
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
      player.presence = { ...event.presence };
    }
  } else if (event.type === 'couple_updated' && event.couple) {
    currentCoupleStats = /** @type {CoupleStats} */ (event.couple);
  } else if (event.type === 'room_removed') {
    stopPresenceLifecycle();
    currentRoom = null;
    currentPlayerId = null;
    currentCoupleStats = null;
    clearSession();
    roomListener.stop();
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

function ok(room) {
  return { success: true, room };
}

/**
 * @returns {import('firebase/firestore').Firestore}
 */
function requireDb() {
  refreshConnection();
  if (!isFirebaseReady()) {
    throw new Error('Firebase não conectado.');
  }
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firestore indisponível.');
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
  return {
    id: roomSnap.id,
    code: typeof data.code === 'string' ? data.code : roomSnap.id,
    status: data.status === 'full' || data.status === 'closed' ? data.status : 'waiting',
    players,
    maxPlayers: typeof data.maxPlayers === 'number' ? data.maxPlayers : MAX_PLAYERS,
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

function resolvePlayerCount(roomData, fallbackCount) {
  if (typeof roomData.playerCount === 'number' && Number.isFinite(roomData.playerCount)) {
    return Math.max(0, roomData.playerCount);
  }
  return Math.max(0, fallbackCount);
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
 * Remove estado local obsoleto (sessão órfã ou jogador já removido da nuvem).
 */
async function reconcileLocalRoomState() {
  if (!currentRoom && hasSession()) {
    clearSession();
    return;
  }

  if (!currentRoom || !currentPlayerId) return;

  try {
    const db = requireDb();
    const exists = await playerExistsInRoom(db, currentRoom.code, currentPlayerId);
    if (!exists) {
      clearLocalRoom();
    }
  } catch (err) {
    console.warn('[CloudManager] reconcileLocalRoomState:', err);
  }
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
      error: 'Configuração Firebase inválida.',
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
    return fail('NOT_IN_ROOM', 'Você não está em uma sala.');
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
        lastSeenLabel: p.presence.online ? 'online' : formatLastSeen(p.presence.lastSeen),
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
    return fail('NOT_IN_ROOM', 'Você não está em uma sala.');
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
    return fail('NOT_IN_ROOM', 'Você não está em uma sala.');
  }

  const pid = typeof playerId === 'string' ? playerId.trim() : '';
  const pname = typeof playerName === 'string' ? playerName.trim() : '';

  if (!pid) {
    return fail('INVALID_PLAYER', 'playerId inválido.');
  }

  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return fail('INVALID_SCORE', 'Pontuação inválida.');
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
    return fail('NOT_IN_ROOM', 'Você não está em uma sala.');
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
        online: player.presence?.online === true,
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
  throw new Error('Não foi possível gerar um código de sala único.');
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
    return fail('NO_SESSION', 'Nenhuma sessão de sala encontrada.');
  }

  if (currentRoom) {
    return { success: true, room: getCurrentRoom(), restored: true };
  }

  try {
    const db = requireDb();
    const roomSnap = await getDoc(roomDocRef(db, session.roomCode));
    if (!roomSnap.exists()) {
      clearSession();
      return fail('ROOM_NOT_FOUND', 'La sala ya no existe.');
    }

    const exists = await playerExistsInRoom(db, session.roomCode, session.playerId);
    if (!exists) {
      clearSession();
      return fail('PLAYER_NOT_FOUND', 'Ya no estás en esta sala.');
    }

    const room = await fetchRoom(db, session.roomCode);
    if (!room) {
      clearSession();
      return fail('ROOM_NOT_FOUND', 'La sala ya no existe.');
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

export async function createRoom(player) {
  const normalized = normalizePlayer(player);
  if (!normalized) {
    return fail('INVALID_PLAYER', 'Jugador inválido — indica un id.');
  }

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
      maxPlayers: MAX_PLAYERS,
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
      return fail('CREATE_FAILED', 'Sala criada, mas não foi possível carregá-la.');
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
    return fail('INVALID_PLAYER', 'Jogador inválido — informe ao menos um id.');
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
      const maxPlayers = typeof data.maxPlayers === 'number' ? data.maxPlayers : MAX_PLAYERS;
      const existingPlayerSnap = await transaction.get(rootRef);

      if (existingPlayerSnap.exists()) {
        joinedExisting = true;
        return;
      }

      const currentCount = resolvePlayerCount(data, listedPlayerCount);
      if (currentCount >= maxPlayers) {
        throw new Error('ROOM_FULL');
      }

      transactionCreatePlayer(transaction, db, roomCode, normalized);

      const newCount = currentCount + 1;
      transaction.update(roomRef, {
        playerCount: newCount,
        status: newCount >= maxPlayers ? 'full' : 'waiting',
        updatedAt: serverTimestamp(),
      });
    });

    if (!joinedExisting) {
      await setPlayerOnline(db, roomCode, normalized.id);
      postJoinChatMessage(db, roomCode, normalized.name).catch((err) => {
        console.warn('[CloudManager] postJoinChatMessage:', err);
      });
    }

    const room = await fetchRoom(db, roomCode);
    if (!room) {
      return fail('JOIN_FAILED', 'Não foi possível entrar na sala.');
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
      return fail('ROOM_NOT_FOUND', 'Sala não encontrada.');
    }
    if (message === 'ROOM_FULL') {
      return fail('ROOM_FULL', 'Sala cheia — máximo de 2 jogadores.');
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
      const currentCount = resolvePlayerCount(data, listedPlayerCount);
      transactionDeletePlayer(transaction, db, roomId, playerId);

      const newCount = Math.max(0, currentCount - 1);

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
    if (message === 'NO_ROOM') return fail('NO_ROOM', 'Entre em uma sala para sincronizar.');
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

export async function createHubEvent(event, playerName) {
  try {
    const code = requireRoomCode();
    const db = requireDb();
    const id = await addHubEvent(db, code, event, playerName);
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
  completeHubMission,
};

if (typeof window !== 'undefined') {
  window.CloudManager = CloudManager;
}

if (hasSession()) {
  restorePromise = restoreSession();
}

export default CloudManager;
