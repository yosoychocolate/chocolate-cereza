/**
 * CloudListener — listeners em tempo real da sala (onSnapshot).
 * Usado exclusivamente por cloud-manager.js.
 */
import {
  doc,
  collection,
  query,
  onSnapshot,
} from './firebase-manager.js';
import { profileRef, presenceRef } from './cloud-presence.js';
import { coupleRef, coupleFromSnapshot } from './cloud-couple.js';

const ROOMS_COLLECTION = 'rooms';
const PLAYERS_SUBCOLLECTION = 'players';
const DEBOUNCE_MS = 60;

/**
 * @typedef {Object} RoomUpdateEvent
 * @property {'room_updated' | 'room_removed' | 'couple_updated' | 'error'} type
 * @property {import('./cloud-presence.js').CloudPlayer[] | Array} [players]
 * @property {Object | null} [room]
 * @property {import('./cloud-couple.js').CoupleStats | null} [couple]
 * @property {number} timestamp
 * @property {string} [source]
 * @property {string} [message]
 */

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
function roomDocRef(db, roomCode) {
  return doc(db, ROOMS_COLLECTION, roomCode);
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} roomCode
 */
function playersCollectionRef(db, roomCode) {
  return collection(db, ROOMS_COLLECTION, roomCode, PLAYERS_SUBCOLLECTION);
}

/**
 * @param {(db: import('firebase/firestore').Firestore, roomCode: string) => Promise<Object | null>} fetchRoom
 */
export function createRoomListener(fetchRoom) {
  /** @type {Set<(event: RoomUpdateEvent) => void>} */
  const callbacks = new Set();

  /** @type {import('firebase/firestore').Unsubscribe[]} */
  const rootUnsubs = [];

  /** @type {Map<string, import('firebase/firestore').Unsubscribe[]>} */
  const playerUnsubs = new Map();

  /** @type {ReturnType<typeof setTimeout> | null} */
  let debounceTimer = null;

  /** @type {boolean} */
  let active = false;

  /** @type {string | null} */
  let activeRoomCode = null;

  /** @type {import('firebase/firestore').Firestore | null} */
  let activeDb = null;

  /** @type {boolean} */
  let refreshInFlight = false;

  /** @type {boolean} */
  let refreshQueued = false;

  /**
   * @param {RoomUpdateEvent} event
   */
  function emit(event) {
    callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[CloudListener] Erro no callback:', err);
      }
    });
  }

  /**
   * @param {Object | null} room
   * @param {string} [source]
   */
  function emitRoomUpdated(room, source) {
    emit({
      type: 'room_updated',
      room,
      players: room?.players ?? [],
      timestamp: Date.now(),
      source: source || 'snapshot',
    });
  }

  function clearPlayerListeners() {
    playerUnsubs.forEach((unsubs) => {
      unsubs.forEach((unsub) => unsub());
    });
    playerUnsubs.clear();
  }

  function clearRootListeners() {
    rootUnsubs.forEach((unsub) => unsub());
    rootUnsubs.length = 0;
  }

  async function refreshRoom(source) {
    if (!activeDb || !activeRoomCode) return null;

    if (refreshInFlight) {
      refreshQueued = true;
      return null;
    }

    refreshInFlight = true;
    try {
      const room = await fetchRoom(activeDb, activeRoomCode);
      if (room) {
        emitRoomUpdated(room, source);
      }
      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit({
        type: 'error',
        room: null,
        players: [],
        timestamp: Date.now(),
        message,
        source: source || 'snapshot',
      });
      return null;
    } finally {
      refreshInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        scheduleRefresh('queued');
      }
    }
  }

  function scheduleRefresh(source) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      refreshRoom(source);
    }, DEBOUNCE_MS);
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} roomCode
   * @param {string[]} playerIds
   */
  function syncPlayerDetailListeners(db, roomCode, playerIds) {
    const nextIds = new Set(playerIds);

    playerUnsubs.forEach((unsubs, playerId) => {
      if (!nextIds.has(playerId)) {
        unsubs.forEach((unsub) => unsub());
        playerUnsubs.delete(playerId);
      }
    });

    playerIds.forEach((playerId) => {
      if (playerUnsubs.has(playerId)) return;

      const profileUnsub = onSnapshot(
        profileRef(db, roomCode, playerId),
        () => scheduleRefresh(`profile:${playerId}`),
        (err) => console.warn('[CloudListener] profile error:', err)
      );

      const presenceUnsub = onSnapshot(
        presenceRef(db, roomCode, playerId),
        () => scheduleRefresh(`presence:${playerId}`),
        (err) => console.warn('[CloudListener] presence error:', err)
      );

      playerUnsubs.set(playerId, [profileUnsub, presenceUnsub]);
    });
  }

  /**
   * @param {import('firebase/firestore').Firestore} db
   * @param {string} roomCode
   */
  function start(db, roomCode) {
    if (active && activeRoomCode === roomCode) return;

    stop();

    activeDb = db;
    activeRoomCode = roomCode;
    active = true;

    const roomRef = roomDocRef(db, roomCode);
    const playersRef = query(playersCollectionRef(db, roomCode));

    const roomUnsub = onSnapshot(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          emit({
            type: 'room_removed',
            room: null,
            players: [],
            timestamp: Date.now(),
            source: 'room_doc',
          });
          stop();
          return;
        }
        scheduleRefresh('room_doc');
      },
      (err) => {
        emit({
          type: 'error',
          room: null,
          players: [],
          timestamp: Date.now(),
          message: err.message,
          source: 'room_doc',
        });
      }
    );

    const playersUnsub = onSnapshot(
      playersRef,
      (snap) => {
        const playerIds = snap.docs.map((d) => d.id);
        syncPlayerDetailListeners(db, roomCode, playerIds);
        scheduleRefresh('players_collection');
      },
      (err) => {
        emit({
          type: 'error',
          room: null,
          players: [],
          timestamp: Date.now(),
          message: err.message,
          source: 'players_collection',
        });
      }
    );

    const coupleUnsub = onSnapshot(
      coupleRef(db, roomCode),
      (snap) => {
        emit({
          type: 'couple_updated',
          couple: coupleFromSnapshot(snap),
          room: null,
          players: [],
          timestamp: Date.now(),
          source: 'couple_data',
        });
      },
      (err) => {
        emit({
          type: 'error',
          room: null,
          players: [],
          couple: null,
          timestamp: Date.now(),
          message: err.message,
          source: 'couple_data',
        });
      }
    );

    rootUnsubs.push(roomUnsub, playersUnsub, coupleUnsub);
    refreshRoom('initial');
  }

  function stop() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    clearRootListeners();
    clearPlayerListeners();
    active = false;
    activeRoomCode = null;
    activeDb = null;
    refreshInFlight = false;
    refreshQueued = false;
  }

  /**
   * @param {(event: RoomUpdateEvent) => void} callback
   * @returns {() => void}
   */
  function subscribe(callback) {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  /**
   * @param {(event: RoomUpdateEvent) => void} [callback]
   */
  function unsubscribe(callback) {
    if (callback) {
      callbacks.delete(callback);
      return;
    }
    callbacks.clear();
  }

  function isActive() {
    return active;
  }

  return {
    start,
    stop,
    subscribe,
    unsubscribe,
    isActive,
    refresh: refreshRoom,
  };
}
