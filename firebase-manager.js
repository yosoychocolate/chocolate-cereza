/**
 * FirebaseManager — integração Firebase/Firestore (ES Module).
 * Etapa 1: apenas inicialização. Sem leitura/escrita no banco.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js';

/** @type {import('firebase/app').FirebaseApp | null} */
let app = null;

/** @type {import('firebase/firestore').Firestore | null} */
let db = null;

let ready = false;
/** @type {Error | null} */
let initError = null;

/**
 * Substitua pelos valores do Firebase Console:
 * Project settings → Your apps → SDK setup and configuration
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAPZrpeHjrNme6P_X7oEnnnTKsj0KPHP7E',
  authDomain: 'elchocolatelacereza.firebaseapp.com',
  projectId: 'elchocolatelacereza',
  storageBucket: 'elchocolatelacereza.firebasestorage.app',
  messagingSenderId: '587613496405',
  appId: '1:587613496405:web:d3cdf17a0156dac7f760dc',
};

const PLACEHOLDER_PATTERN = /^YOUR_/;

function isPlaceholder(value) {
  return typeof value !== 'string' || PLACEHOLDER_PATTERN.test(value);
}

/**
 * Verifica se a configuração Firebase foi preenchida.
 * @returns {boolean}
 */
export function isFirebaseConfigValid() {
  return (
    !isPlaceholder(firebaseConfig.apiKey) &&
    !isPlaceholder(firebaseConfig.projectId) &&
    !isPlaceholder(firebaseConfig.appId)
  );
}

/**
 * Inicializa Firebase App e Firestore (idempotente).
 * Não lê nem escreve dados — apenas estabelece a conexão.
 * @returns {{ app: import('firebase/app').FirebaseApp | null, db: import('firebase/firestore').Firestore | null }}
 */
export function initFirebase() {
  if (ready) {
    return { app, db };
  }

  if (!isFirebaseConfigValid()) {
    console.info(
      '[FirebaseManager] Configuração pendente — preencha firebaseConfig em firebase-manager.js.'
    );
    return { app: null, db: null };
  }

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    ready = true;
    initError = null;
    console.info('[FirebaseManager] Firebase e Firestore inicializados.');
    return { app, db };
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    app = null;
    db = null;
    ready = false;
    console.warn('[FirebaseManager] Falha ao inicializar:', initError);
    return { app: null, db: null };
  }
}

/** @returns {import('firebase/app').FirebaseApp | null} */
export function getFirebaseApp() {
  if (!ready) initFirebase();
  return app;
}

/** @returns {import('firebase/firestore').Firestore | null} */
export function getFirestoreDb() {
  if (!ready) initFirebase();
  return db;
}

/** @returns {boolean} */
export function isFirebaseReady() {
  return ready;
}

/** @returns {Error | null} */
export function getFirebaseInitError() {
  return initError;
}

export { app, db };

initFirebase();
