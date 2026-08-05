/**
 * Push FCM — notificações com Chrome fechado (via Cloud Functions).
 */
import { getMessaging, getToken, isSupported, onMessage } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging.js';
import { getFirebaseApp, initFirebase, isFirebaseConfigValid } from './firebase-manager.js?v=__APP_VERSION__';
import { registerPushToken, disablePushToken } from './cloud-push.js?v=__APP_VERSION__';

function getServiceWorkerUrl() {
  if (typeof globalThis.assetUrl === 'function') {
    return globalThis.assetUrl('sw.js?v=__APP_VERSION__');
  }
  const path = location.pathname || '/';
  return path.includes('/jugar') ? '../sw.js?v=__APP_VERSION__' : 'sw.js?v=__APP_VERSION__';
}

/** @type {import('firebase/messaging').Messaging | null} */
let messaging = null;
/** @type {string | null} */
let currentToken = null;
/** @type {{ subscribed: boolean, remote: boolean, reason: string | null }} */
let status = { subscribed: false, remote: false, reason: null };

function getVapidKey() {
  const key = globalThis.FIREBASE_VAPID_KEY;
  if (typeof key !== 'string' || !key || key.startsWith('YOUR_')) return '';
  return key;
}

function getDeviceMeta() {
  const ua = navigator.userAgent || '';
  let deviceLabel = 'desktop';
  if (/Android/i.test(ua)) deviceLabel = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) deviceLabel = 'iPhone';
  return {
    deviceLabel,
    origin: location.origin,
  };
}

async function showLocalTestNotification() {
  if (Notification.permission !== 'granted') return;
  const title = '✅ Chocolate & Cereza';
  const body = 'Si ves esto, el service worker puede avisarte con Chrome cerrado. 🔋🐻';
  const opts = {
    body,
    icon: 'assets/app-icon-192.png',
    badge: 'assets/cherry.png',
    tag: 'push-local-test',
    renotify: true,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, opts);
      return;
    }
  } catch (_) { /* fallback */ }
  try {
    new Notification(title, opts);
  } catch (_) { /* ignore */ }
}

function getReminderMeta() {
  const hub = globalThis.CoupleHub?.getChargeReminderSettings?.();
  return {
    timezone: hub?.timezone || 'America/New_York',
    reminderTime: hub?.time || '20:30',
  };
}

function isProductionSite() {
  return /github\.io/i.test(location.hostname);
}

export function getPushStatus() {
  return { ...status, token: currentToken ? `${currentToken.slice(0, 12)}…` : null };
}

async function ensureMessaging() {
  if (!(await isSupported())) {
    status.reason = 'unsupported';
    return null;
  }
  if (!isFirebaseConfigValid()) {
    status.reason = 'firebase_config';
    return null;
  }
  initFirebase();
  const app = getFirebaseApp();
  if (!app) {
    status.reason = 'no_app';
    return null;
  }
  if (!messaging) {
    messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      const data = payload.data || {};
      const title = payload.notification?.title || data.title || 'Chocolate & Cereza';
      const body = payload.notification?.body || data.body || '';
      const tag = data.tag
        || (data.type === 'dm' && data.friendId
          ? `dm-${data.friendId}-${data.messageId || ''}`
          : (data.type || 'daily-charge-push-fg'));
      if (Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body,
            icon: payload.notification?.icon || 'assets/app-icon-192.png',
            tag,
            data,
          });
          n.onclick = () => {
            window.focus();
            globalThis.handleSocialPushAction?.(data);
            n.close();
          };
        } catch (_) { /* ignore */ }
      }
      globalThis.DailyChargeMission?.updateIntroNotificationButton?.();
    });
  }
  return messaging;
}

export async function subscribePush() {
  status = { subscribed: false, remote: false, reason: null };

  if (!globalThis.isSecureContext) {
    status.reason = 'insecure_context';
    return status;
  }

  if (globalThis.IosPushGuide?.needsHomeScreenInstall?.()) {
    status.reason = 'ios_needs_install';
    return status;
  }

  if (!('Notification' in globalThis) || Notification.permission !== 'granted') {
    status.reason = 'permission';
    return status;
  }

  const vapidKey = getVapidKey();
  if (!vapidKey) {
    status.reason = 'vapid_missing';
    console.warn('[Push] Cole FIREBASE_VAPID_KEY em firebase-config.js (Firebase Console → Cloud Messaging).');
    return status;
  }

  const msg = await ensureMessaging();
  if (!msg) return status;

  try {
    const oldToken = localStorage.getItem('ChocolateCerezaPushToken');
    if (oldToken && oldToken !== currentToken) {
      await disablePushToken(oldToken);
    }

    const reg = await navigator.serviceWorker.register(getServiceWorkerUrl());
    await reg.update();
    await navigator.serviceWorker.ready;

    const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: reg });
    if (!token) {
      status.reason = 'no_token';
      return status;
    }

    currentToken = token;
    const saved = await registerPushToken(token, {
      ...getReminderMeta(),
      ...getDeviceMeta(),
    });
    status.subscribed = true;
    status.remote = saved.ok === true;
    status.reason = saved.ok ? null : saved.reason || 'save_failed';
    status.device = getDeviceMeta().deviceLabel;
    status.origin = getDeviceMeta().origin;

    if (saved.ok) await showLocalTestNotification();

    globalThis.DailyChargeMission?.updateIntroNotificationButton?.();

    try {
      localStorage.setItem('ChocolateCerezaPushToken', token);
    } catch (_) { /* ignore */ }

    return status;
  } catch (err) {
    console.warn('[Push] subscribe:', err);
    status.reason = 'subscribe_failed';
    return status;
  }
}

export async function unsubscribePush() {
  const token = currentToken || localStorage.getItem('ChocolateCerezaPushToken');
  if (token) await disablePushToken(token);
  currentToken = null;
  status = { subscribed: false, remote: false, reason: 'disabled' };
  try {
    localStorage.removeItem('ChocolateCerezaPushToken');
  } catch (_) { /* ignore */ }
  return status;
}

async function autoSubscribeIfGranted() {
  if (globalThis.IosPushGuide?.needsHomeScreenInstall?.()) return;
  if (Notification.permission !== 'granted') return;
  await subscribePush();
  globalThis.DailyChargeMission?.updateIntroNotificationButton?.();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') autoSubscribeIfGranted();
});

globalThis.addEventListener('focus', () => autoSubscribeIfGranted());

globalThis.PushNotifications = {
  subscribe: subscribePush,
  unsubscribe: unsubscribePush,
  getStatus: getPushStatus,
  isRemoteReady: () => Boolean(getVapidKey()) && isFirebaseConfigValid(),
};

autoSubscribeIfGranted();
