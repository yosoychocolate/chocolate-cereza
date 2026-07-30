/**
 * Palavras do Amor — mensagens especiais, raridades e memórias.
 */
(function (global) {
  'use strict';

  const PITY_MS = 3 * 60 * 1000;
  const PITY_GAMES = 10;
  const EASTER_MIN_GAMES = 12;
  const SPAWN_ROLL = 0.42;

  const WORDS = [
    { text: 'Eu te amo ❤️', reward: { type: 'points', value: 200 } },
    { text: 'Você é linda 🥰', reward: { type: 'points', value: 150 } },
    { text: 'Meu amor 😘', reward: { type: 'points', value: 120 } },
    { text: 'Chocolate ama Cereza 🍫🍒', reward: { type: 'points', value: 180 } },
    { text: 'Beijo 🌹', reward: { type: 'life', value: 1 } },
    { text: 'Saudade 💖', reward: { type: 'points', value: 100 } },
    { text: 'Sempre com você 💕', reward: { type: 'points', value: 160 } },
    { text: 'Você me faz feliz ✨', reward: { type: 'points', value: 140 } },
    { text: 'Pensando em ti 💭', reward: { type: 'points', value: 80 } },
    { text: 'Minha pessoa favorita 🥰', reward: { type: 'points', value: 175 } },
    { text: 'Te escolheria de novo 💍', reward: { type: 'points', value: 190 } },
    { text: 'Obrigado por existir 🙏', reward: { type: 'points', value: 130 } },
    { text: 'Você deixa tudo mais bonito 🌸', reward: { type: 'points', value: 110 } },
    { text: 'Obrigado por ser você 💗', reward: { type: 'points', value: 125 } },
    { text: 'Cada partida é melhor contigo 🎮', reward: { type: 'points', value: 90 } },
    { text: 'Meu lugar favorito é contigo 🏠', reward: { type: 'life', value: 1 } },
    { text: 'Você é minha cereza 🍒', reward: { type: 'points', value: 155 } },
    { text: 'Amor sem pausa 💓', reward: { type: 'points', value: 95 } },
    { text: 'Contigo tudo sabe doce 🍫', reward: { type: 'points', value: 105 } },
    { text: 'Meu coração é seu ❤️', reward: { type: 'points', value: 165 } },
    { text: 'A melhor parte do meu dia é falar com você ☀️', reward: { type: 'points', value: 115 } },
    { text: 'Se pudesse, te escolheria mil vezes ✨', reward: { type: 'points', value: 185 } },
    { text: 'Você ilumina meu mundo 🌟', reward: { type: 'points', value: 135 } },
    { text: 'Sinto sua falta 💫', reward: { type: 'points', value: 85 } },
    { text: 'Para sempre nós dois 🧸', reward: { type: 'points', value: 145 } },
    { text: 'Te amo mais a cada dia 📈', reward: { type: 'points', value: 170 } },
    { text: 'Você é especial demais 💎', reward: { type: 'points', value: 125 } },
    { text: 'Meu sorriso começa com você 😊', reward: { type: 'life', value: 1 } },
    { text: 'Nosso amor é único 🌈', reward: { type: 'points', value: 150 } },
    { text: 'Cada mensagem tua é um presente 🎁', reward: { type: 'points', value: 100 } },
  ];

  const LETTERS = [
    'Obrigado por existir ❤️',
    'Você é a melhor parte de mim.',
    'Nunca vou cansar de te escolher.',
    'Meu coração sorri quando penso em você.',
    'Contigo, até o silêncio é bonito.',
    'Você transforma dias comuns em especiais.',
    'Te amo mais do que palavras cabem.',
    'Obrigado por ser exatamente quem você é.',
    'Você é meu lugar seguro.',
    'Cada segundo contigo vale ouro.',
  ];

  const MEMORIES = [
    { id: 'mem_01', gamesRequired: 1, title: 'Memória #01 desbloqueada', text: 'Foi aqui que começou nossa disputa.' },
    { id: 'mem_02', gamesRequired: 10, title: 'Memória #02 desbloqueada', text: 'Cada partida contigo é especial.' },
    { id: 'mem_03', gamesRequired: 25, title: 'Memória #03 desbloqueada', text: 'Obrigado por jogar comigo.' },
    { id: 'mem_04', gamesRequired: 50, title: 'Memória #04 desbloqueada', text: 'Nosso placar importa menos que nosso tempo juntos.' },
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
          popupText: 'Chocolate abraçou a Cereza ❤️',
          reward: { type: 'points', value: 250 },
          isSpecial: true,
        });
      case 'crown':
        return formatEntry({
          kind: 'crown',
          display: '👑',
          text: '👑',
          popupText: 'Rei do Chocolate 👑',
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
          popupText: 'Você é a melhor parte do meu dia ❤️',
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
          popupText: '❤️ Bônus do Casal',
          reward: { type: 'points', value: 500 },
          rewardLabel: '+500 Puntos · Casal 💕',
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
          popupText: 'Se eu pudesse escolher uma companheira de jogo para sempre… escolheria você. ❤️',
          reward: { type: 'points', value: 100 },
          rewardLabel: '💖 Para sempre',
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

      if (!forcePity && Math.random() > SPAWN_ROLL) {
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
