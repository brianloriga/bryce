/**
 * Castle Defense — Board configuration
 *
 * BOARD_CELLS format: [col, row, baseTileKey, ...stackedKeys]
 *
 *   Rotation syntax — append (degrees) to ANY key to rotate it:
 *     'tile-corner-round(90)'   → rotate corner 90° CW from above
 *     'tile-straight(180)'      → flip a straight tile
 *     'weapon-ballista(45)'     → rotate a stacked weapon
 *
 * PATH_CELLS drives the monster route and tile rotations for path pieces.
 *
 * TOWER_SLOTS — 8 buildable positions adjacent to the path.
 *   Slots 0-2 are pre-built with Arrow Towers at game start.
 *   Slots 3-7 are empty — players place towers earned from questions.
 *
 * Map layout (9 × 8, isometric view from top-right):
 *   Castle on the LEFT edge (col 0, rows 2-6).
 *   Enemy spawn portal on the RIGHT (col 7, row 1).
 */

export const BOARD_COLS = 9;
export const BOARD_ROWS = 8;
export const TILE   = 1.35;
export const TILE_H = 0.35;

// ── Tower build slots ─────────────────────────────────────────────────────────
// Each slot is a flat 'tile' cell adjacent to the enemy path.
// Slots 0-2 get pre-built Arrow Towers; slots 3-12 are empty at game start.
// Slots 8-12 are the "second-row" deeper positions, two tiles from the path.
export const TOWER_SLOTS = [
  { id: 0,  col: 6, row: 2 }, // pre-built — near spawn turn
  { id: 1,  col: 5, row: 5 }, // pre-built — covers mid-path
  { id: 2,  col: 2, row: 5 }, // pre-built — near castle approach
  { id: 3,  col: 5, row: 2 }, // buildable — row-3 path coverage
  { id: 4,  col: 3, row: 2 }, // buildable — row-3 path coverage
  { id: 5,  col: 6, row: 4 }, // buildable — mid-path coverage
  { id: 6,  col: 3, row: 5 }, // buildable — row-6 path coverage
  { id: 7,  col: 2, row: 4 }, // buildable — castle flank
  // ── Second-row (deeper) slots ─────────────────────────────────────────────
  { id: 8,  col: 6, row: 1 }, // buildable — behind slot 0, near spawn
  { id: 9,  col: 5, row: 1 }, // buildable — second row above row-3 path
  { id: 10, col: 3, row: 1 }, // buildable — second row above slot 4
  { id: 11, col: 7, row: 4 }, // buildable — second row right of south path
  { id: 12, col: 7, row: 5 }, // buildable — second row right of south path
];

// No pre-built towers — students earn every tower by answering questions correctly.
export const STARTING_TOWER_SLOT_IDS = [];

// ── Board cells ───────────────────────────────────────────────────────────────
export const BOARD_CELLS = [

  // ── Row 0 — northern tree-line ─────────────────────────────────────────────
  [1, 0, 'tile-tree'],
  [2, 0, 'tile-tree-double'],
  [3, 0, 'tile', 'detail-rocks'],
  [4, 0, 'tile-tree'],
  [5, 0, 'tile-crystal'],
  [6, 0, 'tile-tree-double'],
  [7, 0, 'tile', 'detail-rocks'],
  [8, 0, 'tile-tree'],

  // ── Row 1 — open field leading to spawn ────────────────────────────────────
  [1, 1, 'tile-tree'],
  [2, 1, 'tile', 'detail-rocks'],
  [3, 1, 'tile'],                        // tower slot 10 — cleared
  [4, 1, 'tile'],
  [5, 1, 'tile'],                        // tower slot 9 — cleared
  [6, 1, 'tile'],                        // tower slot 8 — cleared
  [7, 1, 'tile-spawn-round'],      // enemy spawn portal
  [8, 1, 'tile-tree-double'],

  // ── Row 2 — castle flank + open field ──────────────────────────────────────
  // [6,2] and [5,2] and [3,2] are tower slots — plain tile
  [0, 2, 'tile', 'tower-round-top-a'],   // flanking archer tower (decorative)
  [1, 2, 'tile-tree'],
  [2, 2, 'tile'],
  [3, 2, 'tile'],                        // tower slot 4 — cleared
  [4, 2, 'tile-rock'],
  [5, 2, 'tile'],                        // tower slot 3 — cleared
  [6, 2, 'tile'],                        // tower slot 0 — cleared (pre-built)
  [7, 2, 'tile-straight'],               // PATH  ↓ south
  [8, 2, 'tile-tree'],

  // ── Row 3 — castle gate + east-west path ───────────────────────────────────
  [0, 3, 'tile', 'tower-square-bottom-b', 'weapon-ballista(90)'],   // wall tower
  [1, 3, 'tile-crossing'],                 // PATH_A ←W and PATH_B ↑N merge here
  [2, 3, 'tile-straight(90)'],
  [3, 3, 'tile-straight(90)'],
  [4, 3, 'tile-crossing'],                 // PATH fork crossing
  [5, 3, 'tile-straight(90)'],             // PATH ← west
  [6, 3, 'tile-bump(90)'],                 // PATH ← west
  [7, 3, 'tile-corner-round(180)'],        // PATH corner  ↓S → ←W
  [8, 3, 'tile-tree'],

  // ── Row 4 — main castle + path going south ─────────────────────────────────
  // [6,4] and [2,4] are tower slots — plain tile
  [0, 4, 'tile', 'tower-square-bottom-b', 'weapon-cannon(90)'],   // wall tower
  [1, 4, 'tile-straight'],                 // PATH_B north leg ↑ north
  [2, 4, 'tile'],                          // tower slot 7 — cleared
  [3, 4, 'tile'],
  [4, 4, 'tile-straight'],                 // PATH  ↓ south
  [5, 4, 'tile-tree'],
  [6, 4, 'tile'],                          // tower slot 5 — cleared
  [7, 4, 'tile'],                          // tower slot 11 — cleared
  [8, 4, 'tile-crystal'],

  // ── Row 5 — castle flank + open field ─────────────────────────────────────
  // [5,5] and [2,5] and [3,5] are tower slots — plain tile
  [0, 5, 'tile', 'tower-square-bottom-b', 'weapon-ballista(90)'],  // wall tower
  [1, 5, 'tile-straight'],                 // PATH_B north leg ↑ north
  [2, 5, 'tile'],                          // tower slot 2 — cleared (pre-built)
  [3, 5, 'tile'],                          // tower slot 6 — cleared
  [4, 5, 'tile-straight'],                 // PATH  ↓ south
  [5, 5, 'tile'],                          // tower slot 1 — cleared (pre-built)
  [6, 5, 'tile-tree'],
  [7, 5, 'tile'],                          // tower slot 12 — cleared
  [8, 5, 'tile-tree-double'],

  // ── Row 6 — southern end of PATH_B loop ───────────────────────────────────
  [0, 6, 'tile', 'tower-round-top-a'],     // southern archer tower (decorative)
  [1, 6, 'tile-corner-round(90)'],         // PATH_B corner ←W→↑N
  [2, 6, 'tile-straight(90)'],
  [3, 6, 'tile-straight(90)'],
  [4, 6, 'tile-corner-round(180)'],        // PATH corner  ↓S → ←W
  [5, 6, 'tile-tree'],
  [6, 6, 'tile-rock'],
  [7, 6, 'tile-tree'],
  [8, 6, 'tile', 'detail-rocks'],

  // ── Row 7 — southern edge ──────────────────────────────────────────────────
  [1, 7, 'tile-tree'],
  [2, 7, 'tile', 'detail-rocks'],
  [3, 7, 'tile-tree-double'],
  [4, 7, 'tile-rock'],
  [5, 7, 'tile-tree'],
  [6, 7, 'tile', 'detail-rocks'],
  [7, 7, 'tile-rock'],
  [8, 7, 'tile-tree-double'],
];

// ── Path cells ─────────────────────────────────────────────────────────────────
const Q = Math.PI / 2;
export const PATH_CELLS = [
  [7, 1, 'spawn',    0  ],
  [7, 2, 'straight', 0  ],
  [7, 3, 'corner',   Q  ],
  [6, 3, 'straight', Q  ],
  [5, 3, 'straight', Q  ],
  [4, 3, 'corner',  -Q  ],
  [4, 4, 'straight', 0  ],
  [4, 5, 'straight', 0  ],
  [4, 6, 'corner',   Q  ],
  [3, 6, 'straight', Q  ],
  [2, 6, 'straight', Q  ],
  [1, 6, 'corner',   0  ], // PATH_B corner: west → north
  [1, 5, 'straight', 0  ], // PATH_B north leg
  [1, 4, 'straight', 0  ], // PATH_B north leg
];

export const WAYPOINTS = PATH_CELLS.map(([c, r]) => [c, r]);

// ── Dual monster paths ─────────────────────────────────────────────────────────
// PATH_A — straight row-3 route.  Ends at (0,3).
export const PATH_A_WAYPOINTS = [
  [7, 1], // spawn portal
  [7, 2],
  [7, 3],
  [6, 3],
  [5, 3],
  [4, 3], // fork
  [3, 3],
  [2, 3],
  [1, 3],
  [0, 3], // castle wall — DAMAGE POINT
];

// PATH_B — winding southern route.  Exits at (0,6) — south flank of castle.
export const PATH_B_WAYPOINTS = [
  [7, 1], // spawn portal
  [7, 2],
  [7, 3],
  [6, 3],
  [5, 3],
  [4, 3], // fork — goes south
  [4, 4],
  [4, 5],
  [4, 6], // turn west
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6], // castle south gate — DAMAGE POINT
];

// ── Path cell lookup set ───────────────────────────────────────────────────────
export const PATH_CELL_SET = new Set(PATH_CELLS.map(([c, r]) => `${c},${r}`));

// ── Utilities ──────────────────────────────────────────────────────────────────
export function tileToWorld(col, row) {
  return {
    x: (col - (BOARD_COLS - 1) / 2) * TILE,
    z: (row - (BOARD_ROWS - 1) / 2) * TILE,
  };
}
