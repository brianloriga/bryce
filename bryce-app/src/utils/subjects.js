// Default subject categories. Each has a stable `key` (stored in DB),
// a display label, a colour for the card, and a local PNG image asset.
export const DEFAULT_SUBJECTS = [
  {
    key: 'reading',
    label: 'Reading',
    color: '#2563eb',
    image: require('../../assets/reading_icon.png'),
  },
  {
    key: 'math',
    label: 'Math',
    color: '#7c3aed',
    image: require('../../assets/math_icon.png'),
  },
  {
    key: 'science',
    label: 'Science',
    color: '#059669',
    image: require('../../assets/science_icon.png'),
  },
  {
    key: 'social_studies',
    label: 'Social Studies',
    color: '#ea580c',
    image: require('../../assets/social_studies_icon.png'),
  },
];

// Generic icon used for custom / unrecognised subjects.
export const GENERIC_ICON = require('../../assets/generic_lessoon_icon.png');

// Fallback tile used for lessons that have no subject or an unrecognised key.
export const UNASSIGNED_SUBJECT = {
  key: 'unassigned',
  label: 'Unassigned',
  color: '#475569',
  image: GENERIC_ICON,
};

/**
 * Build a full subject list from the defaults + any parent-created custom keys
 * that appear in the loaded units.
 *
 * @param {Array<{subject?: string}>} units  All loaded lesson objects
 * @param {Array<{key, label, emoji?, color?}>} customSubjects  Saved custom subjects
 * @returns {Array}  Ordered list: defaults first, then custom alphabetically
 */
export function buildSubjectList(units = [], customSubjects = []) {
  const knownKeys = new Set(DEFAULT_SUBJECTS.map(s => s.key));

  // Merge stored custom subjects
  const extras = [...customSubjects];
  const extraKeys = new Set(extras.map(s => s.key));

  // Also surface any subject key found in units that isn't already covered
  for (const u of units) {
    const k = u.subject;
    if (k && k !== 'custom' && k !== 'unassigned' && !knownKeys.has(k) && !extraKeys.has(k)) {
      extras.push({ key: k, label: toLabel(k), color: '#0891b2', image: GENERIC_ICON });
      extraKeys.add(k);
    }
  }

  extras.sort((a, b) => a.label.localeCompare(b.label));
  return [...DEFAULT_SUBJECTS, ...extras];
}

/** Convert a snake_case or camelCase key to a human label. */
function toLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Given a subject key, return the matching subject object (or a synthesised one).
 */
export function resolveSubject(key, allSubjects) {
  if (!key || key === 'custom' || key === 'unassigned') return UNASSIGNED_SUBJECT;
  return allSubjects.find(s => s.key === key) ?? {
    key,
    label: toLabel(key),
    color: '#0891b2',
    image: GENERIC_ICON,
  };
}
