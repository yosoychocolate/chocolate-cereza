/**
 * Rotas portal ↔ jugar (mesmo domínio).
 */

/**
 * @returns {boolean}
 */
export function isJugarPage() {
  return /\/jugar(?:\/|$)/i.test(window.location.pathname)
    || window.__JUGAR_PAGE__ === true;
}

/**
 * @param {string} [roomCode]
 * @returns {string}
 */
export function getJugarUrl(roomCode = '') {
  const code = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : '';
  const qs = code.length === 6 ? `?sala=${encodeURIComponent(code)}` : '';

  if (isJugarPage()) {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set('sala', code);
    else url.searchParams.delete('sala');
    return `${url.pathname}${url.search}`;
  }

  return `jugar/${qs}`;
}

/**
 * Abre a página do jogo — ou entra na sala se já estiver em /jugar/.
 * @param {string} [roomCode]
 */
export function goToJugarRoom(roomCode = '') {
  const code = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : '';

  if (isJugarPage()) {
    if (code.length === 6) {
      window.dispatchEvent(new CustomEvent('social:join-room', { detail: { roomCode: code } }));
    }
    return;
  }

  window.location.href = getJugarUrl(code);
}

export default { isJugarPage, getJugarUrl, goToJugarRoom };
