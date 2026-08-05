/**
 * CoupleMascots — ursinhos Chocolate & Cereza (kawaii, tema romântico).
 */
import { isPresenceOnline } from './cloud-presence.js?v=__APP_VERSION__';

/** @typedef {'chocolate' | 'cereza'} MascotType */

/** @typedef {'waiting' | 'together' | 'alone' | 'hugging'} MascotSceneMode */

const BEAR_PALETTE = {
  chocolate: {
    fur: '#6B4423',
    light: '#9A6B45',
    muzzle: '#C9A07A',
    cheek: '#E8B896',
    nose: '#4A2818',
  },
  cereza: {
    fur: '#B8436B',
    light: '#E8789A',
    muzzle: '#FFD0DC',
    cheek: '#FFB8CC',
    nose: '#7A2848',
  },
};

/**
 * @param {string} name
 * @param {string} [playerId]
 * @param {{ id: string }[]} [players]
 * @returns {MascotType}
 */
export function resolveMascotType(name, playerId, players) {
  const n = (name || '').toLowerCase();
  if (/cereza|cereja|cherry/.test(n)) return 'cereza';
  if (/chocolate|choco/.test(n)) return 'chocolate';

  if (players && playerId) {
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx === 1) return 'cereza';
  }

  return 'chocolate';
}

/**
 * @param {MascotType} type
 * @param {{ size?: number, crown?: boolean, cherry?: boolean, prop?: boolean, online?: boolean, className?: string, label?: string }} [opts]
 * @returns {string}
 */
export function renderBear(type, opts = {}) {
  const {
    size = 52,
    crown = false,
    cherry = type === 'cereza',
    prop = false,
    online = true,
    className = '',
    label = '',
  } = opts;

  const c = BEAR_PALETTE[type];
  const opacity = online ? 1 : 0.55;
  const extraClass = [
    'bear',
    `bear-${type}`,
    crown ? 'has-crown' : '',
    !online ? 'is-offline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const crownSvg =
    crown ?
      `<g class="bear-crown" transform="translate(18,2)">
        <path d="M4 10 L8 2 L12 8 L16 2 L20 10 L4 10 Z" fill="#FFD56A" stroke="#C9A020" stroke-width="0.8"/>
        <circle cx="8" cy="4" r="1.2" fill="#FF6B9D"/>
        <circle cx="16" cy="4" r="1.2" fill="#FF6B9D"/>
      </g>`
    : '';

  const cherrySvg =
    cherry && type === 'cereza' && !prop ?
      `<g class="bear-cherry" transform="translate(42,8)">
        <circle cx="4" cy="6" r="3.5" fill="#E84393"/>
        <path d="M4 2 Q6 -2 8 1" stroke="#5A9E3A" stroke-width="1.2" fill="none"/>
      </g>`
    : '';

  const propSvg =
    prop ?
      type === 'chocolate' ?
        `<g class="bear-prop" transform="translate(22,54)">
          <rect x="0" y="2" width="20" height="9" rx="2.5" fill="#4A2818"/>
          <rect x="1.5" y="3" width="17" height="6.5" rx="1.5" fill="#6B4423"/>
          <rect x="3" y="4" width="4" height="4" rx="0.5" fill="#9A6B45" opacity="0.6"/>
        </g>`
      : `<g class="bear-prop" transform="translate(24,52)">
          <circle cx="8" cy="7" r="6" fill="#E84393"/>
          <circle cx="6" cy="5" r="1.5" fill="#FF8FB8" opacity="0.5"/>
          <path d="M8 1 Q11 -4 14 0" stroke="#5A9E3A" stroke-width="1.3" fill="none"/>
        </g>`
    : '';

  const aria = label ? ` aria-label="${label}" role="img"` : ' aria-hidden="true"';

  return `<span class="${extraClass}" style="--bear-size:${size}px;opacity:${opacity}"${aria}>
    <svg class="bear-svg" viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" xmlns="http://www.w3.org/2000/svg">
      ${crownSvg}
      ${cherrySvg}
      ${propSvg}
      <ellipse cx="16" cy="14" rx="9" ry="10" fill="${c.fur}"/>
      <ellipse cx="48" cy="14" rx="9" ry="10" fill="${c.fur}"/>
      <ellipse cx="16" cy="14" rx="5" ry="6" fill="${c.light}"/>
      <ellipse cx="48" cy="14" rx="5" ry="6" fill="${c.light}"/>
      <ellipse cx="32" cy="34" rx="22" ry="20" fill="${c.fur}"/>
      <ellipse cx="32" cy="38" rx="14" ry="12" fill="${c.muzzle}"/>
      <ellipse cx="22" cy="36" rx="4" ry="2.5" fill="${c.cheek}" opacity="0.7"/>
      <ellipse cx="42" cy="36" rx="4" ry="2.5" fill="${c.cheek}" opacity="0.7"/>
      <ellipse cx="26" cy="30" rx="3.5" ry="4.5" fill="#2A1520"/>
      <ellipse cx="38" cy="30" rx="3.5" ry="4.5" fill="#2A1520"/>
      <circle cx="27" cy="29" r="1.2" fill="#fff"/>
      <circle cx="39" cy="29" r="1.2" fill="#fff"/>
      <ellipse cx="32" cy="40" rx="3" ry="2" fill="${c.nose}"/>
      <path d="M32 42 Q28 46 32 48 Q36 46 32 42" fill="none" stroke="${c.nose}" stroke-width="1" stroke-linecap="round"/>
      <ellipse cx="32" cy="58" rx="16" ry="14" fill="${c.fur}"/>
      <ellipse cx="32" cy="60" rx="10" ry="8" fill="${c.light}" opacity="0.45"/>
    </svg>
  </span>`;
}

/**
 * @param {MascotSceneMode} mode
 * @param {{ localType: MascotType, partnerType: MascotType, localName: string, partnerName?: string, localOnline?: boolean, partnerOnline?: boolean }} ctx
 * @returns {{ html: string, caption: string, className: string }}
 */
export function buildMascotScene(mode, ctx) {
  const {
    localType,
    partnerType,
    localName,
    partnerName = '',
    localOnline = true,
    partnerOnline = false,
  } = ctx;

  const chocolateType = localType === 'chocolate' ? localType : partnerType;
  const cerezaType = localType === 'cereza' ? localType : partnerType;
  const chocolateName = localType === 'chocolate' ? localName : partnerName || 'Chocolate';
  const cerezaName = localType === 'cereza' ? localName : partnerName || 'Cereza';
  const chocolateOnline = localType === 'chocolate' ? localOnline : partnerOnline;
  const cerezaOnline = localType === 'cereza' ? localOnline : partnerOnline;

  let caption = '';
  let sceneClass = `is-${mode}`;
  let heart = '';
  let brokenHeart = '';

  if (mode === 'waiting') {
    caption = `🧸 ${localName} esperando…`;
    const alone = renderBear(localType, { size: 58, online: localOnline, label: localName });
    return {
      html: `<div class="mascot-stage-inner is-solo">${alone}</div>`,
      caption,
      className: sceneClass,
    };
  }

  if (mode === 'alone') {
    caption = partnerName ? `${partnerName} no está aquí…` : 'Esperando a tu pareja…';
    brokenHeart = '<span class="mascot-heart mascot-heart-broken" aria-hidden="true">💔</span>';
    const alone = renderBear(localType, { size: 54, online: true, label: localName });
    const ghost = renderBear(partnerType, { size: 44, online: false, className: 'is-ghost', label: partnerName });
    return {
      html: `<div class="mascot-stage-inner is-parted">${alone}${brokenHeart}${ghost}</div>`,
      caption,
      className: sceneClass,
    };
  }

  if (mode === 'hugging') {
    caption = `🧸🍒 ¡${partnerName || 'Tu pareja'} entró!`;
    heart = '<span class="mascot-heart mascot-heart-pulse" aria-hidden="true">❤️</span>';
  } else if (mode === 'together') {
    caption = '🧸❤️🧸';
    heart = '<span class="mascot-heart mascot-heart-static" aria-hidden="true">❤️</span>';
  }

  const choco = renderBear('chocolate', {
    size: 54,
    online: chocolateOnline,
    label: chocolateName,
    className: mode === 'hugging' ? 'is-hug-left' : '',
  });
  const cereza = renderBear('cereza', {
    size: 54,
    online: cerezaOnline,
    cherry: true,
    label: cerezaName,
    className: mode === 'hugging' ? 'is-hug-right' : '',
  });

  return {
    html: `<div class="mascot-stage-inner is-duo">${choco}${heart}${cereza}</div>`,
    caption,
    className: sceneClass,
  };
}

/**
 * @param {MascotType} type
 * @param {string} name
 * @param {number} score
 * @param {{ isLeader?: boolean, rank?: number }} [opts]
 * @returns {string}
 */
export function renderRankingRow(type, name, score, opts = {}) {
  const { isLeader = false, rank = 1 } = opts;
  const badge = isLeader ? '👑' : type === 'cereza' ? '🍒' : '🍫';
  const bear = renderBear(type, { size: 36, crown: isLeader, cherry: type === 'cereza' && !isLeader });

  return `<li class="couple-rank-item${isLeader ? ' is-first' : ''}">
    <span class="couple-rank-pos">${rank}.</span>
    <span class="couple-rank-mascot">${bear}<span class="couple-rank-badge">${badge}</span></span>
    <span class="couple-rank-name">${escapeHtml(name)}</span>
    <span class="couple-rank-score">${score} 🍫</span>
  </li>`;
}

/**
 * @param {MascotType} type
 * @param {string} name
 * @param {string} message
 * @param {string} [timeLabel]
 * @param {string} [timeIso]
 * @returns {string}
 */
export function renderChatRow(type, name, message, timeLabel = '', timeIso = '') {
  const bear = renderBear(type, { size: 32, cherry: type === 'cereza' });
  const timeHtml = timeLabel
    ? `<time class="couple-chat-time" datetime="${escapeHtml(timeIso)}">${escapeHtml(timeLabel)}</time>`
    : '';
  return `<div class="couple-chat-msg is-player">
    <span class="couple-chat-mascot">${bear}</span>
    <div class="couple-chat-bubble">
      <div class="couple-chat-meta">
        <span class="couple-chat-author">${escapeHtml(name)}</span>
        ${timeHtml}
      </div>
      <span class="couple-chat-text">${escapeHtml(message)}</span>
    </div>
  </div>`;
}

/**
 * @param {string} message
 * @param {boolean} isMine
 * @param {string} [timeLabel]
 * @param {string} [timeIso]
 * @returns {string}
 */
export function renderPrivateChatRow(message, isMine, timeLabel = '', timeIso = '') {
  const timeHtml = timeLabel
    ? `<time class="couple-chat-time" datetime="${escapeHtml(timeIso)}">${escapeHtml(timeLabel)}</time>`
    : '';
  return `<div class="couple-chat-msg is-private ${isMine ? 'is-mine' : 'is-theirs'}">
    <div class="couple-chat-bubble">
      <div class="couple-chat-meta">${timeHtml}</div>
      <span class="couple-chat-text">${escapeHtml(message)}</span>
    </div>
  </div>`;
}

/**
 * @param {number} streak
 * @returns {string}
 */
export function renderStreakBadge(streak) {
  if (!streak || streak < 2) return '';

  const isMilestone = streak >= 7 && streak % 7 === 0;
  const fire = streak >= 3 ? '🔥 ' : '';
  const milestone = isMilestone ? `<span class="streak-milestone">🧸❤️🧸 Día ${streak}</span>` : '';

  return `<div class="couple-streak-badge${isMilestone ? ' is-milestone' : ''}">
    ${fire}<span class="streak-label">Racha de días juntos</span>
    <strong class="streak-count">${streak}</strong>
    ${milestone}
  </div>`;
}

/**
 * @param {{ players: Array<{ id: string, name: string, presence?: { online?: boolean } }> }, localPlayerId: string }} room
 * @returns {MascotSceneMode}
 */
export function detectSceneMode(room, localPlayerId) {
  const players = room?.players || [];
  if (players.length < 2) return 'waiting';

  const partner = players.find((p) => p.id !== localPlayerId);
  if (!partner) return 'waiting';

  const partnerOnline = isPresenceOnline(partner.presence);
  const local = players.find((p) => p.id === localPlayerId);
  const localOnline = isPresenceOnline(local?.presence);

  if (partnerOnline && localOnline) return 'together';
  return 'alone';
}

/** @type {readonly string[]} */
export const GUARDIAN_ANIM_CLASSES = [
  'guardian-animate-wave',
  'guardian-animate-blink',
  'guardian-animate-record',
  'guardian-animate-crown',
];

/**
 * Par de ursinhos guardiões (estáticos, canto do painel).
 * @param {{ size?: number }} [opts]
 * @returns {string}
 */
export function renderGuardianPair(opts = {}) {
  const size = opts.size ?? 48;
  const choco = renderBear('chocolate', {
    size,
    prop: true,
    cherry: false,
    className: 'guardian-bear guardian-bear-chocolate',
    label: 'Ursinho Chocolate',
  });
  const cereza = renderBear('cereza', {
    size,
    prop: true,
    cherry: false,
    className: 'guardian-bear guardian-bear-cereza',
    label: 'Ursinha Cereza',
  });

  return `<div class="couple-guardians-inner" aria-hidden="true">
    ${choco}
    ${cereza}
  </div>`;
}

/**
 * Rodapé — ursinhos sentados juntos.
 * @returns {string}
 */
export function renderFooterGuardians() {
  const choco = renderBear('chocolate', {
    size: 44,
    prop: true,
    className: 'footer-bear footer-bear-chocolate',
    label: 'Chocolate',
  });
  const cereza = renderBear('cereza', {
    size: 44,
    prop: true,
    className: 'footer-bear footer-bear-cereza',
    label: 'Cereza',
  });

  return `<div class="site-footer-guardians" aria-hidden="true">
    ${choco}<span class="footer-heart">❤️</span>${cereza}
  </div>
  <p class="site-footer-title">El Chocolate &amp; La Cereza</p>`;
}

/**
 * Linha do HUD de placar do casal.
 * @param {MascotType} type
 * @param {number} score
 * @param {boolean} [isLeader]
 * @returns {string}
 */
export function renderScoreHudRow(type, score, isLeader = false) {
  const bear = renderBear(type, {
    size: 24,
    prop: false,
    cherry: false,
    crown: isLeader,
    className: 'hud-bear',
  });
  return `<div class="couple-hud-row couple-hud-${type}${isLeader ? ' is-leader' : ''}">${bear}<span class="couple-hud-score">${score}</span></div>`;
}

/**
 * Dispara animação única num ursinho guardião.
 * @param {HTMLElement | null} root
 * @param {'chocolate' | 'cereza'} which
 * @param {'wave' | 'blink' | 'record' | 'crown'} anim
 */
export function playGuardianAnim(root, which, anim) {
  if (!root) return;
  const bear = root.querySelector(`.guardian-bear-${which}`);
  if (!bear) return;

  const cls = `guardian-animate-${anim}`;
  bear.classList.remove(...GUARDIAN_ANIM_CLASSES);
  void bear.offsetWidth;
  bear.classList.add(cls);

  const cleanup = () => bear.classList.remove(cls);
  bear.addEventListener('animationend', cleanup, { once: true });
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const CoupleMascots = {
  resolveMascotType,
  renderBear,
  buildMascotScene,
  renderRankingRow,
  renderChatRow,
  renderPrivateChatRow,
  renderStreakBadge,
  renderGuardianPair,
  renderFooterGuardians,
  renderScoreHudRow,
  playGuardianAnim,
  detectSceneMode,
};

export default CoupleMascots;
