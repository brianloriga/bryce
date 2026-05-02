/**
 * Pre-required tile images from the Kenney Medieval Platformer Pack.
 *
 * Metro bundler requires all asset paths to be fully static string literals
 * inside require() — no variables or template literals. Every tile used in
 * the game must be listed here explicitly.
 *
 * Tile reference (128×128 PNG, CC0 license):
 *   Orange tower rooftops  → 033 (left corner), 034 (right corner), 035 (fill)
 *   Castle battlements     → 038 (left end), 039 (right end), 041 (wide), 043 (center)
 *   Stone wall fill        → 064 (uniform), 065 (light), 066 (dark blocks)
 *   Decorative banners     → 046 (green/yellow), 069 (orange pennant)
 *   Arched doorways        → 055 (dark arch), 060 (dark arch alt)
 *   Dark cave stone        → 175 (near-black), 176 (dark grey), 177 (charcoal)
 */

/* eslint-disable global-require */
export const TILES = {
  // ── Orange tower rooftops ──────────────────────────────────
  t033: require('./kenney_platformer-pack-medieval/PNG/medievalTile_033.png'),
  t034: require('./kenney_platformer-pack-medieval/PNG/medievalTile_034.png'),
  t035: require('./kenney_platformer-pack-medieval/PNG/medievalTile_035.png'),

  // ── Castle battlements (grey stone crenelations) ───────────
  t038: require('./kenney_platformer-pack-medieval/PNG/medievalTile_038.png'),
  t039: require('./kenney_platformer-pack-medieval/PNG/medievalTile_039.png'),
  t041: require('./kenney_platformer-pack-medieval/PNG/medievalTile_041.png'),
  t043: require('./kenney_platformer-pack-medieval/PNG/medievalTile_043.png'),

  // ── Stone wall fill ────────────────────────────────────────
  t064: require('./kenney_platformer-pack-medieval/PNG/medievalTile_064.png'),
  t065: require('./kenney_platformer-pack-medieval/PNG/medievalTile_065.png'),
  t066: require('./kenney_platformer-pack-medieval/PNG/medievalTile_066.png'),

  // ── Decorative banners ─────────────────────────────────────
  t046: require('./kenney_platformer-pack-medieval/PNG/medievalTile_046.png'),
  t069: require('./kenney_platformer-pack-medieval/PNG/medievalTile_069.png'),

  // ── Arched doorways ────────────────────────────────────────
  t055: require('./kenney_platformer-pack-medieval/PNG/medievalTile_055.png'),
  t060: require('./kenney_platformer-pack-medieval/PNG/medievalTile_060.png'),

  // ── Dark cave / dungeon stone ──────────────────────────────
  t175: require('./kenney_platformer-pack-medieval/PNG/medievalTile_175.png'),
  t176: require('./kenney_platformer-pack-medieval/PNG/medievalTile_176.png'),
  t177: require('./kenney_platformer-pack-medieval/PNG/medievalTile_177.png'),
};
/* eslint-enable global-require */
