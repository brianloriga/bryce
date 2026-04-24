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
      userContent.push({
        type: 'text',
        text: `Original question to replace: "${body.existingQuestion ?? ''}"\n\nGenerate ONE replacement question on the same topic. isVisual: ${isVisual}`,
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
      const parsed      = JSON.parse(jsonMatch[0]);
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

    // Over-generate by ~40% so Pass-2 filtering never leaves us short.
    // We trim back to exactly questionCount after validation.
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

    // Build user message
    const userContent: unknown[] = imageList.map((b64) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' },
    }));
    for (const v of rawVisuals) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${v.base64}`, detail: 'high' },
      });
    }

    const pageText = imageList.length > 1
      ? `These are ${imageList.length} pages from the same lesson. Generate exactly ${overGenCount} practice questions spread evenly across all pages.`
      : `Generate exactly ${overGenCount} practice questions from this page.`;

    let visualAidInstruction = '';
    if (rawVisuals.length > 0) {
      const totalVisualQs = rawVisuals.reduce((s, v) => s + (v.questionCount ?? 1), 0);
      const perImageInstructions = rawVisuals.map((v, i) =>
        `Visual Aid ${i + 1} (image at position ${imageList.length + i + 1}): generate exactly ${v.questionCount ?? 1} question(s), mark each with "image_ref": ${i + 1}`
      ).join('. ');
      visualAidInstruction = ` The LAST ${rawVisuals.length} image(s) are visual aids the parent photographed from the same lesson — they are NOT text pages. ${perImageInstructions}. CRITICAL for visual aid questions: you have already read the lesson text pages — use that topic and vocabulary as your anchor. Ask questions that use the image as evidence for a concept from the lesson (e.g. if the lesson is about traits, ask how the image illustrates an inherited or learned trait). Do NOT ask trivial identification questions like "what animal is shown" or "what colour is this" — the question must connect the image to a concept from the lesson text. Reference "the image shown" or "the diagram above" in the question text. The remaining ${overGenCount - totalVisualQs} questions come from the text pages only.`;
    }

    userContent.push({
      type: 'text',
      text: `${pageText}${visualAidInstruction} Every question must include a "hint" field. WORKSHEET EXTRACTION PRIORITY: if the image shows a worksheet or problem set, base the questions as closely as possible on the ACTUAL questions printed on the worksheet — same numbers, same scenarios, same level of difficulty. Do NOT simplify or restate the questions in a generic way. Use fill_in ONLY for math/number calculations, ordering for sequence questions, true_false for comparisons, word_bank for vocabulary/grammar, multiple_choice for all other text-based answers. CRITICAL: visual_mc is ONLY for emoji/symbol pattern sequences (like colour patterns or shape sequences). NEVER use visual_mc for reading comprehension, main idea, vocabulary, science concepts, or any question whose answer is a word or sentence — use regular multiple_choice with text answers instead.`,
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
          max_tokens: 10000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: userContent },
        ],
      }),
    });

    if (!openaiResponse.ok) {
      const err = await openaiResponse.text();
      throw new Error(`OpenAI error: ${err}`);
    }

    const data    = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON. Please try again.');
    const parsed = JSON.parse(jsonMatch[0]);

    // ── Pass 1 logging ────────────────────────────────────────
    if (Array.isArray(parsed.questions)) {
      console.log(`[generate-questions] GPT returned ${parsed.questions.length} question(s) for "${parsed.title}":`);
      (parsed.questions as Array<Record<string, unknown>>).forEach((q, i) => {
        const sc   = q.selfContained;
        const flag = sc === false ? '❌ NOT self-contained' : sc === true ? '✅' : '⚠️  missing selfContained';
        console.log(`  [${i + 1}] ${flag} | type=${q.type ?? 'mc'} | "${q.question}"`);
      });
    }

    // ── Auto-enrich number_line questions before Pass-2 ───────
    if (Array.isArray(parsed.questions)) {
      parsed.questions = enrichNumberLineQuestions(parsed.questions as Array<Record<string, unknown>>);
      parsed.questions = enrichDrawAngleQuestions(parsed.questions as Array<Record<string, unknown>>);
    }

    // ── Pass 2: independent validation via gpt-4o-mini ────────
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      const qs      = parsed.questions as Array<Record<string, unknown>>;
      const allowed = await validateSelfContained(qs, openaiKey);
      const before  = qs.length;
      parsed.questions = qs.filter((_, i) => allowed[i]);
      const dropped2 = qs.filter((_, i) => !allowed[i]);
      if (dropped2.length > 0) {
        console.warn(`[generate-questions] PASS-2 dropped ${dropped2.length} question(s) GPT mislabelled as self-contained:`);
        dropped2.forEach((q, i) => console.warn(`  [${i + 1}] "${q.question}"`));
      }
      console.log(`[generate-questions] Pass-2 result: ${before} → ${parsed.questions.length} questions kept`);

      // Trim surplus from over-generation down to the count the user requested
      if ((parsed.questions as Array<Record<string, unknown>>).length > questionCount) {
        parsed.questions = (parsed.questions as Array<Record<string, unknown>>).slice(0, questionCount);
        console.log(`[generate-questions] Trimmed to exactly ${questionCount} questions`);
      }

      if (parsed.questions.length === 0) {
        console.warn('[generate-questions] All questions failed Pass-2 — worksheet is too visually dependent to digitize');
        return new Response(
          JSON.stringify({
            valid: false,
            reason: 'Every question on this worksheet refers to a diagram or visual that the app cannot reproduce. Try a worksheet where the questions can stand on their own — for example, one with written problems, sequences, or vocabulary rather than diagrams to read.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Retry pass: fill gap if Pass-2 dropped some questions
      const shortfall = questionCount - (parsed.questions as Array<Record<string, unknown>>).length;
      if (shortfall > 0) {
        console.log(`[generate-questions] Shortfall of ${shortfall} — attempting retry pass`);
        try {
          const coveredTopics = (parsed.questions as Array<Record<string, unknown>>)
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
              const retryParsed = JSON.parse(retryMatch[0]);
              let retryQs = (retryParsed.questions as Array<Record<string, unknown>> ?? []);
              retryQs = enrichNumberLineQuestions(retryQs);
              retryQs = enrichDrawAngleQuestions(retryQs);
              const retryAllowed = await validateSelfContained(retryQs, openaiKey);
              const retryKept   = retryQs.filter((_, i) => retryAllowed[i]);
              console.log(`[generate-questions] Retry kept ${retryKept.length} / ${retryQs.length} question(s)`);
              (parsed.questions as Array<Record<string, unknown>>).push(...retryKept.slice(0, shortfall));
            }
          }
        } catch (retryErr) {
          console.warn('[generate-questions] Retry pass failed (non-fatal):', (retryErr as Error).message);
        }
      }
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

    const generatedCount = (safe.questions as unknown[])?.length ?? 0;
    const countMeta = generatedCount < questionCount
      ? { generated_count: generatedCount, requested_count: questionCount }
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
