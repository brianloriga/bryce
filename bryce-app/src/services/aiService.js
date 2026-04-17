import { supabase } from './supabase';

// Calls the Supabase Edge Function which securely calls GPT-4o Vision.
// The OpenAI API key never touches the client.
//
// base64Images — string (single page) or string[] (multiple pages)
export async function generateQuestionsFromImage(base64Images) {
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];

  const { data, error } = await supabase.functions.invoke('generate-questions', {
    body: { images },
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
    const err = new Error(
      data.reason ?? 'This image cannot be used. Please take a photo of an actual textbook or worksheet page.'
    );
    err.isValidationError = true;
    throw err;
  }

  // Validate response shape
  if (!data?.questions || !Array.isArray(data.questions)) {
    throw new Error('AI returned an unexpected format. Please try again.');
  }

  const questions = data.questions.map((q, i) => ({
    question:     q.question     ?? `Question ${i + 1}`,
    options:      Array.isArray(q.options) && q.options.length === 4
                    ? q.options
                    : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
  }));

  return {
    title:     data.title ?? 'New Unit',
    questions: questions.slice(0, 9),
  };
}
