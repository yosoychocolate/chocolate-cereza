/**
 * Dados compartilhados da Central do Casal (sem Firebase).
 */
(function (global) {
  'use strict';

  const DEFAULT_TASKS = [
    { text: 'Carregar o carro', emoji: '🔋' },
    { text: 'Comprar café', emoji: '☕' },
    { text: 'Comprar chocolate', emoji: '🍫' },
    { text: 'Ligar para mamãe', emoji: '📞' },
    { text: 'Ir ao mercado', emoji: '🛒' },
  ];

  const DAILY_MISSION_DEFS = [
    { id: 'charge_car', text: 'Carregar o carro', emoji: '🔋', reward: 5 },
    { id: 'play_game', text: 'Jogar uma partida', emoji: '🎮', reward: 3 },
    { id: 'send_photo', text: 'Enviar uma foto', emoji: '📸', reward: 4 },
    { id: 'listen_music', text: 'Ouvir nossa música', emoji: '🎵', reward: 2 },
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
    visit: { emoji: '🌸', label: 'Entrou hoje' },
    letter: { emoji: '🌹', label: 'Enviou carta' },
    game: { emoji: '🌻', label: 'Jogou' },
    music: { emoji: '🌷', label: 'Ouvir música' },
    together: { emoji: '💐', label: 'Os dois online' },
    task: { emoji: '🌺', label: 'Tarefa concluída' },
  };

  const STAR_DEFS = [
    { id: 'first_letter', emoji: '⭐', label: 'Primeira cartinha' },
    { id: 'games_10', emoji: '⭐', label: '10 partidas' },
    { id: 'games_100', emoji: '⭐', label: '100 partidas' },
    { id: 'choco_1000', emoji: '⭐', label: '1000 chocolates' },
    { id: 'days_100', emoji: '⭐', label: '100 dias juntos' },
    { id: 'days_365', emoji: '⭐', label: '365 dias' },
    { id: 'garden_50', emoji: '⭐', label: 'Jardim florido' },
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
