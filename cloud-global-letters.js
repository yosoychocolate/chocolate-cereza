/**
 * Cartas / buzón personal — directo entre personas (sin sala).
 * globalLetters/{letterId}
 */
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  orderBy,
} from './firebase-manager.js?v=__APP_VERSION__';

const COLLECTION = 'globalLetters';

/**
 * @typedef {Object} GlobalLetter
 * @property {string} id
 * @property {string} threadId
 * @property {string} fromPlayerId
 * @property {string} toPlayerId
 * @property {string} fromName
 * @property {string} toName
 * @property {string} text
 * @property {string} type
 * @property {string|null} deliverDate
 * @property {string|null} openAfter
 * @property {string} photoUrl
 * @property {string} audioUrl
 * @property {Record<string, string>} reactions
 * @property {number|null} createdAt
 */

/**
 * @param {string} playerIdA
 * @param {string} playerIdB
 */
export function buildLetterThreadId(playerIdA, playerIdB) {
  return [playerIdA, playerIdB].sort().join('_');
}

export function globalLettersCollectionRef(db) {
  return collection(db, COLLECTION);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {GlobalLetter}
 */
export function globalLetterFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    threadId: typeof data.threadId === 'string' ? data.threadId : '',
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : '',
    toPlayerId: typeof data.toPlayerId === 'string' ? data.toPlayerId : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : '',
    toName: typeof data.toName === 'string' ? data.toName : '',
    text: typeof data.text === 'string' ? data.text : '',
    type: typeof data.type === 'string' ? data.type : 'inbox',
    deliverDate: typeof data.deliverDate === 'string' ? data.deliverDate : null,
    openAfter: typeof data.openAfter === 'string' ? data.openAfter : null,
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
    audioUrl: typeof data.audioUrl === 'string' ? data.audioUrl : '',
    reactions: data.reactions && typeof data.reactions === 'object' ? data.reactions : {},
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} fromPlayerId
 * @param {string} toPlayerId
 * @param {Omit<GlobalLetter, 'id'|'threadId'|'createdAt'> & { text: string }} letter
 */
export async function sendGlobalLetter(db, fromPlayerId, toPlayerId, letter) {
  if (!fromPlayerId || !toPlayerId || fromPlayerId === toPlayerId) {
    throw new Error('Destinatario inválido.');
  }
  const text = (letter.text || '').trim();
  if (!text && !letter.photoUrl) throw new Error('Carta vacía.');

  const threadId = buildLetterThreadId(fromPlayerId, toPlayerId);
  const docRef = await addDoc(globalLettersCollectionRef(db), {
    threadId,
    fromPlayerId,
    toPlayerId,
    fromName: letter.fromName || 'Jugador',
    toName: letter.toName || '',
    text,
    type: letter.type || 'inbox',
    deliverDate: letter.deliverDate || null,
    openAfter: letter.openAfter || null,
    photoUrl: letter.photoUrl || '',
    audioUrl: letter.audioUrl || '',
    reactions: letter.reactions || {},
    pushNotified: false,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} letterId
 */
export async function deleteGlobalLetter(db, letterId) {
  if (!letterId) return;
  await deleteDoc(doc(db, COLLECTION, letterId));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {(letters: GlobalLetter[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeIncomingGlobalLetters(db, playerId, callback, onError) {
  if (!playerId) return () => {};

  const q = query(
    globalLettersCollectionRef(db),
    where('toPlayerId', '==', playerId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map(globalLetterFromDoc));
    },
    (err) => {
      console.warn('[GlobalLetters] incoming:', err);
      if (typeof onError === 'function') onError(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} threadId
 * @param {(letters: GlobalLetter[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribeGlobalLettersThread(db, threadId, callback, onError) {
  if (!threadId) return () => {};

  const q = query(
    globalLettersCollectionRef(db),
    where('threadId', '==', threadId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map(globalLetterFromDoc));
    },
    (err) => {
      console.warn('[GlobalLetters] thread:', err);
      if (typeof onError === 'function') onError(err instanceof Error ? err : new Error(String(err)));
    }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 */
export async function fetchLettersForPlayer(db, playerId) {
  if (!playerId) return [];
  const [inSnap, outSnap] = await Promise.all([
    getDocs(query(globalLettersCollectionRef(db), where('toPlayerId', '==', playerId))),
    getDocs(query(globalLettersCollectionRef(db), where('fromPlayerId', '==', playerId))),
  ]);
  const map = new Map();
  [...inSnap.docs, ...outSnap.docs].forEach((d) => {
    map.set(d.id, globalLetterFromDoc(d));
  });
  return [...map.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
