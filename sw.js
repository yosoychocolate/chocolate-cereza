/**
 * Service Worker — push FCM (site fechado) + clique na notificação + cache mínimo.
 */
importScripts('firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging-compat.js');

const SW_ORIGIN = self.SITE_ORIGIN || self.location.origin;
const CACHE_SHELL = 'chocolate-shell-v1';
const SHELL_ASSETS = [
  'firebase-config.js',
  'assets/app-icon-192.png',
  'assets/cherry.png',
];

function shellUrl(path) {
  try {
    return new URL(path, self.registration.scope).href;
  } catch (_) {
    return `${SW_ORIGIN}/${path}`.replace(/([^:]\/)\/+/g, '$1');
  }
}

function buildNotificationOptions(payload) {
  const n = payload?.notification || {};
  const d = payload?.data || {};
  const title = n.title || d.title || '❤️ Chocolate & Cereza';
  const body = n.body || d.body || 'Hora de poner el auto a cargar. 🔋🐻';
  const targetUrl = d.url || SW_ORIGIN + '/';
  return {
    title,
    options: {
      body,
      icon: n.icon || d.icon || `${SW_ORIGIN}/assets/app-icon-192.png`,
      badge: `${SW_ORIGIN}/assets/cherry.png`,
      tag: d.tag || (d.type === 'dm' && d.friendId
        ? `dm-${d.friendId}-${d.messageId || d.pushKey || ''}`
        : (d.pushKey && d.fromPlayerId
          ? `friend-request-${d.fromPlayerId}-${d.pushKey}`
          : (d.type || 'daily-charge-push'))),
      renotify: true,
      data: { url: targetUrl, ...d },
    },
  };
}

function showPushNotification(payload) {
  const { title, options } = buildNotificationOptions(payload);
  return self.registration.showNotification(title, options);
}

function buildSocialMessage(data) {
  if (data.type === 'dm' && data.friendId) {
    return {
      type: 'social:open-dm',
      friendId: data.friendId,
      friendName: data.friendName || 'Amigo',
    };
  }
  if (data.type === 'friend-request') {
    return { type: 'social:open-friend-requests', fromPlayerId: data.fromPlayerId || '' };
  }
  if (data.type === 'room-invite') {
    return { type: 'social:open-invites', roomCode: data.roomCode || '' };
  }
  return null;
}

function normalizeUrl(url) {
  try {
    return new URL(url, SW_ORIGIN).href.replace(/\/$/, '');
  } catch (_) {
    return String(url || SW_ORIGIN);
  }
}

if (self.FIREBASE_WEB_CONFIG) {
  firebase.initializeApp(self.FIREBASE_WEB_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => showPushNotification(payload));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => (
      Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(shellUrl(asset))))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_SHELL).map((key) => caches.delete(key))
      )),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_SHELL);
        return cache.match(event.request)
          || cache.match(shellUrl('index.html'))
          || cache.match(shellUrl('./'));
      })
    );
  }
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'push:resubscribe' });
      });
    })
  );
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'push-health-check') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'push:resubscribe' });
      });
    })
  );
});

async function showScheduledNotification(payload) {
  const { eventId, title, body, timestamp, tag } = payload || {};
  if (!timestamp || timestamp <= Date.now()) return;

  const options = {
    body: body || 'Recordatorio del calendario',
    icon: `${SW_ORIGIN}/assets/app-icon-192.png`,
    badge: `${SW_ORIGIN}/assets/cherry.png`,
    tag: tag || `hub-event-${eventId}`,
    renotify: true,
    data: { url: SW_ORIGIN + '/', type: 'hub-event', eventId: eventId || '' },
  };

  try {
    if (typeof TimestampTrigger !== 'undefined') {
      options.showTrigger = new TimestampTrigger(timestamp);
      await self.registration.showNotification(title || 'El Chocolate & La Cereza ❤️', options);
      return;
    }
  } catch (err) {
    console.warn('[SW] TimestampTrigger no disponible:', err);
  }

  await self.registration.showNotification(title || 'El Chocolate & La Cereza ❤️', options);
}

async function cancelHubReminder(eventId) {
  const tag = `hub-event-${eventId}`;
  const list = await self.registration.getNotifications({ tag });
  list.forEach((n) => n.close());
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'schedule-hub-reminder') {
    event.waitUntil(showScheduledNotification(data.payload));
  }
  if (data.type === 'cancel-hub-reminder') {
    event.waitUntil(cancelHubReminder(data.eventId));
  }
  if (data.type === 'sync-hub-reminders') {
    event.waitUntil(
      Promise.all((data.events || []).map((payload) => showScheduledNotification(payload)))
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || SW_ORIGIN + '/';
  const socialMessage = buildSocialMessage(data);
  const targetNorm = normalizeUrl(targetUrl);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if (!('focus' in client)) continue;

        const clientNorm = normalizeUrl(client.url);
        if (clientNorm !== targetNorm && 'navigate' in client) {
          try {
            await client.navigate(targetUrl);
          } catch (_) { /* ignore */ }
        }

        if (socialMessage) {
          client.postMessage(socialMessage);
        }
        return client.focus();
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
