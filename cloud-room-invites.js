/**
 * Convites de sala enviados a amigos.
 * roomInvites/{targetPlayerId}/items/{inviteId}
 * roomInvitesByName/{username}/items/{inviteId} — espelho por @usuario
 */
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
} from './firebase-manager.js?v=__APP_VERSION__';
import { normalizeUsername } from './cloud-usernames.js?v=__APP_VERSION__';

const ROOT = 'roomInvites';
const ROOT_BY_NAME = 'roomInvitesByName';
const ITEMS = 'items';
/**
 * @typedef {Object} RoomInvite
 * @property {string} id
 * @property {string} roomCode
 * @property {string} fromPlayerId
 * @property {string} fromName
 * @property {'pending'|'accepted'|'declined'} status
 * @property {number|null} createdAt
 */

export function inviteItemRef(db, targetPlayerId, inviteId) {
  return doc(db, ROOT, targetPlayerId, ITEMS, inviteId);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {RoomInvite}
 */
export function inviteFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    roomCode: typeof data.roomCode === 'string' ? data.roomCode : '',
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : '',
    status: data.status === 'accepted' || data.status === 'declined' ? data.status : 'pending',
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {{ roomCode: string, fromPlayerId: string, fromName: string }} payload
 * @param {string} [targetUsername]
 */
export async function sendRoomInvite(db, targetPlayerId, payload, targetUsername = '') {
  const inviteId = crypto.randomUUID();
  const data = {
    roomCode: payload.roomCode,
    fromPlayerId: payload.fromPlayerId,
    fromName: payload.fromName || 'Amigo',
    status: 'pending',
    createdAt: serverTimestamp(),
  };

  await setDoc(inviteItemRef(db, targetPlayerId, inviteId), data);

  const uname = normalizeUsername(targetUsername);
  if (uname) {
    await setDoc(doc(db, ROOT_BY_NAME, uname, ITEMS, inviteId), {
      ...data,
      targetPlayerId,
    });
  }

  return inviteId;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} username
 * @param {(invites: RoomInvite[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribePendingInvitesByName(db, username, callback, onError) {
  const uname = normalizeUsername(username);
  if (!uname) return () => {};

  const ref = collection(db, ROOT_BY_NAME, uname, ITEMS);
  return onSnapshot(
    ref,
    (snap) => {
      const invites = snap.docs
        .map(inviteFromDoc)
        .filter((inv) => inv.status === 'pending');
      invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(invites);
    },
    (err) => {
      console.warn('[RoomInvites] subscribe by name:', err);
      if (typeof onError === 'function') {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {(invites: RoomInvite[]) => void} callback
 * @param {(err: Error) => void} [onError]
 */
export function subscribePendingInvites(db, targetPlayerId, callback, onError) {
  const ref = collection(db, ROOT, targetPlayerId, ITEMS);
  return onSnapshot(
    ref,
    (snap) => {
      const invites = snap.docs
        .map(inviteFromDoc)
        .filter((inv) => inv.status === 'pending');
      invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(invites);
    },
    (err) => {
      console.warn('[RoomInvites] subscribe:', err);
      if (typeof onError === 'function') {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {string} inviteId
 * @param {'accepted'|'declined'} status
 */
export async function updateInviteStatus(db, targetPlayerId, inviteId, status) {
  await setDoc(
    inviteItemRef(db, targetPlayerId, inviteId),
    { status, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} username
 * @param {string} inviteId
 * @param {'accepted'|'declined'} status
 */
export async function updateInviteStatusByName(db, username, inviteId, status) {
  const uname = normalizeUsername(username);
  if (!uname) return;
  await setDoc(
    doc(db, ROOT_BY_NAME, uname, ITEMS, inviteId),
    { status, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
