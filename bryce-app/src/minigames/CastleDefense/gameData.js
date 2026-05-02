/**
 * Castle Defense — game data
 *
 * Tower Defense gameplay:
 *   • 5 waves of enemies spawn and walk toward the castle.
 *   • Answer questions to earn tower build tokens.
 *   • Correct answer  → pick any tower type to place.
 *   • Wrong answer    → a new enemy immediately spawns.
 *   • Towers auto-fire at enemies in range every N ms.
 *   • Enemy armor: Knights resist Arrows; Giants resist Catapults.
 *   • Ice Tower slows all enemies it hits for 3.5 s.
 *   • Wave 5 ends with a BOSS — high HP, immune to nothing.
 *   • Survive all 5 waves → Victory. Castle HP=0 → Defeat.
 */

// ── Enemy types ───────────────────────────────────────────────────────────────
export const ENEMY_TYPES = {
  goblin: {
    key:        'goblin',
    name:       'Goblin',
    emoji:      '👺',
    hp:         2,     // 2 arrow shots to kill
    speed:      1.0,
    color:      0x4ade80,
    scale:      0.32,
    scoreValue: 10,
    immuneTo:   [],
    hint:       'Weak to everything!',
  },
  knight: {
    key:        'knight',
    name:       'Dark Knight',
    emoji:      '🛡️',
    hp:         4,     // tanky — needs cannon or many arrows
    speed:      0.75,
    color:      0x94a3b8,
    scale:      0.36,
    scoreValue: 20,
    immuneTo:   ['arrow'],
    hint:       'Arrows bounce off armor!',
  },
  giant: {
    key:        'giant',
    name:       'Giant',
    emoji:      '👹',
    hp:         6,     // very tough
    speed:      0.5,
    color:      0xc084fc,
    scale:      0.50,
    scoreValue: 30,
    immuneTo:   ['catapult'],
    hint:       'Too big to hit with boulders!',
  },
  largermonster: {
    key:        'largermonster',
    name:       'Large Monster',
    emoji:      '🧟',
    hp:         12,    // double the giant's 6 HP
    speed:      0.45,
    color:      0x7c3aed,
    scale:      0.60,
    scoreValue: 50,
    immuneTo:   [],
    hint:       'Massive — needs sustained fire from all towers!',
  },
  boss: {
    key:        'boss',
    name:       'BOSS',
    emoji:      '👑',
    hp:         16,    // requires sustained fire from multiple towers
    speed:      0.35,
    color:      0xff4500,
    scale:      0.72,
    scoreValue: 100,
    immuneTo:   [],
    hint:       'The final boss! All towers effective.',
  },
};

// Keep MONSTER_TYPES as alias so enemies.js still works
export const MONSTER_TYPES = ENEMY_TYPES;

// ── Tower types ───────────────────────────────────────────────────────────────
export const TOWER_TYPES = {
  arrow: {
    key:         'arrow',
    name:        'Arrow Tower',
    emoji:       '🏹',
    fireRateMs:  1800,
    damage:      1,
    range:       3.2,
    splash:      0,
    flightMs:    550,
    arcHeight:   0.25,   // nearly flat — fast direct shot
    weaponGlb:   'weapon-ballista',
    ammoGlb:     'weapon-ammo-arrow',
    ammoScale:   0.55,
    ammoColor:   0xfde68a,
    description: 'Fast single-target',
    weakAgainst: ['knight'],
  },
  cannon: {
    key:         'cannon',
    name:        'Cannon',
    emoji:       '💣',
    fireRateMs:  3800,
    damage:      2,
    range:       3.5,
    splash:      1.1,
    flightMs:    800,
    arcHeight:   0.55,   // moderate arc
    weaponGlb:   'weapon-cannon',
    ammoGlb:     'weapon-ammo-cannonball',
    ammoScale:   0.62,
    ammoColor:   0xf97316,
    description: 'Splash damage',
    weakAgainst: [],
  },
  catapult: {
    key:         'catapult',
    name:        'Catapult',
    emoji:       '🪨',
    fireRateMs:  5500,
    damage:      3,
    range:       5.0,
    splash:      1.9,
    flightMs:    1100,
    arcHeight:   1.8,    // big lob — catapults hurl boulders high
    weaponGlb:   'weapon-catapult',
    ammoGlb:     'weapon-ammo-boulder',
    ammoScale:   0.90,
    ammoColor:   0x92400e,
    description: 'Huge splash & range',
    weakAgainst: ['giant'],
  },
  turret: {
    key:         'turret',
    name:        'Turret',
    emoji:       '⚡',
    fireRateMs:  1100,
    damage:      1,
    range:       2.8,
    splash:      0,
    flightMs:    400,
    arcHeight:   0.10,   // essentially flat — rapid-fire bullets
    weaponGlb:   'weapon-turret',
    ammoGlb:     'weapon-ammo-bullet',
    ammoScale:   0.42,
    ammoColor:   0x38bdf8,
    description: 'Ultra-fast fire',
    weakAgainst: [],
  },
  ice: {
    key:          'ice',
    name:         'Ice Tower',
    emoji:        '❄️',
    fireRateMs:   2800,
    damage:       0,
    range:        3.0,
    splash:       1.4,
    flightMs:     600,
    arcHeight:    0.40,  // gentle arc for icy orb
    weaponGlb:    'tower-round-crystals',
    ammoGlb:      null,
    ammoScale:    0,
    ammoColor:    0x7dd3fc,
    slowDuration: 3500,
    slowFactor:   2.5,
    description:  'Freezes all nearby enemies',
    weakAgainst:  [],
  },
};

// ── Towers the player can pick from on a correct answer ───────────────────────
export const PICKABLE_TOWERS = ['arrow', 'cannon', 'catapult', 'ice'];

// ── Wave definitions ──────────────────────────────────────────────────────────
export const WAVE_DEFS = [
  // Wave 1 — regular monsters only (Monster.json sprite)
  { label: 'Wave 1', enemies: ['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin'], gapMs: 500 },
  // Wave 2 — 60% regular / 40% larger monster
  { label: 'Wave 2', enemies: ['goblin', 'largermonster', 'goblin', 'largermonster', 'goblin', 'largermonster', 'goblin', 'goblin'], gapMs: 500 },
  // Wave 3 — knights and goblins
  { label: 'Wave 3', enemies: ['goblin', 'knight', 'goblin', 'largermonster', 'knight', 'goblin', 'knight', 'largermonster'], gapMs: 500 },
  // Wave 4 — heavy mix, more enemies, faster cadence
  { label: 'Wave 4', enemies: ['goblin', 'largermonster', 'knight', 'largermonster', 'goblin', 'knight', 'largermonster', 'giant', 'largermonster', 'knight', 'giant', 'largermonster'], gapMs: 400 },
  // Wave 5 — max enemies, BOSS
  { label: 'Wave 5 — BOSS!', enemies: ['knight', 'largermonster', 'goblin', 'giant', 'largermonster', 'knight', 'goblin', 'largermonster', 'giant', 'knight', 'largermonster', 'goblin', 'giant', 'largermonster', 'boss'], gapMs: 350 },
];

export const TOTAL_WAVES = WAVE_DEFS.length;

// ── Token cycle (legacy alias — no longer used, PICKABLE_TOWERS replaced it) ──
export const TOKEN_CYCLE = ['cannon', 'catapult', 'turret'];

// ── Monster order helpers (used to vary enemy types per question) ─────────────
const ENEMY_KEYS = Object.keys(ENEMY_TYPES);

export function monsterForQuestion(qIdx, shuffledOrder) {
  const order = shuffledOrder ?? ENEMY_KEYS;
  return order[qIdx % order.length];
}

export function buildMonsterOrder(len) {
  const out = [];
  const pool = [...ENEMY_KEYS];
  let bag = [];
  while (out.length < len) {
    if (bag.length === 0) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    out.push(bag.pop());
  }
  return out;
}
