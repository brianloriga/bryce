// @ts-nocheck
// Server-side content sanitization — profanity guard and question field validation.

const BANNED = [
  /\bf+u+c+k+\w*/gi, /\bs+h+i+t+\w*/gi, /\bb+i+t+c+h+\w*/gi,
  /\bc+u+n+t+\w*/gi, /\bd+i+c+k+\w*/gi,  /\bp+u+s+s+y+\w*/gi,
  /\bw+h+o+r+e+\w*/gi, /\bs+l+u+t+\w*/gi, /\bp+o+r+n+\w*/gi,
  /\bn+i+g+g+[ae]+\w*/gi, /\bf+a+g+g+o+t+\w*/gi,
];

export function serverSanitize(text: string): string {
  let out = text;
  for (const p of BANNED) { out = out.replace(p, '[removed]'); p.lastIndex = 0; }
  return out;
}

export function sanitizeQuestion(q: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {
    question: serverSanitize(String(q.question ?? '')),
    hint:     q.hint ? serverSanitize(String(q.hint)) : undefined,
  };

  if (q.type) sanitized.type = q.type;

  // multiple_choice / visual_mc
  if (Array.isArray(q.options) && q.options.length > 0) {
    sanitized.options      = (q.options as string[]).map(serverSanitize);
    sanitized.correctIndex = q.correctIndex;
  }

  // fill_in
  if (q.correctAnswer !== undefined && q.type === 'fill_in') {
    sanitized.correctAnswer  = serverSanitize(String(q.correctAnswer));
    if (Array.isArray(q.acceptedAnswers)) {
      sanitized.acceptedAnswers = (q.acceptedAnswers as string[]).map(serverSanitize);
    }
  }

  // number_line
  if (q.type === 'number_line') {
    sanitized.correctAnswer = serverSanitize(String(q.correctAnswer ?? ''));
    if (Array.isArray(q.acceptedAnswers)) {
      sanitized.acceptedAnswers = (q.acceptedAnswers as string[]).map(serverSanitize);
    }
    if (q.mode) sanitized.mode = q.mode;
    if (Array.isArray(q.options)) {
      sanitized.options      = (q.options as string[]).map(serverSanitize);
      sanitized.correctIndex = q.correctIndex;
    }
  }

  // ordering
  if (q.type === 'ordering') {
    if (Array.isArray(q.items))        sanitized.items        = (q.items as string[]).map(serverSanitize);
    if (Array.isArray(q.correctOrder)) sanitized.correctOrder = q.correctOrder;
  }

  // true_false
  if (q.type === 'true_false') {
    sanitized.correctAnswer = q.correctAnswer;
  }

  // word_bank
  if (q.type === 'word_bank') {
    sanitized.correctAnswer = serverSanitize(String(q.correctAnswer ?? ''));
    if (Array.isArray(q.wordBank)) {
      sanitized.wordBank = (q.wordBank as string[]).map(serverSanitize);
    }
  }

  // Optional extras (selfContained is intentionally NOT forwarded — internal only)
  if (q.geometry)        sanitized.geometry        = q.geometry;
  if (q.image_ref != null) sanitized.image_ref = q.image_ref; // preserve the numeric index (1, 2, 3…)
  if (q.context)         sanitized.context         = q.context;
  if (q.measurementTool) sanitized.measurementTool = q.measurementTool;
  if (q.rulerMaxCm)      sanitized.rulerMaxCm      = q.rulerMaxCm;
  if (q.rulerSubtype)    sanitized.rulerSubtype     = q.rulerSubtype;

  return sanitized;
}

export function sanitizeResponse(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj.valid === false) {
    return { valid: false, reason: serverSanitize(String(obj.reason ?? '')) };
  }

  const raw = (obj.questions as Array<Record<string, unknown>> ?? []);

  const dropped = raw.filter((q) => q.selfContained === false);
  const missing = raw.filter((q) => q.selfContained === undefined);
  if (dropped.length > 0) {
    console.warn(`[generate-questions] DROPPED ${dropped.length} question(s) marked selfContained:false:`);
    dropped.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
  }
  if (missing.length > 0) {
    console.warn(`[generate-questions] ${missing.length} question(s) missing selfContained field (kept, but investigate):`);
    missing.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
  }

  const questions = raw
    .filter((q) => {
      // Measurement tool questions are always self-contained — the app renders
      // the full interactive tool from geometry, never the original worksheet.
      if (q.measurementTool) return true;
      return q.selfContained !== false;
    })
    .map(sanitizeQuestion);

  console.log(`[generate-questions] title="${obj.title}" raw=${raw.length} kept=${questions.length} dropped=${dropped.length} missingField=${missing.length}`);

  const result: Record<string, unknown> = {
    valid: true,
    title: serverSanitize(String(obj.title ?? '')),
    questions,
  };
  if (obj.passage && typeof obj.passage === 'string' && obj.passage.trim()) {
    result.passage = serverSanitize(obj.passage.trim());
  }
  if (obj.lesson_intro && typeof obj.lesson_intro === 'string' && obj.lesson_intro.trim()) {
    result.lesson_intro = serverSanitize(obj.lesson_intro.trim());
  }
  if (obj.image_search_query && typeof obj.image_search_query === 'string' && obj.image_search_query.trim()) {
    result.image_search_query = serverSanitize(obj.image_search_query.trim());
  }
  return result;
}
