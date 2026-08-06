/**

 * DailyGreeting — mensaje personalizada diferente cada día (intro).

 */

(function (global) {

  'use strict';



  const TIMEZONE = 'America/New_York';

  const NAME = 'Sophie';



  const GREETINGS = [

    `🌸 Qué bueno verte de nuevo, ${NAME}.`,

    '🍫 Hoy también reservé un rincón de mi día para ti.',

    '🍒 ¿Lista para batir mi récord hoy? ❤️',

    `☀️ Un día más, ${NAME} — y sigues siendo mi favorita.`,

    '🐻 El Chocolate mandó un abrazo antes de que entraras.',

    '💫 Entra despacio… preparé cositas para ti hoy.',

    '🌙 Qué bueno que apareciste. Te estaba esperando.',

    '❤️ Tu lugar aquí siempre está guardado.',

    '🎵 Hoy la banda sonora combina contigo.',

    '🔋 Recordatorio cariñoso: cuidar del Chocolate también es cuidar de nosotros.',

    '🍫🍒 Chocolate + Cereza = mi día se completa cuando vienes.',

    `✨ ${NAME}, conviertes un sitio en un hogar.`,

    '🌷 Pequeño ritual del día: abrir esto y pensar en ti.',

    '🎯 ¿Hacemos que hoy valga la pena juntos?',

    '💕 Un capítulo más de nuestra historia empieza ahora.',

    '🧸 Teddy dice: ¡llegó ella! Esconde los secretos… o no. 😄',

    '🌈 Hoy elegí este mensaje solo para ti.',

    '⭐ Eres la estrella que más me gusta ver brillar.',

    '🍫 Un chocolate virtual para calentar tu día.',

    '🍒 Cuidado: jugar conmigo puede causar sonrisa involuntaria.',

    `💗 Hola, ${NAME}. Te extrañé — aunque haya sido ayer.`,

    '🎮 Modo cariño activado. Puedes entrar.',

    '🌸 Flores digitales para la persona más especial.',

    '❤️‍🔥 ¿Lista? Porque yo ya lo estoy.',

    '🕊️ Respira hondo… hoy va a ser bonito.',

    '📖 Página nueva de nuestro diario. ¿La escribimos juntos?',

    '🍫 El Chocolate prometió portarse bien hoy. (Mentira.)',

    `🌟 ${NAME}, gracias por existir en mi mundo.`,

    '💌 Este mensaje es tu pase VIP de hoy.',

    '🎁 Hay sorpresas escondidas… pero solo si exploras.',

    '🍒 Batir récord es opcional. Quererte no lo es.',

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


