// @ts-nocheck — Deno runtime; Node type checker does not understand Deno globals or https:// imports
// Supabase Edge Function — generate-questions
// Receives one or more base64 images, validates educational content,
// then calls GPT-4o Vision to generate structured questions.
//
// Deploy with:
//   npx supabase functions deploy generate-questions --project-ref vwyhxnaunkbrxuzjxpzt
//
// Set secret:
//   npx supabase secrets set OPENAI_API_KEY=sk-...

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { SYSTEM_PROMPT, REGEN_SYSTEM_PROMPT } from './prompts.ts';
import { sanitizeQuestion, sanitizeResponse }  from './sanitize.ts';
import { enrichNumberLineQuestions, enrichDrawAngleQuestions, validateSelfContained } from './enrich.ts';
import { MAX_SCANS_PER_DAY, parseJwtUserId }   from './rateLimit.ts';

// Repair unescaped LaTeX backslashes in AI-generated JSON strings so JSON.parse succeeds.
// GPT often writes \frac{}{} or \( \) inside JSON string values without escaping the backslash.
// Strategy (two passes):
//   Pass A: catch clearly invalid escapes like \( \[ \{ \s \c \a \d \e \g \h …
//   Pass B: catch "looks valid but wrong" escapes \f \t \b \n \r followed by more letters
//            (e.g. \frac → pass A misses because \f is valid JSON, but \frac is LaTeX)
function repairLatexJson(raw: string): string {
  return raw
    // Pass A: backslash + char that is NOT a valid JSON escape char at all
    .replace(/\\([^"\\/bfnrtu])/g, '\\\\$1')
    // Pass B: backslash + valid-looking escape char that is actually part of a LaTeX word
    //         e.g. \frac, \times, \beta, \newline — recognise by letter immediately after
    .replace(/\\([bfnrt])(?=[a-zA-Z])/g, '\\\\$1');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// How many image-referenced visual questions to generate based on total count
function imageVisualCount(total: number): number {
  if (total >= 20) return 4;
  if (total >= 15) return 3;
  if (total >= 9)  return 2;
  return 1;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt    = authHeader.replace('Bearer ', '');
    const userId = parseJwtUserId(jwt);

    const body = await req.json();

    // ── Regenerate single question mode ──────────────────────
    if (body.regenerate === true) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const imageList: string[] = body.images
        ? (Array.isArray(body.images) ? body.images : [body.images])
        : [];

      const userContent: unknown[] = imageList.map((b64) => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
      }));

      const isVisual = body.isVisual === true;

      // Build a rich context description so GPT knows exactly what tool/type to reproduce
      const qc = body.questionContext as Record<string, string> | undefined;
      let toolContextLine = '';
      if (qc?.measurementTool === 'protractor') {
        const mode = qc.protractorMode ?? 'read';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="protractor", protractorMode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"protractor" and the SAME protractorMode:"${mode}". ` +
          `Generate a FRESH random angleDeg (never reuse the original angle). See MEASUREMENT TOOL REGEN RULES in your instructions.`;
      } else if (qc?.measurementTool === 'ruler') {
        const sub = qc.rulerSubtype ?? 'endpoint';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="ruler", rulerSubtype="${sub}". ` +
          `You MUST generate a fill_in question with measurementTool:"ruler" and rulerSubtype:"${sub}" (or omit for endpoint). ` +
          `Generate a fresh length and color. See MEASUREMENT TOOL REGEN RULES in your instructions.`;
      } else if (qc?.measurementTool === 'coin') {
        const mode = qc.coinMode ?? 'count';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="coin", mode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"coin" and geometry.mode:"${mode}". ` +
          `Generate FRESH coin combinations. See MEASUREMENT TOOL REGEN RULES in your instructions.`;
      } else if (qc?.measurementTool === 'clock') {
        const mode = qc.clockMode ?? 'read';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="clock", clockMode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"clock" and geometry.clockMode:"${mode}". ` +
          `Generate FRESH hours and minutes — NEVER reuse the original time. See MEASUREMENT TOOL REGEN RULES in your instructions.`;
      } else if (qc?.measurementTool === 'fraction_bar') {
        const mode = qc.fractionBarMode ?? 'read';
        const modeExtra = mode === 'compare'
          ? 'Generate FRESH parts/shaded/parts2/shaded2. Compute correctAnswer="top"|"bottom"|"equal" precisely.'
          : mode === 'equivalent'
          ? 'Generate FRESH parts/shaded and parts2 (must give a whole-number equivalent). Set correctAnswer=round((shaded/parts)*parts2) as a string.'
          : 'Generate FRESH parts (2–10) and shaded (1 to parts−1). shaded must be ≥ 1 and < parts.';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="fraction_bar", mode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"fraction_bar" and geometry.mode:"${mode}". ` +
          `${modeExtra} Use grade-appropriate denominators (2,3,4,5,6,8,10). See MEASUREMENT TOOL REGEN RULES.`;
      } else if (qc?.measurementTool === 'fraction_build') {
        toolContextLine = `\nORIGINAL TOOL: measurementTool="fraction_build". ` +
          `You MUST generate a fill_in question with measurementTool:"fraction_build" and geometry.target="<N>/<D>". ` +
          `Generate a FRESH target fraction (denominator 2,3,4,5,6,8,10; numerator ≥ 1 and < denominator). ` +
          `correctAnswer = geometry.target. See MEASUREMENT TOOL REGEN RULES.`;
      } else if (qc?.measurementTool === 'fraction_number_line') {
        const mode = qc.fractionNumberLineMode ?? 'read';
        const modeExtra = mode === 'order'
          ? 'Generate 3 FRESH distinct tick indices (fractions array). correctAnswer = sorted fraction strings joined with comma.'
          : 'Generate FRESH denominator (2–8) and target (1 to denominator−1). correctAnswer = fraction string.';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="fraction_number_line", mode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"fraction_number_line" and geometry.mode:"${mode}". ` +
          `${modeExtra} See MEASUREMENT TOOL REGEN RULES.`;
      } else if (qc?.measurementTool === 'measuring_cup') {
        const mode = qc.cupMode ?? 'read';
        const modeExtra = mode === 'compare'
          ? 'Generate FRESH level (0.25/0.5/0.75/1.0) and level2 (0.25/0.5/0.75/1.0). correctAnswer = "left"|"right"|"equal".'
          : mode === 'fill'
          ? 'Generate FRESH currentLevel and targetLevel (both in 0.25/0.5/0.75/1.0; targetLevel > currentLevel). correctAnswer = difference as fraction string e.g. "½ cup".'
          : 'Generate FRESH level (0.25/0.5/0.75/1.0). correctAnswer = fraction label e.g. "½ cup".';
        toolContextLine = `\nORIGINAL TOOL: measurementTool="measuring_cup", mode="${mode}". ` +
          `You MUST generate a fill_in question with measurementTool:"measuring_cup" and geometry.mode:"${mode}". ` +
          `${modeExtra} See MEASUREMENT TOOL REGEN RULES.`;
      }

      userContent.push({
        type: 'text',
        text: `Original question to replace: "${body.existingQuestion ?? ''}"${toolContextLine}\n\nGenerate ONE replacement question on the same topic. isVisual: ${isVisual}`,
      });

      const regenResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 800,
          messages: [
            { role: 'system', content: REGEN_SYSTEM_PROMPT },
            { role: 'user',   content: userContent },
          ],
        }),
      });

      if (!regenResponse.ok) {
        const err = await regenResponse.text();
        throw new Error(`OpenAI error: ${err}`);
      }

      const regenData    = await regenResponse.json();
      const regenContent = regenData.choices?.[0]?.message?.content ?? '';
      const jsonMatch    = regenContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON. Please try again.');
      const parsed      = JSON.parse(repairLatexJson(jsonMatch[0]));
      const sanitizedQ  = sanitizeQuestion(parsed.question ?? parsed);

      return new Response(
        JSON.stringify({ question: sanitizedQ }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Rate limiting (full generation only) ─────────────────
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabase    = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', todayStart.toISOString());

      if ((count ?? 0) >= MAX_SCANS_PER_DAY) {
        return new Response(
          JSON.stringify({ error: `Daily scan limit reached (${MAX_SCANS_PER_DAY}/day). Try again tomorrow.` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Accept `images` array (new) or legacy `imageBase64` string
    const imageList: string[] = body.images
      ? (Array.isArray(body.images) ? body.images : [body.images])
      : body.imageBase64
        ? [body.imageBase64]
        : [];

    type VisualItem = { base64: string; questionCount: number };
    const rawVisuals: VisualItem[] = Array.isArray(body.visualImages)
      ? body.visualImages
      : body.visualImage
        ? [{ base64: body.visualImage, questionCount: imageVisualCount(Math.min(Math.max(Number(body.questionCount) || 9, 5), 20)) }]
        : [];

    const questionCount: number = Math.min(Math.max(Number(body.questionCount) || 9, 5), 20);

    // Visual aid questions are ADDITIVE — they do not consume from the text budget.
    const totalVisualQs: number = rawVisuals.reduce((s, v) => s + (v.questionCount ?? 1), 0);

    // Over-generate text questions by ~40% so Pass-2 filtering never leaves us short.
    // Visual aid questions are requested on top of this, separately.
    const overGenCount: number = questionCount + Math.ceil(questionCount * 0.4);

    if (imageList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload visual aid images to Supabase Storage
    const visualUrls: string[] = [];
    if (rawVisuals.length > 0) {
      const supabaseUrl   = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabaseAdmin = createClient(supabaseUrl, serviceKey);
      await supabaseAdmin.storage.createBucket('lesson-visuals', { public: true }).catch(() => {});

      for (let vi = 0; vi < rawVisuals.length; vi++) {
        const b64 = rawVisuals[vi].base64;
        try {
          const binaryStr = atob(b64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const storagePath = `${userId ?? 'anon'}/${Date.now()}-${vi}.jpg`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('lesson-visuals')
            .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });
          if (!uploadError) {
            const { data: urlData } = supabaseAdmin.storage
              .from('lesson-visuals').getPublicUrl(storagePath);
            visualUrls.push(urlData.publicUrl);
          } else {
            visualUrls.push('');
          }
        } catch {
          visualUrls.push('');
        }
      }
    }

    // ── Image block helpers ───────────────────────────────────
    // high  — full detail, used for lesson pages in the text call and for the VA image itself
    // low   — ~85 tokens/image, used for lesson pages sent as topic context in VA calls
    function imgBlock(b64: string): Record<string, unknown> {
      return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } };
    }
    function imgBlockLow(b64: string): Record<string, unknown> {
      return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } };
    }

    // Common suffix appended to every generation prompt
    const QUESTION_RULES =
      ' Every question must include a "hint" field.' +
      ' WORKSHEET EXTRACTION PRIORITY: if the image shows a worksheet or problem set, base the questions as closely as possible on the ACTUAL questions printed on the worksheet — same numbers, same scenarios, same level of difficulty.' +
      ' Use fill_in ONLY for math/number calculations, ordering for sequence questions, true_false for comparisons, word_bank for vocabulary/grammar, multiple_choice for all other text-based answers.' +
      ' CRITICAL: visual_mc is ONLY for emoji/symbol pattern sequences. NEVER use visual_mc for reading comprehension, main idea, vocabulary, or science concepts.';

    // ── Track A: text questions (lesson pages only, NO visual aids) ──
    const textContent: unknown[] = imageList.map(imgBlock);
    textContent.push({
      type: 'text',
      text: (imageList.length > 1
        ? `These are ${imageList.length} pages from the same lesson. Generate exactly ${overGenCount} practice questions spread evenly across all pages.`
        : `Generate exactly ${overGenCount} practice questions from this page.`
      ) + QUESTION_RULES,
    });

    const textCallPromise = fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 10000,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: textContent }],
      }),
    });

    // ── Track B: one dedicated GPT call per visual aid ────────
    // Each call sees ONLY the lesson pages + that ONE visual aid image.
    // This completely eliminates cross-image contamination.
    const visualCallPromises = rawVisuals.map((visual, i) => {
      const imageRef = i + 1;
      const n = visual.questionCount ?? 1;
      const vaContent: unknown[] = [
        ...imageList.map(imgBlockLow),
        imgBlock(visual.base64),
        {
          type: 'text',
          text:
            `The LAST image is a visual aid photo from the same lesson. ` +
            `Generate exactly ${n} question${n > 1 ? 's' : ''} about ONLY this visual aid image. ` +
            `Rules: ` +
            `(1) Set "image_ref": ${imageRef} and "selfContained": true on every question. ` +
            `(2) Questions must be directly about what is VISIBLE in this specific image — no content from any other image. ` +
            `(3) Connect the image content to the lesson topic and vocabulary from the text pages. ` +
            `(4) Reference "the image shown" or "the image above" — never "Image A/B/C" or "the top-left image". ` +
            `(5) ALL answer options must come from this image only. ` +
            `(6) Every question must include a "hint" field. ` +
            `Use multiple_choice unless the question clearly fits true_false, word_bank, or ordering.`,
        },
      ];
      return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: Math.max(1200, n * 600),
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: vaContent }],
        }),
      });
    });

    // ── Run text + all visual aid calls in parallel ───────────
    const [openaiResponse, ...vaResponses] = await Promise.all([textCallPromise, ...visualCallPromises]);

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data    = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON. Please try again.');
    const parsed = JSON.parse(repairLatexJson(jsonMatch[0]));

    // ── Parse visual aid responses ────────────────────────────
    const rawVisualQs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < vaResponses.length; i++) {
      const imageRef = i + 1;
      const resp = vaResponses[i];
      if (!resp.ok) {
        console.warn(`[generate-questions] Visual aid ${imageRef} HTTP ${resp.status} — skipping`);
        continue;
      }
      const vaData    = await resp.json();
      const vaText    = vaData.choices?.[0]?.message?.content ?? '';
      const vaMatch   = vaText.match(/\{[\s\S]*\}/);
      if (!vaMatch) {
        console.warn(`[generate-questions] Visual aid ${imageRef}: no JSON returned`);
        continue;
      }
      const vaParsed = JSON.parse(repairLatexJson(vaMatch[0]));
      const vaQs     = (vaParsed.questions ?? []) as Array<Record<string, unknown>>;
      // Force correct image_ref and selfContained regardless of what GPT wrote
      const tagged = vaQs.map(q => ({ ...q, image_ref: imageRef, selfContained: true }));
      console.log(`[generate-questions] Visual aid ${imageRef}: ${tagged.length} question(s) returned`);
      rawVisualQs.push(...tagged);
    }

    // ── Pass 1 logging (text questions) ──────────────────────
    if (Array.isArray(parsed.questions)) {
      console.log(`[generate-questions] Text track: ${parsed.questions.length} question(s) for "${parsed.title}"`);
      (parsed.questions as Array<Record<string, unknown>>).forEach((q, i) => {
        const sc   = q.selfContained;
        const flag = sc === false ? '❌' : sc === true ? '✅' : '⚠️';
        console.log(`  [${i + 1}] ${flag} | ${q.type ?? 'mc'} | "${q.question}"`);
      });
    }

    // ── Auto-enrich number_line questions before Pass-2 ───────
    if (Array.isArray(parsed.questions)) {
      parsed.questions = enrichNumberLineQuestions(parsed.questions as Array<Record<string, unknown>>);
      parsed.questions = enrichDrawAngleQuestions(parsed.questions as Array<Record<string, unknown>>);
    }

    // ── Pass 2: validate TEXT questions only ──────────────────
    // Visual aid questions are auto-approved (selfContained forced to true above,
    // and the pre-filter in validateSelfContained passes image_ref questions instantly).
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const qs      = parsed.questions as Array<Record<string, unknown>>;
      const allowed = await validateSelfContained(qs, openaiKey);
      const before  = qs.length;
      parsed.questions = qs.filter((_, i) => allowed[i]);
      const dropped2 = qs.filter((_, i) => !allowed[i]);
      if (dropped2.length > 0) {
        console.warn(`[generate-questions] PASS-2 dropped ${dropped2.length} text question(s):`);
        dropped2.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
      }
      console.log(`[generate-questions] Pass-2 text: ${before} → ${parsed.questions.length} kept`);

      // Text questions only (visual aids handled separately)
      const visualQs = rawVisualQs; // already tagged, pre-approved
      let   textQs   = parsed.questions as Array<Record<string, unknown>>;

      // Trim surplus TEXT questions down to the count the user requested (visual aid questions are kept in full)
      if (textQs.length > questionCount) {
        textQs = textQs.slice(0, questionCount);
        console.log(`[generate-questions] Trimmed text questions to exactly ${questionCount}`);
      }
      console.log(`[generate-questions] text=${textQs.length}/${questionCount} visual=${visualQs.length}/${totalVisualQs}`);

      if (textQs.length === 0 && visualQs.length === 0) {
        console.warn('[generate-questions] All questions failed Pass-2 — worksheet is too visually dependent to digitize');
        return new Response(
          JSON.stringify({
            valid: false,
            reason: 'Every question on this worksheet refers to a diagram or visual that the app cannot reproduce. Try a worksheet where the questions can stand on their own — for example, one with written problems, sequences, or vocabulary rather than diagrams to read.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Retry pass: fill gap in TEXT questions only if Pass-2 dropped some
      const shortfall = questionCount - textQs.length;
      if (shortfall > 0) {
        console.log(`[generate-questions] Shortfall of ${shortfall} text question(s) — attempting retry pass`);
        try {
          const coveredTopics = textQs
            .map((q) => String(q.question ?? '').slice(0, 80))
            .join(' | ');

          const retryContent: unknown[] = imageList.map((b64) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
          }));
          // Ask for 2× the shortfall so one bad question doesn't leave us short again
          const retryAsk = shortfall * 2;
          retryContent.push({
            type: 'text',
            text: `Generate exactly ${retryAsk} MORE practice questions from this page. Every question must include a "hint" field. IMPORTANT: do NOT repeat any of these already-covered topics: ${coveredTopics}. Focus on parts of the worksheet not yet covered. CRITICAL: every question must be fully self-contained — do NOT generate questions that reference a diagram, image, chart, or visual that is not rendered by the app (e.g. "Which choice best represents ∠XYZ?" is not self-contained unless it has a geometry field). Prefer text-based question types: definitions, true/false, vocabulary, calculations, or concept questions. Apply all the same rules as before (self-contained, correct type/mode, etc.).`,
          });

          const retryResp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-4o',
              max_tokens: 4000,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: retryContent },
              ],
            }),
          });

          if (retryResp.ok) {
            const retryData  = await retryResp.json();
            const retryText  = retryData.choices?.[0]?.message?.content ?? '';
            const retryMatch = retryText.match(/\{[\s\S]*\}/);
            if (retryMatch) {
              const retryParsed = JSON.parse(repairLatexJson(retryMatch[0]));
              let retryQs = (retryParsed.questions as Array<Record<string, unknown>> ?? []);
              retryQs = enrichNumberLineQuestions(retryQs);
              retryQs = enrichDrawAngleQuestions(retryQs);
              const retryAllowed = await validateSelfContained(retryQs, openaiKey);
              // Only pick text questions from the retry (no image_ref)
              const retryKept = retryQs.filter((q, i) => retryAllowed[i] && q.image_ref == null);
              console.log(`[generate-questions] Retry kept ${retryKept.length} / ${retryQs.length} question(s)`);
              textQs.push(...retryKept.slice(0, shortfall));
            }
          }
        } catch (retryErr) {
          console.warn('[generate-questions] Retry pass failed (non-fatal):', (retryErr as Error).message);
        }
      }

      // Recombine: text questions first, then visual aid questions appended at the end
      parsed.questions = [...textQs, ...visualQs];
      console.log(`[generate-questions] title="${parsed.title}" raw=${before} kept=${parsed.questions.length} dropped=${before - parsed.questions.length} missingField=0`);
    }

    const safe = sanitizeResponse(parsed);

    // Fetch Pexels stock photos using the AI-generated search query.
    // Runs in parallel with the rate-limit log so it doesn't add meaningful latency.
    let introImageUrls: string[] = [];
    const imageSearchQuery = (safe.image_search_query as string | undefined) ?? '';
    if (imageSearchQuery) {
      const pexelsKey = Deno.env.get('PEXELS_API_KEY');
      if (pexelsKey) {
        try {
          const query     = encodeURIComponent(imageSearchQuery.trim());
          const pexelsRes = await fetch(
            `https://api.pexels.com/v1/search?query=${query}&per_page=3&orientation=landscape`,
            { headers: { Authorization: pexelsKey } },
          );
          if (pexelsRes.ok) {
            const pexelsData = await pexelsRes.json();
            introImageUrls = (pexelsData.photos ?? [])
              .map((p: Record<string, unknown>) =>
                (p.src as Record<string, string>)?.large ?? (p.src as Record<string, string>)?.original ?? ''
              )
              .filter(Boolean)
              .slice(0, 3);
          }
        } catch (pexelsErr) {
          console.warn('[generate-questions] Pexels fetch failed (non-fatal):', (pexelsErr as Error).message);
        }
      }
    }

    // Log the scan for rate limiting (fire-and-forget)
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabase    = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      supabase.from('scan_logs').insert({ user_id: userId }).then(() => {});
    }

    const allGenerated   = (safe.questions as Array<Record<string, unknown>> | undefined) ?? [];
    const textGenerated  = allGenerated.filter((q) => q.image_ref == null).length;
    const countMeta = textGenerated < questionCount
      ? { generated_count: allGenerated.length, requested_count: questionCount + totalVisualQs }
      : {};

    const responseBody = {
      ...(visualUrls.length > 0 ? { ...safe, visual_urls: visualUrls, visual_url: visualUrls[0] } : safe),
      ...countMeta,
      ...(introImageUrls.length > 0 ? { intro_image_urls: introImageUrls } : {}),
    };

    return new Response(
      JSON.stringify(responseBody),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
