/**

 * Datos compartidos del hogar del casal (sin Firebase).

 */

(function (global) {

  'use strict';



  const DEFAULT_TASKS = [

    { text: 'Cargar el auto', emoji: '🔋' },

    { text: 'Comprar café', emoji: '☕' },

    { text: 'Comprar chocolate', emoji: '🍫' },

    { text: 'Llamar a mamá', emoji: '📞' },

    { text: 'Ir al mercado', emoji: '🛒' },

  ];



  const DAILY_MISSION_DEFS = [

    { id: 'charge_car', text: 'Cargar el auto', emoji: '🔋', reward: 5 },

    { id: 'play_game', text: 'Jugar una partida', emoji: '🎮', reward: 3 },

    { id: 'send_photo', text: 'Enviar una foto', emoji: '📸', reward: 4 },

    { id: 'listen_music', text: 'Escuchar nuestra canción', emoji: '🎵', reward: 2 },

  ];



  function createDefaultHubData() {

    return {

      relationshipStart: null,

      nextMeetingDate: null,

      chargeReminder: {

        enabled: true,

        time: '20:30',

        timezone: 'America/New_York',

      },

      dailyMissions: {

        dateKey: '',

        completed: [],

      },

      updatedAt: null,

    };

  }



  function todayDateKeyInTz(timezone) {

    timezone = timezone || 'America/New_York';

    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

  }



  function daysBetween(fromIso, toDate) {

    if (!fromIso) return null;

    toDate = toDate || new Date();

    const start = new Date(fromIso + 'T12:00:00');

    if (Number.isNaN(start.getTime())) return null;

    const diff = toDate.getTime() - start.getTime();

    return Math.max(0, Math.floor(diff / 86400000));

  }



  function daysUntil(isoDate, fromDate) {

    if (!isoDate) return null;

    fromDate = fromDate || new Date();

    const target = new Date(isoDate + 'T12:00:00');

    if (Number.isNaN(target.getTime())) return null;

    const diff = target.getTime() - fromDate.getTime();

    return Math.ceil(diff / 86400000);

  }



  const GARDEN_ACTIONS = {

    visit: { emoji: '🌸', label: 'Entró hoy' },

    letter: { emoji: '🌹', label: 'Envió carta' },

    game: { emoji: '🌻', label: 'Jugó' },

    music: { emoji: '🌷', label: 'Escuchó música' },

    together: { emoji: '💐', label: 'Los dos en línea' },

    task: { emoji: '🌺', label: 'Tarea completada' },

  };



  const STAR_DEFS = [

    { id: 'first_letter', emoji: '⭐', label: 'Primera cartita' },

    { id: 'games_10', emoji: '⭐', label: '10 partidas' },

    { id: 'games_100', emoji: '⭐', label: '100 partidas' },

    { id: 'choco_1000', emoji: '⭐', label: '1000 chocolates' },

    { id: 'days_100', emoji: '⭐', label: '100 días juntos' },

    { id: 'days_365', emoji: '⭐', label: '365 días' },

    { id: 'garden_50', emoji: '⭐', label: 'Jardín florecido' },

  ];



  global.HubShared = {

    DEFAULT_TASKS,

    DAILY_MISSION_DEFS,

    GARDEN_ACTIONS,

    STAR_DEFS,

    createDefaultHubData,

    todayDateKeyInTz,

    daysBetween,

    daysUntil,

  };

})(typeof window !== 'undefined' ? window : globalThis);


