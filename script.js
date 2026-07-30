/* ===== Storage ===== */
const STORAGE = {
  loveClicks: 'chocolateCereza_loveClicks',
  meterClicks: 'chocolateCereza_meterClicks',
  gameScore: 'chocolateCereza_gameScore',
  secretUnlocked: 'chocolateCereza_secretUnlocked',
  gameMilestones: 'chocolateCereza_gameMilestones',
  gameLives: 'chocolateCereza_gameLives',
};

function load(key, fallback = 0) {
  const v = localStorage.getItem(key);
  return v !== null ? JSON.parse(v) : fallback;
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadGame(key, fallback = 0) {
  const v = sessionStorage.getItem(key);
  return v !== null ? JSON.parse(v) : fallback;
}

function saveGame(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function clearSessionStorage() {
  sessionStorage.removeItem(STORAGE.gameScore);
  sessionStorage.removeItem(STORAGE.gameMilestones);
  sessionStorage.removeItem(STORAGE.gameLives);
  sessionStorage.removeItem(STORAGE.meterClicks);
  sessionStorage.removeItem(STORAGE.secretUnlocked);
  localStorage.removeItem(STORAGE.gameScore);
  localStorage.removeItem(STORAGE.gameMilestones);
  localStorage.removeItem(STORAGE.gameLives);
  localStorage.removeItem(STORAGE.meterClicks);
  localStorage.removeItem(STORAGE.secretUnlocked);
}

/* ===== Petal & Heart Rain ===== */
function isMobileView() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function createRain() {
  const container = document.getElementById('petal-rain');
  const hearts = ['❤️', '💕', '💗', '🩷'];
  const count = isMobileView() ? 24 : 40;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const isHeart = Math.random() > 0.5;
    el.className = isHeart ? 'rain-heart' : 'petal';
    if (isHeart) el.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    el.style.left = Math.random() * 100 + '%';
    el.style.animationDuration = (6 + Math.random() * 8) + 's';
    el.style.animationDelay = Math.random() * 10 + 's';
    if (!isHeart) {
      el.style.background = Math.random() > 0.5 ? '#FF58A8' : '#E91E63';
    }
    container.appendChild(el);
  }
}

function createAmbientBg() {
  const container = document.getElementById('ambient-bg');
  if (!container) return;

  const mobile = isMobileView();
  const starCount = mobile ? 27 : 45;
  const particleCount = mobile ? 12 : 20;
  const heartCount = mobile ? 7 : 12;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'ambient-star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--dur', (3 + Math.random() * 5) + 's');
    star.style.animationDelay = Math.random() * 6 + 's';
    container.appendChild(star);
  }

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'ambient-particle';
    const side = Math.random() > 0.5;
    particle.style.left = side ? (Math.random() * 18) + '%' : (82 + Math.random() * 18) + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.setProperty('--dur', (10 + Math.random() * 14) + 's');
    particle.style.animationDelay = Math.random() * 8 + 's';
    container.appendChild(particle);
  }

  const faintHearts = ['❤', '💜', '💗'];
  for (let i = 0; i < heartCount; i++) {
    const heart = document.createElement('div');
    heart.className = 'ambient-heart';
    heart.textContent = faintHearts[i % faintHearts.length];
    const side = i % 2 === 0;
    heart.style.left = side ? (2 + Math.random() * 12) + '%' : (86 + Math.random() * 10) + '%';
    heart.style.top = (10 + Math.random() * 80) + '%';
    heart.style.setProperty('--dur', (16 + Math.random() * 12) + 's');
    heart.style.animationDelay = Math.random() * 10 + 's';
    container.appendChild(heart);
  }
}

function spawnButtonHearts(btn) {
  const rect = btn.getBoundingClientRect();
  const icons = ['❤️', '💕', '💗', '🩷'];
  for (let i = 0; i < 4; i++) {
    const h = document.createElement('span');
    h.className = 'btn-heart-burst';
    h.textContent = icons[i % icons.length];
    h.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 50) + 'px';
    h.style.top = (rect.top + rect.height / 2) + 'px';
    document.body.appendChild(h);
    setTimeout(() => h.remove(), 900);
  }
}

/* ===== Intro & Meeting ===== */
function initIntro() {
  const btnEnter = document.getElementById('btn-enter');
  const intro = document.getElementById('intro');
  const meeting = document.getElementById('meeting');
  const main = document.getElementById('main-content');

  btnEnter.addEventListener('click', () => {
    intro.classList.remove('active');
    meeting.classList.add('active');
    playMeetingAnimation(() => {
      meeting.classList.remove('active');
      main.classList.remove('hidden');
      initMainSections();
    });
  });
}

function playMeetingAnimation(onComplete) {
  const scene = document.querySelector('.meeting-scene');
  const heart = document.getElementById('meeting-heart');
  const message = document.getElementById('meeting-message');
  const particles = document.getElementById('meeting-particles');

  scene.classList.add('walking');

  setTimeout(() => {
    scene.classList.remove('walking');
    scene.classList.add('met');
    spawnParticles(particles, 50, 50);
    heart.classList.remove('hidden');
    message.classList.remove('hidden');
  }, 3000);

  setTimeout(onComplete, 5500);
}

function spawnParticles(container, cx, cy) {
  const colors = ['#FF4FA3', '#6C3BFF', '#D81B60', '#FFD700', '#FF4FA3'];
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 * i) / 30;
    const dist = 80 + Math.random() * 120;
    p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
    p.style.background = colors[i % colors.length];
    p.style.left = cx + '%';
    p.style.top = cy + '%';
    container.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

/* ===== Love Clicks ===== */
sessionStorage.removeItem(STORAGE.meterClicks);
sessionStorage.removeItem(STORAGE.secretUnlocked);
localStorage.removeItem(STORAGE.meterClicks);
localStorage.removeItem(STORAGE.secretUnlocked);

const LAUNCH_RESET_LOVE_CLICKS = 'chocolateCereza_loveClicks_launchReset_v3';
if (!localStorage.getItem(LAUNCH_RESET_LOVE_CLICKS)) {
  save(STORAGE.loveClicks, 0);
  localStorage.setItem(LAUNCH_RESET_LOVE_CLICKS, 'done');
}

let loveClicks = load(STORAGE.loveClicks, 0);
let meterHeartClicks = 0;
let secretUnlocked = false;

function initLoveClicks() {
  const btn = document.getElementById('love-click-btn');
  const countEl = document.getElementById('love-count');
  countEl.textContent = loveClicks;

  btn.addEventListener('click', (e) => {
    loveClicks++;
    save(STORAGE.loveClicks, loveClicks);
    countEl.textContent = loveClicks;
    countEl.style.transform = 'scale(1.15)';
    setTimeout(() => { countEl.style.transform = 'scale(1)'; }, 150);

    const burst = document.createElement('div');
    burst.className = 'click-burst';
    burst.textContent = '❤️';
    burst.style.left = e.clientX + 'px';
    burst.style.top = e.clientY + 'px';
    document.body.appendChild(burst);
    setTimeout(() => burst.remove(), 1000);
  });
}

/* ===== Surprise Messages ===== */
const surprisePhrases = [
  'El chocolate nunca imaginó encontrar una cereza tan perfecta.',
  'Mi lugar favorito sigue siendo cualquier conversación contigo.',
  'Eres el ritmo favorito de mi corazón.',
  'Contigo, cada día sabe a chocolate con cereza.',
  'Tu sonrisa es la cereza de mi universo.',
  'No necesito mapas cuando sé que mi camino es hacia ti.',
  'Eres la dulzura que mi alma buscaba sin saberlo.',
  'Cada mensaje tuyo es un pequeño regalo que guardo.',
  'Mi corazón late al ritmo de tu nombre.',
  'Si el amor tuviera sabor, sería chocolate y cereza.',
];

function initSurprise() {
  const btn = document.getElementById('btn-surprise');
  const msg = document.getElementById('surprise-message');
  let lastIndex = -1;

  btn.addEventListener('mouseenter', () => spawnButtonHearts(btn));

  btn.addEventListener('click', () => {
    let idx;
    do {
      idx = Math.floor(Math.random() * surprisePhrases.length);
    } while (idx === lastIndex && surprisePhrases.length > 1);
    lastIndex = idx;

    msg.classList.remove('show');
    void msg.offsetWidth;
    msg.textContent = `"${surprisePhrases[idx]}"`;
    msg.classList.add('show');
  });
}

/* ===== Poem Generator ===== */
const POEM_BANK_SIZE = 100;
const POEM_QUEUE_KEY = 'chocolateCereza_poemQueue';

const poemSeeds = [
  ['El chocolate caminaba despacio,', 'buscando calor en un mundo frío,', 'hasta que una cereza le sonrió', 'y le enseñó el camino a lo mío.'],
  ['No fue un rayo ni fue fortuna:', 'fue un "hola" que quedó en el aire,', 'una charla que se hizo cuna', 'de un amor dulce y verdadero.'],
  ['Tu risa tiene sabor a abril,', 'tu voz despierta luz en mi piel,', 'y en cada mensaje descubro mil', 'razones para elegirte otra vez.'],
  ['Si el tiempo fuera chocolate,', 'yo lo derretiría despacio,', 'solo para escribir en tu arte', 'que eres mi lugar más hermoso.'],
  ['Hay quien busca estrellas lejanas;', 'yo encontré una cerca de mí:', 'una cereza entre las mañanas,', 'mi dulce compañía aquí.'],
  ['Entre píxeles y silencios,', 'creció algo que no tiene prisa:', 'un cariño hecho de momentos,', 'una historia que aún se escribe.'],
  ['No sé medir lo que siento,', 'pero sé que es sincero:', 'como chocolate lento,', 'dulce, profundo y entero.'],
  ['Antes de ti, el día era simple;', 'ahora tiene otra canción.', 'Eres mi pausa más noble,', 'mi favorita razón.'],
  ['Si algún día dudas de ti,', 'recuerda esto sin temor:', 'para este corazón,', 'eres su mejor sabor.'],
  ['Calla la noche, brilla tu nombre,', 'se enciende lento mi piel,', 'y aunque el mundo sea grande,', 'mi ruta termina en ti, cereza fiel.'],
];

const poemVerse = {
  l1: [
    'En la calma de la tarde,',
    'Cuando el cielo se vuelve lento,',
    'Sin mapas y sin prisa,',
    'Entre luces de pantalla,',
    'En un mundo de rutina,',
    'Cuando el silencio me abraza,',
    'Desde aquel primer mensaje,',
    'Si el amor fuera camino,',
  ],
  l2: [
    'pienso en ti sin avisar,',
    'mi corazón vuelve a ti,',
    'busco tu voz en el aire,',
    'guardo tu risa en mi paz,',
    'encuentro dulzura en ti,',
    'sé que estás cerca de mí,',
    'nació algo verdadero,',
    'yo te elegiría otra vez,',
  ],
  l3: [
    'Eres cereza en mi jardín,',
    'Chocolate de mi amanecer,',
    'Mi refugio y mi canción,',
    'La calma después del vaivén,',
    'Mi estrella en la cotidianidad,',
    'La dulzura que quiero ver,',
    'Mi lugar favorito de ser,',
    'La razón de sonreír sin fin,',
  ],
  l4: [
    'y hoy te elijo sin dudar.',
    'porque contigo quiero estar.',
    'y en ti quiero permanecer.',
    'mi amor sigue florecer.',
    'nuestro cuento va a crecer.',
    'te llevo dentro al caminar.',
    'no hay distancia que apagar.',
    'chocolate y cereza, sin final.',
  ],
};

const poemSigns = [
  '— El Chocolate 🍫',
  '— Para mi cereza 🍒',
  '— Con amor, siempre ❤️',
  '— De tu chocolate 🍫🍒',
];

let poemBank = null;
let poemQueue = [];

function buildPoemBank() {
  const bank = [];
  const seen = new Set();

  poemSeeds.forEach((poem) => {
    const key = poem.join('|');
    if (!seen.has(key)) {
      seen.add(key);
      bank.push(poem);
    }
  });

  let attempts = 0;
  while (bank.length < POEM_BANK_SIZE && attempts < 8000) {
    attempts++;
    const poem = [
      poemVerse.l1[Math.floor(Math.random() * poemVerse.l1.length)],
      poemVerse.l2[Math.floor(Math.random() * poemVerse.l2.length)],
      poemVerse.l3[Math.floor(Math.random() * poemVerse.l3.length)],
      poemVerse.l4[Math.floor(Math.random() * poemVerse.l4.length)],
    ];
    const key = poem.join('|');
    if (!seen.has(key)) {
      seen.add(key);
      bank.push(poem);
    }
  }

  return bank;
}

function getPoemBank() {
  if (!poemBank) poemBank = buildPoemBank();
  return poemBank;
}

function shufflePoemQueue() {
  const bank = getPoemBank();
  poemQueue = bank.map((_, i) => i);
  for (let i = poemQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poemQueue[i], poemQueue[j]] = [poemQueue[j], poemQueue[i]];
  }
  sessionStorage.setItem(POEM_QUEUE_KEY, JSON.stringify(poemQueue));
}

function loadPoemQueue() {
  const saved = sessionStorage.getItem(POEM_QUEUE_KEY);
  if (saved) {
    try {
      poemQueue = JSON.parse(saved);
      if (!Array.isArray(poemQueue)) poemQueue = [];
    } catch (_) {
      poemQueue = [];
    }
  }
  if (poemQueue.length === 0) shufflePoemQueue();
}

function nextPoemFromDeck() {
  if (poemQueue.length === 0) shufflePoemQueue();
  const bankIndex = poemQueue.pop();
  sessionStorage.setItem(POEM_QUEUE_KEY, JSON.stringify(poemQueue));
  return getPoemBank()[bankIndex].slice();
}

function updatePoemCounter() {
  const counter = document.getElementById('poem-counter');
  if (!counter) return;
  const remaining = poemQueue.length;
  if (remaining === 0) {
    counter.textContent = 'Nueva ronda de 100 poemas lista ✨';
    return;
  }
  counter.textContent = `${remaining} poemas restantes en esta ronda`;
}

function renderPoem(output, lines, sign) {
  output.classList.remove('show', 'typing');
  output.innerHTML = '';

  lines.forEach((line, i) => {
    const span = document.createElement('span');
    span.className = 'poem-line';
    span.textContent = line;
    span.style.animationDelay = `${i * 0.18}s`;
    output.appendChild(span);
    output.appendChild(document.createTextNode('\n'));
  });

  const signEl = document.createElement('span');
  signEl.className = 'poem-sign';
  signEl.textContent = sign;
  output.appendChild(signEl);

  void output.offsetWidth;
  output.classList.add('show', 'typing');
}

function initPoem() {
  const btn = document.getElementById('btn-poem');
  const output = document.getElementById('poem-output');
  if (!btn || !output) return;

  loadPoemQueue();
  updatePoemCounter();

  btn.addEventListener('mouseenter', () => spawnButtonHearts(btn));

  btn.addEventListener('click', () => {
    const lines = nextPoemFromDeck();
    const sign = poemSigns[Math.floor(Math.random() * poemSigns.length)];
    renderPoem(output, lines, sign);
    updatePoemCounter();
  });
}

/* ===== Love Meter ===== */
let meterPercent = 0;

function initMeter() {
  meterHeartClicks = 0;
  secretUnlocked = false;
  updateMeterDisplay();

  const heart = document.getElementById('meter-heart');
  let holding = false;
  let holdRaf = 0;
  let lastTick = 0;
  const FILL_PER_SEC = 28;

  function tick(now) {
    if (!holding) return;
    if (!lastTick) lastTick = now;
    const dt = Math.min((now - lastTick) / 1000, 0.05);
    lastTick = now;

    meterHeartClicks = Math.min(meterHeartClicks + FILL_PER_SEC * dt, 130);
    updateMeterDisplay();

    if (meterHeartClicks >= 100 && !secretUnlocked) {
      triggerSecretAnimation();
    }

    holdRaf = requestAnimationFrame(tick);
  }

  function startHold(e) {
    if (e.type === 'touchstart') e.preventDefault();
    if (holding) return;
    holding = true;
    lastTick = 0;
    heart.classList.add('holding');
    holdRaf = requestAnimationFrame(tick);
  }

  function stopHold() {
    if (!holding) return;
    holding = false;
    lastTick = 0;
    heart.classList.remove('holding');
    cancelAnimationFrame(holdRaf);
  }

  heart.addEventListener('mousedown', startHold);
  heart.addEventListener('touchstart', startHold, { passive: false });
  window.addEventListener('mouseup', stopHold);
  window.addEventListener('touchend', stopHold);
  window.addEventListener('touchcancel', stopHold);
  heart.addEventListener('mouseleave', stopHold);
}

function updateMeterDisplay() {
  const fill = document.getElementById('meter-fill');
  const percentEl = document.getElementById('meter-percent');
  const valueEl = document.getElementById('meter-value');
  const errorEl = document.getElementById('meter-error');

  if (meterHeartClicks <= 100) {
    meterPercent = meterHeartClicks;
    fill.style.width = meterPercent + '%';
    percentEl.textContent = Math.floor(meterPercent) + '%';
    valueEl.textContent = Math.floor(meterPercent);
    valueEl.classList.remove('infinity');
    errorEl.classList.add('hidden');
  } else {
    fill.style.width = '100%';
    percentEl.textContent = '100%+';
    valueEl.textContent = '∞';
    valueEl.classList.add('infinity');
    errorEl.classList.remove('hidden');
  }
}

/* ===== Secret Animation ===== */
function triggerSecretAnimation() {
  if (secretUnlocked) return;
  secretUnlocked = true;

  const overlay = document.getElementById('secret-overlay');
  const scene = document.querySelector('.secret-scene');
  const msg = document.getElementById('secret-message');
  const closeBtn = document.getElementById('secret-close');
  const rain = document.getElementById('secret-rain');

  overlay.classList.remove('hidden');

  setTimeout(() => scene.classList.add('walking'), 300);

  setTimeout(() => {
    scene.classList.remove('walking');
    scene.classList.add('hug');
    startSecretRain(rain);
    msg.classList.remove('hidden');
    closeBtn.classList.remove('hidden');
  }, 2800);

  closeBtn.onclick = () => {
    overlay.classList.add('hidden');
    scene.classList.remove('walking', 'hug');
    msg.classList.add('hidden');
    closeBtn.classList.add('hidden');
    rain.innerHTML = '';
  };
}

function startSecretRain(container) {
  for (let i = 0; i < 25; i++) {
    const h = document.createElement('div');
    h.className = 'rain-heart';
    h.textContent = ['❤️', '💕', '💗'][Math.floor(Math.random() * 3)];
    h.style.left = Math.random() * 100 + '%';
    h.style.animationDuration = (3 + Math.random() * 4) + 's';
    h.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(h);
  }
}

/* ===== Mini Game ===== */
const SPRITE_PATHS = {
  cherry: 'assets/cherry.png',
  chocolate: 'assets/chocolate.png',
};

function loadRawImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log('[MiniGame] carregado:', img.src, `${img.naturalWidth}x${img.naturalHeight}`);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Falha ao carregar: ${src}`));
    img.src = src;
  });
}

function spriteDimensions(sprite) {
  return {
    w: sprite.naturalWidth || sprite.width,
    h: sprite.naturalHeight || sprite.height,
  };
}

function isBackgroundPixel(r, g, b) {
  const isWhite = r > 235 && g > 235 && b > 235;
  const isBlack = r < 40 && g < 40 && b < 40;
  const isChecker = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 170 && r < 250;
  return isWhite || isBlack || isChecker;
}

function prepareSprite(img, label) {
  const { w, h } = spriteDimensions(img);
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(img, 0, 0);

  try {
    const corner = pctx.getImageData(0, 0, 1, 1).data;
    if (corner[3] < 15) {
      console.log(`[MiniGame] ${label}: PNG com transparência real (${w}x${h}) — ${img.src}`);
      return img;
    }

    const data = pctx.getImageData(0, 0, w, h);
    const px = data.data;
    const visited = new Uint8Array(w * h);
    const stack = [];

    for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
    for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }

    while (stack.length) {
      const y = stack.pop();
      const x = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const pi = y * w + x;
      if (visited[pi]) continue;
      const idx = pi * 4;
      if (!isBackgroundPixel(px[idx], px[idx + 1], px[idx + 2])) continue;
      visited[pi] = 1;
      px[idx + 3] = 0;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }

    pctx.putImageData(data, 0, 0);
    console.log(`[MiniGame] ${label}: fundo removido em canvas (${w}x${h})`);
    return probe;
  } catch (err) {
    console.warn(`[MiniGame] ${label}: usando PNG direto.`, err);
    return img;
  }
}

function loadSprite(key) {
  const src = SPRITE_PATHS[key];
  return loadRawImage(src).then((img) => prepareSprite(img, key));
}

function initGame() {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('#game-score .game-score-num');
  const scoreBox = document.getElementById('game-score');
  const milestoneEl = document.getElementById('game-milestone');
  const milestoneText = document.getElementById('game-milestone-text');
  const milestoneSub = document.getElementById('game-milestone-sub');
  const continueBtn = document.getElementById('game-continue');
  const pauseBtn = document.getElementById('game-pause');
  const pauseScreen = document.getElementById('game-pause-screen');
  const resumeBtn = document.getElementById('game-resume');
  const progressFill = document.getElementById('game-progress-fill');
  const progressMarkers = document.getElementById('game-progress-markers');
  const gameCursor = document.getElementById('game-cursor');
  const gameContainer = canvas.parentElement;
  const pauseIcon = pauseBtn?.querySelector('.game-pause-icon');
  const pauseLabel = pauseBtn?.querySelector('.game-pause-label');
  const livesEl = document.getElementById('game-lives');
  const livesHeartsEl = document.getElementById('game-lives-hearts');
  const gameOverScreen = document.getElementById('game-over-screen');
  const gameOverRestartBtn = document.getElementById('game-over-restart');
  const touchFx = document.getElementById('game-touch-fx');
  const endlessBadge = document.getElementById('game-endless-badge');
  const endlessReward = document.getElementById('game-endless-reward');
  const endlessEnterBtn = document.getElementById('game-endless-enter');
  const progressInfinity = document.getElementById('game-progress-infinity');
  const toastDismissBtn = document.getElementById('game-toast-dismiss');
  const toastTimerEl = document.getElementById('game-toast-timer');
  let lastTouchHeartAt = 0;
  let lastEndlessToastScore = 0;
  let endlessRewardTimer = null;
  let messagePause = false;
  let endlessIntroPause = false;
  let toastCountdownTimer = null;
  let toastCountdownInterval = null;
  const TOAST_READ_SECONDS = 8;

  ctx.imageSmoothingEnabled = true;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let SPRITE_H = 85;

  const perfLite = isMobileView();
  ctx.imageSmoothingQuality = 'medium';

  const PERF = {
    maxChocolates: perfLite ? 5 : 7,
    maxParticles: perfLite ? 8 : 12,
    maxEffects: perfLite ? 3 : 5,
    maxHeartRain: perfLite ? 4 : 6,
    catchDots: perfLite ? 3 : 4,
    dprCap: perfLite ? 1 : 1.25,
    bgStars: perfLite ? 12 : 18,
    bgGlows: 2,
    shadows: false,
    cherryGlow: !perfLite,
  };
  let spawnGraceUntil = 0;
  let bgCache = null;
  let bgCacheCtx = null;
  let frameStress = 0;
  let turboLite = perfLite;
  let gameReady = false;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  function trimPool(arr, max) {
    if (arr.length > max) arr.splice(0, arr.length - max);
  }

  function scaleGameState(sx, sy) {
    if (!gameReady || !cherry) return;
    cherry.x *= sx;
    mouseX *= sx;
    cherry.y = H - H * (58 / 400);
    cherry.speed = W * (6.5 / 360);
    chocolates.forEach((c) => {
      c.x *= sx;
      c.y *= sy;
      c.size *= sy;
    });
    particles.forEach((p) => {
      p.x *= sx;
      p.y *= sy;
    });
    effects.forEach((e) => {
      e.x *= sx;
      e.y *= sy;
    });
    heartRain.forEach((h) => {
      h.x *= sx;
      h.y *= sy;
    });
    bgStars.forEach((s) => {
      s.x *= sx;
      s.y *= sy;
    });
    bgGlows.forEach((g) => {
      g.x *= sx;
      g.y *= sy;
      g.r *= Math.min(sx, sy);
    });
  }

  function startGameLoop() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    lastSpawn = lastTime;
    animId = requestAnimationFrame(render);
  }

  function forceRestartGameLoop() {
    cancelAnimationFrame(animId);
    running = true;
    lastTime = performance.now();
    lastSpawn = lastTime;
    animId = requestAnimationFrame(render);
  }

  function clearAllGameplayBlockers() {
    milestonePause = false;
    gamePaused = false;
    gameOver = false;
    messagePause = false;
    endlessIntroPause = false;
    heartRainActive = false;
    camZoom = 1;
    camZoomTarget = 1;
    clearCinematicUiTimer();
    if (endlessRewardTimer) {
      clearTimeout(endlessRewardTimer);
      endlessRewardTimer = null;
    }
    clearToastTimers();
    hideGameOver();
    hideEndlessIntro();
    continueBtn?.classList.add('hidden');
    milestoneEl?.classList.add('hidden');
    milestoneEl?.classList.remove('cinematic', 'readable');
    milestoneSub?.classList.add('hidden');
    toastDismissBtn?.classList.add('hidden');
    toastTimerEl?.classList.add('hidden');
    pauseScreen?.classList.add('hidden');
    pauseScreen?.setAttribute('aria-hidden', 'true');
    pauseBtn?.classList.remove('is-paused');
    if (pauseIcon) pauseIcon.textContent = '⏸';
    if (pauseLabel) pauseLabel.textContent = 'Pausar';
    pauseBtn?.setAttribute('aria-label', 'Pausar juego');
    updatePauseButtonState();
  }

  function resizeCanvas() {
    const container = canvas.parentElement;
    if (!container) return;

    const newW = Math.max(280, Math.min(container.clientWidth, 900));
    const newH = Math.round(newW * (400 / 360));

    if (W > 0 && (newW !== W || newH !== H)) {
      scaleGameState(newW / W, newH / H);
    }

    W = newW;
    H = newH;
    SPRITE_H = H * (85 / 400);
    dpr = Math.min(window.devicePixelRatio || 1, PERF.dprCap);

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    if (gameReady) rebuildBgCache();
  }

  function rebuildBgCache() {
    if (!W || !H || !gameReady) return;
    if (!bgCache) {
      bgCache = document.createElement('canvas');
      bgCacheCtx = bgCache.getContext('2d');
    }
    bgCache.width = Math.round(W * dpr);
    bgCache.height = Math.round(H * dpr);
    bgCacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCacheCtx.imageSmoothingEnabled = true;
    bgCacheCtx.fillStyle = 'rgba(15, 10, 10, 0.35)';
    bgCacheCtx.fillRect(0, 0, W, H);
    for (let i = 0; i < PERF.bgGlows; i++) {
      const g = bgGlows[i];
      if (!g) continue;
      const grad = bgCacheCtx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, 'rgba(108, 59, 255, 0.05)');
      grad.addColorStop(1, 'rgba(108, 59, 255, 0)');
      bgCacheCtx.fillStyle = grad;
      bgCacheCtx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      if (gameReady) rebuildBgCache();
    }, 120);
  });
  const MILESTONE_INTERVAL = 10;
  const FINAL_MILESTONE = 50;
  const MAX_LIVES = 5;
  const ENDLESS_INTERVAL = 25;
  const ENDLESS_MESSAGES = [
    '"El amor no tiene límite."',
    '"Cada chocolate extra es un te quiero más."',
    '"Contigo, hasta el infinito sabe dulce."',
    '"Mi corazón no deja de contar contigo."',
    '"Eres mi recompensa favorita."',
    '"Más chocolates, más razones para amarte."',
    '"En modo infinito, siempre elijo quedarme."',
    '"Tu amor vale más que todos los puntos."',
  ];
  const TOAST_MESSAGES = [
    '"Cada clic me acerca más a ti."',
    '"Un chocolate más, un pensamiento en ti."',
    '"El chocolate ya no sabe vivir sin su cereza."',
    '"Tu sonrisa vale más que todos los chocolates."',
    '"Mi corazón late al ritmo del tuyo."',
    '"Contigo todo sabe mejor."',
    '"Eres mi cereza favorita."',
    '"Cada momento contigo es dulce."',
  ];

  localStorage.removeItem(STORAGE.gameScore);
  localStorage.removeItem(STORAGE.gameMilestones);
  localStorage.removeItem(STORAGE.gameLives);

  let score = loadGame(STORAGE.gameScore, 0);
  scoreEl.textContent = score;

  let lives = loadGame(STORAGE.gameLives, MAX_LIVES);
  lives = Math.max(0, Math.min(MAX_LIVES, lives));

  const milestones = loadGame(STORAGE.gameMilestones, { 50: false });
  let lastToastScore = 0;
  let toastTimer = null;

  function buildProgressMarkers() {
    if (!progressMarkers) return;
    progressMarkers.innerHTML = '';
    for (let value = MILESTONE_INTERVAL; value <= FINAL_MILESTONE; value += MILESTONE_INTERVAL) {
      const pct = (value / FINAL_MILESTONE) * 100;
      const marker = document.createElement('div');
      marker.className = 'game-progress-marker' + (value === FINAL_MILESTONE ? ' final' : '');
      marker.style.left = `${pct}%`;
      marker.dataset.value = String(value);
      marker.title = value === FINAL_MILESTONE
        ? 'Gran final — mensaje especial'
        : `Mensaje especial en ${value} chocolates`;
      const icon = value === FINAL_MILESTONE ? '🍒' : '⭐';
      marker.innerHTML = `<span class="marker-num">${value}</span><span class="marker-star" aria-hidden="true">${icon}</span>`;
      progressMarkers.appendChild(marker);
    }
  }

  function isGameplayBlocked() {
    return milestonePause || gamePaused || gameOver || messagePause || endlessIntroPause;
  }

  function updateProgressBar() {
    const endless = milestones[FINAL_MILESTONE];
    if (progressFill) {
      if (endless) {
        progressFill.style.width = '100%';
        progressFill.classList.add('endless');
      } else {
        progressFill.style.width = `${Math.min(100, (score / FINAL_MILESTONE) * 100)}%`;
        progressFill.classList.remove('endless');
      }
    }
    progressInfinity?.classList.toggle('hidden', !endless);
    progressMarkers?.querySelectorAll('.game-progress-marker').forEach((marker) => {
      const value = Number(marker.dataset.value);
      marker.classList.toggle('reached', score >= value);
      marker.classList.toggle('next', !endless && score < value && score >= value - MILESTONE_INTERVAL);
    });
  }

  function applyEndlessModeUI() {
    scoreBox?.classList.add('endless-mode');
    gameContainer?.classList.add('endless-mode');
    document.querySelector('.game-progress')?.classList.add('endless-mode');
    endlessBadge?.classList.remove('hidden');
    updateProgressBar();
  }

  function hideEndlessIntro() {
    if (endlessRewardTimer) clearTimeout(endlessRewardTimer);
    endlessIntroPause = false;
    endlessReward?.classList.add('hidden');
    endlessReward?.setAttribute('aria-hidden', 'true');
  }

  function showEndlessIntro() {
    if (endlessRewardTimer) clearTimeout(endlessRewardTimer);
    endlessIntroPause = true;
    heartRainActive = false;
    heartRain.length = 0;
    chocolates.length = 0;
    particles.length = 0;
    effects.length = 0;
    camZoom = 1;
    camZoomTarget = 1;
    glowPower = 0;

    milestoneEl.classList.add('hidden');
    milestoneEl.classList.remove('cinematic');
    milestoneSub.classList.add('hidden');
    continueBtn?.classList.add('hidden');

    endlessReward?.classList.remove('hidden');
    endlessReward?.setAttribute('aria-hidden', 'false');
    updatePauseButtonState();
    startGameLoop();
  }

  function enterEndlessMode() {
    milestonePause = false;
    endlessIntroPause = false;
    messagePause = false;
    heartRainActive = false;
    heartRain.length = 0;
    hideEndlessIntro();
    continueBtn?.classList.add('hidden');
    milestoneEl?.classList.add('hidden');
    milestoneEl?.classList.remove('cinematic');
    milestones[FINAL_MILESTONE] = true;
    saveMilestones();
    lives = MAX_LIVES;
    saveGame(STORAGE.gameLives, lives);
    applyEndlessModeUI();
    updateLivesDisplay();
    showLivesHud(true);
    updateProgressBar();
    updatePauseButtonState();
    spawnGraceUntil = performance.now() + 450;
    lastSpawn = performance.now();
    forceRestartGameLoop();
  }

  function clearEndlessModeUI() {
    hideEndlessIntro();
    scoreBox?.classList.remove('endless-mode');
    gameContainer?.classList.remove('endless-mode');
    document.querySelector('.game-progress')?.classList.remove('endless-mode');
    endlessBadge?.classList.add('hidden');
    progressFill?.classList.remove('endless');
    progressInfinity?.classList.add('hidden');
  }

  function buildLivesHearts() {
    if (!livesHeartsEl) return;
    livesHeartsEl.innerHTML = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      const heart = document.createElement('span');
      heart.className = 'life-heart';
      heart.textContent = '❤️';
      heart.setAttribute('aria-hidden', 'true');
      livesHeartsEl.appendChild(heart);
    }
  }

  function updateLivesDisplay() {
    livesHeartsEl?.querySelectorAll('.life-heart').forEach((heart, index) => {
      heart.classList.toggle('full', index < lives);
      heart.classList.toggle('lost', index >= lives);
    });
  }

  function showLivesHud(animate = false) {
    if (!livesEl) return;
    livesEl.classList.remove('lives-locked');
    livesEl.classList.remove('lives-fade-in');
    void livesEl.offsetWidth;
    if (animate) livesEl.classList.add('lives-fade-in');
  }

  function hideLivesHud() {
    if (!livesEl) return;
    livesEl.classList.add('lives-locked');
    livesEl.classList.remove('lives-fade-in');
  }

  function syncLivesHudVisibility(animate = false) {
    if (milestones[FINAL_MILESTONE]) showLivesHud(animate);
    else hideLivesHud();
  }

  function loseLife() {
    if (!milestones[FINAL_MILESTONE] || gameOver || milestonePause || gamePaused || lives <= 0) return;
    lives--;
    saveGame(STORAGE.gameLives, lives);
    updateLivesDisplay();
    livesEl?.classList.add('life-lost-flash');
    setTimeout(() => livesEl?.classList.remove('life-lost-flash'), 350);
    if (lives <= 0) triggerGameOver();
  }

  function triggerGameOver() {
    gameOver = true;
    setPaused(false);
    updatePauseButtonState();
    gameOverScreen?.classList.remove('hidden');
    gameOverScreen?.setAttribute('aria-hidden', 'false');
  }

  function hideGameOver() {
    gameOver = false;
    gameOverScreen?.classList.add('hidden');
    gameOverScreen?.setAttribute('aria-hidden', 'true');
  }

  function updatePauseButtonState() {
    if (!pauseBtn) return;
    const locked = milestonePause || gameOver || messagePause || endlessIntroPause;
    pauseBtn.disabled = locked;
    pauseBtn.classList.toggle('hidden', locked);
  }

  function setPaused(paused) {
    if (milestonePause || gameOver || messagePause || endlessIntroPause) return;
    gamePaused = paused;
    pauseBtn?.classList.toggle('is-paused', paused);
    if (pauseIcon) pauseIcon.textContent = paused ? '▶' : '⏸';
    if (pauseLabel) pauseLabel.textContent = paused ? 'Reanudar' : 'Pausar';
    pauseBtn?.setAttribute('aria-label', paused ? 'Reanudar juego' : 'Pausar juego');
    pauseScreen?.classList.toggle('hidden', !paused);
    pauseScreen?.setAttribute('aria-hidden', paused ? 'false' : 'true');
  }

  function togglePause() {
    if (milestonePause || gameOver || messagePause || endlessIntroPause) return;
    setPaused(!gamePaused);
  }

  buildProgressMarkers();
  updateProgressBar();
  buildLivesHearts();
  updateLivesDisplay();
  syncLivesHudVisibility(false);

  let cherryImg = null;
  let chocolateImg = null;
  let spritesReady = false;

  let gameMode = 'loading';
  let milestonePause = false;
  let gamePaused = false;
  let gameOver = false;
  let running = false;
  let animId = 0;
  let lastTime = 0;
  let lastSpawn = 0;
  let glowPower = 0;
  let heartRainActive = false;

  const cherry = { x: 0, y: 0, speed: 0 };
  const chocolates = [];
  const particles = [];
  const effects = [];
  const heartRain = [];
  let keys = {};
  let mouseX = 0;

  let cinematicUiTimer = null;
  let camZoom = 1;
  let camZoomTarget = 1;

  const bgStars = Array.from({ length: PERF.bgStars }, () => ({
    x: 0,
    y: 0,
    r: 0.5 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
    speed: 0.001 + Math.random() * 0.002,
  }));

  const bgGlows = Array.from({ length: PERF.bgGlows }, () => ({
    x: 0,
    y: 0,
    r: 36 + Math.random() * 44,
    phase: Math.random() * Math.PI * 2,
  }));

  resizeCanvas();
  cherry.x = W / 2;
  cherry.y = H - H * (58 / 400);
  cherry.speed = W * (6.5 / 360);
  mouseX = W / 2;
  bgStars.forEach((s) => {
    s.x = Math.random() * W;
    s.y = Math.random() * H;
  });
  bgGlows.forEach((g) => {
    g.x = Math.random() * W;
    g.y = Math.random() * H;
  });
  gameReady = true;
  rebuildBgCache();

  Promise.all([
    loadSprite('cherry'),
    loadSprite('chocolate'),
  ]).then(([cherryLoaded, chocolateLoaded]) => {
    cherryImg = cherryLoaded;
    chocolateImg = chocolateLoaded;
    spritesReady = true;
    gameMode = 'playing';
    console.log('[MiniGame] Sprites prontos — renderização via drawImage exclusivamente.');
    forceRestartGameLoop();
    if (score >= FINAL_MILESTONE && milestones[FINAL_MILESTONE]) {
      applyEndlessModeUI();
      syncLivesHudVisibility(false);
      clearAllGameplayBlockers();
      applyEndlessModeUI();
      syncLivesHudVisibility(false);
    } else {
      checkMilestones(false);
      syncLivesHudVisibility(false);
    }
    updatePauseButtonState();
    if (lives <= 0 && milestones[FINAL_MILESTONE]) triggerGameOver();
  }).catch((err) => {
    console.error('[MiniGame] Erro ao carregar sprites:', err);
    milestoneText.textContent = 'Error al cargar sprites. Abre index.html desde la carpeta del proyecto.';
    milestoneEl.classList.remove('hidden');
  });

  function spriteSize(img, targetH) {
    const { w, h } = spriteDimensions(img);
    const aspect = w / h;
    return { w: targetH * aspect, h: targetH };
  }

  function saveMilestones() {
    saveGame(STORAGE.gameMilestones, milestones);
  }

  function resetMeterSession() {
    meterHeartClicks = 0;
    secretUnlocked = false;
    updateMeterDisplay();
  }

  function resetGameSession() {
    clearSessionStorage();
    clearAllGameplayBlockers();
    score = 0;
    lives = MAX_LIVES;
    milestones[50] = false;
    saveGame(STORAGE.gameScore, 0);
    saveMilestones();
    saveGame(STORAGE.gameLives, lives);
    scoreEl.textContent = '0';
    lastToastScore = 0;
    lastEndlessToastScore = 0;
    heartRain.length = 0;
    chocolates.length = 0;
    particles.length = 0;
    effects.length = 0;
    gameMode = spritesReady ? 'playing' : 'loading';
    glowPower = 0;
    spawnGraceUntil = 0;
    cherry.x = W / 2;
    mouseX = W / 2;
    clearEndlessModeUI();
    updateProgressBar();
    updateLivesDisplay();
    hideLivesHud();
    resetMeterSession();
    frameStress = 0;
    turboLite = perfLite;
    forceRestartGameLoop();
  }

  function clearCinematicUiTimer() {
    if (cinematicUiTimer) {
      clearTimeout(cinematicUiTimer);
      cinematicUiTimer = null;
    }
  }

  function handleFiftyContinueClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!milestonePause) return;
    clearCinematicUiTimer();
    enterEndlessMode();
    showToast(
      '"¡Modo Infinito desbloqueado!"',
      '"Tu cereza ganó 5 vidas. Sigue atrapando chocolates para siempre."',
      3500
    );
  }

  function clearToastTimers() {
    if (toastTimer) clearTimeout(toastTimer);
    if (toastCountdownTimer) clearTimeout(toastCountdownTimer);
    if (toastCountdownInterval) clearInterval(toastCountdownInterval);
    toastTimer = null;
    toastCountdownTimer = null;
    toastCountdownInterval = null;
  }

  function hideMessageToast() {
    clearToastTimers();
    messagePause = false;
    milestoneEl.classList.add('hidden');
    milestoneEl.classList.remove('readable', 'cinematic');
    milestoneSub.classList.add('hidden');
    toastDismissBtn?.classList.add('hidden');
    toastTimerEl?.classList.add('hidden');
    lastSpawn = performance.now();
    updatePauseButtonState();
  }

  function updateToastTimerDisplay(secondsLeft) {
    if (!toastTimerEl) return;
    toastTimerEl.textContent = secondsLeft > 0
      ? `Continuar en ${secondsLeft}s…`
      : '';
  }

  function showReadableToast(text, subText) {
    clearToastTimers();
    messagePause = true;
    milestoneText.textContent = text;
    milestoneSub.textContent = subText;
    milestoneSub.classList.remove('hidden');
    milestoneEl.classList.add('readable');
    milestoneEl.classList.remove('cinematic', 'hidden');
    toastDismissBtn?.classList.remove('hidden');
    toastTimerEl?.classList.remove('hidden');

    let secondsLeft = TOAST_READ_SECONDS;
    updateToastTimerDisplay(secondsLeft);

    toastCountdownInterval = setInterval(() => {
      secondsLeft -= 1;
      updateToastTimerDisplay(secondsLeft);
      if (secondsLeft <= 0) hideMessageToast();
    }, 1000);
  }

  function showToast(text, subText, duration = 3200, cinematicMode = false) {
    clearToastTimers();
    messagePause = false;
    toastDismissBtn?.classList.add('hidden');
    toastTimerEl?.classList.add('hidden');
    milestoneEl.classList.remove('readable');
    milestoneText.textContent = text;
    if (subText) {
      milestoneSub.textContent = subText;
      milestoneSub.classList.remove('hidden');
    } else {
      milestoneSub.classList.add('hidden');
    }
    milestoneEl.classList.toggle('cinematic', cinematicMode);
    milestoneEl.classList.remove('hidden');
    if (!cinematicMode) {
      toastTimer = setTimeout(() => milestoneEl.classList.add('hidden'), duration);
    }
  }

  function triggerFinalMilestonePause() {
    if (milestonePause || milestones[FINAL_MILESTONE]) return;

    milestonePause = true;
    setPaused(false);
    updatePauseButtonState();
    heartRainActive = true;
    camZoomTarget = 1.04;
    chocolates.length = 0;
    particles.length = 0;
    effects.length = 0;
    for (let i = 0; i < 6; i++) spawnHeartRain(true);
    setTimeout(() => {
      heartRainActive = false;
      heartRain.length = 0;
    }, 3500);

    clearCinematicUiTimer();
    milestoneText.textContent = '"El chocolate encontró a su cereza."';
    milestoneSub.textContent = '"Desde ese día, mi corazón encontró su lugar favorito."';
    milestoneSub.classList.remove('hidden');
    continueBtn?.classList.remove('hidden');
    milestoneEl.classList.add('cinematic');
    milestoneEl.classList.remove('hidden');
    startGameLoop();
  }

  function checkMilestones(announce = true) {
    if (score >= FINAL_MILESTONE && !milestones[FINAL_MILESTONE] && !milestonePause) {
      triggerFinalMilestonePause();
      return;
    }
    if (announce && score > 0 && score < FINAL_MILESTONE && score % MILESTONE_INTERVAL === 0 && score !== lastToastScore) {
      lastToastScore = score;
      const msgIndex = (score / MILESTONE_INTERVAL - 1) % TOAST_MESSAGES.length;
      showToast(TOAST_MESSAGES[msgIndex]);
      return;
    }
    if (announce && milestones[FINAL_MILESTONE] && score > FINAL_MILESTONE && score % ENDLESS_INTERVAL === 0 && score !== lastEndlessToastScore) {
      lastEndlessToastScore = score;
      const msgIndex = (score / ENDLESS_INTERVAL - 1) % ENDLESS_MESSAGES.length;
      const bonus = score - FINAL_MILESTONE;
      showReadableToast(ENDLESS_MESSAGES[msgIndex], `Modo Infinito · ${bonus} chocolates extra ✨`);
    }
  }

  function spawnHeartRain(initial = false) {
    if (heartRain.length >= PERF.maxHeartRain) return;
    heartRain.push({
      x: Math.random() * W,
      y: initial ? Math.random() * H : -16,
      speed: 0.5 + Math.random() * 1.4,
      size: 9 + Math.random() * 9,
      opacity: 0.25 + Math.random() * 0.45,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function spawnCatchEffects(x, y, size) {
    glowPower = 0.75;
    if (!turboLite) {
      scoreBox.classList.add('pulse');
      setTimeout(() => scoreBox.classList.remove('pulse'), 280);
    }

    trimPool(effects, PERF.maxEffects - 1);
    trimPool(particles, PERF.maxParticles - PERF.catchDots);

    effects.push({ type: 'pop', x, y, life: 1, scale: 0.55, size });

    for (let i = 0; i < PERF.catchDots; i++) {
      const angle = (Math.PI * 2 * i) / PERF.catchDots + Math.random() * 0.35;
      const speed = 1.4 + Math.random() * 2.2;
      particles.push({
        kind: 'dot',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: ['#FF4FA3', '#D81B60', '#FF80AB'][i % 3],
        size: 2 + Math.random() * 2.2,
      });
    }
  }

  function drawGlow(cx, cy, radius, color, alpha) {
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
    g.addColorStop(0, color.replace('ALPHA', String(alpha)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSprite(img, cx, cy, targetH, opts = {}) {
    if (!img) return null;
    const { w, h } = spriteSize(img, targetH * (opts.scale || 1));
    const x = cx - w / 2;
    const y = cy - h / 2 + (opts.floatY || 0);

    if (opts.glowColor && opts.glowAlpha > 0) {
      drawGlow(cx, cy + (opts.floatY || 0), Math.max(w, h) * 0.55, opts.glowColor, opts.glowAlpha);
    }

    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;

    if (opts.rotate) {
      ctx.translate(cx, cy + (opts.floatY || 0));
      ctx.rotate(opts.rotate);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(img, x, y, w, h);
    }

    if (opts.shine) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = (opts.alpha ?? 1) * 0.12;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.12, cy - h * 0.18 + (opts.floatY || 0), w * 0.2, h * 0.12, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    return { w, h };
  }

  function drawBackground(time) {
    if (bgCache) {
      ctx.drawImage(bgCache, 0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(15, 10, 10, 0.35)';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < bgStars.length; i++) {
      const s = bgStars[i];
      const a = 0.12 + Math.sin(time * s.speed + s.phase) * 0.1;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawCherryPlayer(time) {
    const floatY = Math.sin(time * 0.0035) * 2.5;
    const cx = cherry.x;
    const cherryGlow = PERF.cherryGlow && !turboLite && glowPower > 0.12 ? 0.18 + glowPower * 0.28 : 0;
    drawSprite(cherryImg, cx, cherry.y, SPRITE_H, {
      floatY,
      glowColor: cherryGlow > 0 ? 'rgba(255, 79, 163, ALPHA)' : null,
      glowAlpha: cherryGlow,
    });
  }

  function drawFallingChocolate(c) {
    if (!chocolateImg || c.alpha <= 0) return;
    drawSprite(chocolateImg, c.x, c.y, c.size, {
      alpha: c.alpha,
      rotate: c.rot,
    });
  }

  function spawnChocolate() {
    if (chocolates.length >= PERF.maxChocolates) return;
    const scaleVar = 0.88 + Math.random() * 0.18;
    chocolates.push({
      x: 28 + Math.random() * (W - 56),
      y: -50,
      speed: 1.4 + Math.random() * 3.2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: 0.012 + Math.random() * 0.028,
      size: SPRITE_H * scaleVar,
      wobble: Math.random() * Math.PI * 2,
      alpha: 1,
      collecting: false,
      collectStart: 0,
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07;
      p.life -= dt * 0.0055;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life -= dt * 0.005;
      if (e.type === 'pop') e.scale += dt * 0.006;
      if (e.life <= 0) effects.splice(i, 1);
    }

    if (heartRainActive && heartRain.length < PERF.maxHeartRain && Math.random() < 0.006) {
      spawnHeartRain(false);
    }
    for (let i = heartRain.length - 1; i >= 0; i--) {
      const h = heartRain[i];
      h.y += h.speed;
      h.wobble += 0.025;
      h.x += Math.sin(h.wobble) * 0.35;
      if (h.y > H + 20) heartRain.splice(i, 1);
    }
  }

  function drawHeartRainLayer() {
    if (!heartRain.length) return;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    heartRain.forEach((h) => {
      ctx.globalAlpha = h.opacity;
      ctx.font = `${h.size}px serif`;
      ctx.fillText('❤️', h.x, h.y);
    });
    ctx.restore();
  }

  function drawForegroundEffects() {
    if (turboLite && particles.length === 0 && effects.length === 0) return;

    ctx.save();
    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    effects.forEach((e) => {
      ctx.globalAlpha = e.life * 0.85;
      ctx.strokeStyle = '#FF4FA3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.scale * 18, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  function updatePlaying(time, dt) {
    if (isGameplayBlocked()) return;

    if (keys['ArrowLeft'] || keys['a']) {
      cherry.x = Math.max(SPRITE_H * 0.35, cherry.x - cherry.speed);
    }
    if (keys['ArrowRight'] || keys['d']) {
      cherry.x = Math.min(W - SPRITE_H * 0.35, cherry.x + cherry.speed);
    }
    cherry.x += (mouseX - cherry.x) * (isCoarsePointer ? 0.14 : 0.09);
    glowPower *= 0.93;

    const spawnRate = score > 75 ? 780 : score > 50 ? 880 : 920;
    if (time >= spawnGraceUntil && time - lastSpawn > spawnRate) {
      spawnChocolate();
      lastSpawn = time;
    }

    const hitW = SPRITE_H * 0.34;

    for (let i = chocolates.length - 1; i >= 0; i--) {
      const c = chocolates[i];

      if (c.collecting) {
        const elapsed = time - c.collectStart;
        c.alpha = Math.max(0, 1 - elapsed / 200);
        if (elapsed >= 200) {
          chocolates.splice(i, 1);
        }
        continue;
      }

      c.y += c.speed;
      c.rot += c.rotSpeed;
      c.x += Math.sin(c.wobble + time * 0.002) * 0.28;
      c.wobble += 0.018;

      const dx = Math.abs(c.x - cherry.x);
      const dy = Math.abs(c.y - cherry.y);
      if (dx < hitW && dy < hitW) {
        spawnCatchEffects(c.x, c.y, c.size);
        c.collecting = true;
        c.collectStart = time;
        score++;
        saveGame(STORAGE.gameScore, score);
        scoreEl.textContent = score;
        updateProgressBar();
        checkMilestones();
        continue;
      }

      if (c.y > H + 60) {
        chocolates.splice(i, 1);
        loseLife();
      }
    }
  }

  function render(time) {
    if (!running) return;

    const dt = Math.min(time - lastTime, 24);
    lastTime = time;
    frameStress = frameStress * 0.92 + (dt > 18 ? 1 : 0);
    turboLite = perfLite || frameStress > 0.28;

    if (Math.abs(camZoomTarget - camZoom) > 0.001) {
      camZoom += (camZoomTarget - camZoom) * 0.06;
    } else {
      camZoom = camZoomTarget;
    }

    if (gameMode === 'playing' && spritesReady) updatePlaying(time, dt);

    updateParticles(dt);

    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (camZoom !== 1) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(camZoom, camZoom);
      ctx.translate(-W / 2, -H / 2);
    }

    drawBackground(time);
    if (heartRainActive && heartRain.length) drawHeartRainLayer();

    if (!spritesReady) {
      ctx.restore();
      animId = requestAnimationFrame(render);
      return;
    }

    if (gameMode === 'playing') {
      chocolates.forEach(drawFallingChocolate);
      drawCherryPlayer(time);
      drawForegroundEffects();
    }

    ctx.restore();
    animId = requestAnimationFrame(render);
  }

  startGameLoop();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(animId);
    } else if (spritesReady && !gameOver) {
      forceRestartGameLoop();
    }
  });

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (!e.repeat && (e.key === 'p' || e.key === 'P' || e.key === 'Escape') && !milestonePause && !gameOver) {
      e.preventDefault();
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  function setCherryTarget(clientX) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((clientX - rect.left) / rect.width) * W;
    mouseX = Math.max(SPRITE_H * 0.35, Math.min(W - SPRITE_H * 0.35, mouseX));
  }

  function spawnTouchHearts(clientX, clientY) {
    if (!touchFx || !gameContainer || isGameplayBlocked() || turboLite) return;
    const now = performance.now();
    if (now - lastTouchHeartAt < 100) return;
    lastTouchHeartAt = now;

    const rect = gameContainer.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const icons = ['❤️', '💕', '💗'];
    const count = perfLite ? 2 : 3;

    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span');
      heart.className = 'game-touch-heart';
      heart.textContent = icons[i % icons.length];
      heart.style.left = `${x + (Math.random() - 0.5) * 32}px`;
      heart.style.top = `${y + (Math.random() - 0.5) * 20}px`;
      heart.style.animationDelay = `${i * 0.04}s`;
      touchFx.appendChild(heart);
      setTimeout(() => heart.remove(), 800);
    }

    while (touchFx.children.length > 12) {
      touchFx.firstChild?.remove();
    }
  }

  function handleCanvasTap(clientX, clientY) {
    setCherryTarget(clientX);
    spawnTouchHearts(clientX, clientY);
  }

  function updateGameCursor(e) {
    if (!gameCursor || !gameContainer || window.matchMedia('(pointer: coarse)').matches) return;
    const rect = gameContainer.getBoundingClientRect();
    gameCursor.style.left = `${e.clientX - rect.left}px`;
    gameCursor.style.top = `${e.clientY - rect.top}px`;
    const overCanvas = e.target === canvas;
    gameCursor.classList.toggle('hidden', !overCanvas);
  }

  gameContainer?.addEventListener('mousemove', updateGameCursor);
  gameContainer?.addEventListener('mouseleave', () => gameCursor?.classList.add('hidden'));

  canvas.addEventListener('mousemove', (e) => {
    setCherryTarget(e.clientX);
    updateGameCursor(e);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches[0]) setCherryTarget(e.touches[0].clientX);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches[0]) setCherryTarget(e.touches[0].clientX);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      canvas.setPointerCapture(e.pointerId);
    }
    handleCanvasTap(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      setCherryTarget(e.clientX);
    }
  });

  function handleContinueClick(e) {
    handleFiftyContinueClick(e);
  }

  continueBtn?.addEventListener('click', handleContinueClick);
  endlessEnterBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!endlessIntroPause) return;
    enterEndlessMode();
  });

  pauseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });

  resumeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPaused(false);
  });

  toastDismissBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideMessageToast();
  });

  document.getElementById('game-reload').addEventListener('click', resetGameSession);
  gameOverRestartBtn?.addEventListener('click', resetGameSession);
}

/* ===== Letter ===== */
function initLetter() {
  const envelope = document.getElementById('envelope');
  const letter = document.getElementById('letter-content');

  function open() {
    envelope.classList.add('open');
    setTimeout(() => letter.classList.remove('hidden'), 400);
  }

  envelope.addEventListener('click', open);
  envelope.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
}

/* ===== Stars ===== */
function initFinalMeeting() {
  const scene = document.getElementById('final-meeting');
  const heart = document.getElementById('final-meeting-heart');
  const message = document.getElementById('final-message');
  let played = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !played) {
        played = true;
        scene.classList.add('walking');
        setTimeout(() => {
          scene.classList.remove('walking');
          scene.classList.add('met');
          heart.classList.remove('hidden');
          message.style.animation = 'final-reveal 3s ease 0.5s forwards';
        }, 3000);
      }
    });
  }, { threshold: 0.4 });

  observer.observe(scene);
}

function createStars() {
  const container = document.getElementById('stars-bg');
  if (!container) return;
  const count = isMobileView() ? 36 : 60;
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.setProperty('--duration', (2 + Math.random() * 3) + 's');
    star.style.animationDelay = Math.random() * 3 + 's';
    container.appendChild(star);
  }
}

/* ===== Music ===== */
const musicState = {
  playing: false,
  unlocked: false,
  useFallback: false,
  toastShown: false,
  attemptedAutoplay: false,
  noteTimer: null,
  fallbackStep: 0,
  fallbackStart: 0,
  fallbackLoopSec: 18,
};

let audioEl = null;
let audioCtx = null;
let musicNodes = [];
let fallbackTimer = null;
let progressRaf = null;

function formatMusicTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function setMusicPlayingEffects(active) {
  document.body.classList.toggle('music-playing', active);
  document.getElementById('music-toggle')?.classList.toggle('is-playing', active);
  document.getElementById('petal-rain')?.classList.toggle('music-active', active);

  document.querySelectorAll('#petal-rain .petal, #petal-rain .rain-heart').forEach((el) => {
    const current = parseFloat(el.style.animationDuration);
    if (!current) return;
    if (active) {
      if (!el.dataset.origDur) el.dataset.origDur = String(current);
      el.style.animationDuration = `${current * 0.72}s`;
    } else if (el.dataset.origDur) {
      el.style.animationDuration = `${el.dataset.origDur}s`;
      delete el.dataset.origDur;
    }
  });
}

function updateMusicUI() {
  const playBtn = document.getElementById('music-play-btn');
  const pauseBtn = document.getElementById('music-pause-btn');
  const status = document.getElementById('music-status');
  const prompt = document.getElementById('music-autoplay-prompt');

  if (playBtn) playBtn.classList.toggle('hidden', musicState.playing);
  if (pauseBtn) pauseBtn.classList.toggle('hidden', !musicState.playing);
  if (status) status.classList.toggle('hidden', !musicState.playing);
  if (prompt) prompt.classList.toggle('hidden', musicState.playing || musicState.unlocked);
}

function updateMusicProgress() {
  const fill = document.getElementById('music-progress-fill');
  const currentEl = document.getElementById('music-current');
  const durationEl = document.getElementById('music-duration');
  if (!fill || !currentEl || !durationEl) return;

  let current = 0;
  let duration = 0;

  if (musicState.useFallback) {
    if (musicState.playing) {
      current = ((performance.now() - musicState.fallbackStart) / 1000) % musicState.fallbackLoopSec;
    }
    duration = musicState.fallbackLoopSec;
  } else if (audioEl && Number.isFinite(audioEl.duration)) {
    current = audioEl.currentTime || 0;
    duration = audioEl.duration || 0;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  fill.style.width = `${pct}%`;
  currentEl.textContent = formatMusicTime(current);
  durationEl.textContent = formatMusicTime(duration);
}

function tickMusicProgress() {
  updateMusicProgress();
  if (musicState.playing) {
    progressRaf = requestAnimationFrame(tickMusicProgress);
  }
}

function showMusicToast() {
  if (musicState.toastShown) return;
  musicState.toastShown = true;
  const toast = document.getElementById('music-toast');
  if (!toast) return;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 500);
  }, 4200);
}

function spawnMusicNote() {
  const container = document.getElementById('music-notes');
  const toggle = document.getElementById('music-toggle');
  if (!container || !toggle || !musicState.playing) return;

  const note = document.createElement('span');
  note.className = 'music-note-particle';
  note.textContent = ['♪', '♫', '♬', '🎵'][Math.floor(Math.random() * 4)];
  note.style.left = `${12 + Math.random() * 24}px`;
  container.appendChild(note);
  setTimeout(() => note.remove(), 1100);
}

function startMusicNotes() {
  stopMusicNotes();
  spawnMusicNote();
  musicState.noteTimer = setInterval(spawnMusicNote, 900);
}

function stopMusicNotes() {
  if (musicState.noteTimer) {
    clearInterval(musicState.noteTimer);
    musicState.noteTimer = null;
  }
  document.getElementById('music-notes')?.replaceChildren();
}

function startFallbackMusic() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const notes = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
  const melody = [0, 2, 4, 2, 4, 5, 4, 2, 0, 2, 4, 5, 4, 2, 0, 4, 2, 0];

  function playNote() {
    if (!musicState.playing || !musicState.useFallback) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.value = notes[melody[musicState.fallbackStep % melody.length]];
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.08);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
    musicNodes.push(osc);

    musicState.fallbackStep++;
    fallbackTimer = setTimeout(playNote, 620);
  }

  musicState.fallbackStart = performance.now();
  playNote();
}

function stopFallbackMusic() {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  musicNodes.forEach((n) => {
    try { n.stop(); } catch (_) {}
  });
  musicNodes = [];
}

async function playMusic() {
  musicState.unlocked = true;
  document.getElementById('music-autoplay-prompt')?.classList.add('hidden');

  let started = false;

  if (!musicState.useFallback && audioEl) {
    if (audioEl.error) {
      musicState.useFallback = true;
    } else {
      try {
        audioEl.volume = 0.35;
        await audioEl.play();
        started = true;
      } catch (_) {
        if (audioEl.error) {
          musicState.useFallback = true;
        } else {
          updateMusicUI();
          return;
        }
      }
    }
  }

  if (musicState.useFallback) {
    startFallbackMusic();
    started = true;
  }

  if (started && !musicState.playing) {
    musicState.playing = true;
    musicState.fallbackStart = performance.now();
    setMusicPlayingEffects(true);
    startMusicNotes();
    showMusicToast();
    updateMusicUI();
    cancelAnimationFrame(progressRaf);
    progressRaf = requestAnimationFrame(tickMusicProgress);
  }
}

function pauseMusic() {
  musicState.playing = false;

  if (audioEl && !musicState.useFallback) {
    audioEl.pause();
  }
  stopFallbackMusic();

  setMusicPlayingEffects(false);
  stopMusicNotes();
  updateMusicUI();
  cancelAnimationFrame(progressRaf);
  updateMusicProgress();
}

function toggleMusic() {
  if (musicState.playing) pauseMusic();
  else playMusic();
}

async function tryAutoplayMusic() {
  if (musicState.attemptedAutoplay) return;
  musicState.attemptedAutoplay = true;

  if (!audioEl || musicState.useFallback) {
    document.getElementById('music-autoplay-prompt')?.classList.remove('hidden');
    updateMusicUI();
    return;
  }

  audioEl.volume = 0.35;
  try {
    await audioEl.play();
    musicState.playing = true;
    musicState.unlocked = true;
    setMusicPlayingEffects(true);
    startMusicNotes();
    showMusicToast();
    updateMusicUI();
    progressRaf = requestAnimationFrame(tickMusicProgress);
  } catch (_) {
    document.getElementById('music-autoplay-prompt')?.classList.remove('hidden');
    updateMusicUI();
  }
}

function bindFirstInteractionAutoplay() {
  const unlock = () => {
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    if (musicState.unlocked) return;
    musicState.unlocked = true;
    if (!musicState.playing) playMusic();
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

function initMusic() {
  audioEl = document.getElementById('song-audio');
  const toggle = document.getElementById('music-toggle');
  const playBtn = document.getElementById('music-play-btn');
  const pauseBtn = document.getElementById('music-pause-btn');
  const autoplayBtn = document.getElementById('music-autoplay-btn');
  const progressTrack = document.getElementById('music-progress-track');

  if (audioEl) {
    audioEl.volume = 0.35;
    audioEl.addEventListener('loadedmetadata', () => {
      musicState.useFallback = false;
      updateMusicProgress();
    });
    audioEl.addEventListener('canplay', () => {
      musicState.useFallback = false;
    });
    audioEl.addEventListener('timeupdate', () => {
      if (!musicState.useFallback && musicState.playing) updateMusicProgress();
    });
    audioEl.addEventListener('error', () => {
      musicState.useFallback = true;
      const durationEl = document.getElementById('music-duration');
      if (durationEl) durationEl.textContent = formatMusicTime(musicState.fallbackLoopSec);
    });
    audioEl.load();
  }

  toggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMusic();
  });

  playBtn?.addEventListener('click', () => playMusic());
  pauseBtn?.addEventListener('click', () => pauseMusic());
  autoplayBtn?.addEventListener('click', () => playMusic());

  progressTrack?.addEventListener('click', (e) => {
    if (musicState.useFallback || !audioEl || !audioEl.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audioEl.currentTime = ratio * audioEl.duration;
    updateMusicProgress();
  });

  progressTrack?.addEventListener('keydown', (e) => {
    if (!audioEl || musicState.useFallback) return;
    if (e.key === 'ArrowRight') audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
    if (e.key === 'ArrowLeft') audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
    updateMusicProgress();
  });

  updateMusicUI();
  bindFirstInteractionAutoplay();
  setTimeout(tryAutoplayMusic, 600);
}

/* ===== Init ===== */
function initMainSections() {
  initLoveClicks();
  initSurprise();
  initPoem();
  initMeter();
  initGame();
  initLetter();
  createStars();
  initFinalMeeting();
}

document.addEventListener('DOMContentLoaded', () => {
  createAmbientBg();
  createRain();
  initIntro();
  initMusic();
});
