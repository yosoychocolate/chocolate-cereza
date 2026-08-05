/**
 * Lista de amigos — Firestore friends/{ownerId}/contacts/{friendId}
 */
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';

const ROOT = 'friends';
const CONTACTS = 'contacts';

export function friendContactRef(db, ownerId, friendId) {
  return doc(db, ROOT, ownerId, CONTACTS, friendId);
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} docSnap
 */
export function friendFromDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    friendId: typeof data.friendId === 'string' ? data.friendId : docSnap.id,
    friendName: typeof data.friendName === 'string' ? data.friendName : 'Amigo',
    addedAt: typeof data.addedAt === 'number' ? data.addedAt : 0,
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} ownerId
 * @param {string} friendId
 * @param {string} friendName
 */
export async function addFriendContact(db, ownerId, friendId, friendName) {
  if (!ownerId || !friendId || ownerId === friendId) {
    throw new Error('ID de amigo inválido.');
  }
  await setDoc(friendContactRef(db, ownerId, friendId), {
    friendId,
    friendName: friendName || 'Amigo',
    addedAt: Date.now(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} ownerId
 * @param {string} friendId
 */
export async function removeFriendContact(db, ownerId, friendId) {
  await deleteDoc(friendContactRef(db, ownerId, friendId));
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} friendId
 */
export async function fetchFriendProfileName(db, friendId) {
  const snap = await getDoc(doc(db, 'globalPresence', friendId));
  if (!snap.exists()) return '';
  const name = snap.data()?.name;
  return typeof name === 'string' ? name : '';
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} ownerId
 * @param {(friends: ReturnType<typeof friendFromDoc>[]) => void} callback
 */
export function subscribeFriends(db, ownerId, callback) {
  const ref = collection(db, ROOT, ownerId, CONTACTS);
  return onSnapshot(
    ref,
    (snap) => {
      const friends = snap.docs.map(friendFromDoc);
      friends.sort((a, b) => a.friendName.localeCompare(b.friendName, 'es'));
      callback(friends);
    },
    (err) => console.warn('[CloudFriends] subscribe:', err)
  );
}
