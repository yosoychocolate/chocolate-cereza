/**
 * DailyGreeting — mensagem personalizada diferente a cada dia (intro).
 */
(function (global) {
  'use strict';

  const TIMEZONE = 'America/New_York';
  const NAME = 'Sophie';

  const GREETINGS = [
    `🌸 Bom te ver de novo, ${NAME}.`,
    '🍫 Hoje também reservei um cantinho do meu dia para você.',
    '🍒 Pronta para bater meu recorde hoje? ❤️',
    `☀️ Mais um dia, ${NAME} — e você continua sendo meu favorito.`,
    '🐻 O Chocolate mandou um abraço antes de você entrar.',
    '💫 Entre devagar… preparei coisinhas para você hoje.',
    '🌙 Que bom que você apareceu. Eu estava te esperando.',
    '❤️ Seu lugar aqui sempre está guardado.',
    '🎵 Hoje a trilha sonora combina com você.',
    '🔋 Lembrete carinhoso: cuidar do Chocolate também é cuidar de nós.',
    '🍫🍒 Chocolate + Cereza = meu dia fica completo quando você vem.',
    `✨ ${NAME}, você transforma um site em um lar.`,
    '🌷 Pequeno ritual do dia: abrir isso e pensar em você.',
    '🎯 Vamos fazer hoje valer a pena juntos?',
    '💕 Mais um capítulo da nossa história começa agora.',
    '🧸 Teddy diz: ela chegou! Esconda os segredos… ou não. 😄',
    '🌈 Hoje eu escolhi esta mensagem só para você.',
    '⭐ Você é a estrela que eu mais gosto de ver brilhar.',
    '🍫 Um chocolate virtual para aquecer seu dia.',
    '🍒 Cuidado: jogar comigo pode causar sorriso involuntário.',
    `💗 Oi, ${NAME}. Senti sua falta — mesmo que tenha sido ontem.`,
    '🎮 Modo carinho ativado. Pode entrar.',
    '🌸 Flores digitais para a pessoa mais especial.',
    '❤️‍🔥 Pronta? Porque eu já estou.',
    '🕊️ Respira fundo… hoje vai ser bonito.',
    '📖 Página nova do nosso diário. Vamos escrever juntos?',
    '🍫 O Chocolate prometeu se comportar hoje. (Mentira.)',
    `🌟 ${NAME}, obrigado por existir no meu mundo.`,
    '💌 Esta mensagem é seu passe VIP de hoje.',
    '🎁 Tem surpresas escondidas… mas só se você explorar.',
    '🍒 Bater recorde é opcional. Te amar não é.',
  ];

  function getTodayKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(date);
  }

  function pickIndexForDay(dayKey, count) {
    let hash = 0;
    for (let i = 0; i < dayKey.length; i++) {
      hash = ((hash << 5) - hash + dayKey.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % count;
  }

  function getGreetingForToday(date = new Date()) {
    if (!GREETINGS.length) return '';
    const dayKey = getTodayKey(date);
    const index = pickIndexForDay(dayKey, GREETINGS.length);
    return GREETINGS[index];
  }

  function renderIntroGreeting() {
    const el = document.getElementById('intro-daily-greeting');
    if (!el) return;
    const text = getGreetingForToday();
    el.textContent = text;
    el.classList.add('is-visible');
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderIntroGreeting);
    } else {
      renderIntroGreeting();
    }
  }

  global.DailyGreeting = {
    init,
    getGreetingForToday,
    getTodayKey,
    GREETINGS,
    TIMEZONE,
  };

  init();
})(typeof window !== 'undefined' ? window : globalThis);
