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
      tag: d.type || 'daily-charge-push',
      renotify: true,
      data: { url: targetUrl, ...d },
    },
  };
}

function showPushNotification(payload) {
  const { title, options } = buildNotificationOptions(payload);
  return self.registration.showNotification(title, options);
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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        if ('focus' in client) {
          if (data.type === 'dm' && data.friendId) {
            client.postMessage({
              type: 'social:open-dm',
              friendId: data.friendId,
              friendName: data.friendName || 'Amigo',
            });
          } else if (data.type === 'friend-request') {
            client.postMessage({ type: 'social:open-friend-requests' });
          } else if (data.type === 'room-invite') {
            client.postMessage({ type: 'social:open-invites' });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
