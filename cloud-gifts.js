/**
 * CloudGifts — doação de chocolates 🍫 entre jogadores da sala.
 * Usado exclusivamente por cloud-manager.js.
 *
 * Estrutura:
 * rooms/{code}/gifts/{giftId}
 */
import {
  collection,
  doc,
  query,
  where,
  addDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from './firebase-manager.js?v=7cbf9eb';

const ROOMS_COLLECTION = 'rooms';
const GIFTS_SUBCOLLECTION = 'gifts';

export const MIN_GIFT_AMOUNT = 1;
export const MAX_GIFT_AMOUNT = 9999;

/**
 * @typedef {Object} ChocolateGift
 * @property {string} id
 * @property {string} fromPlayerId
 * @property {string} fromPlayerName
 * @property {string} toPlayerId
 * @property {string} toPlayerName
 * @property {number} amount
 * @property {'pending' | 'claimed'} status
 * @property {number|null} createdAt
 */

/**
 * @typedef {Object} GiftUpdateEvent
 * @property {'gift_pending' | 'error'} type
 * @property {ChocolateGift[]} gifts
 * @property {number} timestamp
 * @property {string} [message]
 */

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function giftsCollectionRef(db, roomCode) {
  return collection(db, ROOMS_COLLECTION, roomCode, GIFTS_SUBCOLLECTION);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {ChocolateGift}
 */
export function giftFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : '',
    fromPlayerName: typeof data.fromPlayerName === 'string' ? data.fromPlayerName : '',
    toPlayerId: typeof data.toPlayerId === 'string' ? data.toPlayerId : '',
    toPlayerName: typeof data.toPlayerName === 'string' ? data.toPlayerName : '',
    amount: typeof data.amount === 'number' && data.amount > 0 ? Math.floor(data.amount) : 0,
    status: data.status === 'claimed' ? 'claimed' : 'pending',
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {number} amount
 * @returns {number|null}
 */
export function normalizeGiftAmount(amount) {
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n < MIN_GIFT_AMOUNT || n > MAX_GIFT_AMOUNT) return null;
  return n;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {Object} payload
 */
export async function createChocolateGift(db, roomCode, payload) {
  const amount = normalizeGiftAmount(payload.amount);
  if (!amount) {
    throw new Error('Cantidad inválida.');
  }

  const fromPlayerId = typeof payload.fromPlayerId === 'string' ? payload.fromPlayerId.trim() : '';
  const toPlayerId = typeof payload.toPlayerId === 'string' ? payload.toPlayerId.trim() : '';
  if (!fromPlayerId || !toPlayerId || fromPlayerId === toPlayerId) {
    throw new Error('Jugadores inválidos.');
  }

  const docRef = await addDoc(giftsCollectionRef(db, roomCode), {
    fromPlayerId,
    fromPlayerName: typeof payload.fromPlayerName === 'string' ? payload.fromPlayerName.trim() : 'Jugador',
    toPlayerId,
    toPlayerName: typeof payload.toPlayerName === 'string' ? payload.toPlayerName.trim() : 'Pareja',
    amount,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return { id: docRef.id, amount };
}

/**
 * Marca presente como reclamado e devolve dados para creditar carteira local.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} giftId
 * @param {string} playerId
 * @returns {Promise<{ amount: number, fromPlayerName: string } | null>}
 */
export async function claimGiftTransaction(db, roomCode, giftId, playerId) {
  const giftRef = doc(db, ROOMS_COLLECTION, roomCode, GIFTS_SUBCOLLECTION, giftId);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(giftRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    if (data.status !== 'pending') return null;
    if (data.toPlayerId !== playerId) return null;

    const amount = typeof data.amount === 'number' ? Math.floor(data.amount) : 0;
    if (amount < MIN_GIFT_AMOUNT) return null;

    transaction.update(giftRef, {
      status: 'claimed',
      claimedAt: serverTimestamp(),
    });

    return {
      amount,
      fromPlayerName: typeof data.fromPlayerName === 'string' ? data.fromPlayerName : 'Tu pareja',
    };
  });
}

export function createGiftListener() {
  /** @type {Set<(event: GiftUpdateEvent) => void>} */
  const callbacks = new Set();

  /** @type {import('firebase/firestore').Unsubscribe | null} */
  let giftsUnsub = null;

  /** @type {boolean} */
  let active = false;

  /**
   * @param {GiftUpdateEvent} event
   */
  function emit(event) {
    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[CloudGifts] callback error:', err);
      }
    });
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} roomCode
   * @param {string} playerId
   */
  function start(db, roomCode, playerId) {
    stop();

    if (!roomCode || !playerId) return;

    active = true;
    const giftsRef = giftsCollectionRef(db, roomCode);
    const giftsQuery = query(
      giftsRef,
      where('toPlayerId', '==', playerId)
    );

    giftsUnsub = onSnapshot(
      giftsQuery,
      (snap) => {
        const gifts = snap.docs
          .map(giftFromDoc)
          .filter((gift) => gift.status === 'pending');
        emit({
          type: 'gift_pending',
          gifts,
          timestamp: Date.now(),
        });
      },
      (err) => {
        emit({
          type: 'error',
          gifts: [],
          timestamp: Date.now(),
          message: err.message,
        });
      }
    );
  }

  function stop() {
    if (giftsUnsub) {
      giftsUnsub();
      giftsUnsub = null;
    }
    active = false;
  }

  /**
   * @param {(event: GiftUpdateEvent) => void} callback
   * @returns {() => void}
   */
  function subscribe(callback) {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  /**
   * @param {(event: GiftUpdateEvent) => void} [callback]
   */
  function unsubscribe(callback) {
    if (callback) {
      callbacks.delete(callback);
      return;
    }
    callbacks.clear();
  }

  function isActive() {
    return active;
  }

  return {
    start,
    stop,
    subscribe,
    unsubscribe,
    isActive,
  };
}
