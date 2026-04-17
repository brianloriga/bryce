/**
 * Profanity filter for child-safe content.
 * Applied to ALL text returned by the AI before it is displayed in the app.
 *
 * Strategy:
 *  - Word-boundary regex so "class" or "assist" are never affected
 *  - Replaces the matched word entirely with [removed]
 *  - Case-insensitive
 */

// Common letter substitutions used to evade filters (e→3, i→1, a→@, o→0, s→$)
function normalize(text) {
  return text
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/\$/g, 's')
    .replace(/\+/g, 't')
    .replace(/!/g, 'i')
    .replace(/5/g, 's');
}

// Each entry is matched as a whole word (word-boundary anchored).
// Variations with repeated letters (fuuuck) are handled by the + quantifiers below.
const BANNED_PATTERNS = [
  // Profanity
  /\bf+u+c+k+\w*/gi,
  /\bs+h+[i1]+t+\w*/gi,
  /\bb+[i1]+t+c+h+\w*/gi,
  /\ba+s+s+h+o+l+e+\w*/gi,
  /\bc+u+n+t+\w*/gi,
  /\bd+[i1]+c+k+\w*/gi,
  /\bc+o+c+k+\w*/gi,
  /\bp+u+s+s+y+\w*/gi,
  /\bb+a+s+t+a+r+d+\w*/gi,
  /\bw+h+o+r+e+\w*/gi,
  /\bs+l+u+t+\w*/gi,
  /\bp+[i1]+s+s+\w*/gi,
  /\bd+a+m+n+\w*/gi,
  /\br+e+t+a+r+d+\w*/gi,
  /\bc+r+a+p+\w*/gi,
  /\bb+o+l+l+o+c+k+\w*/gi,
  /\bb+u+g+g+e+r+\w*/gi,
  /\bp+r+[i1]+c+k+\w*/gi,
  /\bt+[i1]+t+\b/gi,
  /\bt+[i1]+t+s+\w*/gi,
  /\bn+[i1]+g+g+[ae]+\w*/gi,
  /\bf+a+g+g+[oi]+t+\w*/gi,
  /\bf+a+g+\b/gi,
  /\bp+o+r+n+\w*/gi,
  /\bs+e+x+u+a+l+\w*/gi,
  /\bn+u+d+e+\w*/gi,
  /\bn+a+k+e+d+\w*/gi,
  /\br+a+p+e+\b/gi,
  /\br+a+p+[ei]+s+t+\w*/gi,
];

/**
 * Replaces any profanity in `text` with [removed].
 * Also checks leet-speak normalized version.
 */
export function sanitize(text) {
  if (!text || typeof text !== 'string') return text ?? '';

  let clean = text;

  // Check and clean the raw text
  for (const pattern of BANNED_PATTERNS) {
    clean = clean.replace(pattern, '[removed]');
  }

  // Also check normalized version and replace in original if needed
  const norm = normalize(clean.toLowerCase());
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(norm)) {
      // Re-run on clean with case-insensitive pattern as fallback
      clean = clean.replace(pattern, '[removed]');
    }
    pattern.lastIndex = 0; // reset stateful regex
  }

  return clean;
}

/**
 * Returns true if the text contains any banned content.
 */
export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  const norm = normalize(text.toLowerCase());
  for (const pattern of BANNED_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text) || pattern.test(norm)) {
      pattern.lastIndex = 0;
      return true;
    }
  }
  return false;
}

/**
 * Sanitizes every string field in an AI questions response.
 * Safe to call on the full { title, questions } object.
 */
export function sanitizeUnit({ title, questions }) {
  return {
    title: sanitize(title),
    questions: (questions ?? []).map(q => ({
      question:     sanitize(q.question),
      options:      (q.options ?? []).map(sanitize),
      correctIndex: q.correctIndex,
    })),
  };
}

/**
 * Sanitizes the validation rejection reason shown to the user.
 * If the reason itself contains something inappropriate, replace it
 * with a safe generic message.
 */
export function sanitizeReason(reason) {
  const cleaned = sanitize(reason ?? '');
  if (containsProfanity(cleaned) || cleaned.includes('[removed]')) {
    return 'This image cannot be used. Please take a photo of an actual textbook or worksheet page.';
  }
  return cleaned;
}
