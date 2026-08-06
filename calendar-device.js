/**
 * Calendario del dispositivo — ICS, Google Calendar y alarmas locales (PWA).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ChocolateCerezaCalendarReminders';

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function eventStartDate(event) {
    const date = event.date || '';
    const time = (event.time || '09:00').slice(0, 5);
    if (!date) return null;
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function toIcsUtc(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  }

  function toGoogleDate(date) {
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
  }

  function repeatRule(repeat) {
    if (repeat === 'daily') return 'RRULE:FREQ=DAILY';
    if (repeat === 'weekly') return 'RRULE:FREQ=WEEKLY';
    if (repeat === 'monthly') return 'RRULE:FREQ=MONTHLY';
    return '';
  }

  function notifyBody(event) {
    if (event.eventType === 'car' || /cargar|coche|auto|carro/i.test(event.title || '')) {
      return 'No olvides poner el coche a cargar. 🔋🐻';
    }
    return `${event.emoji || '❤️'} ${event.title || 'Recordatorio'}`;
  }

  function buildIcs(event, timezone) {
    const start = eventStartDate(event);
    if (!start) return '';
    const end = new Date(start.getTime() + 30 * 60000);
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    const uid = `chocolate-cereza-${event.id || Date.now()}@github.io`;
    const summary = `${event.emoji || ''} ${event.title || 'Evento'}`.trim();
    const rrule = repeatRule(event.repeat);
    const localStamp = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
    const localEnd = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//El Chocolate & La Cereza//Calendar//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART;TZID=${tz}:${localStamp}`,
      `DTEND;TZID=${tz}:${localEnd}`,
      `SUMMARY:${summary.replace(/[,\\;]/g, ' ')}`,
      `DESCRIPTION:${notifyBody(event).replace(/\n/g, '\\n')}`,
    ];
    if (rrule) lines.push(rrule);
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
  }

  function buildGoogleCalendarUrl(event, timezone) {
    const start = eventStartDate(event);
    if (!start) return '';
    const end = new Date(start.getTime() + 30 * 60000);
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${event.emoji || '❤️'} ${event.title || 'Evento'}`,
      dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
      details: notifyBody(event),
      ctz: tz,
    });
    if (event.repeat === 'daily') params.set('recur', 'RRULE:FREQ=DAILY');
    if (event.repeat === 'weekly') params.set('recur', 'RRULE:FREQ=WEEKLY');
    if (event.repeat === 'monthly') params.set('recur', 'RRULE:FREQ=MONTHLY');
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadIcs(event, timezone) {
    const ics = buildIcs(event, timezone);
    if (!ics) return false;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chocolate-cereza-${(event.title || 'evento').slice(0, 24).replace(/\s+/g, '-')}.ics`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  function openGoogleCalendar(event, timezone) {
    const url = buildGoogleCalendarUrl(event, timezone);
    if (!url) return false;
    const win = global.open(url, '_blank', 'noopener,noreferrer');
    return !!win;
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveStored(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (_) { /* ignore */ }
  }

  async function ensureNotificationPermission() {
    if (!('Notification' in global)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch (_) {
      return false;
    }
  }

  async function getSwRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        const swUrl = typeof global.assetUrl === 'function'
          ? global.assetUrl('sw.js?v=__APP_VERSION__')
          : 'sw.js?v=__APP_VERSION__';
        reg = await navigator.serviceWorker.register(swUrl, { scope: './' });
      }
      return reg.active ? reg : await navigator.serviceWorker.ready;
    } catch (_) {
      return null;
    }
  }

  async function scheduleSwReminder(event, timezone) {
    const start = eventStartDate(event);
    if (!start || !event.id) return { ok: false, reason: 'invalid' };
    const timestamp = start.getTime();
    if (timestamp <= Date.now()) return { ok: false, reason: 'past' };

    const reg = await getSwRegistration();
    if (!reg?.active) return { ok: false, reason: 'no_sw' };

    reg.active.postMessage({
      type: 'schedule-hub-reminder',
      payload: {
        eventId: event.id,
        title: 'El Chocolate & La Cereza ❤️',
        body: notifyBody(event),
        timestamp,
        tag: `hub-event-${event.id}`,
      },
    });

    const stored = loadStored();
    stored[event.id] = { timestamp, title: event.title, date: event.date, time: event.time };
    saveStored(stored);
    return { ok: true, method: 'sw' };
  }

  async function cancelSwReminder(eventId) {
    const reg = await getSwRegistration();
    reg?.active?.postMessage({ type: 'cancel-hub-reminder', eventId });
    const stored = loadStored();
    delete stored[eventId];
    saveStored(stored);
  }

  async function syncAllReminders(events, timezone) {
    const list = (events || []).filter((ev) => ev.remind !== false && ev.time && ev.date);
    const reg = await getSwRegistration();
    reg?.active?.postMessage({
      type: 'sync-hub-reminders',
      events: list.map((ev) => ({
        eventId: ev.id,
        title: 'El Chocolate & La Cereza ❤️',
        body: notifyBody(ev),
        timestamp: eventStartDate(ev)?.getTime(),
        tag: `hub-event-${ev.id}`,
      })).filter((x) => x.timestamp && x.timestamp > Date.now()),
    });
  }

  /**
   * Instala recordatorio en el teléfono: calendario nativo + alarma PWA.
   * @returns {Promise<{ calendar: boolean, notification: boolean, method: string }>}
   */
  async function installReminder(event, timezone) {
    timezone = timezone || 'America/New_York';
    const result = { calendar: false, notification: false, method: '' };

    if (isIOS()) {
      result.calendar = downloadIcs(event, timezone);
      result.method = 'ics-ios';
    } else if (isAndroid()) {
      result.calendar = openGoogleCalendar(event, timezone);
      if (!result.calendar) result.calendar = downloadIcs(event, timezone);
      result.method = result.calendar ? 'google-android' : 'ics-android';
    } else {
      result.calendar = openGoogleCalendar(event, timezone) || downloadIcs(event, timezone);
      result.method = 'google-desktop';
    }

    const permitted = await ensureNotificationPermission();
    if (permitted) {
      const sw = await scheduleSwReminder(event, timezone);
      result.notification = sw.ok;
      if (sw.ok) result.method += '+sw';
    }

    return result;
  }

  global.CalendarDevice = {
    installReminder,
    cancelSwReminder,
    syncAllReminders,
    downloadIcs,
    openGoogleCalendar,
    buildGoogleCalendarUrl,
    ensureNotificationPermission,
    notifyBody,
  };
})(typeof window !== 'undefined' ? window : globalThis);
