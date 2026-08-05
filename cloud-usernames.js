/**
 * Usernames curtos — adicionar amigos por @nome em vez de UUID.
 * playerUsernames/{username} → { playerId, username, displayName }
 * playerProfiles/{playerId} → { username, displayName, photoUrl? }
 */
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';
import { globalPresenceRef } from './cloud-global-presence.js?v=__APP_VERSION__';

const USERNAMES = 'playerUsernames';
const PROFILES = 'playerProfiles';

const RESERVED = new Set([
  'admin', 'system', 'jugador', 'amigo', 'amigos', 'soporte', 'help', 'null', 'undefined',
]);

/**
 * @param {string} input
 * @returns {string}
 */
export function normalizeUsername(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16);
}

/**
 * @param {string} username
 * @returns {string|null} mensagem de erro ou null se válido
 */
export function validateUsername(username) {
  if (!username || username.length < 3) {
    return 'Mínimo 3 caracteres (letras, números o _).';
  }
  if (username.length > 16) {
    return 'Máximo 16 caracteres.';
  }
  if (!/^[a-z][a-z0-9_]*$/.test(username)) {
    return 'Empieza con letra; solo a-z, 0-9 y _.';
  }
  if (RESERVED.has(username)) {
    return 'Ese usuario no está disponible.';
  }
  return null;
}

export function usernameDocRef(db, username) {
  return doc(db, USERNAMES, username);
}

export function playerProfileRef(db, playerId) {
  return doc(db, PROFILES, playerId);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {string} identifier UUID ou @username
 * @returns {boolean}
 */
export function looksLikePlayerUuid(identifier) {
  return UUID_RE.test(String(identifier || '').trim());
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} identifier
 * @returns {Promise<string>} playerId
 */
export async function resolvePlayerId(db, identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) throw new Error('Escribe un usuario.');

  if (looksLikePlayerUuid(raw)) {
    return raw;
  }

  const username = normalizeUsername(raw);
  const err = validateUsername(username);
  if (err) throw new Error(err);

  const snap = await getDoc(usernameDocRef(db, username));
  if (!snap.exists()) {
    throw new Error(`Usuario @${username} no encontrado.`);
  }

  const playerId = snap.data()?.playerId;
  if (typeof playerId !== 'string' || !playerId) {
    throw new Error('Usuario no encontrado.');
  }
  return playerId;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 */
export async function fetchPlayerUsername(db, playerId) {
  if (!playerId) return '';
  const snap = await getDoc(playerProfileRef(db, playerId));
  if (!snap.exists()) return '';
  const username = snap.data()?.username;
  return typeof username === 'string' ? username : '';
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {string} displayName
 * @param {string} rawUsername
 */
export async function claimUsername(db, playerId, displayName, rawUsername) {
  if (!playerId) throw new Error('Jugador no identificado.');

  const username = normalizeUsername(rawUsername);
  const err = validateUsername(username);
  if (err) throw new Error(err);

  const profileRef = playerProfileRef(db, playerId);
  const newUsernameRef = usernameDocRef(db, username);

  await runTransaction(db, async (tx) => {
    const profileSnap = await tx.get(profileRef);
    const usernameSnap = await tx.get(newUsernameRef);

    const oldUsername = profileSnap.exists()
      ? (typeof profileSnap.data()?.username === 'string' ? profileSnap.data().username : '')
      : '';

    if (usernameSnap.exists()) {
      const owner = usernameSnap.data()?.playerId;
      if (owner !== playerId) {
        throw new Error(`@${username} ya está en uso.`);
      }
    }

    if (oldUsername && oldUsername !== username) {
      tx.delete(usernameDocRef(db, oldUsername));
    }

    const label = `@${username}`;
    tx.set(newUsernameRef, {
      playerId,
      username,
      displayName: label,
      updatedAt: serverTimestamp(),
    });
    tx.set(profileRef, {
      playerId,
      username,
      displayName: label,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });

  try {
    await setDoc(globalPresenceRef(db, playerId), { username, name: `@${username}` }, { merge: true });
  } catch (_) { /* ignore */ }

  return username;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 */
export async function fetchPlayerProfile(db, playerId) {
  const snap = await getDoc(playerProfileRef(db, playerId));
  if (!snap.exists()) {
    return { username: '', displayName: '', photoUrl: '' };
  }
  const data = snap.data();
  return {
    username: typeof data.username === 'string' ? data.username : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} playerId
 * @param {string} photoUrl data URL o URL https
 */
export async function setPlayerPhotoUrl(db, playerId, photoUrl) {
  if (!playerId) throw new Error('Jugador no identificado.');
  const url = typeof photoUrl === 'string' ? photoUrl.trim() : '';
  await setDoc(playerProfileRef(db, playerId), {
    photoUrl: url,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  try {
    await setDoc(globalPresenceRef(db, playerId), { photoUrl: url }, { merge: true });
  } catch (_) { /* ignore */ }
  return url;
}
