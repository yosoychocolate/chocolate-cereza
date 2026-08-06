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
 * @property {string} chatLang
 */

function loadRaw() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { id: '', name: '', username: '', photoUrl: '', chatLang: '' };
    const parsed = JSON.parse(raw);
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : '',
      chatLang: typeof parsed.chatLang === 'string' ? parsed.chatLang : '',
    };
  } catch (_) {
    return { id: '', name: '', username: '', photoUrl: '', chatLang: '' };
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
        chatLang: data.chatLang || '',
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
  save({ id, name: data.name, username: data.username, photoUrl: data.photoUrl, chatLang: data.chatLang });
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
    chatLang: data.chatLang,
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
    chatLang: data.chatLang,
  });
}

/**
 * @returns {string}
 */
export function getChatLang() {
  return loadRaw().chatLang;
}

/**
 * @param {string} chatLang
 */
export function setChatLang(chatLang) {
  const data = loadRaw();
  const lang = typeof chatLang === 'string' ? chatLang.trim().toLowerCase() : '';
  save({
    id: getOrCreatePlayerId(),
    name: data.name,
    username: data.username,
    photoUrl: data.photoUrl,
    chatLang: lang,
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
    chatLang: data.chatLang,
  });
}

export function getIdentity() {
  return {
    id: getOrCreatePlayerId(),
    name: getPlayerName(),
    username: getUsername(),
    photoUrl: getPhotoUrl(),
    chatLang: getChatLang(),
  };
}

/**
 * Apaga o perfil local e gera um novo ID (novo @usuario depois).
 * @returns {string} novo playerId
 */
export function resetIdentity() {
  const id = crypto.randomUUID();
  save({ id, name: '', username: '', photoUrl: '', chatLang: '' });
  try {
    localStorage.removeItem('ChocolateCerezaPlayerId');
    localStorage.removeItem('ChocolateCerezaPlayerName');
  } catch (_) { /* ignore */ }
  return id;
}

export const PlayerIdentity = {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
  getUsername,
  setUsername,
  getPhotoUrl,
  setPhotoUrl,
  getChatLang,
  setChatLang,
  getPreferredDisplayName,
  getIdentity,
  resetIdentity,
};

export default PlayerIdentity;
