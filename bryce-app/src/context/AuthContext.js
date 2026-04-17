import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { getKidProfiles, getProgressForKid } from '../services/supabase';
import { saveActiveKid, getActiveKid, buildLocalStoragePayload } from '../services/progressSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null);   // Supabase session
  const [user, setUser]               = useState(null);   // Supabase user
  const [kidProfiles, setKidProfiles] = useState([]);     // This parent's kids
  const [activeKid, setActiveKidState] = useState(null);  // Currently playing kid
  const [cloudScores, setCloudScores] = useState(null);   // Flat scores from Supabase
  const [loading, setLoading]         = useState(true);

  // ── Listen for auth state changes ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load kid profiles when user logs in ────────────────────
  useEffect(() => {
    if (!user) {
      setKidProfiles([]);
      setActiveKidState(null);
      setCloudScores(null);
      setLoading(false);
      return;
    }
    loadKidProfiles();
  }, [user]);

  async function loadKidProfiles() {
    setLoading(true);
    try {
      const profiles = await getKidProfiles();
      setKidProfiles(profiles);

      // Restore last active kid
      const savedKidId = await getActiveKid();
      const match = profiles.find(p => p.id === savedKidId);
      if (match) {
        await selectKid(match, false); // false = don't persist again
      }
    } catch (err) {
      console.warn('[AuthContext] loadKidProfiles error:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Select which kid is playing ────────────────────────────
  async function selectKid(kid, persist = true) {
    console.log('[selectKid] called with:', kid?.name, kid?.id);
    setActiveKidState(kid);
    if (persist) await saveActiveKid(kid.id);
    console.log('[selectKid] activeKid set, loading scores...');

    // Load their cloud scores so GameScreen can inject into WebView
    try {
      const scores = await getProgressForKid(kid.id);
      console.log('[selectKid] scores loaded:', Object.keys(scores).length, 'games');
      setCloudScores(scores);
    } catch (err) {
      console.warn('[selectKid] getProgressForKid error:', err.message);
      setCloudScores({});
    }
    console.log('[selectKid] done');
  }

  // The localStorage JSON string to inject into the WebView on startup
  const initialLocalStoragePayload = cloudScores
    ? buildLocalStoragePayload(cloudScores)
    : null;

  const value = {
    session,
    user,
    kidProfiles,
    activeKid,
    cloudScores,
    loading,
    selectKid,
    reloadKids: loadKidProfiles,
    initialLocalStoragePayload,
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
