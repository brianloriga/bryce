// Shared quiz utilities used across QuizScreen and renderers.

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const TYPE_LABELS = {
  fill_in:     'Fill in the blank',
  ordering:    'Put in order',
  true_false:  'True or False',
  word_bank:   'Word Bank',
  visual_mc:   'Visual Question',
  number_line: 'Number Line',
};

export function getStars(correct, total) {
  const pct = correct / total;
  if (pct >= 0.89) return 3;
  if (pct >= 0.67) return 2;
  if (pct >= 0.45) return 1;
  return 0;
}

// True when the string looks like a math/numeric answer (digits, decimals,
// fractions, currency symbols, percentages). Numeric answers stay exact-match
// only so "0.35" never accidentally accepts "0.3".
export function isNumericAnswer(s) {
  return /^[\d\s.,¢$%\/\\-]+$/.test(s.trim());
}

// Levenshtein edit distance — used for spelling tolerance.
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// How many edit-distance mistakes we allow based on correct answer length.
// Very short words (≤3 chars) get no tolerance — "cat"→"car" must be exact.
export function spellingTolerance(len) {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

// Returns true if the typed answer should be counted correct against one
// candidate answer string. Handles two cases beyond exact match:
//   1. Extra trailing words — "main entrance" typed when answer is "main"
//   2. Spelling mistakes    — within Levenshtein tolerance for non-numeric
export function isFuzzyMatch(typed, correct) {
  if (isNumericAnswer(correct)) return false;

  if (
    typed.length > correct.length &&
    typed.startsWith(correct) &&
    typed[correct.length] === ' '
  ) return true;

  const tolerance = spellingTolerance(correct.length);
  if (tolerance > 0 && levenshtein(typed, correct) <= tolerance) return true;

  return false;
}

// Fisher-Yates shuffle then fix any adjacent pair that shares the same
// correctAnswer or the same question text.
export function shuffleNoConsecutiveDupes(arr) {
  if (arr.length <= 1) return [...arr];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const sameQ = (x, y) =>
    String(x?.correctAnswer ?? '') === String(y?.correctAnswer ?? '') ||
    String(x?.question ?? '')     === String(y?.question ?? '');
  for (let i = 1; i < a.length; i++) {
    if (sameQ(a[i], a[i - 1])) {
      const j = a.findIndex((q, k) => k > i && !sameQ(q, a[i - 1]));
      if (j !== -1) [a[i], a[j]] = [a[j], a[i]];
    }
  }
  return a;
}
