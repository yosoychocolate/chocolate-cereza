/**
 * RoomSession — persistência local da sessão de sala.
 * Único módulo autorizado a acessar localStorage para dados de sala online.
 */
const SESSION_KEY = 'ChocolateCerezaRoomSession';
const LAST_ROOM_CODE_KEY = 'ChocolateCerezaLastRoomCode';

/**
 * @typedef {Object} RoomSessionData
 * @property {string} roomCode
 * @property {string} playerId
 * @property {string} playerName
 * @property {number} joinedAt
 */

function isValidSession(data) {
  return (
    data &&
    typeof data.roomCode === 'string' &&
    data.roomCode.trim().length > 0 &&
    typeof data.playerId === 'string' &&
    data.playerId.trim().length > 0 &&
    typeof data.playerName === 'string' &&
    typeof data.joinedAt === 'number' &&
    Number.isFinite(data.joinedAt)
  );
}

/**
 * @returns {RoomSessionData | null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      clearSession();
      return null;
    }
    return {
      roomCode: parsed.roomCode.trim().toUpperCase(),
      playerId: parsed.playerId.trim(),
      playerName: parsed.playerName.trim(),
      joinedAt: parsed.joinedAt,
    };
  } catch (_) {
    clearSession();
    return null;
  }
}

/**
 * @param {RoomSessionData} data
 */
export function saveSession(data) {
  if (!isValidSession(data)) return;
  try {
    const payload = {
      roomCode: data.roomCode.trim().toUpperCase(),
      playerId: data.playerId.trim(),
      playerName: data.playerName.trim(),
      joinedAt: data.joinedAt,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    saveLastRoomCode(payload.roomCode);
  } catch (err) {
    console.warn('[RoomSession] Erro ao salvar sessão:', err);
  }
}

/** Último código de sala (sobrevive a limpeza de sessão). */
export function saveLastRoomCode(code) {
  if (typeof code !== 'string' || !code.trim()) return;
  try {
    localStorage.setItem(LAST_ROOM_CODE_KEY, code.trim().toUpperCase());
  } catch (_) { /* ignore */ }
}

/** @returns {string | null} */
export function getLastRoomCode() {
  try {
    const code = localStorage.getItem(LAST_ROOM_CODE_KEY);
    return code && code.trim().length === 6 ? code.trim().toUpperCase() : null;
  } catch (_) {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (_) { /* ignore */ }
}

/**
 * @returns {boolean}
 */
export function hasSession() {
  return getSession() !== null;
}

export const RoomSession = {
  getSession,
  saveSession,
  clearSession,
  hasSession,
  saveLastRoomCode,
  getLastRoomCode,
};

export default RoomSession;
