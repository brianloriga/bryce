// @ts-nocheck — Deno runtime; Node type checker does not understand Deno globals or https:// imports
// Supabase Edge Function — generate-audio
// Receives a unit_id + questions array, generates an OpenAI TTS MP3 for each question
// (reading the question text then A/B/C/D options), uploads to Supabase Storage,
// and patches the custom_units row with audio_url on each question.
//
// Deploy with:
//   npx supabase functions deploy generate-audio --project-ref vwyhxnaunkbrxuzjxpzt --no-verify-jwt
//
// Requires the same OPENAI_API_KEY secret already set for generate-questions.
// Storage bucket setup — run once in Supabase SQL Editor:
//   insert into storage.buckets (id, name, public) values ('question-audio', 'question-audio', true)
//   on conflict (id) do nothing;

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

// Strip emoji and markdown formatting so TTS reads clean prose
function stripForTTS(text: string): string {
  return (text ?? '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F700}-\u{1F7FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[█░▓▒■□▪▫▬►◄◆◇○●]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSpeechText(q: Record<string, unknown>): string {
  const questionText = stripForTTS(q.question as string);
  const options = (q.options as string[] ?? []);
  const optionsText = options
    .slice(0, 4)
    .map((opt, i) => `${OPTION_LETTERS[i]}: ${stripForTTS(opt)}`)
    .join('. ');
  return `${questionText}. ${optionsText}.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const openaiKey    = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { unit_id, questions } = await req.json();

    if (!unit_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'unit_id and questions array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Ensure the storage bucket exists (no-op if already created)
    await supabase.storage.createBucket('question-audio', { public: true }).catch(() => {});

    // Generate all TTS audio files in parallel
    const audioUrls = await Promise.all(
      questions.map(async (q: Record<string, unknown>, i: number) => {
        const speechText = buildSpeechText(q);

        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'nova',
            input: speechText,
          }),
        });

        if (!ttsResponse.ok) {
          const err = await ttsResponse.text();
          throw new Error(`TTS error for question ${i}: ${err}`);
        }

        const audioBuffer = await ttsResponse.arrayBuffer();
        const storagePath = `${unit_id}/${i}.mp3`;

        const { error: uploadError } = await supabase.storage
          .from('question-audio')
          .upload(storagePath, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) throw new Error(`Upload error for question ${i}: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from('question-audio')
          .getPublicUrl(storagePath);

        return urlData.publicUrl;
      }),
    );

    // Patch the custom_units row: add audio_url to each question object
    const updatedQuestions = questions.map((q: Record<string, unknown>, i: number) => ({
      ...q,
      audio_url: audioUrls[i],
    }));

    const { error: dbError } = await supabase
      .from('custom_units')
      .update({ questions: updatedQuestions })
      .eq('id', unit_id);

    if (dbError) throw new Error(`DB update error: ${dbError.message}`);

    return new Response(
      JSON.stringify({ success: true, count: audioUrls.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
