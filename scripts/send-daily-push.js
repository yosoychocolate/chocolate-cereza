/**
 * Envia push diário lendo tokens do Firestore.
 * Roda no GitHub Actions — NÃO precisa de plano Blaze no Firebase.
 *
 * Secret necessário no GitHub: FIREBASE_SERVICE_ACCOUNT
 * (JSON da conta de serviço: Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada)
 */
const admin = require('firebase-admin');

const SITE_URL = 'https://yosoychocolate.github.io/chocolate-cereza/';
const TIMEZONE = 'America/New_York';

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

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('Falta FIREBASE_SERVICE_ACCOUNT (secret no GitHub).');
  }
  const cred = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

function getNyTimeParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = {};
  fmt.formatToParts(date).forEach((p) => {
    if (p.type !== 'literal') parts[p.type] = p.value;
  });
  return parts;
}

function resolveKind(forceKind, parts) {
  if (forceKind === 'main' || forceKind === 'nudge') return forceKind;
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const main = 20 * 60 + 30;
  const nudge = 21 * 60 + 30;
  if (mins >= main && mins < main + 15) return 'main';
  if (mins >= nudge && mins < nudge + 15) return 'nudge';
  return null;
}

async function disableBadToken(db, token) {
  const q = await db.collection('pushTokens').where('token', '==', token).limit(5).get();
  if (q.empty) return;
  const batch = db.batch();
  q.forEach((docSnap) => batch.update(docSnap.ref, { enabled: false }));
  await batch.commit();
}

function filterEntries(entries) {
  const forceDevice = (process.env.FORCE_DEVICE || '').trim().toLowerCase();
  const forceOrigin = (process.env.FORCE_ORIGIN || '').trim().toLowerCase();

  let filtered = entries;
  if (forceDevice === 'android') {
    filtered = filtered.filter((e) => /android/i.test(e.deviceLabel));
  }
  if (forceOrigin === 'github') {
    filtered = filtered.filter((e) => /github\.io/i.test(e.origin));
  }
  if (filtered.length !== entries.length) {
    console.log(`[push] Filtro: ${filtered.length}/${entries.length} tokens (device=${forceDevice || '*'}, origin=${forceOrigin || '*'})`);
  }
  return filtered;
}

async function sendDailyChargePush(kind) {
  const db = admin.firestore();
  const snap = await db.collection('pushTokens').where('enabled', '==', true).get();

  if (snap.empty) {
    console.log('[push] Nenhum token registrado.');
    return { sent: 0, total: 0, failed: 0, kind };
  }

  const entries = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const t = d.token;
    if (typeof t === 'string' && t.length > 20) {
      entries.push({
        token: t,
        deviceLabel: d.deviceLabel || '?',
        origin: d.origin || '?',
      });
    }
  });

  if (!entries.length) {
    console.log('[push] Nenhum token válido na coleção.');
    return { sent: 0, total: 0, failed: 0, kind };
  }

  const active = filterEntries(entries);
  if (!active.length) {
    console.log('[push] Nenhum token após filtro.');
    return { sent: 0, total: 0, failed: 0, kind };
  }

  active.forEach((e, idx) => {
    console.log(`[push] token ${idx}: ${e.deviceLabel} @ ${e.origin} (${e.token.slice(0, 10)}…)`);
  });

  const tokens = active.map((e) => e.token);

  const msg = MESSAGES[kind] || MESSAGES.main;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    // Só data — o service worker exibe a notificação (mais confiável com Chrome fechado no Android).
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      data: {
        type: kind === 'nudge' ? 'daily-charge-nudge' : 'daily-charge',
        title: msg.title,
        body: msg.body,
        icon: `${SITE_URL}assets/app-icon-192.png`,
        url: SITE_URL,
      },
      android: { priority: 'high' },
      webpush: {
        headers: { Urgency: 'high' },
        fcmOptions: { link: SITE_URL },
      },
    });

    sent += res.successCount;
    failed += res.failureCount;

    res.responses.forEach((r, idx) => {
      const meta = active[i + idx];
      if (r.success) {
        console.log(`[push] OK → ${meta?.deviceLabel || '?'} (${meta?.origin || '?'})`);
      } else {
        console.log(`[push] falha token ${i + idx} (${meta?.deviceLabel}):`, r.error?.code || r.error?.message || 'unknown');
      }
    });

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

async function main() {
  initAdmin();
  const parts = getNyTimeParts();
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const hm = `${parts.hour}:${parts.minute}`;
  const forceKind = (process.env.FORCE_KIND || '').trim();
  const kind = resolveKind(forceKind, parts);

  if (!kind) {
    console.log(`[push] Fora da janela (${TIMEZONE} ${hm}). Nada a enviar.`);
    return;
  }

  const db = admin.firestore();
  const logRef = db.doc(`pushSentLog/${dateKey}_${kind}`);

  if (!forceKind) {
    const log = await logRef.get();
    if (log.exists) {
      console.log(`[push] Já enviado hoje: ${dateKey} ${kind}`);
      return;
    }
  }

  const result = await sendDailyChargePush(kind);

  if (result.sent > 0 || result.total === 0) {
    await logRef.set({
      kind,
      dateKey,
      nyTime: hm,
      sent: result.sent,
      total: result.total,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(JSON.stringify({ ok: true, ...result, dateKey, nyTime: hm }));
}

main().catch((err) => {
  console.error('[push] Erro:', err);
  process.exit(1);
});
