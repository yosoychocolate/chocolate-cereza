/**
 * Service Worker — push FCM (site fechado) + clique na notificação.
 */
importScripts('firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging-compat.js');

const SW_ORIGIN = self.SITE_ORIGIN || self.location.origin;

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

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
