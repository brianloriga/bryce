import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncProgressToSupabase } from './supabase';

const LOCAL_KID_KEY = '@bryce_active_kid';
const LOCAL_SCORES_KEY = '@bryce_scores';

// ── Local storage ────────────────────────────────────────────

export async function saveActiveKid(kidId) {
  await AsyncStorage.setItem(LOCAL_KID_KEY, kidId);
}

export async function getActiveKid() {
  return AsyncStorage.getItem(LOCAL_KID_KEY);
}

export async function saveScoresLocally(scores) {
  await AsyncStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(scores));
}

export async function loadScoresLocally() {
  const raw = await AsyncStorage.getItem(LOCAL_SCORES_KEY);
  return raw ? JSON.parse(raw) : {};
}

// ── Bridge: parse raw bryceLearning localStorage value ───────
// The game stores: { math: { numberline: 7, tools: 5 }, reading: {...}, science: {...} }
// We flatten that into { numberline: 7, tools: 5, vocabulary: 3, ... }

export function flattenGameScores(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);
    const flat = {};
    for (const subject of Object.keys(parsed)) {
      const subjectScores = parsed[subject];
      if (subjectScores && typeof subjectScores === 'object') {
        for (const [gameKey, score] of Object.entries(subjectScores)) {
          if (typeof score === 'number') {
            flat[gameKey] = score;
          }
        }
      }
    }
    return flat;
  } catch {
    return {};
  }
}

// ── Main sync handler ─────────────────────────────────────────
// Called whenever the WebView sends a progress_update message.

export async function handleProgressUpdate(rawJson) {
  const scores = flattenGameScores(rawJson);
  if (Object.keys(scores).length === 0) return;

  // Always save locally first (works offline)
  await saveScoresLocally(scores);

  // Try to sync to Supabase (no-op if not logged in or offline)
  const kidId = await getActiveKid();
  if (!kidId) return;

  try {
    await syncProgressToSupabase(kidId, scores);
  } catch (err) {
    // Silently fail — will sync next time
    console.warn('[progressSync] Supabase sync failed:', err.message);
  }
}

// ── Build the bryceLearning localStorage value from cloud scores ──
// Used to pre-populate the WebView's localStorage when the kid logs in.

export function buildLocalStoragePayload(flatScores) {
  const subjects = { math: {}, reading: {}, science: {} };
  const mathGames = [
    'numberline','tools','ruler','convert',
    'readclock','elapsedtime','timeconvert','timeword',
    'countmoney','menumath','makechange','moneyword',
    'tenthmoreless','placevalue','decimalword','decimaltable',
    'lineplot','stemleaf','moderange','dataword',
  ];
  const readingGames = ['vocabulary','comprehension','textfeatures','chronology'];
  const scienceGames = ['constellation','moonphases','daynight','spacevocab'];

  for (const [key, score] of Object.entries(flatScores)) {
    if (mathGames.includes(key))    subjects.math[key]    = score;
    if (readingGames.includes(key)) subjects.reading[key] = score;
    if (scienceGames.includes(key)) subjects.science[key] = score;
  }
  return JSON.stringify(subjects);
}
