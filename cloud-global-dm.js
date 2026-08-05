/**
 * DM global entre amigos (fora da sala).
 * globalDm/{messageId} — filtrado por threadId
 */
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';
import { normalizeChatText, MAX_CHAT_MESSAGES, MAX_CHAT_LENGTH } from './cloud-chat.js?v=__APP_VERSION__';

const COLLECTION = 'globalDm';

export { MAX_CHAT_LENGTH };

/**
 * @typedef {Object} GlobalDmMessage
 * @property {string} id
 * @property {string} threadId
 * @property {string} fromPlayerId
 * @property {string} toPlayerId
 * @property {string} fromName
 * @property {string} message
 * @property {number|null} createdAt
 */

/**
 * @param {string} playerIdA
 * @param {string} playerIdB
 */
export function buildDmThreadId(playerIdA, playerIdB) {
  return [playerIdA, playerIdB].sort().join('_');
}

export function globalDmCollectionRef(db) {
  return collection(db, COLLECTION);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {GlobalDmMessage}
 */
export function globalDmFromDoc(docSnap) {
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

async function trimMessages(db, threadId) {
  const ref = globalDmCollectionRef(db);
  const snap = await getDocs(query(ref, where('threadId', '==', threadId)));
  if (snap.size <= MAX_CHAT_MESSAGES) return;

  const sorted = [...snap.docs].sort((a, b) => {
    const ta = a.data().createdAt?.toMillis?.() ?? 0;
    const tb = b.data().createdAt?.toMillis?.() ?? 0;
    return ta - tb;
  });

  const excess = sorted.length - MAX_CHAT_MESSAGES;
  await Promise.all(sorted.slice(0, excess).map((d) => deleteDoc(d.ref)));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @param {string} fromName
 * @param {string} message
 */
export async function sendGlobalDm(db, fromPlayerId, toPlayerId, fromName, message) {
  const text = normalizeChatText(message);
  if (!text) throw new Error('Mensaje vacío.');
  if (!fromPlayerId || !toPlayerId || fromPlayerId === toPlayerId) {
    throw new Error('Destinatario inválido.');
  }

  const threadId = buildDmThreadId(fromPlayerId, toPlayerId);
  const docRef = await addDoc(globalDmCollectionRef(db), {
    threadId,
    fromPlayerId,
    toPlayerId,
    fromName: fromName || 'Jugador',
    message: text,
    createdAt: serverTimestamp(),
  });

  trimMessages(db, threadId).catch(() => {});
  return docRef.id;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} toPlayerId
 * @param {(messages: GlobalDmMessage[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeIncomingGlobalDm(db, toPlayerId, callback, onError) {
  if (!toPlayerId) return () => {};

  const q = query(globalDmCollectionRef(db), where('toPlayerId', '==', toPlayerId));

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(globalDmFromDoc);
      messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      callback(messages);
    },
    (err) => {
      console.warn('[GlobalDm] incoming subscribe:', err);
      if (typeof onError === 'function') {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} threadId
 * @param {(messages: GlobalDmMessage[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeGlobalDm(db, threadId, callback, onError) {
  if (!threadId) return () => {};

  const ref = globalDmCollectionRef(db);
  const q = query(ref, where('threadId', '==', threadId));

  return onSnapshot(
    q,
    (snap) => {
      const messages = snap.docs.map(globalDmFromDoc);
      messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      callback(messages.length > MAX_CHAT_MESSAGES ? messages.slice(-MAX_CHAT_MESSAGES) : messages);
    },
    (err) => {
      console.warn('[GlobalDm] subscribe:', err);
      if (typeof onError === 'function') {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}
