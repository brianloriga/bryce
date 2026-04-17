import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Palettes ──────────────────────────────────────────────────
export const dark = {
  id:           'dark',
  bg:           '#0d0d1a',
  bgCard:       '#1a1a2e',
  bgInput:      'rgba(255,255,255,0.07)',
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  accent:       '#4ade80',
  accentDim:    'rgba(74,222,128,0.12)',
  accent2:      '#c084fc',
  accentBtn:    '#16a34a',
  accentBtnShadow: '#16a34a',
  text:         '#ffffff',
  textSub:      'rgba(255,255,255,0.55)',
  textMuted:    'rgba(255,255,255,0.3)',
  danger:       '#f87171',
  dangerDim:    'rgba(248,113,113,0.12)',
  tabBg:        '#0f172a',
  tabActive:    '#4ade80',
  tabInactive:  'rgba(255,255,255,0.35)',
  statusBar:    'light',
  shadow:       '#000',
};

export const light = {
  id:           'light',
  bg:           '#f1f5f9',
  bgCard:       '#ffffff',
  bgInput:      '#f8fafc',
  border:       '#e2e8f0',
  borderStrong: '#cbd5e1',
  accent:       '#2563eb',
  accentDim:    'rgba(37,99,235,0.08)',
  accent2:      '#7c3aed',
  accentBtn:    '#2563eb',
  accentBtnShadow: '#2563eb',
  text:         '#0f172a',
  textSub:      '#64748b',
  textMuted:    '#94a3b8',
  danger:       '#ef4444',
  dangerDim:    '#fee2e2',
  tabBg:        '#0f172a',
  tabActive:    '#4ade80',
  tabInactive:  'rgba(255,255,255,0.35)',
  statusBar:    'dark',
  shadow:       '#94a3b8',
};

const THEME_KEY = '@snapstudy_theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(dark);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light') setTheme(light);
      setLoaded(true);
    });
  }, []);

  async function toggleTheme() {
    const next = theme.id === 'dark' ? light : dark;
    setTheme(next);
    await AsyncStorage.setItem(THEME_KEY, next.id);
  }

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme.id === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
