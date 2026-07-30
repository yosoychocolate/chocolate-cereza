/**
 * PlayerIdentity — ID permanente (UUID) e nome do jogador local.
 * Único módulo autorizado a persistir identidade do jogador online.
 */
const IDENTITY_KEY = 'ChocolateCerezaPlayerIdentity';

/**
 * @typedef {Object} PlayerIdentityData
 * @property {string} id
 * @property {string} name
 */

function loadRaw() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return { id: '', name: '' };
    const parsed = JSON.parse(raw);
    return {
      id: typeof parsed.id === 'string' ? parsed.id : '',
      name: typeof parsed.name === 'string' ? parsed.name : '',
    };
  } catch (_) {
    return { id: '', name: '' };
  }
}

function save(data) {
  try {
    localStorage.setItem(
      IDENTITY_KEY,
      JSON.stringify({
        id: data.id || '',
        name: data.name || '',
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
  save({ id, name: data.name });
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
  save({ id: getOrCreatePlayerId(), name: typeof name === 'string' ? name.trim() : '' });
}

/**
 * @returns {PlayerIdentityData}
 */
export function getIdentity() {
  return {
    id: getOrCreatePlayerId(),
    name: getPlayerName(),
  };
}

export const PlayerIdentity = {
  getOrCreatePlayerId,
  getPlayerName,
  setPlayerName,
  getIdentity,
};

export default PlayerIdentity;
