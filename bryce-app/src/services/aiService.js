import { supabase } from './supabase';
import { sanitizeUnit, sanitizeReason } from '../utils/profanityFilter';

// Calls the Supabase Edge Function which securely calls GPT-4o Vision.
// The OpenAI API key never touches the client.
//
// base64Images  — string (single page) or string[] (multiple pages)
// questionCount — how many questions to generate (5 / 9 / 15 / 20)
// visualBase64  — optional base64 string of a diagram/graph image; triggers image-ref questions
// visualImages is an array of { base64, questionCount } — one per visual aid slot.
export async function generateQuestionsFromImage(base64Images, questionCount = 9, visualImages = []) {
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];

  const body = { images, questionCount };
  if (visualImages.length > 0) body.visualImages = visualImages;

  const { data, error } = await supabase.functions.invoke('generate-questions', { body });

  if (error) {
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json().catch(() => null);
        if (body?.error) throw new Error(body.error);
        if (body?.message) throw new Error(body.message);
      } else if (ctx?.json?.error) {
        throw new Error(ctx.json.error);
      }
    } catch (inner) {
      if (inner.message && inner.message !== error.message) throw inner;
    }
    throw new Error(error.message ?? 'Failed to generate questions');
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
    if (q.hint)      mapped.hint      = q.hint;
    if (q.type)      mapped.type      = q.type;
    if (q.geometry)  mapped.geometry  = q.geometry;
    // Map visual_url(s) onto questions GPT flagged as image-referenced.
    // image_ref is 1-based index into visual_urls array.
    if (q.image_ref && data.visual_urls?.length > 0) {
      const idx = (typeof q.image_ref === 'number' ? q.image_ref : 1) - 1;
      mapped.image_url = data.visual_urls[Math.max(0, Math.min(idx, data.visual_urls.length - 1))];
    } else if (q.image_ref && data.visual_url) {
      mapped.image_url = data.visual_url; // backwards compat
    }
    return mapped;
  });

  // Sanitize ALL AI-generated text before returning to the UI
  const sanitized = sanitizeUnit({
    title:     data.title ?? 'New Lesson',
    questions: rawQuestions.slice(0, questionCount),
  });

  // Include reading passage if GPT extracted one
  if (data.passage && typeof data.passage === 'string' && data.passage.trim()) {
    sanitized.passage = data.passage.trim();
  }

  return sanitized;
}

// Sends a small (512px) version of the visual aid to GPT-4o-mini and gets back
// a bounding box {x, y, w, h} as percentages of the image. Used to auto-crop
// phone browser chrome / bezels from the captured diagram image.
// Fails gracefully — always returns usable percentages (defaults to full image).
export async function detectCrop(smallBase64) {
  try {
    const { data } = await supabase.functions.invoke('detect-crop', {
      body: { imageBase64: smallBase64 },
    });
    const crop = data?.crop;
    if (crop && typeof crop.x === 'number') return crop;
  } catch (_) { /* fall through */ }
  return { x: 0, y: 0, w: 100, h: 100 };
}

// Generates TTS audio for every question in a saved unit and caches the MP3s in
// Supabase Storage. Runs fire-and-forget after saveCustomUnit — never blocks the UI.
// The edge function patches the custom_units row directly with audio_url on each question.
export async function generateAudio(unitId, questions) {
  const { error } = await supabase.functions.invoke('generate-audio', {
    body: { unit_id: unitId, questions },
  });
  if (error) throw new Error(error.message ?? 'Audio generation failed');
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
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json().catch(() => null);
        if (body?.error) throw new Error(body.error);
      } else if (ctx?.json?.error) {
        throw new Error(ctx.json.error);
      }
    } catch (inner) {
      if (inner.message && inner.message !== error.message) throw inner;
    }
    throw new Error(error.message ?? 'Failed to regenerate question');
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
