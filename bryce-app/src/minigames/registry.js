/**
 * Mini-game registry — single source of truth for every game in the app.
 *
 * To add a new game:
 *   1. Create  src/minigames/YourGame/index.js
 *   2. Import it here and add one entry to GAME_REGISTRY
 *   3. App.js reads this file to register navigation routes automatically
 *   4. ScanScreen reads this file to populate the game picker
 *   5. QuizScreen reads this file to resolve labels and navigate
 *
 * Fields:
 *   id          — stable string key stored in Supabase reward_config.game
 *   label       — display name shown to parents and kids
 *   emoji       — single emoji used in buttons and banners
 *   description — one-line blurb shown in the ScanScreen picker chip
 *   routeName   — React Navigation stack route name (must match App.js)
 *   component   — the screen component (imported below)
 *   available   — false = coming-soon chip (dimmed, not selectable)
 */

import SpeedRound  from './SpeedRound';
import MemoryFlip  from './MemoryFlip';

export const GAME_REGISTRY = [
  {
    id:          'speed_round',
    label:       'Speed Round',
    emoji:       '⚡',
    description: '60-sec blitz — answer as many as you can before time runs out',
    routeName:   'SpeedRound',
    component:   SpeedRound,
    available:   true,
  },
  {
    id:          'memory_flip',
    label:       'Memory Flip',
    emoji:       '🃏',
    description: 'Flip cards to match each question with its correct answer',
    routeName:   'MemoryFlip',
    component:   MemoryFlip,
    available:   true,
  },
  // ── Future games ───────────────────────────────────────────────
  // {
  //   id:          'match_up',
  //   label:       'Match-Up',
  //   emoji:       '🧩',
  //   description: 'Drag terms to their definitions',
  //   routeName:   'MatchUp',
  //   component:   null,
  //   available:   false,
  // },
];

/** Return the registry entry for a given game id, or null. */
export function findGame(id) {
  return GAME_REGISTRY.find(g => g.id === id) ?? null;
}

/** All games currently available to play (not coming-soon). */
export const AVAILABLE_GAMES = GAME_REGISTRY.filter(g => g.available);

/** All games including coming-soon placeholders (for the picker UI). */
export const ALL_GAMES = GAME_REGISTRY;
