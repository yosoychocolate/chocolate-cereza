/**
 * Push de pedidos de amizade — GitHub Actions, plano Spark (grátis).
 * Verifica friendRequests a cada ~2 min e envia FCM ao destinatário.
 */
const { initAdmin, admin, SITE_URL, formatPushName, sendPushToPlayer } = require('./push-admin-common.js');

async function fetchTargetUsername(db, playerId) {
  if (!playerId) return '';
  try {
    const snap = await db.doc(`playerProfiles/${playerId}`).get();
    if (!snap.exists) return '';
    return String(snap.data()?.username || '').toLowerCase().replace(/^@+/, '');
  } catch (_) {
    return '';
  }
}

async function findPendingFriendRequests(db) {
  const root = await db.collection('friendRequests').get();
  const pending = [];

  for (const playerDoc of root.docs) {
    const targetPlayerId = playerDoc.id;
    const incoming = await playerDoc.ref.collection('incoming')
      .where('status', '==', 'pending')
      .get();

    incoming.forEach((docSnap) => {
      const data = docSnap.data();
      if (!needsFriendRequestPush(data)) return;
      pending.push({
        targetPlayerId,
        fromPlayerId: docSnap.id,
        ref: docSnap.ref,
        fromName: data.fromName || 'Alguien',
        pushKey: data.pushKey || '',
      });
    });
  }

  return pending;
}

function needsFriendRequestPush(data) {
  if (data.pushNotified !== true) return true;
  const pushKey = String(data.pushKey || '');
  const notifiedKey = String(data.pushNotifiedKey || '');
  if (pushKey && pushKey !== notifiedKey) return true;
  const created = data.createdAt?.toMillis?.() || 0;
  const notified = data.pushNotifiedAt?.toMillis?.() || 0;
  return created > notified + 500;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const pending = await findPendingFriendRequests(db);

  if (!pending.length) {
    console.log('[friend-push] Nenhum pedido pendente sem notificar.');
    console.log(JSON.stringify({ ok: true, checked: 0, sent: 0 }));
    return;
  }

  console.log(`[friend-push] ${pending.length} pedido(s) para notificar.`);

  let totalSent = 0;

  for (const req of pending) {
    const fromName = formatPushName(req.fromName);
    const targetUsername = await fetchTargetUsername(db, req.targetPlayerId);
    const pushKey = req.pushKey || String(Date.now());
    const tag = `friend-request-${req.fromPlayerId}-${pushKey}`;
    const result = await sendPushToPlayer(db, req.targetPlayerId, {
      title: `👥 ${fromName}`,
      body: 'Te envió una solicitud de amistad',
      username: targetUsername,
      url: `${SITE_URL}jugar/#amigos`,
      data: {
        type: 'friend-request',
        fromPlayerId: req.fromPlayerId,
        fromName,
        pushKey,
        tag,
        url: `${SITE_URL}jugar/#amigos`,
      },
    });

    if (result.sent > 0) {
      await req.ref.set({
        pushNotified: true,
        pushNotifiedKey: pushKey,
        pushNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      totalSent += result.sent;
    } else {
      console.log(`[friend-push] Aguardando token de push: ${req.targetPlayerId.slice(0, 8)}…`);
    }
  }

  console.log(JSON.stringify({ ok: true, checked: pending.length, sent: totalSent }));
}

main().catch((err) => {
  console.error('[friend-push] Erro:', err);
  process.exit(1);
});
