/**
 * Pedidos de amizade — a pessoa recebe e aceita ou recusa.
 * friendRequests/{targetPlayerId}/incoming/{fromPlayerId}
 */
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';
import {
  friendContactRef,
  addFriendContact,
  fetchFriendProfileName,
} from './cloud-friends.js?v=__APP_VERSION__';
import { fetchPlayerProfile } from './cloud-usernames.js?v=__APP_VERSION__';

const ROOT = 'friendRequests';
const INCOMING = 'incoming';

/**
 * @typedef {Object} FriendRequest
 * @property {string} id
 * @property {string} fromPlayerId
 * @property {string} fromName
 * @property {'pending'|'accepted'|'declined'} status
 * @property {number|null} createdAt
 */

export function friendRequestRef(db, targetPlayerId, fromPlayerId) {
  return doc(db, ROOT, targetPlayerId, INCOMING, fromPlayerId);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 * @returns {FriendRequest}
 */
export function friendRequestFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : docSnap.id,
    fromName: typeof data.fromName === 'string' ? data.fromName : 'Jugador',
    status: data.status === 'accepted' || data.status === 'declined' ? data.status : 'pending',
    createdAt: data.createdAt?.toMillis?.() ?? null,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} ownerId
 * @param {string} targetId
 */
async function areFriends(db, ownerId, targetId) {
  const snap = await getDoc(friendContactRef(db, ownerId, targetId));
  return snap.exists();
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} fromPlayerId
 * @param {string} fromName
 * @param {string} toPlayerId
 */
export async function sendFriendRequest(db, fromPlayerId, fromName, toPlayerId) {
  if (!fromPlayerId || !toPlayerId || fromPlayerId === toPlayerId) {
    throw new Error('ID inválido.');
  }

  if (await areFriends(db, fromPlayerId, toPlayerId)) {
    throw new Error('Ya sois amigos.');
  }

  const reverse = await getDoc(friendRequestRef(db, fromPlayerId, toPlayerId));
  if (reverse.exists() && reverse.data()?.status === 'pending') {
    throw new Error('Esa persona ya te envió una solicitud — acéptala abajo.');
  }

  const existing = await getDoc(friendRequestRef(db, toPlayerId, fromPlayerId));
  if (existing.exists() && existing.data()?.status === 'pending') {
    throw new Error('Solicitud ya enviada — espera respuesta.');
  }

  await setDoc(friendRequestRef(db, toPlayerId, fromPlayerId), {
    fromPlayerId,
    fromName: fromName || 'Jugador',
    status: 'pending',
    pushNotified: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {string} fromPlayerId
 * @param {string} targetName
 */
export async function acceptFriendRequest(db, targetPlayerId, fromPlayerId, targetName) {
  const req = await getDoc(friendRequestRef(db, targetPlayerId, fromPlayerId));
  if (!req.exists() || req.data()?.status !== 'pending') {
    throw new Error('Solicitud no encontrada.');
  }

  const fromName = req.data()?.fromName || (await fetchFriendProfileName(db, fromPlayerId)) || 'Amigo';
  const myName = targetName || (await fetchFriendProfileName(db, targetPlayerId)) || 'Amigo';

  const fromProfile = await fetchPlayerProfile(db, fromPlayerId);
  const myProfile = await fetchPlayerProfile(db, targetPlayerId);
  const fromLabel = fromProfile.username ? `@${fromProfile.username}` : fromName;
  const myLabel = myProfile.username ? `@${myProfile.username}` : myName;

  await addFriendContact(db, targetPlayerId, fromPlayerId, fromLabel);
  await addFriendContact(db, fromPlayerId, targetPlayerId, myLabel);
  await deleteDoc(friendRequestRef(db, targetPlayerId, fromPlayerId));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {string} fromPlayerId
 */
export async function declineFriendRequest(db, targetPlayerId, fromPlayerId) {
  await deleteDoc(friendRequestRef(db, targetPlayerId, fromPlayerId));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} targetPlayerId
 * @param {(requests: FriendRequest[]) => void} callback
 */
export function subscribeIncomingFriendRequests(db, targetPlayerId, callback) {
  const ref = collection(db, ROOT, targetPlayerId, INCOMING);
  const q = query(ref, where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map(friendRequestFromDoc);
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    },
    (err) => console.warn('[FriendRequests] subscribe:', err)
  );
}
