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
    // Try to extract the actual error body from the edge function response
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

  const rawQuestions = data.questions.map((q, i) => ({
    question:     q.question     ?? `Question ${i + 1}`,
    options:      Array.isArray(q.options) && q.options.length === 4
                    ? q.options
                    : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
  }));

  // Sanitize ALL AI-generated text before returning to the UI
  const sanitized = sanitizeUnit({
    title:     data.title ?? 'New Unit',
    questions: rawQuestions.slice(0, questionCount),
  });

  return sanitized;
}
