/**
 * Push de pedidos de amizade — GitHub Actions, plano Spark (grátis).
 * Verifica friendRequests a cada ~2 min e envia FCM ao destinatário.
 */
const { initAdmin, admin, SITE_URL, formatPushName, sendPushToPlayer } = require('./push-admin-common.js');

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
      if (data.pushNotified === true) return;
      pending.push({
        targetPlayerId,
        fromPlayerId: docSnap.id,
        ref: docSnap.ref,
        fromName: data.fromName || 'Alguien',
      });
    });
  }

  return pending;
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
    const result = await sendPushToPlayer(db, req.targetPlayerId, {
      title: `👥 ${fromName}`,
      body: 'Te envió una solicitud de amistad',
      url: `${SITE_URL}jugar/`,
      data: {
        type: 'friend-request',
        fromPlayerId: req.fromPlayerId,
        fromName,
        url: `${SITE_URL}jugar/`,
      },
    });

    if (result.sent > 0) {
      await req.ref.set({
        pushNotified: true,
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
