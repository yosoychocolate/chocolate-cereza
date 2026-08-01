/**
 * Config Firebase compartilhada (site + service worker).
 * A chave VAPID vem do Console Firebase → Configurações → Cloud Messaging → Par de chaves Web Push.
 */
(function (g) {
  g.FIREBASE_WEB_CONFIG = {
    apiKey: 'AIzaSyAPZrpeHjrNme6P_X7oEnnnTKsj0KPHP7E',
    authDomain: 'elchocolatelacereza.firebaseapp.com',
    projectId: 'elchocolatelacereza',
    storageBucket: 'elchocolatelacereza.firebasestorage.app',
    messagingSenderId: '587613496405',
    appId: '1:587613496405:web:d3cdf17a0156dac7f760dc',
  };

  /** Substitua pela chave pública Web Push do Firebase Console (começa com B...) */
  g.FIREBASE_VAPID_KEY = 'YOUR_VAPID_KEY_HERE';

  g.SITE_ORIGIN = 'https://yosoychocolate.github.io/chocolate-cereza';
})(typeof self !== 'undefined' ? self : globalThis);
