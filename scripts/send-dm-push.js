/**
 * Push de mensagens privadas — GitHub Actions, plano Spark (grátis).
 * Envia FCM quando chega DM e o app está fechado (service worker acorda só na entrega).
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

function needsDmPush(data) {
  if (data.pushNotified !== true) return true;
  const created = data.createdAt?.toMillis?.() || 0;
  const notified = data.pushNotifiedAt?.toMillis?.() || 0;
  return created > notified + 500;
}

async function findPendingDms(db) {
  const snap = await db.collection('globalDm')
    .where('pushNotified', '==', false)
    .limit(100)
    .get();

  const pending = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (!needsDmPush(data)) return;
    if (!data.toPlayerId || !data.fromPlayerId) return;
    const preview = String(data.message || '').trim();
    if (!preview) return;
    pending.push({
      id: docSnap.id,
      ref: docSnap.ref,
      toPlayerId: data.toPlayerId,
      fromPlayerId: data.fromPlayerId,
      fromName: data.fromName || 'Alguien',
      message: preview,
      createdAt: data.createdAt?.toMillis?.() || 0,
    });
  });

  pending.sort((a, b) => a.createdAt - b.createdAt);
  return pending;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const pending = await findPendingDms(db);

  if (!pending.length) {
    console.log('[dm-push] Nenhuma mensagem pendente sem notificar.');
    console.log(JSON.stringify({ ok: true, checked: 0, sent: 0 }));
    return;
  }

  console.log(`[dm-push] ${pending.length} mensagem(ns) para notificar.`);

  let totalSent = 0;

  for (const dm of pending) {
    const fromName = formatPushName(dm.fromName);
    const body = dm.message.length > 120 ? `${dm.message.slice(0, 117)}…` : dm.message;
    const targetUsername = await fetchTargetUsername(db, dm.toPlayerId);
    const tag = `dm-${dm.fromPlayerId}-${dm.id}`;
    const url = `${SITE_URL}jugar/#amigos`;

    const result = await sendPushToPlayer(db, dm.toPlayerId, {
      title: `💬 ${fromName}`,
      body,
      username: targetUsername,
      url,
      data: {
        type: 'dm',
        friendId: dm.fromPlayerId,
        friendName: fromName,
        messageId: dm.id,
        tag,
        url,
      },
    });

    if (result.sent > 0) {
      await dm.ref.set({
        pushNotified: true,
        pushNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      totalSent += result.sent;
    } else {
      console.log(`[dm-push] Aguardando token de push: ${dm.toPlayerId.slice(0, 8)}…`);
    }
  }

  console.log(JSON.stringify({ ok: true, checked: pending.length, sent: totalSent }));
}

main().catch((err) => {
  console.error('[dm-push] Erro:', err);
  process.exit(1);
});
