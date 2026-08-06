/**
 * CloudCouple — estatísticas compartilhadas do casal na sala.
 * Usado exclusivamente por cloud-manager.js e cloud-listener.js.
 *
 * Estrutura:
 * rooms/{code}/couple/data
 */
import { doc, getDoc, serverTimestamp } from './firebase-manager.js?v=7cbf9eb';

const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const COUPLE_COLLECTION = 'couple';
const STATS_COLLECTION = 'stats';
const COUPLE_DOC_ID = 'data';
const STATS_DOC_ID = 'data';

/** @typedef {Object} CoupleStats
 * @property {number} bestScore
 * @property {string|null} bestPlayerId
 * @property {string} bestPlayerName
 * @property {number} totalGames
 * @property {number} totalChocolate
 * @property {number|null} updatedAt
 * @property {number} playStreak
 * @property {string|null} lastPlayDate
 */

/**
 * @returns {string} YYYY-MM-DD em UTC local do navegador
 */
export function todayDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string} dateKey
 * @returns {string}
 */
export function previousDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayDateKey(dt);
}

/**
 * @param {CoupleStats} current
 * @param {string} [today]
 * @returns {{ playStreak: number, lastPlayDate: string }}
 */
export function computePlayStreak(current, today = todayDateKey()) {
  const last = current.lastPlayDate || null;
  const prev = current.playStreak || 0;

  if (last === today) {
    return { playStreak: prev || 1, lastPlayDate: today };
  }

  if (last === previousDateKey(today)) {
    return { playStreak: prev + 1, lastPlayDate: today };
  }

  return { playStreak: 1, lastPlayDate: today };
}

/**
 * @returns {CoupleStats}
 */
export function createDefaultCoupleStats() {
  return {
    bestScore: 0,
    bestPlayerId: null,
    bestPlayerName: '',
    totalGames: 0,
    totalChocolate: 0,
    updatedAt: null,
    playStreak: 0,
    lastPlayDate: null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function coupleRef(db, roomCode) {
  return doc(db, ROOMS_COLLECTION, roomCode, COUPLE_COLLECTION, COUPLE_DOC_ID);
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 */
export function playerStatsRef(db, roomCode, playerId) {
  return doc(
    db,
    ROOMS_COLLECTION,
    roomCode,
    PLAYERS_SUBCOLLECTION,
    playerId,
    STATS_COLLECTION,
    STATS_DOC_ID
  );
}

/**
 * @param {import('firebase/firestore').DocumentSnapshot} snap
 * @returns {CoupleStats}
 */
export function coupleFromSnapshot(snap) {
  if (!snap.exists()) return createDefaultCoupleStats();

  const data = snap.data();
  return {
    bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
    bestPlayerId: typeof data.bestPlayerId === 'string' ? data.bestPlayerId : null,
    bestPlayerName: typeof data.bestPlayerName === 'string' ? data.bestPlayerName : '',
    totalGames: typeof data.totalGames === 'number' ? data.totalGames : 0,
    totalChocolate: typeof data.totalChocolate === 'number' ? data.totalChocolate : 0,
    updatedAt: data.updatedAt?.toMillis?.() ?? null,
    playStreak: typeof data.playStreak === 'number' ? data.playStreak : 0,
    lastPlayDate: typeof data.lastPlayDate === 'string' ? data.lastPlayDate : null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @returns {Promise<CoupleStats>}
 */
export async function fetchCoupleStats(db, roomCode) {
  const snap = await getDoc(coupleRef(db, roomCode));
  return coupleFromSnapshot(snap);
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function transactionInitCouple(transaction, db, roomCode) {
  transaction.set(coupleRef(db, roomCode), {
    ...createDefaultCoupleStats(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function transactionDeleteCouple(transaction, db, roomCode) {
  transaction.delete(coupleRef(db, roomCode));
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').DocumentSnapshot} coupleSnap
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} score
 * @returns {{ stats: CoupleStats, isNewBest: boolean }}
 */
export function applyScoreToCouple(transaction, coupleSnap, db, roomCode, playerId, playerName, score) {
  const ref = coupleRef(db, roomCode);
  const current = coupleSnap.exists() ? coupleFromSnapshot(coupleSnap) : createDefaultCoupleStats();

  const safeScore = Math.max(0, Math.floor(score));
  const streakUpdate = computePlayStreak(current);
  const next = {
    bestScore: current.bestScore,
    bestPlayerId: current.bestPlayerId,
    bestPlayerName: current.bestPlayerName,
    totalGames: current.totalGames + 1,
    totalChocolate: current.totalChocolate + safeScore,
    playStreak: streakUpdate.playStreak,
    lastPlayDate: streakUpdate.lastPlayDate,
    updatedAt: serverTimestamp(),
  };

  let isNewBest = false;
  if (safeScore > current.bestScore) {
    next.bestScore = safeScore;
    next.bestPlayerId = playerId;
    next.bestPlayerName = playerName;
    isNewBest = true;
  }

  if (coupleSnap.exists()) {
    transaction.update(ref, next);
  } else {
    transaction.set(ref, next);
  }

  return {
    stats: {
      bestScore: next.bestScore,
      bestPlayerId: next.bestPlayerId,
      bestPlayerName: next.bestPlayerName,
      totalGames: next.totalGames,
      totalChocolate: next.totalChocolate,
      playStreak: next.playStreak,
      lastPlayDate: next.lastPlayDate,
      updatedAt: Date.now(),
    },
    isNewBest,
  };
}

/**
 * @param {import('firebase/firestore').Transaction} transaction
 * @param {import('firebase/firestore').DocumentSnapshot} statsSnap
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @param {number} score
 */
export function applyPlayerStats(transaction, statsSnap, db, roomCode, playerId, score) {
  const ref = playerStatsRef(db, roomCode, playerId);
  const prev = statsSnap.exists() ? statsSnap.data() : {};
  const safeScore = Math.max(0, Math.floor(score));
  const prevBest = typeof prev.bestScore === 'number' ? prev.bestScore : 0;
  const prevGames = typeof prev.gamesPlayed === 'number' ? prev.gamesPlayed : 0;

  const next = {
    bestScore: Math.max(prevBest, safeScore),
    lastScore: safeScore,
    gamesPlayed: prevGames + 1,
    updatedAt: serverTimestamp(),
  };

  if (statsSnap.exists()) {
    transaction.update(ref, next);
  } else {
    transaction.set(ref, next);
  }

  return {
    bestScore: next.bestScore,
    lastScore: safeScore,
    gamesPlayed: next.gamesPlayed,
  };
}

/**
 * @param {import('firebase/firestore').DocumentSnapshot} snap
 */
export function playerStatsFromSnapshot(snap) {
  if (!snap.exists()) {
    return { bestScore: 0, lastScore: 0, gamesPlayed: 0 };
  }
  const data = snap.data();
  return {
    bestScore: typeof data.bestScore === 'number' ? data.bestScore : 0,
    lastScore: typeof data.lastScore === 'number' ? data.lastScore : 0,
    gamesPlayed: typeof data.gamesPlayed === 'number' ? data.gamesPlayed : 0,
  };
}
