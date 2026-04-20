-- ============================================================
-- BryceLearning — Supabase Database Schema
-- ============================================================
-- Run this in the Supabase SQL Editor:
--   Dashboard → SQL Editor → New Query → paste → Run
-- ============================================================

-- ── Kid Profiles ────────────────────────────────────────────
-- One parent account can have multiple kids.
CREATE TABLE IF NOT EXISTS kid_profiles (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  avatar      TEXT        DEFAULT '🦁',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: parents can only see their own kids
ALTER TABLE kid_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage own kids" ON kid_profiles
  FOR ALL USING (auth.uid() = parent_id);


-- ── Progress ─────────────────────────────────────────────────
-- Stores the best score for each game activity per kid.
-- game_key matches the keys in the JS app, e.g. 'numberline', 'tools', etc.
CREATE TABLE IF NOT EXISTS progress (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  kid_id      UUID        REFERENCES kid_profiles(id) ON DELETE CASCADE NOT NULL,
  game_key    TEXT        NOT NULL,
  best_score  INTEGER     DEFAULT 0 CHECK (best_score >= 0 AND best_score <= 9),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (kid_id, game_key)
);

-- Row Level Security: only the parent of this kid can read/write
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage kid progress" ON progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kid_profiles
      WHERE kid_profiles.id = progress.kid_id
        AND kid_profiles.parent_id = auth.uid()
    )
  );


-- ── Subscriptions ────────────────────────────────────────────
-- Synced from RevenueCat webhook (Phase 4).
-- For now, all users start on 'free'.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  status      TEXT        DEFAULT 'free' CHECK (status IN ('free', 'premium')),
  expires_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- Only server-side (service role) can write subscriptions
CREATE POLICY "Service role writes subscriptions" ON subscriptions
  FOR ALL USING (false); -- Blocked for anon/authed; use service role key from webhook


-- ── Custom Units (AI-generated) ──────────────────────────────
-- Unlocked in Phase 3 (camera + AI scanning). Premium only.
CREATE TABLE IF NOT EXISTS custom_units (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT        NOT NULL,
  subject     TEXT        DEFAULT 'math',
  unit_label  TEXT,       -- e.g. '13.2', 'Chapter 7'
  questions   JSONB       NOT NULL, -- Array of { question, options, correctIndex }
  passage     TEXT,       -- Optional reading passage/story extracted from scanned pages
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE custom_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage own units" ON custom_units
  FOR ALL USING (auth.uid() = parent_id);


-- ── Quiz Results ─────────────────────────────────────────────
-- Records every quiz attempt for history, improvement tracking, and the
-- progress dashboard (Phase 7.20). unit_id may be null if the unit is deleted.
CREATE TABLE IF NOT EXISTS quiz_results (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  kid_id      UUID        REFERENCES kid_profiles(id) ON DELETE CASCADE NOT NULL,
  unit_id     UUID        REFERENCES custom_units(id) ON DELETE SET NULL,
  unit_title  TEXT        NOT NULL,
  score       INTEGER     NOT NULL,
  total       INTEGER     NOT NULL,
  stars       INTEGER     NOT NULL CHECK (stars >= 0 AND stars <= 3),
  played_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parents manage kid quiz results" ON quiz_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kid_profiles
      WHERE kid_profiles.id = quiz_results.kid_id
        AND kid_profiles.parent_id = auth.uid()
    )
  );


-- ── Scan Logs (rate limiting) ─────────────────────────────────
-- One row per AI scan request. The Edge Function checks this table
-- to enforce a max of 20 scans per user per day.
CREATE TABLE IF NOT EXISTS scan_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scanned_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own scan logs" ON scan_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scan logs" ON scan_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── Helper Function: upsert_progress ─────────────────────────
-- Called from the app to batch-update all game scores at once.
CREATE OR REPLACE FUNCTION upsert_progress(
  p_kid_id   UUID,
  p_scores   JSONB   -- { "numberline": 7, "tools": 5, ... }
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  game_key TEXT;
  score    INTEGER;
BEGIN
  -- Verify the caller owns this kid profile
  IF NOT EXISTS (
    SELECT 1 FROM kid_profiles
    WHERE id = p_kid_id AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  FOR game_key, score IN
    SELECT key, value::int FROM jsonb_each_text(p_scores)
  LOOP
    INSERT INTO progress (kid_id, game_key, best_score, updated_at)
    VALUES (p_kid_id, game_key, score, NOW())
    ON CONFLICT (kid_id, game_key)
    DO UPDATE SET
      best_score = GREATEST(progress.best_score, EXCLUDED.best_score),
      updated_at = NOW();
  END LOOP;
END;
$$;
