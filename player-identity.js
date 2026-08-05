/**
 * PlayerIdentity — ID permanente (UUID) e nome do jogador local.
 * Único módulo autorizado a persistir identidade do jogador online.
 */
const IDENTITY_KEY = 'ChocolateCerezaPlayerIdentity';

/**
 * @typedef {Object} PlayerIdentityData
 * @property {string} id
 * @property {string} name
 * @property {string} username
 * @property {string} photoUrl
 */

function loadRaw() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { id: '', name: '', username: '', photoUrl: '' };
    const parsed = JSON.parse(raw);
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : '',
    };
  } catch (_) {
    return { id: '', name: '', username: '', photoUrl: '' };
  }
}

function save(data) {
  try {
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        id: data.id || '',
        name: data.name || '',
        username: data.username || '',
        photoUrl: data.photoUrl || '',
      })
    );
  } catch (err) {
    console.warn('[PlayerIdentity] Erro ao salvar:', err);
  }
}

/**
 * @returns {string}
 */
export function getOrCreatePlayerId() {
  const data = loadRaw();
  if (data.id) return data.id;
  const id = crypto.randomUUID();
  save({ id, name: data.name, username: data.username, photoUrl: data.photoUrl });
  return id;
}

/**
 * @returns {string}
 */
export function getPlayerName() {
  return loadRaw().name;
}

/**
 * @param {string} name
 */
export function setPlayerName(name) {
  const data = loadRaw();
  save({
    id: getOrCreatePlayerId(),
    name: typeof name === 'string' ? name.trim() : '',
    username: data.username,
    photoUrl: data.photoUrl,
  });
}

/**
 * @returns {string}
 */
export function getUsername() {
  return loadRaw().username;
}

/**
 * Nome exibido no jogo — @usuario tem prioridade.
 * @returns {string}
 */
export function getPreferredDisplayName() {
  const data = loadRaw();
  if (data.username) return `@${data.username}`;
  if (data.name.trim()) return data.name.trim();
  return 'Jugador';
}

/**
 * @param {string} username
 */
export function setUsername(username) {
  const data = loadRaw();
  const uname = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const name = uname ? `@${uname}` : data.name;
  save({
    id: getOrCreatePlayerId(),
    name,
    username: uname,
    photoUrl: data.photoUrl,
  });
}

/**
 * @returns {string}
 */
export function getPhotoUrl() {
  return loadRaw().photoUrl;
}

/**
 * @param {string} photoUrl
 */
export function setPhotoUrl(photoUrl) {
  const data = loadRaw();
  save({
    id: getOrCreatePlayerId(),
    name: data.name,
    username: data.username,
    photoUrl: typeof photoUrl === 'string' ? photoUrl.trim() : '',
  });
}

export function getIdentity() {
  return {
    id: getOrCreatePlayerId(),
    name: getPlayerName(),
    username: getUsername(),
    photoUrl: getPhotoUrl(),
  };
}

export const PlayerIdentity = {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
  getUsername,
  setUsername,
  getPhotoUrl,
  setPhotoUrl,
  getPreferredDisplayName,
  getIdentity,
};

export default PlayerIdentity;
