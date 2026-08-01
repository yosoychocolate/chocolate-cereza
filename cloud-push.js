/**
 * Registro de tokens FCM no Firestore (push com site fechado).
 */
import {
  doc,
  setDoc,
  serverTimestamp,
  getFirestoreDb,
  initFirebase,
  isFirebaseConfigValid,
} from './firebase-manager.js?v=__APP_VERSION__';
import { getOrCreatePlayerId, getPlayerName } from './player-identity.js?v=__APP_VERSION__';

async function tokenDocId(token) {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40);
}

/**
 * @param {string} token
 * @param {{ timezone?: string, reminderTime?: string }} [meta]
 */
export async function registerPushToken(token, meta = {}) {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'invalid_token' };
  }
  if (!isFirebaseConfigValid()) {
    return { ok: false, reason: 'firebase_config' };
  }

  initFirebase();
  const db = getFirestoreDb();
  if (!db) return { ok: false, reason: 'no_db' };

  try {
    const id = await tokenDocId(token);
    await setDoc(
      doc(db, 'pushTokens', id),
      {
        token,
        playerId: getOrCreatePlayerId(),
        playerName: getPlayerName() || '',
        enabled: true,
        timezone: meta.timezone || 'America/New_York',
        reminderTime: meta.reminderTime || '20:30',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { ok: true, id };
  } catch (err) {
    console.warn('[CloudPush] registerPushToken:', err);
    return { ok: false, reason: 'write_failed', message: String(err) };
  }
}

/** @param {string} token */
export async function disablePushToken(token) {
  if (!token) return { ok: false };
  initFirebase();
  const db = getFirestoreDb();
  if (!db) return { ok: false };

  try {
    const id = await tokenDocId(token);
    await setDoc(
      doc(db, 'pushTokens', id),
      { enabled: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { ok: true };
  } catch (err) {
    console.warn('[CloudPush] disablePushToken:', err);
    return { ok: false };
  }
}
