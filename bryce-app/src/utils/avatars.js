// Avatar system: a hex color stored in the DB + first letter of the child's name rendered on top.
// The `avatar` field in kid_profiles now holds a hex color string (e.g. "#6366f1").
// Legacy emoji / image-key values (anything not starting with "#") fall back to DEFAULT_COLOR.

export const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#4ade80', // mint (SnapStudy accent)
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
];

export const DEFAULT_COLOR = '#6366f1';

// Returns a valid hex color from any stored avatar value.
// Handles legacy emoji strings and image keys gracefully.
export function getAvatarColor(avatar) {
  if (typeof avatar === 'string' && avatar.startsWith('#')) return avatar;
  return DEFAULT_COLOR;
}
