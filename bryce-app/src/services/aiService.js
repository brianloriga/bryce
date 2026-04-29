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
      question: q.question ?? `Question ${i + 1}`,
    };

    if (q.hint)            mapped.hint            = q.hint;
    if (q.type)            mapped.type            = q.type;
    if (q.mode)            mapped.mode            = q.mode;
    if (q.geometry)        mapped.geometry        = q.geometry;
    if (q.context)         mapped.context         = q.context;
    if (q.measurementTool) mapped.measurementTool = q.measurementTool;
    if (q.rulerMaxCm)      mapped.rulerMaxCm      = q.rulerMaxCm;
    if (q.rulerSubtype)    mapped.rulerSubtype    = q.rulerSubtype;

    // multiple_choice / visual_mc
    if (!q.type || q.type === 'multiple_choice' || q.type === 'visual_mc') {
      mapped.options      = Array.isArray(q.options) && q.options.length >= 2
        ? q.options
        : ['Option A', 'Option B', 'Option C', 'Option D'];
      mapped.correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
    }

    // fill_in
    if (q.type === 'fill_in') {
      mapped.correctAnswer   = String(q.correctAnswer ?? '');
      if (Array.isArray(q.acceptedAnswers)) mapped.acceptedAnswers = q.acceptedAnswers;
    }

    // number_line — correctAnswer + mode-specific options
    if (q.type === 'number_line') {
      mapped.correctAnswer = String(q.correctAnswer ?? '');
      if (Array.isArray(q.acceptedAnswers)) mapped.acceptedAnswers = q.acceptedAnswers;
      // read + count modes need MC options (auto-enriched server-side)
      if (Array.isArray(q.options) && q.options.length >= 2) {
        mapped.options      = q.options;
        mapped.correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
      }
    }

    // ordering
    if (q.type === 'ordering') {
      mapped.items        = Array.isArray(q.items)        ? q.items        : [];
      mapped.correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder : [];
    }

    // true_false
    if (q.type === 'true_false') {
      mapped.correctAnswer = typeof q.correctAnswer === 'boolean' ? q.correctAnswer : true;
    }

    // word_bank
    if (q.type === 'word_bank') {
      mapped.wordBank      = Array.isArray(q.wordBank) ? q.wordBank : [];
      mapped.correctAnswer = String(q.correctAnswer ?? '');
    }

    // Map visual aid image URLs onto image-referenced questions
    if (q.image_ref && data.visual_urls?.length > 0) {
      const idx = (typeof q.image_ref === 'number' ? q.image_ref : 1) - 1;
      mapped.image_url = data.visual_urls[Math.max(0, Math.min(idx, data.visual_urls.length - 1))];
    } else if (q.image_ref && data.visual_url) {
      mapped.image_url = data.visual_url;
    }

    return mapped;
  });

  // Sanitize ALL AI-generated text before returning to the UI.
  // Do NOT slice here — the server already trims text questions to questionCount
  // and appends visual aid questions on top of that total.
  const sanitized = sanitizeUnit({
    title:     data.title ?? 'New Lesson',
    questions: rawQuestions,
  });

  // Include reading passage if GPT extracted one
  if (data.passage && typeof data.passage === 'string' && data.passage.trim()) {
    sanitized.passage = data.passage.trim();
  }

  // Include lesson intro if GPT generated one
  if (data.lesson_intro && typeof data.lesson_intro === 'string' && data.lesson_intro.trim()) {
    sanitized.lesson_intro = data.lesson_intro.trim();
  }

  // Include image search query for stock photo lookup
  if (data.image_search_query && typeof data.image_search_query === 'string' && data.image_search_query.trim()) {
    sanitized.image_search_query = data.image_search_query.trim();
  }

  // Include pre-fetched Pexels photo URLs so ScanScreen can show a preview
  if (Array.isArray(data.intro_image_urls) && data.intro_image_urls.length > 0) {
    sanitized.intro_image_urls = data.intro_image_urls;
  }

  // Surface shortfall so the UI can show a graceful note to the parent
  if (typeof data.generated_count === 'number' && typeof data.requested_count === 'number') {
    sanitized.generated_count = data.generated_count;
    sanitized.requested_count = data.requested_count;
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

// Generates TTS audio for every question in a saved unit and an optional lesson intro.
// Runs fire-and-forget after saveCustomUnit — never blocks the UI.
// The edge function patches the custom_units row directly with audio_url on each question
// and intro_audio_url when a lesson_intro is provided.
export async function generateAudio(unitId, questions, lessonIntro = null, imageUrls = null) {
  const body = { unit_id: unitId, questions };
  if (lessonIntro)                        body.lesson_intro       = lessonIntro;
  if (Array.isArray(imageUrls) && imageUrls.length > 0) body.intro_image_urls = imageUrls;
  const { error } = await supabase.functions.invoke('generate-audio', { body });
  if (error) throw new Error(error.message ?? 'Audio generation failed');
}

// Regenerates a single question using the same scanned images as context.
// Returns a replacement question object (same shape as a question in the array).
// questionContext — optional extra metadata so the server knows what tool type the original used:
//   { measurementTool, type, protractorMode, coinMode, rulerSubtype, clockMode }
export async function regenerateQuestion(base64Images, existingQuestion, isVisual = false, questionContext = {}) {
  const images = Array.isArray(base64Images) ? base64Images : [base64Images];

  const body = { regenerate: true, images, existingQuestion, isVisual };
  if (questionContext.measurementTool) body.questionContext = questionContext;

  const { data, error } = await supabase.functions.invoke('generate-questions', { body });

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
  const mapped = { question: q.question ?? existingQuestion };
  if (q.hint)            mapped.hint            = q.hint;
  if (q.type)            mapped.type            = q.type;
  if (q.mode)            mapped.mode            = q.mode;
  if (q.geometry)        mapped.geometry        = q.geometry;
  if (q.context)         mapped.context         = q.context;
  if (q.measurementTool) mapped.measurementTool = q.measurementTool;
  if (q.rulerMaxCm)      mapped.rulerMaxCm      = q.rulerMaxCm;
  if (q.rulerSubtype)    mapped.rulerSubtype    = q.rulerSubtype;

  if (!q.type || q.type === 'multiple_choice' || q.type === 'visual_mc') {
    mapped.options      = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['Option A','Option B','Option C','Option D'];
    mapped.correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  }
  if (q.type === 'fill_in') {
    mapped.correctAnswer = String(q.correctAnswer ?? '');
    if (Array.isArray(q.acceptedAnswers)) mapped.acceptedAnswers = q.acceptedAnswers;
  }
  if (q.type === 'number_line') {
    mapped.correctAnswer = String(q.correctAnswer ?? '');
    if (Array.isArray(q.acceptedAnswers)) mapped.acceptedAnswers = q.acceptedAnswers;
    if (Array.isArray(q.options) && q.options.length >= 2) {
      mapped.options      = q.options;
      mapped.correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
    }
  }
  if (q.type === 'ordering') {
    mapped.items        = Array.isArray(q.items)        ? q.items        : [];
    mapped.correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder : [];
  }
  if (q.type === 'true_false') {
    mapped.correctAnswer = typeof q.correctAnswer === 'boolean' ? q.correctAnswer : true;
  }
  if (q.type === 'word_bank') {
    mapped.wordBank      = Array.isArray(q.wordBank) ? q.wordBank : [];
    mapped.correctAnswer = String(q.correctAnswer ?? '');
  }
  return mapped;
}
