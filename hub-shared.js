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



  const EVENT_TYPES = [

    { id: 'car', emoji: '🚗', label: 'Carro' },

    { id: 'work', emoji: '💼', label: 'Trabajo' },

    { id: 'birthday', emoji: '🎂', label: 'Cumpleaños' },

    { id: 'travel', emoji: '✈️', label: 'Viaje' },

    { id: 'play', emoji: '🎮', label: 'Jugar juntos' },

    { id: 'call', emoji: '💌', label: 'Llamada' },

    { id: 'date', emoji: '❤️', label: 'Encuentro' },

    { id: 'coffee', emoji: '☕', label: 'Café' },

  ];



  const REPEAT_OPTIONS = [

    { id: 'never', label: 'Nunca' },

    { id: 'daily', label: 'Todo día' },

    { id: 'weekly', label: 'Toda semana' },

    { id: 'monthly', label: 'Todo mes' },

  ];



  function normalizeHubEvent(ev) {

    if (!ev || typeof ev !== 'object') return null;

    const typeDef = EVENT_TYPES.find((t) => t.id === ev.eventType) || EVENT_TYPES.find((t) => t.emoji === ev.emoji) || EVENT_TYPES[6];

    return {

      id: ev.id || '',

      title: typeof ev.title === 'string' ? ev.title : '',

      date: typeof ev.date === 'string' ? ev.date : '',

      emoji: typeof ev.emoji === 'string' && ev.emoji ? ev.emoji : typeDef.emoji,

      eventType: typeof ev.eventType === 'string' ? ev.eventType : typeDef.id,

      note: typeof ev.note === 'string' ? ev.note : '',

      time: typeof ev.time === 'string' && ev.time ? ev.time.slice(0, 5) : '',

      remind: ev.remind !== false,

      repeat: ['never', 'daily', 'weekly', 'monthly'].includes(ev.repeat) ? ev.repeat : 'never',

      status: ev.status === 'pending' ? 'pending' : 'accepted',

      createdBy: typeof ev.createdBy === 'string' ? ev.createdBy : '',

      createdByPlayerId: typeof ev.createdByPlayerId === 'string' ? ev.createdByPlayerId : '',

      acceptedBy: typeof ev.acceptedBy === 'string' ? ev.acceptedBy : '',

      comments: Array.isArray(ev.comments) ? ev.comments.slice() : [],

      createdAt: typeof ev.createdAt === 'number' ? ev.createdAt : Date.now(),

    };

  }



  function parseDateKey(dateKey) {

    const d = new Date((dateKey || '') + 'T12:00:00');

    return Number.isNaN(d.getTime()) ? null : d;

  }



  function eventOccursOnDate(ev, dateKey) {

    ev = normalizeHubEvent(ev);

    if (!ev?.date || !dateKey) return false;

    const start = parseDateKey(ev.date);

    const target = parseDateKey(dateKey);

    if (!start || !target) return false;

    if (target < start && ev.repeat === 'never') return ev.date === dateKey;

    if (ev.repeat === 'never') return ev.date === dateKey;

    if (target < start) return false;

    if (ev.repeat === 'daily') return true;

    if (ev.repeat === 'weekly') return start.getDay() === target.getDay();

    if (ev.repeat === 'monthly') return start.getDate() === target.getDate();

    return ev.date === dateKey;

  }



  function formatEventTime(time24) {

    if (!time24) return '';

    const parts = time24.slice(0, 5).split(':');

    const h = Number(parts[0]);

    const m = parts[1] || '00';

    if (Number.isNaN(h)) return time24;

    const ampm = h >= 12 ? 'PM' : 'AM';

    const h12 = h % 12 || 12;

    return `${h12}:${m} ${ampm}`;

  }



  function eventMinutesOnDate(ev, dateKey, timezone) {

    ev = normalizeHubEvent(ev);

    if (!ev?.time || !eventOccursOnDate(ev, dateKey)) return null;

    timezone = timezone || 'America/New_York';

    const now = new Date();

    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });

    const parts = {};

    fmt.formatToParts(now).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });

    const nowMins = Number(parts.hour) * 60 + Number(parts.minute);

    const tp = ev.time.slice(0, 5).split(':');

    const targetMins = Number(tp[0]) * 60 + Number(tp[1] || 0);

    return { nowMins, targetMins, delta: targetMins - nowMins };

  }



  function getEventsForDate(events, dateKey) {

    return (events || []).map(normalizeHubEvent).filter((ev) => eventOccursOnDate(ev, dateKey));

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

    EVENT_TYPES,

    REPEAT_OPTIONS,

    normalizeHubEvent,

    eventOccursOnDate,

    formatEventTime,

    eventMinutesOnDate,

    getEventsForDate,

  };

})(typeof window !== 'undefined' ? window : globalThis);


