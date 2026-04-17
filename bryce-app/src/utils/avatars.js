// Shared avatar image registry — used across KidSelect, Home, Account screens.
// Avatar key is stored in the DB as a plain string (e.g. "dog", "panda").

export const AVATAR_MAP = {
  bear:     require('../../child_icons/snapstudy_avatar_bear_fixed2.png'),
  bunny:    require('../../child_icons/snapstudy_avatar_bunny.png'),
  dino:     require('../../child_icons/snapstudy_avatar_dino_fixed2.png'),
  dog:      require('../../child_icons/snapstudy_avatar_dog.png'),
  kitty:    require('../../child_icons/snapstudy_avatar_kitty.png'),
  mermaid:  require('../../child_icons/snapstudy_avatar_mermaid.png'),
  owl:      require('../../child_icons/snapstudy_avatar_owl_fixed2.png'),
  panda:    require('../../child_icons/snapstudy_avatar_panda_fixed2.png'),
  red_dino: require('../../child_icons/snapstudy_avatar_red_dino_fixed2.png'),
  robot:    require('../../child_icons/snapstudy_avatar_robot_fixed2.png'),
  unicorn:  require('../../child_icons/snapstudy_avatar_unicorn.png'),
};

export const AVATAR_KEYS  = Object.keys(AVATAR_MAP);
export const DEFAULT_AVATAR = 'dog';

// Returns a require() source for any key, with safe fallback.
// Also handles legacy emoji keys gracefully — they'll show the default image.
export function getAvatarSource(key) {
  return AVATAR_MAP[key] ?? AVATAR_MAP[DEFAULT_AVATAR];
}

// Soft background tints used behind each avatar image
export const AVATAR_BG = {
  bear:     '#fde68a',
  bunny:    '#fbcfe8',
  dino:     '#86efac',
  dog:      '#fed7aa',
  kitty:    '#f5d0fe',
  mermaid:  '#bae6fd',
  owl:      '#fef08a',
  panda:    '#d1d5db',
  red_dino: '#fca5a5',
  robot:    '#a5b4fc',
  unicorn:  '#c4b5fd',
};

export function getAvatarBg(key) {
  return AVATAR_BG[key] ?? '#e2e8f0';
}
