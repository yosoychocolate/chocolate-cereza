/**
 * Indicador "escribiendo…" no chat privado entre amigos.
 * dmTyping/{threadId}/users/{playerId}
 */
import { doc, setDoc, onSnapshot, serverTimestamp } from './firebase-manager.js?v=7cbf9eb';

const ROOT = 'dmTyping';
const USERS = 'users';
export const TYPING_TTL_MS = 3500;

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} threadId
 * @param {string} playerId
 */
export function dmTypingRef(db, threadId, playerId) {
  return doc(db, ROOT, threadId, USERS, playerId);
}

/**
 * @param {{ typing?: boolean, updatedAt?: { toMillis?: () => number } | number }} data
 */
export function isTypingActive(data) {
  if (!data?.typing) return false;
  const ts = typeof data.updatedAt === 'number'
    ? data.updatedAt
    : (data.updatedAt?.toMillis?.() ?? 0);
  if (!ts) return false;
  return Date.now() - ts < TYPING_TTL_MS;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} threadId
 * @param {string} playerId
 * @param {boolean} typing
 */
export async function setDmTyping(db, threadId, playerId, typing) {
  if (!threadId || !playerId) return;
  await setDoc(
    dmTypingRef(db, threadId, playerId),
    {
      typing,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} threadId
 * @param {string} peerPlayerId
 * @param {(typing: boolean) => void} callback
 */
export function subscribePeerDmTyping(db, threadId, peerPlayerId, callback) {
  if (!threadId || !peerPlayerId || typeof callback !== 'function') return () => {};

  let expiryTimer = null;

  function scheduleExpiryCheck(data) {
    if (expiryTimer) clearTimeout(expiryTimer);
    if (!isTypingActive(data)) {
      callback(false);
      return;
    }
    callback(true);
    const ts = typeof data.updatedAt === 'number'
      ? data.updatedAt
      : (data.updatedAt?.toMillis?.() ?? Date.now());
    const remaining = Math.max(200, TYPING_TTL_MS - (Date.now() - ts) + 50);
    expiryTimer = setTimeout(() => callback(false), remaining);
  }

  const unsub = onSnapshot(
    dmTypingRef(db, threadId, peerPlayerId),
    (snap) => {
      scheduleExpiryCheck(snap.exists() ? snap.data() : { typing: false });
    },
    () => callback(false)
  );

  return () => {
    if (expiryTimer) clearTimeout(expiryTimer);
    unsub();
  };
}
