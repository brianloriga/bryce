// @ts-nocheck
// Supabase Edge Function — detect-crop
// Accepts a base64 image and returns a crop bounding box (as percentages) for the
// main educational content in the photo. Uses GPT-4o-mini with detail:low so it
// costs ~$0.00002 per call. Falls back to full-image bounds on any error.
//
// Deploy:
//   npx supabase functions deploy detect-crop --project-ref vwyhxnaunkbrxuzjxpzt --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FALLBACK = { x: 0, y: 0, w: 100, h: 100 };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OpenAI key not configured');

    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ crop: FALLBACK }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: `You are a precise image cropper. Your job is to find the tightest possible crop box that contains ONLY the educational diagram, chart, or printed page — and nothing else.

STEP 1 — identify what kind of shot this is:
A) Photo of a PHYSICAL DEVICE (laptop, monitor, tablet, phone): the screen is a rectangle surrounded by device body, keyboard, bezel, desk surface. Identify the inner edge of the screen glass only.
B) Photo of a PRINTED PAGE or BOOK: identify the text/content area, excluding page margins, hand holding the book, desk surface, or surrounding background.
C) Screenshot or clean image with no device border: return the full image.

STEP 2 — return the bounding box of ONLY the screen display area (case A) or page content area (case B). Be aggressive — the box should be visibly smaller than the full image for cases A and B.

Things to ALWAYS EXCLUDE:
- Keyboard, laptop body, desk surface, hands
- Monitor bezel, stand, frame
- Browser address bars, toolbars, navigation arrows (< >), scroll bars
- Page margins wider than 1cm, book spine, background

Return ONLY this JSON with integer percentage values (0–100):
{"x":<left %>,"y":<top %>,"w":<width %>,"h":<height %>}

For case A (device photo), the screen typically occupies 50-80% of the image. For case B (book photo), the content typically occupies 70-90%. Do NOT return values close to {"x":0,"y":0,"w":100,"h":100} unless the image is already a clean close-up with zero surrounding material.`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return new Response(JSON.stringify({ crop: FALLBACK }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const match = content.match(/\{[^}]+\}/);

    if (!match) {
      return new Response(JSON.stringify({ crop: FALLBACK }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const crop = JSON.parse(match[0]);

    // Clamp values to valid range
    const safe = {
      x: Math.max(0, Math.min(95, Number(crop.x) || 0)),
      y: Math.max(0, Math.min(95, Number(crop.y) || 0)),
      w: Math.max(5, Math.min(100, Number(crop.w) || 100)),
      h: Math.max(5, Math.min(100, Number(crop.h) || 100)),
    };
    // Ensure crop doesn't go out of bounds
    if (safe.x + safe.w > 100) safe.w = 100 - safe.x;
    if (safe.y + safe.h > 100) safe.h = 100 - safe.y;

    return new Response(JSON.stringify({ crop: safe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('detect-crop error:', err);
    // Always return a usable fallback — never break the calling flow
    return new Response(JSON.stringify({ crop: FALLBACK }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
