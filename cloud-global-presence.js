/**
 * Presença global no site (fora da sala) — amigos veem online em tempo real.
 * globalPresence/{playerId}
 */
import { doc, setDoc, getDoc, serverTimestamp } from './firebase-manager.js?v=__APP_VERSION__';
import { isPresenceOnline, PRESENCE_STALE_MS } from './cloud-presence.js?v=__APP_VERSION__';

const COLLECTION = 'globalPresence';
const HEARTBEAT_MS = 25000;

/** @type {ReturnType<typeof setInterval> | null} */
let heartbeatTimer = null;

/** @type {(() => void) | null} */
let lifecycleBound = null;

export function globalPresenceRef(db, playerId) {
  return doc(db, COLLECTION, playerId);
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {string} name
 */
export async function setGlobalOnline(db, playerId, name) {
  const now = Date.now();
  await setDoc(
    globalPresenceRef(db, playerId),
    { online: true, lastSeen: now, name: name || 'Jugador', updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 */
export async function setGlobalOffline(db, playerId) {
  const now = Date.now();
  try {
    await setDoc(
      globalPresenceRef(db, playerId),
      { online: false, lastSeen: now, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.warn('[GlobalPresence] offline:', err);
  }
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {string} [name]
 */
export async function touchGlobalPresence(db, playerId, name) {
  const now = Date.now();
  const payload = { online: true, lastSeen: now, updatedAt: serverTimestamp() };
  if (name) payload.name = name;
  await setDoc(globalPresenceRef(db, playerId), payload, { merge: true });
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 */
export async function fetchGlobalPresence(db, playerId) {
  const snap = await getDoc(globalPresenceRef(db, playerId));
  if (!snap.exists()) return { online: false, lastSeen: 0, name: '' };
  const data = snap.data();
  const lastSeen = typeof data.lastSeen === 'number' ? data.lastSeen : 0;
  return {
    name: typeof data.name === 'string' ? data.name : '',
    lastSeen,
    online: isPresenceOnline({ online: data.online === true, lastSeen }),
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {string} name
 */
export function startGlobalPresenceLifecycle(db, playerId, name) {
  stopGlobalPresenceLifecycle();
  setGlobalOnline(db, playerId, name).catch(() => {});

  heartbeatTimer = setInterval(() => {
    touchGlobalPresence(db, playerId, name).catch(() => {});
  }, HEARTBEAT_MS);

  const goOffline = () => setGlobalOffline(db, playerId);
  window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    goOffline();
  });
  window.addEventListener('beforeunload', goOffline);
  lifecycleBound = goOffline;
}

export function stopGlobalPresenceLifecycle() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (lifecycleBound && typeof window !== 'undefined') {
    window.removeEventListener('pagehide', lifecycleBound);
    window.removeEventListener('beforeunload', lifecycleBound);
    lifecycleBound = null;
  }
}

export { PRESENCE_STALE_MS, isPresenceOnline };
