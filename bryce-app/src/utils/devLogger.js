/**
 * devLogger — stores timestamped scan generation logs in AsyncStorage.
 * No setup required. Works in tunnel mode, local mode, or any network.
 *
 * Logs are visible in the Dev tab → "Scan Logs" section.
 * Each entry includes timing, page/visual-aid counts, questions generated,
 * drop counts, and any error details.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@devlog_';
const MAX_ENTRIES    = 30;

let _logs      = [];         // in-memory cache, newest first
let _listeners = [];
let _hydrated  = false;

function notify() {
  _listeners.forEach(fn => fn([..._logs]));
}

async function hydrate() {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX)).sort().reverse();
    const pairs = await AsyncStorage.multiGet(logKeys.slice(0, MAX_ENTRIES));
    _logs = pairs
      .map(([, v]) => { try { return JSON.parse(v); } catch { return null; } })
      .filter(Boolean);
    notify();
  } catch {
    // non-fatal
  }
}

async function persist(log) {
  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${log.id}`, JSON.stringify(log));
    // Prune old entries so storage doesn't grow forever
    const keys = await AsyncStorage.getAllKeys();
    const logKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX)).sort();
    if (logKeys.length > MAX_ENTRIES) {
      await AsyncStorage.multiRemove(logKeys.slice(0, logKeys.length - MAX_ENTRIES));
    }
  } catch {
    // non-fatal
  }
}

export const devLogger = {
  /**
   * Call at the START of a generation run.
   * Returns a mutable session object; pass it to event() and finishScan().
   */
  startScan({ pageCount, questionCount, visualAidCount, totalRequested }) {
    hydrate(); // ensure in-memory cache is warm
    return {
      id:            Date.now(),
      startedAt:     new Date().toISOString(),
      pageCount,
      questionCount,
      visualAidCount,
      totalRequested,
      events:        [],
      result:        null,
      durationMs:    null,
    };
  },

  /**
   * Record a timestamped event on the session (mutates in place).
   * @param {string} label     — short label, e.g. 'api_call_start'
   * @param {object} [data]    — any extra key/value pairs
   */
  event(session, label, data = {}) {
    session.events.push({ elapsedMs: Date.now() - session.id, label, ...data });
  },

  /**
   * Finalise the session, save to AsyncStorage, and notify subscribers.
   */
  finishScan(session, {
    success,
    questionsGenerated,
    textGenerated,
    visualGenerated,
    droppedCount,
    error,
  } = {}) {
    session.durationMs = Date.now() - session.id;
    session.result = { success, questionsGenerated, textGenerated, visualGenerated, droppedCount: droppedCount ?? null, error: error ?? null };
    _logs = [session, ..._logs].slice(0, MAX_ENTRIES);
    notify();
    persist(session); // fire-and-forget
  },

  /** Subscribe to log updates (called immediately with current list). Returns unsubscribe fn. */
  subscribe(fn) {
    hydrate();
    _listeners.push(fn);
    fn([..._logs]);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  },

  getLogs() { return [..._logs]; },

  async clearAll() {
    _logs = [];
    notify();
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter(k => k.startsWith(STORAGE_PREFIX)));
    } catch {}
  },
};
