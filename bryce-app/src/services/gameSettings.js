import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@snapstudy_game_settings';

export async function getGameSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setGameEnabled(gameId, enabled) {
  try {
    const settings = await getGameSettings();
    settings[gameId] = { ...(settings[gameId] ?? {}), enabled };
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch { /* silent */ }
}

// Returns true if enabled (default: true when not set)
export async function isGameEnabled(gameId) {
  const settings = await getGameSettings();
  return settings[gameId]?.enabled !== false;
}

// Returns a map of { gameId: boolean } for all provided ids
export async function getEnabledMap(gameIds) {
  const settings = await getGameSettings();
  const map = {};
  for (const id of gameIds) {
    map[id] = settings[id]?.enabled !== false;
  }
  return map;
}
