/**
 * CloudHub — agenda, calendário, cartinhas e memórias sincronizados na sala.
 * rooms/{code}/hub/data + subcoleções hubTasks, hubEvents, hubLetters, hubMemories
 *
 * hub-shared.js é script clássico (window.HubShared) — não usar import ES module.
 */
const HS = globalThis.HubShared || {};

const DEFAULT_TASKS = HS.DEFAULT_TASKS || [
  { text: 'Cargar el auto', emoji: '🔋' },
  { text: 'Comprar café', emoji: '☕' },
  { text: 'Comprar chocolate', emoji: '🍫' },
];

const DAILY_MISSION_DEFS = HS.DAILY_MISSION_DEFS || [
  { id: 'charge_car', text: 'Cargar el auto', emoji: '🔋', reward: 5 },
  { id: 'play_game', text: 'Jugar una partida', emoji: '🎮', reward: 3 },
  { id: 'send_photo', text: 'Enviar una foto', emoji: '📸', reward: 4 },
  { id: 'listen_music', text: 'Escuchar nuestra canción', emoji: '🎵', reward: 2 },
];

const createDefaultHubData = HS.createDefaultHubData || function createDefaultHubDataFallback() {
  return {
    relationshipStart: null,
    nextMeetingDate: null,
    chargeReminder: { enabled: true, time: '20:30', timezone: 'America/New_York' },
    dailyMissions: { dateKey: '', completed: [] },
    updatedAt: null,
  };
};

const todayDateKeyInTz = HS.todayDateKeyInTz || function todayDateKeyInTzFallback(timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/New_York' }).format(new Date());
};

const daysBetween = HS.daysBetween || function daysBetweenFallback(fromIso, toDate) {
  if (!fromIso) return null;
  const start = new Date(fromIso + 'T12:00:00');
  if (Number.isNaN(start.getTime())) return null;
  const diff = (toDate || new Date()).getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

const daysUntil = HS.daysUntil || function daysUntilFallback(isoDate, fromDate) {
  if (!isoDate) return null;
  const target = new Date(isoDate + 'T12:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - (fromDate || new Date()).getTime();
  return Math.ceil(diff / 86400000);
};

export {
  DEFAULT_TASKS,
  DAILY_MISSION_DEFS,
  createDefaultHubData,
  todayDateKeyInTz,
  daysBetween,
  daysUntil,
};

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from './firebase-manager.js?v=__APP_VERSION__';

const ROOMS = 'rooms';
const HUB = 'hub';
const HUB_DATA_ID = 'data';
const TASKS = 'hubTasks';
const EVENTS = 'hubEvents';
const LETTERS = 'hubLetters';
const MEMORIES = 'hubMemories';

export function hubDataRef(db, roomCode) {
  return doc(db, ROOMS, roomCode, HUB, HUB_DATA_ID);
}

export function hubTasksRef(db, roomCode) {
  return collection(db, ROOMS, roomCode, TASKS);
}

export function hubEventsRef(db, roomCode) {
  return collection(db, ROOMS, roomCode, EVENTS);
}

export function hubLettersRef(db, roomCode) {
  return collection(db, ROOMS, roomCode, LETTERS);
}

export function hubMemoriesRef(db, roomCode) {
  return collection(db, ROOMS, roomCode, MEMORIES);
}

export function hubDataFromSnap(snap) {
  const base = createDefaultHubData();
  if (!snap.exists()) return base;
  const d = snap.data() || {};
  const cr = d.chargeReminder || {};
  const dm = d.dailyMissions || {};
  return {
    relationshipStart: typeof d.relationshipStart === 'string' ? d.relationshipStart : null,
    nextMeetingDate: typeof d.nextMeetingDate === 'string' ? d.nextMeetingDate : null,
    chargeReminder: {
      enabled: cr.enabled !== false,
      time: typeof cr.time === 'string' ? cr.time : '20:30',
      timezone: typeof cr.timezone === 'string' ? cr.timezone : 'America/New_York',
    },
    dailyMissions: {
      dateKey: typeof dm.dateKey === 'string' ? dm.dateKey : '',
      completed: Array.isArray(dm.completed) ? dm.completed.filter((x) => typeof x === 'string') : [],
    },
    updatedAt: d.updatedAt?.toMillis?.() ?? null,
  };
}

function mapTaskDoc(id, data) {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    emoji: typeof data.emoji === 'string' ? data.emoji : '✓',
    done: data.done === true,
    doneBy: typeof data.doneBy === 'string' ? data.doneBy : null,
    order: typeof data.order === 'number' ? data.order : 0,
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

function mapEventDoc(id, data) {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    date: typeof data.date === 'string' ? data.date : '',
    emoji: typeof data.emoji === 'string' ? data.emoji : '❤️',
    note: typeof data.note === 'string' ? data.note : '',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

function mapLetterDoc(id, data) {
  return {
    id,
    fromPlayerId: typeof data.fromPlayerId === 'string' ? data.fromPlayerId : '',
    fromName: typeof data.fromName === 'string' ? data.fromName : '',
    text: typeof data.text === 'string' ? data.text : '',
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

function mapMemoryDoc(id, data) {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

export async function ensureHubInitialized(db, roomCode) {
  const ref = hubDataRef(db, roomCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...createDefaultHubData(), updatedAt: serverTimestamp() });
  }

  const tasksSnap = await getDocs(hubTasksRef(db, roomCode));
  if (tasksSnap.empty) {
    for (let i = 0; i < DEFAULT_TASKS.length; i++) {
      const t = DEFAULT_TASKS[i];
      await addDoc(hubTasksRef(db, roomCode), {
        text: t.text,
        emoji: t.emoji,
        done: false,
        doneBy: null,
        order: i,
        createdAt: serverTimestamp(),
      });
    }
  }
}

export async function fetchHubSnapshot(db, roomCode) {
  const [dataSnap, tasksSnap, eventsSnap, lettersSnap, memoriesSnap] = await Promise.all([
    getDoc(hubDataRef(db, roomCode)),
    getDocs(query(hubTasksRef(db, roomCode), orderBy('order', 'asc'))),
    getDocs(query(hubEventsRef(db, roomCode), orderBy('date', 'asc'))),
    getDocs(query(hubLettersRef(db, roomCode), orderBy('createdAt', 'desc'))),
    getDocs(query(hubMemoriesRef(db, roomCode), orderBy('createdAt', 'desc'))),
  ]);

  return {
    settings: hubDataFromSnap(dataSnap),
    tasks: tasksSnap.docs.map((d) => mapTaskDoc(d.id, d.data())),
    events: eventsSnap.docs.map((d) => mapEventDoc(d.id, d.data())),
    letters: lettersSnap.docs.map((d) => mapLetterDoc(d.id, d.data())),
    memories: memoriesSnap.docs.map((d) => mapMemoryDoc(d.id, d.data())),
  };
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 * @param {(payload: object) => void} callback
 */
export function subscribeHub(db, roomCode, callback) {
  const unsubs = [];

  const emit = async () => {
    try {
      const snap = await fetchHubSnapshot(db, roomCode);
      callback({ type: 'hub_updated', ...snap, timestamp: Date.now() });
    } catch (err) {
      callback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      });
    }
  };

  unsubs.push(onSnapshot(hubDataRef(db, roomCode), emit));
  unsubs.push(onSnapshot(hubTasksRef(db, roomCode), emit));
  unsubs.push(onSnapshot(hubEventsRef(db, roomCode), emit));
  unsubs.push(onSnapshot(hubLettersRef(db, roomCode), emit));
  unsubs.push(onSnapshot(hubMemoriesRef(db, roomCode), emit));

  emit();

  return () => unsubs.forEach((u) => u());
}

export async function updateHubSettings(db, roomCode, partial) {
  await setDoc(
    hubDataRef(db, roomCode),
    { ...partial, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function addHubTask(db, roomCode, task) {
  const ref = await addDoc(hubTasksRef(db, roomCode), {
    text: task.text || '',
    emoji: task.emoji || '✓',
    done: false,
    doneBy: null,
    order: typeof task.order === 'number' ? task.order : Date.now(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleHubTask(db, roomCode, taskId, done, doneBy) {
  await updateDoc(doc(db, ROOMS, roomCode, TASKS, taskId), {
    done: !!done,
    doneBy: done ? doneBy : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteHubTask(db, roomCode, taskId) {
  await deleteDoc(doc(db, ROOMS, roomCode, TASKS, taskId));
}

export async function addHubEvent(db, roomCode, event, playerName) {
  const ref = await addDoc(hubEventsRef(db, roomCode), {
    title: event.title || '',
    date: event.date || '',
    emoji: event.emoji || '❤️',
    note: event.note || '',
    createdBy: playerName || '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateHubEvent(db, roomCode, eventId, partial) {
  await updateDoc(doc(db, ROOMS, roomCode, EVENTS, eventId), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteHubEvent(db, roomCode, eventId) {
  await deleteDoc(doc(db, ROOMS, roomCode, EVENTS, eventId));
}

export async function addHubLetter(db, roomCode, letter) {
  const ref = await addDoc(hubLettersRef(db, roomCode), {
    fromPlayerId: letter.fromPlayerId || '',
    fromName: letter.fromName || '',
    text: letter.text || '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function addHubMemory(db, roomCode, memory) {
  const ref = await addDoc(hubMemoriesRef(db, roomCode), {
    title: memory.title || '',
    imageUrl: memory.imageUrl || '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteHubMemory(db, roomCode, memoryId) {
  await deleteDoc(doc(db, ROOMS, roomCode, MEMORIES, memoryId));
}

export async function completeHubDailyMission(db, roomCode, dateKey, missionId, currentSettings) {
  const dm = currentSettings.dailyMissions || { dateKey: '', completed: [] };
  let completed = dm.dateKey === dateKey ? [...(dm.completed || [])] : [];
  if (completed.includes(missionId)) return completed;
  completed.push(missionId);
  await updateHubSettings(db, roomCode, {
    dailyMissions: { dateKey, completed },
  });
  return completed;
}
