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
  collection,
  query,
  where,
  getDocs,
} from './firebase-manager.js?v=__APP_VERSION__';
import { getOrCreatePlayerId, getPlayerName, getUsername } from './player-identity.js?v=__APP_VERSION__';

async function tokenDocId(token) {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 40);
}

/** Desativa tokens antigos do mesmo jogador/dispositivo para evitar envio ao PC. */
async function disableStaleTokens(db, token, meta = {}) {
  const playerId = getOrCreatePlayerId();
  const q = query(collection(db, 'pushTokens'), where('enabled', '==', true));
  const snap = await getDocs(q);
  const tasks = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.token === token) return;

    const samePlayer = d.playerId && d.playerId === playerId;
    const sameDevice =
      meta.deviceLabel &&
      d.deviceLabel === meta.deviceLabel &&
      meta.origin &&
      d.origin === meta.origin;
    const isLocalhost = /localhost|127\.0\.0\.1/i.test(String(d.origin || ''));

    const isMobileProd =
      /android|iphone|ipad|ipod/i.test(String(meta.deviceLabel || '')) &&
      /github\.io/i.test(String(meta.origin || ''));

    if (
      samePlayer ||
      sameDevice ||
      isLocalhost ||
      (isMobileProd && d.deviceLabel === 'desktop') ||
      (isLocalhost && /github\.io/i.test(String(meta.origin || '')))
    ) {
      tasks.push(
        setDoc(docSnap.ref, { enabled: false, updatedAt: serverTimestamp() }, { merge: true })
      );
    }
  });

  if (tasks.length) {
    await Promise.all(tasks);
    console.log(`[CloudPush] ${tasks.length} token(s) antigo(s) desativado(s).`);
  }
}

/**
 * @param {string} token
 * @param {{ timezone?: string, reminderTime?: string, deviceLabel?: string, origin?: string }} [meta]
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
    await disableStaleTokens(db, token, meta);
    await setDoc(
      doc(db, 'pushTokens', id),
      {
        token,
        playerId: getOrCreatePlayerId(),
        playerName: getPlayerName() || '',
        username: getUsername() || '',
        enabled: true,
        timezone: meta.timezone || 'America/New_York',
        reminderTime: meta.reminderTime || '20:30',
        deviceLabel: meta.deviceLabel || '',
        origin: meta.origin || '',
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
