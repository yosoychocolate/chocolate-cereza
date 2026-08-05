/**
 * Utilidades compartilhadas — push FCM via GitHub Actions (plano Spark / gratuito).
 */
const admin = require('firebase-admin');

const SITE_URL = 'https://yosoychocolate.github.io/chocolate-cereza/';

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Falta FIREBASE_SERVICE_ACCOUNT (secret no GitHub).');
  }
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

function formatPushName(raw) {
  return String(raw || 'Alguien').replace(/^@+/, '').trim() || 'Alguien';
}

async function disableBadToken(db, token) {
  const q = await db.collection('pushTokens').where('token', '==', token).limit(5).get();
  if (q.empty) return;
  const batch = db.batch();
  q.forEach((docSnap) => batch.update(docSnap.ref, { enabled: false }));
  await batch.commit();
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ playerId?: string, username?: string }} target
 */
async function collectPushTokens(db, target = {}) {
  const playerId = String(target.playerId || '').trim();
  const username = String(target.username || '').trim().toLowerCase().replace(/^@+/, '');
  const tokenMap = new Map();

  function addFromSnap(snap) {
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.enabled === false) return;
      if (typeof d.token !== 'string' || d.token.length <= 20) return;
      tokenMap.set(d.token, d);
    });
  }

  if (playerId) {
    addFromSnap(await db.collection('pushTokens').where('playerId', '==', playerId).get());
  }

  if (!tokenMap.size && username) {
    try {
      addFromSnap(await db.collection('pushTokens').where('username', '==', username).get());
    } catch (_) { /* índice pode faltar — fallback abaixo */ }

    if (!tokenMap.size) {
      const all = await db.collection('pushTokens').where('enabled', '==', true).get();
      all.forEach((docSnap) => {
        const d = docSnap.data();
        const tokenUsername = String(d.username || '').toLowerCase().replace(/^@+/, '');
        if (tokenUsername && tokenUsername === username && typeof d.token === 'string' && d.token.length > 20) {
          tokenMap.set(d.token, d);
        }
      });
    }
  }

  return Array.from(tokenMap.keys());
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} playerId
 * @param {{ title: string, body: string, url?: string, data?: Record<string, string>, username?: string }} payload
 */
async function sendPushToPlayer(db, playerId, payload) {
  if (!playerId && !payload.username) return { sent: 0, total: 0, failed: 0 };

  const tokens = await collectPushTokens(db, {
    playerId,
    username: payload.username,
  });

  if (!tokens.length) {
    console.log(`[push] Sem token para ${playerId ? playerId.slice(0, 8) + '…' : '?'}${payload.username ? ` (@${payload.username})` : ''}`);
    return { sent: 0, total: 0, failed: 0 };
  }

  const url = payload.url || SITE_URL;
  const data = {
    type: payload.data?.type || 'generic',
    title: payload.title,
    body: payload.body,
    url,
    icon: `${SITE_URL}assets/app-icon-192.png`,
    ...payload.data,
  };

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title: payload.title, body: payload.body },
      data,
      android: { priority: 'high', notification: { channelId: 'social', priority: 'high' } },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: url },
        notification: {
          icon: `${SITE_URL}assets/app-icon-192.png`,
          badge: `${SITE_URL}assets/cherry.png`,
        },
      },
    });

    sent += res.successCount;
    failed += res.failureCount;

    await Promise.all(
      res.responses.map(async (r, idx) => {
        const code = r.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await disableBadToken(db, chunk[idx]);
        }
      })
    );
  }

  console.log(`[push] ${playerId.slice(0, 8)}…: ${sent}/${tokens.length} (${data.type})`);
  return { sent, total: tokens.length, failed };
}

module.exports = {
  admin,
  SITE_URL,
  initAdmin,
  formatPushName,
  collectPushTokens,
  sendPushToPlayer,
};
