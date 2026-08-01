/**

 * Service Worker — push FCM (site fechado) + clique na notificação.

 */

importScripts('firebase-config.js');

importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-app-compat.js');

importScripts('https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging-compat.js');



if (self.FIREBASE_WEB_CONFIG) {

  firebase.initializeApp(self.FIREBASE_WEB_CONFIG);

  const messaging = firebase.messaging();



  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    const title = n.title || d.title || '❤️ Chocolate & Cereza';
    const body = n.body || d.body || 'Hora de poner el auto a cargar. 🔋🐻';
    const origin = self.SITE_ORIGIN || self.location.origin;
    const targetUrl = d.url || origin + '/';

    return self.registration.showNotification(title, {
      body,
      icon: n.icon || d.icon || `${origin}/assets/app-icon-192.png`,
      badge: `${origin}/assets/cherry.png`,
      tag: d.type || 'daily-charge-push',
      renotify: true,
      requireInteraction: false,
      data: { url: targetUrl, ...(payload.data || {}) },
    });
  });
}



self.addEventListener('install', (event) => {

  self.skipWaiting();

});



self.addEventListener('activate', (event) => {

  event.waitUntil(self.clients.claim());

});



self.addEventListener('notificationclick', (event) => {

  event.notification.close();

  const targetUrl = event.notification.data?.url || self.SITE_ORIGIN || '/';

  event.waitUntil(

    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {

      for (let i = 0; i < clients.length; i++) {

        const client = clients[i];

        if ('focus' in client) {

          if ('navigate' in client && targetUrl) {

            return client.focus().then(() => client.navigate(targetUrl));

          }

          return client.focus();

        }

      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);

      return undefined;

    })

  );

});

