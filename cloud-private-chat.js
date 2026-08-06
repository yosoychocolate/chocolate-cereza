/**
 * CloudPrivateChat — mensagens privadas entre dois jogadores na sala.
 * rooms/{code}/privateChat/{messageId}
 */
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
} from './firebase-manager.js?v=7cbf9eb';
import { normalizeChatText, MAX_CHAT_LENGTH, MAX_CHAT_MESSAGES } from './cloud-chat.js?v=7cbf9eb';

const ROOMS_COLLECTION = 'rooms';
const PRIVATE_CHAT_SUBCOLLECTION = 'privateChat';

export { MAX_CHAT_LENGTH };

/**
 * @typedef {Object} PrivateChatMessage
 * @property {string} id
 * @property {string} threadId
 * @property {string} fromPlayerId
 * @property {string} toPlayerId
 * @property {string} fromName
 * @property {string} message
 * @property {number|null} createdAt
 */

/**
 * @typedef {Object} PrivateChatUpdateEvent
 * @property {'private_chat_updated' | 'error'} type
 * @property {PrivateChatMessage[]} messages
 * @property {number} timestamp
 * @property {string} [message]
 */

/**
 * @param {string} playerIdA
 * @param {string} playerIdB
 * @returns {string}
 */
export function buildPrivateThreadId(playerIdA, playerIdB) {
  return [playerIdA, playerIdB].sort().join('_');
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function privateChatCollectionRef(db, roomCode) {
  return collection(db, ROOMS_COLLECTION, roomCode, PRIVATE_CHAT_SUBCOLLECTION);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {PrivateChatMessage}
 */
export function privateChatMessageFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    threadId: typeof data.threadId === 'string' ? data.threadId : '',
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : '',
    toPlayerId: typeof data.toPlayerId === 'string' ? data.toPlayerId : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : '',
    message: typeof data.message === 'string' ? data.message : '',
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} threadId
 */
async function trimPrivateChatMessages(db, roomCode, threadId) {
  const chatRef = privateChatCollectionRef(db, roomCode);
  const snap = await getDocs(
    query(chatRef, where('threadId', '==', threadId), orderBy('createdAt', 'asc'))
  );
  if (snap.size <= MAX_CHAT_MESSAGES) return;

  const excess = snap.size - MAX_CHAT_MESSAGES;
  const toDelete = snap.docs.slice(0, excess);
  await Promise.all(toDelete.map((docSnap) => deleteDoc(docSnap.ref)));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @param {string} fromName
 * @param {string} message
 */
export async function sendPrivateMessage(db, roomCode, fromPlayerId, toPlayerId, fromName, message) {
  const text = normalizeChatText(message);
  if (!text) throw new Error('Mensaje vacío.');

  const fromId = typeof fromPlayerId === 'string' ? fromPlayerId.trim() : '';
  const toId = typeof toPlayerId === 'string' ? toPlayerId.trim() : '';
  if (!fromId || !toId || fromId === toId) {
    throw new Error('Destinatario inválido.');
  }

  const threadId = buildPrivateThreadId(fromId, toId);
  const chatRef = privateChatCollectionRef(db, roomCode);
  const docRef = await addDoc(chatRef, {
    threadId,
    fromPlayerId: fromId,
    toPlayerId: toId,
    fromName: typeof fromName === 'string' ? fromName.trim() || 'Jugador' : 'Jugador',
    message: text,
    createdAt: serverTimestamp(),
  });

  trimPrivateChatMessages(db, roomCode, threadId).catch((err) => {
    console.warn('[CloudPrivateChat] trim error:', err);
  });

  return docRef.id;
}

export function createPrivateChatListener() {
  /** @type {Set<(event: PrivateChatUpdateEvent) => void>} */
  const callbacks = new Set();

  /** @type {import('firebase/firestore').Unsubscribe | null} */
  let chatUnsub = null;

  /** @type {boolean} */
  let active = false;

  /** @type {string} */
  let activeThreadId = '';

  /**
   * @param {PrivateChatUpdateEvent} event
   */
  function emit(event) {
    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[CloudPrivateChat] callback error:', err);
      }
    });
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} roomCode
   * @param {string} threadId
   */
  function start(db, roomCode, threadId) {
    stop();

    if (!threadId) return;

    active = true;
    activeThreadId = threadId;
    const chatRef = privateChatCollectionRef(db, roomCode);
    const chatQuery = query(
      chatRef,
      where('threadId', '==', threadId),
      orderBy('createdAt', 'asc'),
      limit(MAX_CHAT_MESSAGES)
    );

    chatUnsub = onSnapshot(
      chatQuery,
      (snap) => {
        const messages = snap.docs.map(privateChatMessageFromDoc);
        emit({
          type: 'private_chat_updated',
          messages,
          timestamp: Date.now(),
        });
      },
      (err) => {
        emit({
          type: 'error',
          messages: [],
          timestamp: Date.now(),
          message: err.message,
        });
      }
    );
  }

  function stop() {
    if (chatUnsub) {
      chatUnsub();
      chatUnsub = null;
    }
    active = false;
    activeThreadId = '';
  }

  /**
   * @param {(event: PrivateChatUpdateEvent) => void} callback
   * @returns {() => void}
   */
  function subscribe(callback) {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

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

  function getActiveThreadId() {
    return activeThreadId;
  }

  return {
    start,
    stop,
    subscribe,
    unsubscribe,
    isActive,
    getActiveThreadId,
  };
}
