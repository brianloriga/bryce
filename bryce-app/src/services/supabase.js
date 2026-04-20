import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const supabaseKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';


export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Use AsyncStorage so the session survives app restarts
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Auth helpers ─────────────────────────────────────────────

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Kid Profile helpers ───────────────────────────────────────

export async function getKidProfiles() {
  const { data, error } = await supabase
    .from('kid_profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createKidProfile(name, avatar = '🦁') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to create a kid profile');

  const { data, error } = await supabase
    .from('kid_profiles')
    .insert({ name, avatar, parent_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateKidProfile(kidId, { name, avatar }) {
  const { data, error } = await supabase
    .from('kid_profiles')
    .update({ name, avatar })
    .eq('id', kidId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteKidProfile(kidId) {
  const { error } = await supabase
    .from('kid_profiles')
    .delete()
    .eq('id', kidId);
  if (error) throw error;
}

// ── Progress helpers ─────────────────────────────────────────

export async function getProgressForKid(kidId) {
  const { data, error } = await supabase
    .from('progress')
    .select('game_key, best_score')
    .eq('kid_id', kidId);
  if (error) throw error;
  // Return as flat object: { numberline: 7, tools: 5, ... }
  return Object.fromEntries((data ?? []).map(r => [r.game_key, r.best_score]));
}

export async function syncProgressToSupabase(kidId, scores) {
  // scores = { numberline: 7, tools: 5, ... }
  const { error } = await supabase.rpc('upsert_progress', {
    p_kid_id: kidId,
    p_scores: scores,
  });
  if (error) throw error;
}

// ── Custom Unit helpers ───────────────────────────────────────

export async function saveCustomUnit(title, questions, unitLabel = null, passage = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be signed in to save units');

  const row = {
    title,
    questions,
    unit_label: unitLabel,
    subject: 'custom',
    parent_id: user.id,
  };
  if (passage) row.passage = passage;

  const { data, error } = await supabase
    .from('custom_units')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCustomUnits() {
  const { data, error } = await supabase
    .from('custom_units')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteCustomUnit(unitId) {
  const { error } = await supabase
    .from('custom_units')
    .delete()
    .eq('id', unitId);
  if (error) throw error;
}

// ── Quiz Result helpers ───────────────────────────────────────

export async function saveQuizResult({ kidId, unitId, unitTitle, score, total, stars }) {
  const { error } = await supabase
    .from('quiz_results')
    .insert({ kid_id: kidId, unit_id: unitId, unit_title: unitTitle, score, total, stars });
  if (error) throw error;
}

export async function getQuizResultsForKid(kidId) {
  const { data, error } = await supabase
    .from('quiz_results')
    .select('*')
    .eq('kid_id', kidId)
    .order('played_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Subscription helpers ─────────────────────────────────────

export async function getSubscriptionStatus() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'free';
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.status ?? 'free';
}
