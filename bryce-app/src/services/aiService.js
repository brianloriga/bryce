import { supabase } from './supabase';
import { sanitizeUnit, sanitizeReason } from '../utils/profanityFilter';

// Calls the Supabase Edge Function which securely calls GPT-4o Vision.
// The OpenAI API key never touches the client.
//
// base64Images — string (single page) or string[] (multiple pages)
export async function generateQuestionsFromImage(base64Images, questionCount = 9) {
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];

  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: { images, questionCount },
  });

  if (error) {
    let msg = error.message ?? 'Failed to generate questions';
    try {
      const ctx = error.context;
      if (ctx?.json?.error) msg = ctx.json.error;
      else if (typeof ctx?.text === 'string') msg = ctx.text;
    } catch (_) { /* ignore parse errors */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);

  // Image failed content validation — attach flag so UI can show inline error
  if (data?.valid === false) {
    const err = new Error(sanitizeReason(data.reason));
    err.isValidationError = true;
    throw err;
  }

  // Validate response shape
  if (!data?.questions || !Array.isArray(data.questions)) {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  const rawQuestions = data.questions.map((q, i) => {
    const mapped = {
      question:     q.question     ?? `Question ${i + 1}`,
      options:      Array.isArray(q.options) && q.options.length === 4
                      ? q.options
                      : ['Option A', 'Option B', 'Option C', 'Option D'],
      correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
    };
    if (q.hint)     mapped.hint     = q.hint;
    if (q.type)     mapped.type     = q.type;
    if (q.geometry) mapped.geometry = q.geometry;
    return mapped;
  });

  // Sanitize ALL AI-generated text before returning to the UI
  const sanitized = sanitizeUnit({
    title:     data.title ?? 'New Lesson',
    questions: rawQuestions.slice(0, questionCount),
  });

  return sanitized;
}

// Regenerates a single question using the same scanned images as context.
// Returns a replacement question object (same shape as a question in the array).
export async function regenerateQuestion(base64Images, existingQuestion, isVisual = false) {
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];

  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: {
      regenerate: true,
      images,
      existingQuestion,
      isVisual,
    },
  });

  if (error) {
    let msg = error.message ?? 'Failed to regenerate question';
    try {
      const ctx = error.context;
      if (ctx?.json?.error) msg = ctx.json.error;
      else if (typeof ctx?.text === 'string') msg = ctx.text;
    } catch (_) {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.question) throw new Error('AI returned an unexpected format. Please try again.');

  const q = data.question;
  const mapped = {
    question:     q.question     ?? existingQuestion,
    options:      Array.isArray(q.options) && q.options.length === 4
                    ? q.options
                    : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
  };
  if (q.hint)     mapped.hint     = q.hint;
  if (q.type)     mapped.type     = q.type;
  if (q.geometry) mapped.geometry = q.geometry;
  return mapped;
}
