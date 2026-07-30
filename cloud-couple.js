/**
 * CloudCouple — estatísticas compartilhadas do casal na sala.
 * Usado exclusivamente por cloud-manager.js e cloud-listener.js.
 *
 * Estrutura:
 * rooms/{code}/couple/data
 */
import { doc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';

const ROOMS_COLLECTION = 'rooms';
const COUPLE_COLLECTION = 'couple';
const COUPLE_DOC_ID = 'data';

/** @typedef {Object} CoupleStats
 * @property {number} bestScore
 * @property {string|null} bestPlayerId
 * @property {string} bestPlayerName
 * @property {number} totalGames
 * @property {number} totalChocolate
 * @property {number|null} updatedAt
 */

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
  const next = {
    bestScore: current.bestScore,
    bestPlayerId: current.bestPlayerId,
    bestPlayerName: current.bestPlayerName,
    totalGames: current.totalGames + 1,
    totalChocolate: current.totalChocolate + safeScore,
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
      updatedAt: Date.now(),
    },
    isNewBest,
  };
}
