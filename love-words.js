/**

 * Palabras del Amor — mensajes especiales, rarezas y recuerdos.

 */

(function (global) {

  'use strict';



  const PITY_MS = 3 * 60 * 1000;

  const PITY_GAMES = 10;

  const EASTER_MIN_GAMES = 12;

  const SPAWN_ROLL = 0.42;



  const WORDS = [

    { text: 'Te amo ❤️', reward: { type: 'points', value: 200 } },

    { text: 'Eres hermosa 🥰', reward: { type: 'points', value: 150 } },

    { text: 'Mi amor 😘', reward: { type: 'points', value: 120 } },

    { text: 'Chocolate ama Cereza 🍫🍒', reward: { type: 'points', value: 180 } },

    { text: 'Beso 🌹', reward: { type: 'life', value: 1 } },

    { text: 'Te extraño 💖', reward: { type: 'points', value: 100 } },

    { text: 'Siempre contigo 💕', reward: { type: 'points', value: 160 } },

    { text: 'Me haces feliz ✨', reward: { type: 'points', value: 140 } },

    { text: 'Pensando en ti 💭', reward: { type: 'points', value: 80 } },

    { text: 'Mi persona favorita 🥰', reward: { type: 'points', value: 175 } },

    { text: 'Te elegiría otra vez 💍', reward: { type: 'points', value: 190 } },

    { text: 'Gracias por existir 🙏', reward: { type: 'points', value: 130 } },

    { text: 'Haces todo más bonito 🌸', reward: { type: 'points', value: 110 } },

    { text: 'Gracias por ser tú 💗', reward: { type: 'points', value: 125 } },

    { text: 'Cada partida es mejor contigo 🎮', reward: { type: 'points', value: 90 } },

    { text: 'Mi lugar favorito es contigo 🏠', reward: { type: 'life', value: 1 } },

    { text: 'Eres mi cereza 🍒', reward: { type: 'points', value: 155 } },

    { text: 'Amor sin pausa 💓', reward: { type: 'points', value: 95 } },

    { text: 'Contigo todo sabe dulce 🍫', reward: { type: 'points', value: 105 } },

    { text: 'Mi corazón es tuyo ❤️', reward: { type: 'points', value: 165 } },

    { text: 'La mejor parte de mi día es hablar contigo ☀️', reward: { type: 'points', value: 115 } },

    { text: 'Si pudiera, te elegiría mil veces ✨', reward: { type: 'points', value: 185 } },

    { text: 'Iluminas mi mundo 🌟', reward: { type: 'points', value: 135 } },

    { text: 'Te extraño 💫', reward: { type: 'points', value: 85 } },

    { text: 'Para siempre nosotros dos 🧸', reward: { type: 'points', value: 145 } },

    { text: 'Te amo más cada día 📈', reward: { type: 'points', value: 170 } },

    { text: 'Eres demasiado especial 💎', reward: { type: 'points', value: 125 } },

    { text: 'Mi sonrisa empieza contigo 😊', reward: { type: 'life', value: 1 } },

    { text: 'Nuestro amor es único 🌈', reward: { type: 'points', value: 150 } },

    { text: 'Cada mensaje tuyo es un regalo 🎁', reward: { type: 'points', value: 100 } },

  ];



  const LETTERS = [

    'Gracias por existir ❤️',

    'Eres la mejor parte de mí.',

    'Nunca me cansaré de elegirte.',

    'Mi corazón sonríe cuando pienso en ti.',

    'Contigo, hasta el silencio es bonito.',

    'Transformas días comunes en especiales.',

    'Te amo más de lo que caben las palabras.',

    'Gracias por ser exactamente quien eres.',

    'Eres mi lugar seguro.',

    'Cada segundo contigo vale oro.',

  ];



  const MEMORIES = [

    { id: 'mem_01', gamesRequired: 1, title: 'Recuerdo #01 desbloqueado', text: 'Fue aquí donde empezó nuestra competencia.' },

    { id: 'mem_02', gamesRequired: 10, title: 'Recuerdo #02 desbloqueado', text: 'Cada partida contigo es especial.' },

    { id: 'mem_03', gamesRequired: 25, title: 'Recuerdo #03 desbloqueado', text: 'Gracias por jugar conmigo.' },

    { id: 'mem_04', gamesRequired: 50, title: 'Recuerdo #04 desbloqueado', text: 'Nuestro marcador importa menos que nuestro tiempo juntos.' },

  ];



  const SPECIAL_KINDS = new Set(['letter', 'golden', 'gift', 'teddy', 'crown', 'ultra', 'easter', 'couple']);



  let wordQueue = [];

  let letterIdx = 0;



  function defaultState() {

    return {

      lastSpawnAt: 0,

      gamesSinceSpecial: 0,

      lastEasterGame: 0,

      pendingMemories: [],

      memoriesShown: [],

      totalCaught: 0,

    };

  }



  function normalizeState(raw) {

    const base = defaultState();

    if (!raw || typeof raw !== 'object') return base;

    return {

      lastSpawnAt: typeof raw.lastSpawnAt === 'number' ? raw.lastSpawnAt : 0,

      gamesSinceSpecial: typeof raw.gamesSinceSpecial === 'number' ? raw.gamesSinceSpecial : 0,

      lastEasterGame: typeof raw.lastEasterGame === 'number' ? raw.lastEasterGame : 0,

      pendingMemories: Array.isArray(raw.pendingMemories) ? raw.pendingMemories.slice() : [],

      memoriesShown: Array.isArray(raw.memoriesShown) ? raw.memoriesShown.slice() : [],

      totalCaught: typeof raw.totalCaught === 'number' ? raw.totalCaught : 0,

    };

  }



  function shuffle(arr) {

    for (let i = arr.length - 1; i > 0; i--) {

      const j = Math.floor(Math.random() * (i + 1));

      [arr[i], arr[j]] = [arr[j], arr[i]];

    }

    return arr;

  }



  function refillWordQueue() {

    wordQueue = shuffle(WORDS.map((_, i) => i));

  }



  function rewardLabel(reward) {

    if (!reward) return '';

    if (reward.label) return reward.label;

    if (reward.type === 'points') return `+${reward.value} Puntos`;

    if (reward.type === 'life') return '+1 Vida ❤️';

    if (reward.type === 'shield') return 'Escudo 🛡️';

    if (reward.type === 'message') return '+50 Puntos 💌';

    if (reward.type === 'memory') return '❤️ Memoria desbloqueada';

    return '';

  }



  function formatEntry(entry) {

    return {

      kind: entry.kind || 'word',

      text: entry.text || '',

      display: entry.display || entry.text || '❤️',

      popupText: entry.popupText || entry.text || entry.display || '',

      reward: entry.reward || null,

      rewardLabel: entry.rewardLabel || rewardLabel(entry.reward),

      pauseMs: entry.pauseMs,

      fx: entry.fx || null,

      sound: entry.sound || null,

      isSpecial: entry.isSpecial === true,

      noBlock: entry.noBlock === true,

    };

  }



  function rollGiftReward() {

    const roll = Math.random();

    if (roll < 0.34) {

      return { type: 'points', value: 500, label: '+500 Puntos 🎁' };

    }

    if (roll < 0.67) {

      return { type: 'life', value: 1, label: '+1 Vida 🎁' };

    }

    return { type: 'shield', value: 1, label: 'Escudo 🎁' };

  }



  function pickWordEntry() {

    if (!wordQueue.length) refillWordQueue();

    const idx = wordQueue.pop();

    return formatEntry(WORDS[idx]);

  }



  function pickLetterEntry() {

    const msg = LETTERS[letterIdx % LETTERS.length];

    letterIdx++;

    return formatEntry({

      kind: 'letter',

      display: '💌',

      text: '💌',

      popupText: msg,

      reward: { type: 'message', value: 50 },

      rewardLabel: '+50 Puntos 💌',

      pauseMs: 2000,

      isSpecial: true,

    });

  }



  function pickMemoryEntry(state) {

    if (!state.pendingMemories.length) return null;

    const id = state.pendingMemories.shift();

    const mem = MEMORIES.find((m) => m.id === id);

    if (!mem) return null;

    state.memoriesShown.push(id);

    return formatEntry({

      kind: 'memory',

      display: '❤️',

      text: mem.title,

      popupText: mem.text,

      reward: { type: 'memory' },

      rewardLabel: mem.title,

      pauseMs: 2400,

    });

  }



  function weightedPick(weights) {

    let total = 0;

    for (let i = 0; i < weights.length; i++) total += weights[i].w;

    let roll = Math.random() * total;

    for (let i = 0; i < weights.length; i++) {

      roll -= weights[i].w;

      if (roll <= 0) return weights[i].kind;

    }

    return weights[weights.length - 1].kind;

  }



  function buildTypeWeights(ctx) {

    const boost = ctx.state.gamesSinceSpecial >= PITY_GAMES ? 2.2 : 1;

    const weights = [

      { kind: 'word', w: 50 },

      { kind: 'letter', w: 30 },

      { kind: 'golden', w: 20 },

      { kind: 'gift', w: 20 },

      { kind: 'teddy', w: 10 },

      { kind: 'crown', w: 5 * boost },

      { kind: 'ultra', w: 5 * boost },

    ];

    if (ctx.inCoupleRoom) {

      weights.push({ kind: 'couple', w: 18 });

    }

    if (ctx.state.pendingMemories.length) {

      weights.push({ kind: 'memory', w: 12 });

    }

    return weights;

  }



  function buildEntry(kind, ctx) {

    switch (kind) {

      case 'word':

        return pickWordEntry();

      case 'letter':

        return pickLetterEntry();

      case 'golden':

        return formatEntry({

          kind: 'golden',

          display: '❤️',

          text: '❤️',

          popupText: 'Te amo ❤️',

          reward: { type: 'points', value: 300 },

          rewardLabel: '+300 Puntos · Escudo · Cámara lenta',

          isSpecial: true,

        });

      case 'gift':

        return formatEntry({

          kind: 'gift',

          display: '🎁',

          text: '🎁',

          popupText: '¡Sorpresa!',

          reward: { type: 'random' },

          rewardLabel: '¿Qué habrá dentro?',

          isSpecial: true,

        });

      case 'teddy':

        return formatEntry({

          kind: 'teddy',

          display: '🧸',

          text: '🧸',

          popupText: 'Chocolate abrazó a Cereza ❤️',

          reward: { type: 'points', value: 250 },

          isSpecial: true,

        });

      case 'crown':

        return formatEntry({

          kind: 'crown',

          display: '👑',

          text: '👑',

          popupText: 'Rey del Chocolate 👑',

          reward: { type: 'points', value: 1500 },

          isSpecial: true,

          fx: 'milestone',

          sound: 'ultra',

        });

      case 'ultra':

        return formatEntry({

          kind: 'ultra',

          display: '✨',

          text: '✨',

          popupText: 'Eres la mejor parte de mi día ❤️',

          reward: { type: 'points', value: 2000 },

          rewardLabel: '+2000 Puntos ✨',

          pauseMs: 1200,

          fx: 'love',

          sound: 'ultra',

          isSpecial: true,

        });

      case 'couple':

        return formatEntry({

          kind: 'couple',

          display: '💕',

          text: '💕',

          popupText: '❤️ Bono de pareja',

          reward: { type: 'points', value: 500 },

          rewardLabel: '+500 Puntos · Pareja 💕',

          pauseMs: 1600,

          noBlock: true,

          isSpecial: true,

        });

      case 'memory':

        return pickMemoryEntry(ctx.state);

      case 'easter':

        ctx.state.lastEasterGame = ctx.gamesPlayed;

        return formatEntry({

          kind: 'easter',

          display: '💖',

          text: '💖',

          popupText: 'Si pudiera elegir una compañera de juego para siempre… te elegiría a ti. ❤️',

          reward: { type: 'points', value: 100 },

          rewardLabel: '💖 Para siempre',

          pauseMs: 1000,

          fx: 'love',

          sound: 'ultra',

          isSpecial: true,

        });

      default:

        return pickWordEntry();

    }

  }



  const LoveWords = {

    defaultState,

    normalizeState,

    rewardLabel,

    rollGiftReward,

    MEMORIES,



    checkMemoryUnlocks(gamesPlayed, state) {

      const normalized = normalizeState(state);

      const newly = [];

      for (let i = 0; i < MEMORIES.length; i++) {

        const mem = MEMORIES[i];

        if (gamesPlayed < mem.gamesRequired) continue;

        if (normalized.memoriesShown.includes(mem.id)) continue;

        if (normalized.pendingMemories.includes(mem.id)) continue;

        normalized.pendingMemories.push(mem.id);

        newly.push(mem);

      }

      Object.assign(state, normalized);

      return newly;

    },



    onGameOver(gamesPlayed, state) {

      const normalized = normalizeState(state);

      normalized.gamesSinceSpecial += 1;

      const memories = LoveWords.checkMemoryUnlocks(gamesPlayed, normalized);

      Object.assign(state, normalized);

      return memories;

    },



    onCaught(entry, state, gamesPlayed) {

      const normalized = normalizeState(state);

      normalized.totalCaught += 1;

      if (entry?.isSpecial || SPECIAL_KINDS.has(entry?.kind)) {

        normalized.gamesSinceSpecial = 0;

      }

      if (entry?.kind === 'easter') {

        normalized.lastEasterGame = gamesPlayed;

      }

      Object.assign(state, normalized);

    },



    pick(ctx) {

      const state = normalizeState(ctx?.state);

      const now = ctx?.now || performance.now();

      const gamesPlayed = ctx?.gamesPlayed || 0;

      const inCoupleRoom = !!ctx?.inCoupleRoom;

      const forcePity = now - state.lastSpawnAt >= PITY_MS;



      if (!forcePity && Math.random() > (ctx.mobile ? 0.26 : SPAWN_ROLL)) {

        return null;

      }



      const pickCtx = { state, gamesPlayed, inCoupleRoom, now };



      if (forcePity) {

        state.lastSpawnAt = now;

        if (ctx.state) Object.assign(ctx.state, state);

        return pickWordEntry();

      }



      if (canShowEaster(state, gamesPlayed) && Math.random() < (state.gamesSinceSpecial >= PITY_GAMES ? 0.14 : 0.06)) {

        state.lastSpawnAt = now;

        if (ctx.state) Object.assign(ctx.state, state);

        return buildEntry('easter', pickCtx);

      }



      const kind = weightedPick(buildTypeWeights(pickCtx));

      let entry = buildEntry(kind, pickCtx);

      if (!entry) entry = pickWordEntry();

      if (!entry) return null;



      state.lastSpawnAt = now;

      if (ctx.state) Object.assign(ctx.state, state);

      return entry;

    },

  };



  function canShowEaster(state, gamesPlayed) {

    return gamesPlayed - (state.lastEasterGame || 0) >= EASTER_MIN_GAMES;

  }



  refillWordQueue();

  global.LoveWords = LoveWords;

})(typeof window !== 'undefined' ? window : globalThis);

