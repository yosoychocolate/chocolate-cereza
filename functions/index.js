/**
 * Cloud Functions — push diário 20:30 e nudge 21:30 (America/New_York).
 *
 * Deploy (uma vez):
 *   npm install -g firebase-tools
 *   firebase login
 *   cd functions && npm install && cd ..
 *   firebase deploy --only functions
 *
 * Teste manual (após deploy):
 *   https://us-central1-elchocolatelacereza.cloudfunctions.net/testDailyChargePush?key=chocolate-test
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

const SITE_URL = 'https://yosoychocolate.github.io/chocolate-cereza/';
const TEST_KEY = 'chocolate-test';

const MESSAGES = {
  main: {
    title: '❤️ Chocolate & Cereza',
    body: 'Hora de poner el auto a cargar. El Chocolate te está esperando. 🔋🐻',
  },
  nudge: {
    title: '🐻 Chocolate & Cereza',
    body: 'El Chocolate sigue despierto esperándote. 🔋🥺',
  },
};

async function disableBadToken(db, token) {
  const q = await db.collection('pushTokens').where('token', '==', token).limit(5).get();
  const batch = db.batch();
  q.forEach((docSnap) => batch.update(docSnap.ref, { enabled: false }));
  if (!q.empty) await batch.commit();
}

async function sendDailyChargePush(kind) {
  const db = admin.firestore();
  const snap = await db.collection('pushTokens').where('enabled', '==', true).get();

  if (snap.empty) {
    console.log('[push] Nenhum token registrado.');
    return { sent: 0, total: 0, failed: 0 };
  }

  const tokens = [];
  snap.forEach((docSnap) => {
    const t = docSnap.data().token;
    if (typeof t === 'string' && t.length > 20) tokens.push(t);
  });

  const msg = MESSAGES[kind] || MESSAGES.main;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title: msg.title, body: msg.body },
      webpush: {
        fcmOptions: { link: SITE_URL },
        notification: {
          icon: `${SITE_URL}assets/chocolate.png`,
          badge: `${SITE_URL}assets/cherry.png`,
        },
      },
      data: { type: kind === 'nudge' ? 'daily-charge-nudge' : 'daily-charge' },
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

  console.log(`[push] ${kind}: ${sent}/${tokens.length} enviados, ${failed} falhas.`);
  return { sent, total: tokens.length, failed, kind };
}

async function sendPushToPlayer(playerId, payload) {
  if (!playerId && !payload.username) return { sent: 0, total: 0, failed: 0 };

  const db = admin.firestore();
  const tokenSet = new Map();

  function addFromSnap(snap) {
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.enabled === false) return;
      if (typeof d.token !== 'string' || d.token.length <= 20) return;
      tokenSet.set(d.token, d);
    });
  }

  if (playerId) {
    addFromSnap(await db.collection('pushTokens').where('playerId', '==', playerId).get());
  }

  const username = String(payload.username || '').trim().toLowerCase().replace(/^@+/, '');
  if (!tokenSet.size && username) {
    try {
      addFromSnap(await db.collection('pushTokens').where('username', '==', username).get());
    } catch (_) { /* ignore */ }
    if (!tokenSet.size) {
      const all = await db.collection('pushTokens').where('enabled', '==', true).get();
      all.forEach((docSnap) => {
        const d = docSnap.data();
        const u = String(d.username || '').toLowerCase().replace(/^@+/, '');
        if (u === username && typeof d.token === 'string' && d.token.length > 20) {
          tokenSet.set(d.token, d);
        }
      });
    }
  }

  const tokens = [...tokenSet.keys()];

  if (!tokens.length) {
    console.log(`[push] Nenhum token para player ${playerId ? playerId.slice(0, 8) + '…' : '?'}${username ? ` (@${username})` : ''}`);
    return { sent: 0, total: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      android: { priority: 'high', notification: { channelId: 'social', priority: 'high' } },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: payload.url || SITE_URL },
        notification: {
          icon: `${SITE_URL}assets/app-icon-192.png`,
          badge: `${SITE_URL}assets/cherry.png`,
        },
      },
      data: payload.data || {},
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

  console.log(`[push] → ${playerId.slice(0, 8)}…: ${sent}/${tokens.length} enviados (${payload.data?.type || 'generic'}).`);
  return { sent, total: tokens.length, failed };
}

function formatPushName(raw) {
  return String(raw || 'Alguien').replace(/^@+/, '').trim() || 'Alguien';
}

exports.dailyChargePush2030 = onSchedule(
  {
    schedule: '30 20 * * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async () => {
    await sendDailyChargePush('main');
  }
);

exports.dailyChargePush2130 = onSchedule(
  {
    schedule: '30 21 * * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async () => {
    await sendDailyChargePush('nudge');
  }
);

exports.testDailyChargePush = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    if (req.query.key !== TEST_KEY) {
      res.status(403).send('Forbidden');
      return;
    }
    const kind = req.query.kind === 'nudge' ? 'nudge' : 'main';
    try {
      const result = await sendDailyChargePush(kind);
      res.json({ ok: true, ...result });
    } catch (err) {
      console.error('[push] test error:', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  }
);

/** Push quando chega mensagem privada (Chrome fechado). */
exports.onGlobalDmPush = onDocumentCreated(
  {
    document: 'globalDm/{messageId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    const messageId = event.params?.messageId || '';
    if (!data?.toPlayerId || !data.fromPlayerId) return;
    if (data.pushNotified === true) return;

    const fromName = formatPushName(data.fromName);
    const preview = String(data.message || '').trim();
    if (!preview) return;

    const body = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
    const url = `${SITE_URL}jugar/#amigos`;
    const tag = `dm-${data.fromPlayerId}-${messageId}`;

    let targetUsername = '';
    try {
      const prof = await admin.firestore().doc(`playerProfiles/${data.toPlayerId}`).get();
      if (prof.exists) {
        targetUsername = String(prof.data()?.username || '').toLowerCase().replace(/^@+/, '');
      }
    } catch (_) { /* ignore */ }

    const result = await sendPushToPlayer(data.toPlayerId, {
      title: `💬 ${fromName}`,
      body,
      url,
      username: targetUsername,
      data: {
        type: 'dm',
        friendId: data.fromPlayerId,
        friendName: fromName,
        messageId,
        tag,
        url,
      },
    });

    if (result.sent > 0 && event.data?.ref) {
      await event.data.ref.update({
        pushNotified: true,
        pushNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

/** Push quando alguém envia pedido de amizade (celular com app fechado). */
exports.onFriendRequestPush = onDocumentCreated(
  {
    document: 'friendRequests/{targetPlayerId}/incoming/{fromPlayerId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    const { targetPlayerId, fromPlayerId } = event.params || {};
    if (!targetPlayerId || !fromPlayerId) return;
    if (data?.status && data.status !== 'pending') return;

    const fromName = formatPushName(data?.fromName);
    const pushKey = String(data?.pushKey || Date.now());
    let targetUsername = '';
    try {
      const prof = await admin.firestore().doc(`playerProfiles/${targetPlayerId}`).get();
      if (prof.exists) {
        targetUsername = String(prof.data()?.username || '').toLowerCase().replace(/^@+/, '');
      }
    } catch (_) { /* ignore */ }

    await sendPushToPlayer(targetPlayerId, {
      title: `👥 ${fromName}`,
      body: 'Te envió una solicitud de amistad',
      url: `${SITE_URL}jugar/#amigos`,
      username: targetUsername,
      data: {
        type: 'friend-request',
        fromPlayerId: data?.fromPlayerId || fromPlayerId,
        fromName,
        pushKey,
        tag: `friend-request-${fromPlayerId}-${pushKey}`,
        url: `${SITE_URL}jugar/#amigos`,
      },
    });
  }
);
