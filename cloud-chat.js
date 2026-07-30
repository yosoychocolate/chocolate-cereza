/**
 * CloudChat — mensagens da sala (jogador + sistema).
 * Usado exclusivamente por cloud-manager.js.
 *
 * Estrutura:
 * rooms/{code}/chat/{messageId}
 */
import {
  collection,
  query,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';

const ROOMS_COLLECTION = 'rooms';
const CHAT_SUBCOLLECTION = 'chat';

export const MAX_CHAT_MESSAGES = 100;
export const MAX_CHAT_LENGTH = 200;

const SYSTEM_PLAYER_ID = 'system';

/**
 * @typedef {'player' | 'system'} ChatMessageType
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} playerId
 * @property {string} playerName
 * @property {string} message
 * @property {ChatMessageType} type
 * @property {number|null} createdAt
 */

/**
 * @typedef {Object} ChatUpdateEvent
 * @property {'chat_updated' | 'error'} type
 * @property {ChatMessage[]} messages
 * @property {number} timestamp
 * @property {string} [message]
 */

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
export function chatCollectionRef(db, roomCode) {
  return collection(db, ROOMS_COLLECTION, roomCode, CHAT_SUBCOLLECTION);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {ChatMessage}
 */
export function chatMessageFromDoc(docSnap) {
  const data = docSnap.data();
  const type = data.type === 'system' ? 'system' : 'player';

  return {
    id: docSnap.id,
    playerId: typeof data.playerId === 'string' ? data.playerId : '',
    playerName: typeof data.playerName === 'string' ? data.playerName : '',
    message: typeof data.message === 'string' ? data.message : '',
    type,
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeChatText(text) {
  return typeof text === 'string' ? text.trim().slice(0, MAX_CHAT_LENGTH) : '';
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
async function trimChatMessages(db, roomCode) {
  const chatRef = chatCollectionRef(db, roomCode);
  const snap = await getDocs(query(chatRef, orderBy('createdAt', 'asc')));

  if (snap.size <= MAX_CHAT_MESSAGES) return;

  const excess = snap.size - MAX_CHAT_MESSAGES;
  const toDelete = snap.docs.slice(0, excess);
  await Promise.all(toDelete.map((docSnap) => deleteDoc(docSnap.ref)));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @param {string} playerName
 * @param {string} message
 */
async function writeChatMessage(db, roomCode, playerId, playerName, message, type) {
  const text = normalizeChatText(message);
  if (!text) return null;

  const chatRef = chatCollectionRef(db, roomCode);
  const docRef = await addDoc(chatRef, {
    playerId,
    playerName,
    message: text,
    type,
    createdAt: serverTimestamp(),
  });

  trimChatMessages(db, roomCode).catch((err) => {
    console.warn('[CloudChat] trim error:', err);
  });

  return docRef.id;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} playerId
 * @param {string} playerName
 * @param {string} message
 */
export async function sendPlayerMessage(db, roomCode, playerId, playerName, message) {
  const text = normalizeChatText(message);
  if (!text) {
    throw new Error('Mensaje vacío.');
  }

  const pid = typeof playerId === 'string' ? playerId.trim() : '';
  const pname = typeof playerName === 'string' ? playerName.trim() : 'Jugador';
  if (!pid) {
    throw new Error('playerId inválido.');
  }

  return writeChatMessage(db, roomCode, pid, pname, text, 'player');
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {string} message
 */
export async function sendSystemMessage(db, roomCode, message) {
  return writeChatMessage(db, roomCode, SYSTEM_PLAYER_ID, '', message, 'system');
}

export function createChatListener() {
  /** @type {Set<(event: ChatUpdateEvent) => void>} */
  const callbacks = new Set();

  /** @type {import('firebase/firestore').Unsubscribe | null} */
  let chatUnsub = null;

  /** @type {boolean} */
  let active = false;

  /**
   * @param {ChatUpdateEvent} event
   */
  function emit(event) {
    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[CloudChat] callback error:', err);
      }
    });
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} roomCode
   */
  function start(db, roomCode) {
    stop();

    active = true;
    const chatRef = chatCollectionRef(db, roomCode);
    const chatQuery = query(chatRef, orderBy('createdAt', 'asc'), limit(MAX_CHAT_MESSAGES));

    chatUnsub = onSnapshot(
      chatQuery,
      (snap) => {
        const messages = snap.docs.map(chatMessageFromDoc);
        emit({
          type: 'chat_updated',
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
  }

  /**
   * @param {(event: ChatUpdateEvent) => void} callback
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

  return {
    start,
    stop,
    subscribe,
    unsubscribe,
    isActive,
  };
}
