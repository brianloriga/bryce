import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import Markdown from '@ronradtke/react-native-markdown-display';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform, Keyboard, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { saveQuizResult } from '../services/supabase';
import { resolveSubject } from '../utils/subjects';
import { findGame, AVAILABLE_GAMES, GAME_REGISTRY } from '../minigames/registry';
import { getEnabledMap } from '../services/gameSettings';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

// ── Fill-in answer matching helpers ──────────────────────────

// True when the string looks like a math/numeric answer (digits, decimals,
// fractions, currency symbols, percentages). Numeric answers stay exact-match
// only so "0.35" never accidentally accepts "0.3".
function isNumericAnswer(s) {
  return /^[\d\s.,¢$%\/\\-]+$/.test(s.trim());
}

// Levenshtein edit distance — used for spelling tolerance.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// How many edit-distance mistakes we allow based on correct answer length.
// Very short words (≤3 chars) get no tolerance — "cat"→"car" must be exact.
function spellingTolerance(len) {
  if (len <= 3)  return 0;
  if (len <= 6)  return 1;
  return 2;
}

// Returns true if the typed answer should be counted correct against one
// candidate answer string. Handles three cases beyond exact match:
//   1. Extra trailing words — "main entrance" typed when answer is "main"
//   2. Spelling mistakes    — within Levenshtein tolerance for non-numeric
//   3. Already covered by exact/acceptedAnswers match upstream
function isFuzzyMatch(typed, correct) {
  if (isNumericAnswer(correct)) return false; // math stays exact

  // 1. Starts-with word-boundary: correct answer sits at the front of what
  //    was typed, followed by a space or end of string.
  //    "main entrance" → correct "main" → typed[4] === ' ' ✓
  if (
    typed.length > correct.length &&
    typed.startsWith(correct) &&
    typed[correct.length] === ' '
  ) return true;

  // 2. Spelling tolerance (Levenshtein).
  const tolerance = spellingTolerance(correct.length);
  if (tolerance > 0 && levenshtein(typed, correct) <= tolerance) return true;

  return false;
}

const TYPE_LABELS = {
  fill_in:    'Fill in the blank',
  ordering:   'Put in order',
  true_false: 'True or False',
  word_bank:  'Word Bank',
  visual_mc:  'Visual Question',
};

function getStars(correct, total) {
  const pct = correct / total;
  if (pct >= 0.89) return 3;
  if (pct >= 0.67) return 2;
  if (pct >= 0.45) return 1;
  return 0;
}

// ── Context reference card ────────────────────────────────────
// Allowed icon names map to Ionicons "-outline" variants.
// GPT picks from a restricted list we define in the prompt.
const ICON_MAP = {
  // Transport
  car: 'car-outline', bicycle: 'bicycle-outline', bus: 'bus-outline',
  train: 'train-outline', airplane: 'airplane-outline', boat: 'boat-outline',
  walk: 'walk-outline', rocket: 'rocket-outline', subway: 'subway-outline',
  // Animals / Nature
  paw: 'paw-outline', fish: 'fish-outline', bug: 'bug-outline',
  bird: 'egg-outline',    // closest available; bird-outline not in Ionicons5
  egg: 'egg-outline', leaf: 'leaf-outline', flower: 'flower-outline',
  rose: 'rose-outline', water: 'water-outline', flame: 'flame-outline', snow: 'snow-outline',
  // Weather
  rainy: 'rainy-outline', sunny: 'sunny-outline', 'partly-sunny': 'partly-sunny-outline',
  cloud: 'cloud-outline', thunderstorm: 'thunderstorm-outline',
  umbrella: 'umbrella-outline', thermometer: 'thermometer-outline', moon: 'moon-outline',
  // Space
  planet: 'planet-outline', globe: 'globe-outline', earth: 'earth-outline',
  telescope: 'telescope-outline',
  // Science
  flask: 'flask-outline', magnet: 'magnet-outline', flash: 'flash-outline',
  bulb: 'bulb-outline', prism: 'prism-outline', pulse: 'pulse-outline',
  bandage: 'bandage-outline', medkit: 'medkit-outline',
  body: 'body-outline', eye: 'eye-outline', ear: 'ear-outline',
  // People
  person: 'person-outline', people: 'people-outline',
  man: 'man-outline', woman: 'woman-outline', baby: 'happy-outline',
  male: 'male-outline', female: 'female-outline',
  // School / Art
  book: 'book-outline', school: 'school-outline', pencil: 'pencil-outline',
  backpack: 'backpack-outline', library: 'library-outline',
  clipboard: 'clipboard-outline', brush: 'brush-outline',
  'color-palette': 'color-palette-outline', calculator: 'calculator-outline',
  document: 'document-outline',
  // Awards / Sports
  medal: 'medal-outline', trophy: 'trophy-outline', ribbon: 'ribbon-outline',
  star: 'star-outline', podium: 'podium-outline',
  basketball: 'basketball-outline', football: 'american-football-outline',
  baseball: 'baseball-outline', tennisball: 'tennisball-outline',
  golf: 'golf-outline', fitness: 'fitness-outline', stopwatch: 'stopwatch-outline',
  // Food
  nutrition: 'nutrition-outline', pizza: 'pizza-outline',
  'fast-food': 'fast-food-outline', 'ice-cream': 'ice-cream-outline',
  cafe: 'cafe-outline', restaurant: 'restaurant-outline', cart: 'cart-outline',
  // Money / Shopping
  cash: 'cash-outline', card: 'card-outline', bag: 'bag-outline',
  gift: 'gift-outline', pricetag: 'pricetag-outline',
  receipt: 'receipt-outline', wallet: 'wallet-outline',
  // Time
  clock: 'time-outline', time: 'time-outline', hourglass: 'hourglass-outline',
  timer: 'timer-outline', calendar: 'calendar-outline', alarm: 'alarm-outline',
  // Community / Home
  home: 'home-outline', flag: 'flag-outline', storefront: 'storefront-outline',
  key: 'key-outline', map: 'map-outline', compass: 'compass-outline',
  location: 'location-outline', pin: 'pin-outline', newspaper: 'newspaper-outline',
  // Math / Shapes
  cube: 'cube-outline', shapes: 'shapes-outline', triangle: 'triangle-outline',
  square: 'square-outline', diamond: 'diamond-outline', ellipse: 'ellipse-outline',
  infinite: 'infinite-outline', 'pie-chart': 'pie-chart-outline',
  'bar-chart': 'bar-chart-outline', 'stats-chart': 'stats-chart-outline',
  // Music
  'musical-note': 'musical-note-outline', 'musical-notes': 'musical-notes-outline',
  // Heart / General
  heart: 'heart-outline',
  // Fallbacks
  grid: 'grid-outline', layers: 'layers-outline', image: 'image-outline',
};

function ContextCard({ context, accentColor }) {
  if (!context?.type) return null;
  const accent = accentColor ?? '#60a5fa';

  if (context.type === 'grid') {
    const items = context.items ?? [];
    // Lay out items 2-per-row
    const pairs = [];
    for (let i = 0; i < items.length; i += 2) {
      pairs.push([items[i], items[i + 1] ?? null]);
    }
    return (
      <View style={ctxStyles.card}>
        <View style={[ctxStyles.accentBar, { backgroundColor: accent }]} />
        <View style={ctxStyles.inner}>
          {context.title ? (
            <Text style={ctxStyles.title}>{context.title}</Text>
          ) : null}
          {pairs.map((pair, pi) => (
            <View key={pi} style={ctxStyles.row}>
              {pair.map((item, ii) => item ? (
                <View key={ii} style={ctxStyles.cell}>
                  <View style={[ctxStyles.iconCircle, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
                    <Ionicons
                      name={ICON_MAP[item.icon] ?? 'grid-outline'}
                      size={22}
                      color={accent}
                    />
                  </View>
                  <Text style={ctxStyles.cellLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={[ctxStyles.cellValue, { color: accent }]}>{item.value}</Text>
                </View>
              ) : (
                <View key={ii} style={ctxStyles.cellEmpty} />
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (context.type === 'table') {
    const columns = context.columns ?? [];
    const rows    = context.rows    ?? [];
    return (
      <View style={ctxStyles.card}>
        <View style={[ctxStyles.accentBar, { backgroundColor: accent }]} />
        <View style={ctxStyles.inner}>
          {context.title ? <Text style={ctxStyles.title}>{context.title}</Text> : null}
          {/* Header */}
          {columns.length > 0 && (
            <View style={ctxStyles.tableRow}>
              {columns.map((col, ci) => (
                <Text key={ci} style={[ctxStyles.tableHeader, { color: accent }]}>{col}</Text>
              ))}
            </View>
          )}
          {/* Data rows */}
          {rows.map((row, ri) => (
            <View key={ri} style={[ctxStyles.tableRow, ri % 2 === 1 && ctxStyles.tableRowAlt]}>
              {(Array.isArray(row) ? row : [row]).map((cell, ci) => (
                <Text key={ci} style={ctxStyles.tableCell}>{String(cell)}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return null;
}

const ctxStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#1a2744',
    borderRadius: 16, marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  accentBar: { width: 4, borderRadius: 4 },
  inner:     { flex: 1, padding: 14 },
  title:     { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  // Grid layout
  row:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  cell:      { flex: 1, alignItems: 'center', gap: 6 },
  cellEmpty: { flex: 1 },
  iconCircle:{ width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textAlign: 'center' },
  cellValue: { fontSize: 16, fontWeight: '800', textAlign: 'center' },

  // Table layout
  tableRow:    { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.03)' },
  tableHeader: { flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  tableCell:   { flex: 1, fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
});

// ── Geometry renderer ─────────────────────────────────────────
function GeometryDisplay({ geometry }) {
  if (!geometry?.type) return null;
  if (geometry.type === 'pie') {
    const slices = geometry.slices ?? [];
    const total  = slices.reduce((s, x) => s + (x.fraction ?? 0), 0) || 1;
    return (
      <View style={geoStyles.container}>
        <View style={geoStyles.pieStrip}>
          {slices.map((s, i) => (
            <View key={i} style={[
              geoStyles.pieSegment,
              { flex: (s.fraction ?? 0) / total, backgroundColor: s.color ?? '#6366f1' },
              i === 0 && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
              i === slices.length - 1 && { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
            ]} />
          ))}
        </View>
        <View style={geoStyles.pieLegend}>
          {slices.map((s, i) => (
            <View key={i} style={geoStyles.legendItem}>
              <View style={[geoStyles.legendDot, { backgroundColor: s.color ?? '#6366f1' }]} />
              <Text style={geoStyles.legendText}>{s.label ?? ''} ({Math.round((s.fraction ?? 0) * 100)}%)</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (geometry.type === 'bar') {
    const bars   = geometry.bars ?? [];
    const maxVal = geometry.maxValue ?? Math.max(...bars.map(b => b.value ?? 0), 1);
    const CHART_H = 90;
    return (
      <View style={geoStyles.container}>
        <View style={[geoStyles.barChart, { height: CHART_H + 32 }]}>
          {bars.map((b, i) => {
            const barH = Math.max(4, ((b.value ?? 0) / maxVal) * CHART_H);
            return (
              <View key={i} style={geoStyles.barCol}>
                <Text style={geoStyles.barValue}>{b.value}</Text>
                <View style={[geoStyles.bar, { height: barH }]} />
                <Text style={geoStyles.barLabel} numberOfLines={1}>{b.label ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <View style={geoStyles.barBaseline} />
      </View>
    );
  }
  if (geometry.type === 'shape') {
    const kind   = geometry.kind ?? 'rectangle';
    const filled = geometry.shaded !== false;
    const bg     = filled ? '#6366f1' : 'transparent';
    const border = { borderWidth: 2.5, borderColor: '#818cf8' };
    const shapeStyle = kind === 'circle'
      ? { width: 100, height: 100, borderRadius: 50, ...border, backgroundColor: bg }
      : kind === 'rectangle'
        ? { width: 140, height: 80, borderRadius: 6, ...border, backgroundColor: bg }
        : { width: 100, height: 86, ...border, backgroundColor: bg, borderRadius: 4 };
    return (
      <View style={geoStyles.container}>
        <View style={[geoStyles.shapeWrapper, shapeStyle]}>
          {geometry.label ? <Text style={geoStyles.shapeLabel}>{geometry.label}</Text> : null}
        </View>
      </View>
    );
  }
  return null;
}

const geoStyles = StyleSheet.create({
  container:   { alignItems: 'center', marginBottom: 16, marginTop: 4 },
  pieStrip:    { flexDirection: 'row', width: 260, height: 32, borderRadius: 10, overflow: 'hidden', marginBottom: 10 },
  pieSegment:  { height: '100%' },
  pieLegend:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: 12, color: '#94a3b8' },
  barChart:    { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 8 },
  barCol:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar:         { width: '80%', backgroundColor: '#6366f1', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barValue:    { fontSize: 11, fontWeight: '700', color: '#e2e8f0', marginBottom: 2 },
  barLabel:    { fontSize: 10, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  barBaseline: { width: 260, height: 1, backgroundColor: '#334155', marginTop: 2 },
  shapeWrapper:{ alignItems: 'center', justifyContent: 'center' },
  shapeLabel:  { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ── Markdown styles ───────────────────────────────────────────
const mdStyles = {
  body:       { color: '#f1f5f9', fontSize: 20, fontWeight: '700', lineHeight: 30 },
  strong:     { color: '#60a5fa', fontWeight: '800' },
  em:         { color: '#94a3b8', fontStyle: 'italic' },
  code_inline:{ color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 4, paddingHorizontal: 4 },
  fence:      { color: '#4ade80', backgroundColor: '#0f2a1a', borderRadius: 8, padding: 12 },
  table:      { borderWidth: 1, borderColor: '#334155', borderRadius: 8, marginBottom: 8 },
  th:         { backgroundColor: '#1e3a5f', padding: 8, color: '#60a5fa', fontWeight: '700' },
  td:         { padding: 8, color: '#e2e8f0', borderTopWidth: 1, borderColor: '#334155' },
  bullet_list:{ marginBottom: 4 },
  list_item:  { color: '#e2e8f0', fontSize: 16 },
};
const mdStylesVisual = { ...mdStyles, body: { ...mdStyles.body, fontSize: 22, lineHeight: 36 } };

// ── Measurement helpers ───────────────────────────────────────
// Arm: a thin rect from (cx,cy) pointing at angleDeg for `length` px.
// Rotation in RN is around the view center, so we position the view
// such that its center is the midpoint of the arm — then rotate.

// ── AngleStimulus — draws two labeled rays from a vertex ──────
function AngleStimulus({ geometry }) {
  const { angleDeg = 90, vertex = 'M', ray1 = 'N', ray2 = 'L' } = geometry;
  const cx = 130, cy = 120, armLen = 90;
  const rad = (angleDeg * Math.PI) / 180;
  // ray1 is the baseline (horizontal right)
  const r1ex = cx + armLen;
  const r1ey = cy;
  // ray2 is at angleDeg above horizontal
  const r2ex = cx + armLen * Math.cos(rad);
  const r2ey = cy - armLen * Math.sin(rad);

  // Small angle arc radius
  const arcR = 28;
  // Build ~8 tick positions along the arc to simulate a curve
  const arcTicks = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * angleDeg;
    const r = (a * Math.PI) / 180;
    arcTicks.push({ x: cx + arcR * Math.cos(r), y: cy - arcR * Math.sin(r) });
  }

  return (
    <View style={stimStyles.angleCanvas}>
      {/* arc dots */}
      {arcTicks.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x - 1.5, top: p.y - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94a3b8' }} />
      ))}
      {/* ray1 — horizontal */}
      <View style={armStyle(cx, cy, armLen, 0, '#e2e8f0', 2.5)} />
      {/* ray2 — at angleDeg */}
      <View style={armStyle(cx, cy, armLen, angleDeg, '#e2e8f0', 2.5)} />
      {/* arrowheads as dots at tips */}
      <View style={{ position: 'absolute', left: r1ex - 4, top: r1ey - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' }} />
      <View style={{ position: 'absolute', left: r2ex - 4, top: r2ey - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' }} />
      {/* vertex dot */}
      <View style={{ position: 'absolute', left: cx - 5, top: cy - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c3aed' }} />
      {/* labels */}
      <Text style={[stimStyles.angleLabel, { left: cx - 8, top: cy + 8 }]}>{vertex}</Text>
      <Text style={[stimStyles.angleLabel, { left: r1ex + 6, top: r1ey - 8 }]}>{ray1}</Text>
      <Text style={[stimStyles.angleLabel, { left: r2ex + (r2ex > cx ? 4 : -20), top: r2ey - (angleDeg > 150 ? 6 : 20) }]}>{ray2}</Text>
    </View>
  );
}

// ── SegmentStimulus — draws a ruler with a colored bar ─────────
// Supports an optional `start` offset so the bar can begin at a
// non-zero position (used by the "offset" ruler subtype).
function SegmentStimulus({ geometry, compact = false }) {
  const {
    length = 1, start = 0, unit = 'inch', color = 'red',
    rulerMax: rawMax = Math.max(Math.ceil(length + start) + 1, 4),
  } = geometry;
  // Ensure the ruler is always wide enough to show the full bar
  const rulerMax  = Math.max(rawMax, Math.ceil(start + length) + 1, 4);
  const W         = 280;
  const pxPerUnit = W / rulerMax;
  const barLeft   = Math.round(start * pxPerUnit);
  const barWidth  = Math.round(length * pxPerUnit);
  const isInch    = unit === 'inch';

  const COLOR_MAP = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
    orange: '#f97316', purple: '#a855f7', yellow: '#eab308',
  };
  const barColor = COLOR_MAP[color] ?? color;

  const subdivisions = isInch ? 4 : 2;
  const labelEvery   = rulerMax > 20 ? 5 : rulerMax > 10 ? 2 : 1;
  const ticks = [];
  for (let i = 0; i <= rulerMax * subdivisions; i++) {
    const isWhole  = i % subdivisions === 0;
    const isHalf   = !isWhole && i % (subdivisions / 2) === 0;
    const unitVal  = i / subdivisions;
    const x        = Math.round(unitVal * pxPerUnit);
    const h        = isWhole ? 18 : isHalf ? 13 : 8;
    const showLbl  = isWhole && unitVal % labelEvery === 0;
    ticks.push({ x, isWhole, isHalf, h, label: showLbl ? String(unitVal) : null });
  }

  const canvasH = compact ? 74 : 90;
  const barTop  = compact ? 3 : 5;
  const barH    = compact ? 10 : 14;
  const rulerTop = compact ? 20 : 28;

  return (
    <View style={[stimStyles.segCanvas, { height: canvasH }]}>
      {/* ── Dim guide line from 0 to start (shows where measurement begins) ── */}
      {start > 0 && (
        <View style={{ position: 'absolute', left: 0, top: barTop + barH / 2, height: 2,
          width: barLeft, backgroundColor: '#334155', borderRadius: 1 }} />
      )}

      {/* ── Colored bar with end caps ── */}
      <View style={{ position: 'absolute', left: barLeft, top: barTop,
        height: barH, width: barWidth, backgroundColor: barColor, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: barLeft,              top: barTop - 4, width: 2, height: barH + 8, backgroundColor: barColor }} />
      <View style={{ position: 'absolute', left: barLeft + barWidth - 2, top: barTop - 4, width: 2, height: barH + 8, backgroundColor: barColor }} />

      {/* ── Ruler body ── */}
      <View style={{ position: 'absolute', left: 0, top: rulerTop, width: W, height: 28,
        backgroundColor: '#1e293b', borderRadius: 4, borderWidth: 1, borderColor: '#334155' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 18, backgroundColor: '#a78bfa', borderRadius: 1 }} />
        {ticks.map((t, i) => (
          <View key={i} style={{
            position: 'absolute', left: t.x - 0.75, top: 0,
            width: 1.5, height: t.h,
            backgroundColor: t.isWhole ? '#64748b' : '#475569',
          }} />
        ))}
      </View>

      {/* ── Number labels ── */}
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <Text key={i} style={{
          position: 'absolute',
          left: t.x - 10, top: rulerTop + 30,
          width: 20, textAlign: 'center',
          fontSize: 10, color: t.x === 0 ? '#a78bfa' : '#94a3b8', fontWeight: '700',
        }}>{t.label}</Text>
      ))}
    </View>
  );
}

// ── TwoBarStimulus — two bars on the same ruler (compare / difference) ──
function TwoBarStimulus({ geometry }) {
  const {
    length = 5, start = 0, unit = 'inch', color = 'red',
    bar2 = { length: 3, color: 'blue' },
    rulerMax: rawMax = 10,
  } = geometry;
  const b2len     = bar2.length ?? 3;
  const b2color   = bar2.color  ?? 'blue';
  const rulerMax  = Math.max(rawMax, Math.ceil(Math.max(length, b2len) + start) + 1, 4);
  const W         = 280;
  const pxPerUnit = W / rulerMax;
  const isInch    = unit === 'inch';

  const COLOR_MAP = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
    orange: '#f97316', purple: '#a855f7', yellow: '#eab308',
  };
  const c1 = COLOR_MAP[color]   ?? color;
  const c2 = COLOR_MAP[b2color] ?? b2color;

  const subdivisions = isInch ? 4 : 2;
  const labelEvery   = rulerMax > 20 ? 5 : rulerMax > 10 ? 2 : 1;
  const ticks = [];
  for (let i = 0; i <= rulerMax * subdivisions; i++) {
    const isWhole = i % subdivisions === 0;
    const isHalf  = !isWhole && i % (subdivisions / 2) === 0;
    const unitVal = i / subdivisions;
    const x       = Math.round(unitVal * pxPerUnit);
    const h       = isWhole ? 18 : isHalf ? 13 : 8;
    const showLbl = isWhole && unitVal % labelEvery === 0;
    ticks.push({ x, isWhole, isHalf, h, label: showLbl ? String(unitVal) : null });
  }

  const b1w = Math.round(length * pxPerUnit);
  const b2w = Math.round(b2len  * pxPerUnit);

  // Layout: bar1 row (0-14), gap (14-20), bar2 row (20-34), ruler (38-66), labels (68+)
  return (
    <View style={[stimStyles.segCanvas, { height: 112 }]}>
      {/* Bar 1 */}
      <View style={{ position: 'absolute', left: 0, top: 2,  height: 12, width: b1w, backgroundColor: c1, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: 0,     top: 0, width: 2, height: 16, backgroundColor: c1 }} />
      <View style={{ position: 'absolute', left: b1w-2, top: 0, width: 2, height: 16, backgroundColor: c1 }} />

      {/* Bar 2 */}
      <View style={{ position: 'absolute', left: 0, top: 20, height: 12, width: b2w, backgroundColor: c2, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: 0,     top: 18, width: 2, height: 16, backgroundColor: c2 }} />
      <View style={{ position: 'absolute', left: b2w-2, top: 18, width: 2, height: 16, backgroundColor: c2 }} />

      {/* Ruler body */}
      <View style={{ position: 'absolute', left: 0, top: 38, width: W, height: 28,
        backgroundColor: '#1e293b', borderRadius: 4, borderWidth: 1, borderColor: '#334155' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 18, backgroundColor: '#a78bfa', borderRadius: 1 }} />
        {ticks.map((t, i) => (
          <View key={i} style={{ position: 'absolute', left: t.x - 0.75, top: 0,
            width: 1.5, height: t.h, backgroundColor: t.isWhole ? '#64748b' : '#475569' }} />
        ))}
      </View>

      {/* Number labels */}
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <Text key={i} style={{
          position: 'absolute', left: t.x - 10, top: 68,
          width: 20, textAlign: 'center',
          fontSize: 10, color: t.x === 0 ? '#a78bfa' : '#94a3b8', fontWeight: '700',
        }}>{t.label}</Text>
      ))}
    </View>
  );
}

// ── formatMeasurement — renders fractions for inches ──────────
function formatMeasurement(val, unit) {
  if (unit === 'inch') {
    const whole = Math.floor(val);
    const frac  = Math.round((val - whole) * 4) / 4;
    const FRAC_LABELS = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };
    const fracStr = FRAC_LABELS[frac] ?? '';
    if (whole === 0 && fracStr) return fracStr;
    if (whole === 0) return '0';
    return fracStr ? `${whole} ${fracStr}` : `${whole}`;
  }
  return val.toFixed(1);
}

const stimStyles = StyleSheet.create({
  angleCanvas: {
    width: 280, height: 160, alignSelf: 'center',
    backgroundColor: '#0f172a', borderRadius: 10,
    borderWidth: 1, borderColor: '#1e293b',
    marginBottom: 12, position: 'relative', overflow: 'visible',
  },
  angleLabel: {
    position: 'absolute', fontSize: 14, color: '#e2e8f0',
    fontWeight: '800', fontStyle: 'italic',
  },
  segCanvas: {
    width: 280, height: 72, alignSelf: 'center',
    marginBottom: 12, position: 'relative',
  },
  segUnitLabel: {
    position: 'absolute', right: 0, top: 56,
    fontSize: 9, color: '#64748b', fontWeight: '600',
  },
});

function armStyle(cx, cy, length, angleDeg, color, thickness = 2) {
  const rad = (angleDeg * Math.PI) / 180;
  const ex  = cx + length * Math.cos(rad);
  const ey  = cy - length * Math.sin(rad); // Y-axis is inverted on screen
  const mx  = (cx + ex) / 2;
  const my  = (cy + ey) / 2;
  return {
    position: 'absolute',
    left:   mx - length / 2,
    top:    my - thickness / 2,
    width:  length,
    height: thickness,
    backgroundColor: color,
    transform: [{ rotate: `${-angleDeg}deg` }],
  };
}

// ── ProtractorRenderer ────────────────────────────────────────
// Labels shown at major angles; ticks drawn every 10°
const PROT_LABEL_MARKS = [0, 30, 45, 60, 90, 120, 135, 150, 180];
const PROT_TICK_STEP   = 10;
const PROT_R      = 108;
const PROT_CX     = 140;
const PROT_CY     = 130;
const SLIDER_W    = 240;

// ── Targeted wrong-answer diagnostic messages ──────────────────
// Returns a hint string when the student's typed value reveals a specific
// misconception; returns null for generic errors.
function protractorDiagnostic(typed, correct, geo) {
  if (isNaN(typed)) return null;
  const opposite = 180 - correct;
  // Read from the wrong scale (supplement of the correct angle)
  if (Math.abs(typed - opposite) <= 8) {
    const side = geo?.scaleOrigin === 'right' ? 'right' : geo?.scaleOrigin === 'left' ? 'left' : null;
    const sideHint = side ? ` Start at the 0° on the ${side} side.` : '';
    return `You read from the wrong scale.${sideHint}`;
  }
  // Correct answer is acute but student gave obtuse (or vice-versa)
  if (correct < 90 && typed > 90) return 'This is an acute angle — it must be less than 90°.';
  if (correct > 90 && typed < 90) return 'This is an obtuse angle — it must be greater than 90°.';
  if (correct === 90 && typed !== 90) return 'This is a right angle — it should be exactly 90°.';
  return null;
}

function ProtractorRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const geo    = q.geometry?.type === 'angle' ? q.geometry : null;
  // v3: protractorMode — 'align' (default), 'read', or 'build'
  const mode   = geo?.protractorMode ?? 'align';
  // v2: scaleOrigin — 'left' or 'right'; null means skip scale-choice step
  const scaleOrigin = geo?.scaleOrigin ?? null;

  const [angleDeg,    setAngleDeg]    = useState(90);
  const [feedback,    setFeedback]    = useState(null);
  const [typedAnswer, setTypedAnswer] = useState('');       // v1: typed input
  const [scaleChosen, setScaleChosen] = useState(null);     // v2: 'left'|'right'|null
  const [scaleError,  setScaleError]  = useState(null);     // v2: error message
  const [wrongMsg,    setWrongMsg]    = useState(null);     // v1: targeted diagnostic
  const sliderXRef = useRef((90 / 180) * SLIDER_W);
  const startXRef  = useRef(sliderXRef.current);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const inputRef   = useRef(null);

  // v2: slider is locked until the student picks the correct scale (when scaleOrigin present)
  const sliderLocked = scaleOrigin != null && scaleChosen !== scaleOrigin;

  // Mutable refs read by PanResponder at gesture time — avoids stale closure from useRef.
  // PanResponder.create() runs once on mount; without refs the callbacks would forever
  // close over the initial (null/false) values of feedback and sliderLocked.
  const feedbackRef     = useRef(null);
  const sliderLockedRef = useRef(false);
  feedbackRef.current     = feedback;
  sliderLockedRef.current = sliderLocked;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      // Read refs at call-time so these always reflect current state
      onStartShouldSetPanResponderCapture: () => !feedbackRef.current && !sliderLockedRef.current,
      onMoveShouldSetPanResponderCapture:  () => !sliderLockedRef.current,
      onStartShouldSetPanResponder:        () => !feedbackRef.current && !sliderLockedRef.current,
      onMoveShouldSetPanResponder:         () => !sliderLockedRef.current,
      onPanResponderTerminationRequest:    () => false,
      onPanResponderGrant: (e) => {
        if (sliderLockedRef.current) return;
        setScrollEnabled?.(false);
        const x = Math.max(0, Math.min(SLIDER_W, e.nativeEvent.locationX));
        sliderXRef.current = x;
        startXRef.current  = x;
        setAngleDeg(Math.round((x / SLIDER_W) * 180));
      },
      onPanResponderMove: (_, gs) => {
        if (sliderLockedRef.current) return;
        const nx = Math.max(0, Math.min(SLIDER_W, startXRef.current + gs.dx));
        sliderXRef.current = nx;
        setAngleDeg(Math.round((nx / SLIDER_W) * 180));
      },
      onPanResponderRelease:   () => { setScrollEnabled?.(true); },
      onPanResponderTerminate: () => { setScrollEnabled?.(true); },
    })
  ).current;

  // v2: student picks which scale to read from
  function handleScaleChoice(choice) {
    if (feedback) return;
    if (choice === scaleOrigin) {
      setScaleChosen(choice);
      setScaleError(null);
    } else {
      const ray = geo?.ray1 ?? 'the baseline ray';
      const correct = scaleOrigin === 'right' ? 'right' : 'left';
      setScaleError(`Not quite — ${ray} lies along the ${correct} side, so start from the ${correct} 0°.`);
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  function handleSubmit() {
    if (feedback) return;
    Keyboard.dismiss();
    const correct = parseFloat(q.correctAnswer ?? '0');

    // v3 build mode: validate slider position, no typing required
    if (mode === 'build') {
      const isCorrect = Math.abs(angleDeg - correct) <= 5;
      setFeedback(isCorrect ? 'correct' : 'wrong');
      if (isCorrect) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else           { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
      setTimeout(() => onResolve(isCorrect), 1400);
      return;
    }

    // v1 align + read modes: validate typed answer
    const typed = parseFloat(typedAnswer.trim());
    if (isNaN(typed) || typedAnswer.trim() === '') {
      setScaleError('Enter the degree number before checking.');
      return;
    }
    setScaleError(null);
    const isCorrect = Math.abs(typed - correct) <= 5;
    const diag = isCorrect ? null : protractorDiagnostic(typed, correct, geo);
    setWrongMsg(diag);
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else           { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(isCorrect), 1800);
  }

  const isCorrect  = feedback === 'correct';
  const isWrong    = feedback === 'wrong';
  const armColor   = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed';
  const sliderLeft = (angleDeg / 180) * SLIDER_W;

  const refAngle  = parseFloat(q.correctAnswer ?? '0');
  // flipped: baseline points LEFT (180°); reference arm and movable arm screen angles are mirrored.
  // The degree labels also reverse so "0°" appears on the left side of the arc.
  const isFlipped = geo?.flipped === true;

  // Screen angles used for drawing arms — independent of what the angle VALUE is
  const baselineScreenDeg = isFlipped ? 180 : 0;
  const refArmScreenDeg   = isFlipped ? 180 - refAngle : refAngle;
  const movableScreenDeg  = isFlipped ? 180 - angleDeg : angleDeg;

  // Ray label positions — BEYOND the arm tip (arm tip at PROT_R+18; labels at PROT_R+32)
  const labelDist   = PROT_R + 32;
  const refArmRad   = (refArmScreenDeg * Math.PI) / 180;
  const baselineRad = (baselineScreenDeg * Math.PI) / 180;
  const refTipX     = PROT_CX + labelDist * Math.cos(refArmRad);
  const refTipY     = PROT_CY - labelDist * Math.sin(refArmRad);
  const r0TipX      = PROT_CX + labelDist * Math.cos(baselineRad);
  const r0TipY      = PROT_CY - labelDist * Math.sin(baselineRad);

  // Degree label value shown at each arc position:
  //   Normal:  position 30° shows "30°"
  //   Flipped: position 30° shows "150°" (scale reads in reverse from the left)
  const labelValue = (mark) => isFlipped ? 180 - mark : mark;

  // v3 build mode hides the reference arm so student must construct it themselves
  const showRefArm = mode !== 'build';
  // v1: hide live readout until after submit (prevents number-matching shortcut)
  const showReadout = !!feedback;
  // v3 read mode and v1 align mode both need a typed input; build mode uses slider only
  const needsTypedInput = mode !== 'build';
  // v3 read mode has no slider interaction
  const showSlider = mode !== 'read';

  // v2: show scale-choice step when scaleOrigin is present and not yet answered correctly
  const showScaleStep = scaleOrigin != null && scaleChosen !== scaleOrigin;

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>

      {/* ── v2: Scale-choice step — must answer before interacting ── */}
      {showScaleStep && (
        <View style={measStyles.scaleChoiceBox}>
          <Text style={measStyles.scaleChoicePrompt}>Which 0° do you start reading from?</Text>
          <View style={measStyles.scaleChoiceRow}>
            <TouchableOpacity
              style={[measStyles.scaleChoiceBtn, scaleChosen === 'left' && measStyles.scaleChoiceBtnSelected]}
              onPress={() => handleScaleChoice('left')}
              activeOpacity={0.75}
            >
              <Text style={measStyles.scaleChoiceBtnText}>← Left side</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[measStyles.scaleChoiceBtn, scaleChosen === 'right' && measStyles.scaleChoiceBtnSelected]}
              onPress={() => handleScaleChoice('right')}
              activeOpacity={0.75}
            >
              <Text style={measStyles.scaleChoiceBtnText}>Right side →</Text>
            </TouchableOpacity>
          </View>
          {scaleError && (
            <Text style={measStyles.scaleChoiceError}>{scaleError}</Text>
          )}
        </View>
      )}

      {/* ── v2: Scale confirmed badge ── */}
      {scaleOrigin != null && scaleChosen === scaleOrigin && !feedback && (
        <View style={measStyles.scaleConfirmed}>
          <Text style={measStyles.scaleConfirmedText}>
            {mode === 'read'
              ? `✓ Reading from the ${scaleChosen} 0° — now read the angle and type your answer.`
              : mode === 'build'
              ? `✓ Reading from the ${scaleChosen} 0° — now drag the arm to build the angle.`
              : `✓ Reading from the ${scaleChosen} 0° — position the arm, then type the angle.`}
          </Text>
        </View>
      )}

      {/* ── Protractor visual ── */}
      <View style={[measStyles.protContainer, showScaleStep && { opacity: 0.35 }]}>
        <View style={[measStyles.protArc, { left: PROT_CX - PROT_R, top: PROT_CY - PROT_R }]} />
        {/* Full baseline (always drawn end-to-end regardless of flip) */}
        <View style={{ position: 'absolute', left: PROT_CX - PROT_R - 6, top: PROT_CY - 1, width: PROT_R * 2 + 12, height: 1.5, backgroundColor: '#475569' }} />

        {/* Tick marks — positions never change, only what's written changes in flipped mode */}
        {Array.from({ length: 19 }, (_, i) => i * PROT_TICK_STEP).map(deg => {
          const isLabel = PROT_LABEL_MARKS.includes(deg);
          if (isLabel) return null;
          const r   = (deg * Math.PI) / 180;
          const tx1 = PROT_CX + (PROT_R - 4) * Math.cos(r);
          const ty1 = PROT_CY - (PROT_R - 4) * Math.sin(r);
          return <View key={deg} style={armStyle(tx1, ty1, 8, deg, '#334155', 1.5)} />;
        })}

        {/* Reference arm — hidden in build mode; drawn at refArmScreenDeg */}
        {showRefArm && (
          <>
            <View style={armStyle(PROT_CX, PROT_CY, PROT_R + 18, refArmScreenDeg, '#e2e8f0', 1.5)} />
            {/* Small dotted arc between baseline arm and reference arm */}
            {Array.from({ length: Math.round(refAngle / 3) }, (_, i) => {
              const t = Math.round(refAngle / 3) > 0 ? i / Math.round(refAngle / 3) : 0;
              // Arc spans from baselineScreenDeg toward refArmScreenDeg
              const a = isFlipped
                ? baselineScreenDeg - t * refAngle   // 180° → (180-refAngle)°
                : t * refAngle;                       // 0° → refAngle°
              const r = (a * Math.PI) / 180;
              return <View key={i} style={{ position: 'absolute', left: PROT_CX + 36 * Math.cos(r) - 1.5, top: PROT_CY - 36 * Math.sin(r) - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#7c3aed', opacity: 0.5 }} />;
            })}
          </>
        )}

        {/* Baseline arm — at 0° normally, at 180° when flipped */}
        <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, baselineScreenDeg, '#475569')} />
        {/* Movable arm — hidden in read mode; drawn at movableScreenDeg */}
        {showSlider && (
          <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, movableScreenDeg, armColor, 3)} />
        )}

        <View style={{ position: 'absolute', left: PROT_CX - 5, top: PROT_CY - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#94a3b8' }} />

        {/* Degree labels — flipped mode reverses the numbers shown at each arc position */}
        {PROT_LABEL_MARKS.map(mark => {
          const rad    = (mark * Math.PI) / 180;
          const lx     = PROT_CX + (PROT_R + 18) * Math.cos(rad);
          const ly     = PROT_CY - (PROT_R + 18) * Math.sin(rad);
          // Highlight the label nearest to the movable arm's current position
          const isNear = showSlider && Math.abs(labelValue(mark) - angleDeg) <= 6;
          return (
            <Text key={mark} style={[measStyles.protMarkLabel, { left: lx - 13, top: ly - 8 }, isNear && { color: armColor, fontWeight: '800' }]}>
              {labelValue(mark)}°
            </Text>
          );
        })}

        {/* Ray labels — vertex at center, ray1 at baseline tip, ray2 at reference arm tip */}
        {geo && <>
          <Text style={[measStyles.protRayLabel, { left: PROT_CX - 8, top: PROT_CY + 10 }]}>{geo.vertex}</Text>
          <Text style={[measStyles.protRayLabel, { left: r0TipX - 6, top: r0TipY - 9 }]}>{geo.ray1}</Text>
          {showRefArm && (
            <Text style={[measStyles.protRayLabel, { left: refTipX - 6, top: refTipY - 9 }]}>{geo.ray2}</Text>
          )}
        </>}

        {/* v1: readout hidden until after submit */}
        {showReadout && (
          <Text style={[measStyles.protReadout, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}>
            {mode === 'build' ? `${angleDeg}°` : `${typedAnswer}°`}
          </Text>
        )}
      </View>

      {/* ── v3 build mode label ── */}
      {mode === 'build' && !feedback && (
        <Text style={measStyles.buildModeLabel}>
          Create a {refAngle}° angle — drag the arm to the right position
        </Text>
      )}

      {/* ── Slider (align + build modes) ── */}
      {showSlider && (
        <>
          <View style={[measStyles.sliderRow, sliderLocked && { opacity: 0.35 }]}>
            <Text style={measStyles.sliderEndLabel}>0°</Text>
            <View style={measStyles.sliderTrack} {...(!sliderLocked ? panResponder.panHandlers : {})}>
              <View style={[measStyles.sliderFill, { width: sliderLeft }]} />
              <View style={[measStyles.sliderHandle, { left: sliderLeft - 12 }]} pointerEvents="none" />
            </View>
            <Text style={measStyles.sliderEndLabel}>180°</Text>
          </View>
          {sliderLocked
            ? <Text style={measStyles.sliderHint}>Choose the scale above first</Text>
            : <Text style={measStyles.sliderHint}>Tap or drag anywhere on the bar</Text>
          }
        </>
      )}

      {/* ── v1: Typed-answer input (align + read modes) ── */}
      {needsTypedInput && !feedback && (
        <View style={measStyles.typedAnswerRow}>
          <Text style={measStyles.typedAnswerLabel}>
            {mode === 'read' ? 'What angle is shown?' : 'What angle do you measure?'}
          </Text>
          <View style={measStyles.typedAnswerInputWrap}>
            <TextInput
              ref={inputRef}
              style={measStyles.typedAnswerInput}
              keyboardType="numeric"
              returnKeyType="done"
              maxLength={3}
              value={typedAnswer}
              onChangeText={t => {
                setTypedAnswer(t.replace(/[^0-9]/g, ''));
                if (scaleError && t.trim() !== '') setScaleError(null);
              }}
              onSubmitEditing={handleSubmit}
              placeholder="___"
              placeholderTextColor="#475569"
              editable={!sliderLocked}
            />
            <Text style={measStyles.typedAnswerUnit}>°</Text>
          </View>
        </View>
      )}

      {/* ── Input error (empty field on submit attempt) ── */}
      {scaleError && !showScaleStep && (
        <Text style={measStyles.scaleChoiceError}>{scaleError}</Text>
      )}


      {/* ── Wrong-answer feedback ── */}
      {isWrong && (
        <View style={styles.fillInReveal}>
          {wrongMsg
            ? <Text style={[styles.fillInRevealLabel, { color: '#fbbf24', marginBottom: 4 }]}>{wrongMsg}</Text>
            : null
          }
          <Text style={styles.fillInRevealLabel}>Correct angle:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}°</Text>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct! 📐</Text>}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, { marginTop: 20 }, sliderLocked && { opacity: 0.4 }]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={sliderLocked}
        >
          <Text style={styles.fillInSubmitText}>
            {mode === 'build' ? 'Check Angle' : 'Check Angle'}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── Shared ruler drag hook ─────────────────────────────────────
// Extracted so all ruler variants can reuse the same pan+snap logic.
const RULER_DISPLAY_W = 280;

function useRulerDrag({ maxVal, snapStep, setScrollEnabled }) {
  const unitPx    = RULER_DISPLAY_W / maxVal;
  const [value,      setValue]      = useState(maxVal / 2);
  const [hasDragged, setHasDragged] = useState(false);
  const valueXRef = useRef((maxVal / 2) * unitPx);
  const startXRef = useRef(valueXRef.current);

  function snap(raw) { return Math.round(raw / snapStep) * snapStep; }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture:  () => true,
    onStartShouldSetPanResponder:        () => true,
    onMoveShouldSetPanResponder:         () => true,
    onPanResponderTerminationRequest:    () => false,
    onPanResponderGrant: (e) => {
      setScrollEnabled?.(false);
      setHasDragged(true);
      const x = Math.max(0, Math.min(RULER_DISPLAY_W, e.nativeEvent.locationX));
      valueXRef.current = x; startXRef.current = x;
      setValue(snap((x / RULER_DISPLAY_W) * maxVal));
    },
    onPanResponderMove: (_, gs) => {
      const nx = Math.max(0, Math.min(RULER_DISPLAY_W, startXRef.current + gs.dx));
      valueXRef.current = nx;
      setValue(snap((nx / RULER_DISPLAY_W) * maxVal));
    },
    onPanResponderRelease:   () => setScrollEnabled?.(true),
    onPanResponderTerminate: () => setScrollEnabled?.(true),
  })).current;

  return { value, hasDragged, panResponder, unitPx };
}

// ── InteractiveRuler — the draggable answer ruler used by all variants ──
function InteractiveRuler({ maxVal, snapStep, isInch, unitLabel, feedback, value, hasDragged, panResponder }) {
  const unitPx       = RULER_DISPLAY_W / maxVal;
  const isCorrect    = feedback === 'correct';
  const isWrong      = feedback === 'wrong';
  const markerLeft   = (value / maxVal) * RULER_DISPLAY_W;
  const subdivisions = isInch ? 4 : 2;
  const labelEvery   = maxVal > 20 ? 5 : maxVal > 10 ? 2 : 1;
  const ticks = [];
  for (let i = 0; i <= maxVal * subdivisions; i++) {
    const isWhole   = i % subdivisions === 0;
    const isHalf    = !isWhole && i % (subdivisions / 2) === 0;
    const unitVal   = i / subdivisions;
    const xPos      = Math.round(unitVal * unitPx);
    const h         = isWhole ? 16 : isHalf ? 11 : 7;
    const showLabel = isWhole && unitVal % labelEvery === 0;
    ticks.push({ x: xPos, h, isWhole, isHalf, label: showLabel ? String(unitVal) : null });
  }

  return (
    <>
      <View style={measStyles.rulerContainer}>
        <View style={measStyles.rulerBody}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 16, backgroundColor: '#a78bfa', borderRadius: 1 }} />
          {ticks.map((t, idx) => (
            <View key={idx} style={{ position: 'absolute', left: t.x - 0.75, top: 0,
              width: 1.5, height: t.h, backgroundColor: t.isWhole ? '#64748b' : '#475569' }} />
          ))}
        </View>
        {ticks.filter(t => t.label !== null).map((t, idx) => (
          <Text key={`l${idx}`} style={[measStyles.rulerTickLabel,
            { left: t.x - 8, top: 34, color: t.x === 0 ? '#a78bfa' : '#94a3b8' }]}>
            {t.label}
          </Text>
        ))}
        <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} {...panResponder.panHandlers} />
        <View style={[measStyles.rulerMarker, { left: markerLeft - 1.5,
          backgroundColor: isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed' }]} pointerEvents="none" />
        <View style={[measStyles.rulerMarkerHandle, { left: markerLeft - 12 }]} pointerEvents="none" />
      </View>
      {hasDragged
        ? <Text style={[measStyles.sliderHint, { width: RULER_DISPLAY_W }]}>Tap or drag anywhere on the ruler</Text>
        : <Text style={[measStyles.sliderHint, { width: RULER_DISPLAY_W }]}>Drag the marker to where the bar ends</Text>
      }
    </>
  );
}

// ── OffsetRulerVariant — bar starts at a non-zero mark ─────────
// The student must compute length = endpoint − start, not just read the endpoint.
function OffsetRulerVariant({ q, onResolve, styles }) {
  const rulerUnit = q.geometry?.unit ?? (/(inch|inches|\bin\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const unitLabel = rulerUnit === 'inch' ? 'in' : rulerUnit;
  const isInch    = rulerUnit === 'inch';
  const snapStep  = isInch ? 0.25 : 0.5;

  const rawCorrect = parseFloat(q.correctAnswer ?? '0');
  const correct    = isNaN(rawCorrect)
    ? (isInch ? 3 : 7)
    : (isInch ? Math.min(Math.max(rawCorrect, 0.25), 12) : Math.min(Math.max(rawCorrect, 0.5), 30));
  const startVal   = parseFloat(String(q.geometry?.start ?? '0'));
  const maxVal     = Math.max(Math.ceil(startVal + correct) + 1, 4);

  const BAR_COLOR_NAMES = ['red','blue','green','orange','purple','yellow'];
  const detectedColor   = BAR_COLOR_NAMES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(q.question ?? ''));
  const barColor        = q.geometry?.color ?? detectedColor ?? 'green';

  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const { value, hasDragged, panResponder } = useRulerDrag({ maxVal, snapStep, setScrollEnabled: null });

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (feedback) return;
    const tolerance = Math.max(snapStep, correct * 0.08);
    const ok = Math.abs(value - correct) <= tolerance;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2000);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const refGeo    = { type: 'segment', start: startVal, length: correct, unit: rulerUnit, color: barColor, rulerMax: maxVal };

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: 'center' }}>
      <Text style={measStyles.rulerSectionLabel}>Reference</Text>
      <SegmentStimulus geometry={refGeo} />
      <Text style={measStyles.rulerSectionLabel}>Your Measurement · {unitLabel}</Text>
      {hasDragged && !feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W }]}>
          Selected: {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      {feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W },
          isCorrect ? { color: '#4ade80' } : { color: '#f87171' }]}>
          {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      {!hasDragged && !feedback && (
        <Text style={[measStyles.sliderHint, { width: RULER_DISPLAY_W }]}>
          Drag to show the LENGTH of the bar (not where it ends)
        </Text>
      )}
      <InteractiveRuler maxVal={maxVal} snapStep={snapStep} isInch={isInch} unitLabel={unitLabel}
        feedback={feedback} value={value} hasDragged={hasDragged} panResponder={panResponder} />
      {isCorrect && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInCorrectMsg, { marginBottom: 4 }]}>Correct! 📏</Text>
          <Text style={measStyles.rulerExplanation}>
            The bar starts at {formatMeasurement(startVal, rulerUnit)} and ends at {formatMeasurement(startVal + correct, rulerUnit)} {unitLabel}, so its length is {formatMeasurement(correct, rulerUnit)} {unitLabel}.
          </Text>
        </View>
      )}
      {isWrong && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInRevealLabel, { marginBottom: 4 }]}>
            Not quite. Subtract the start from the endpoint: {formatMeasurement(startVal + correct, rulerUnit)} − {formatMeasurement(startVal, rulerUnit)} = {formatMeasurement(correct, rulerUnit)} {unitLabel}.
          </Text>
          <Text style={[styles.fillInRevealAnswer, { marginTop: 4 }]}>
            Answer: {formatMeasurement(correct, rulerUnit)} {unitLabel}
          </Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 16, width: RULER_DISPLAY_W }]} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Measurement</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── CompareRulerVariant — "which bar is longer?" ───────────────
function CompareRulerVariant({ q, onResolve, styles }) {
  const [feedback, setFeedback] = useState(null);
  const [chosen,   setChosen]   = useState(null);
  const correctAnswer = String(q.correctAnswer ?? '').toLowerCase();
  const bar2color     = q.geometry?.bar2?.color ?? 'blue';

  function handleChoice(pick) {
    if (feedback) return;
    setChosen(pick);
    const ok = pick === correctAnswer;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), 1600);
  }

  const CHOICES = [
    { id: q.geometry?.color ?? 'red',  label: `${q.geometry?.color ?? 'Red'} bar` },
    { id: bar2color,                    label: `${bar2color} bar` },
    { id: 'same',                       label: 'Same length' },
  ];

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={measStyles.rulerSectionLabel}>Compare the bars</Text>
      <TwoBarStimulus geometry={q.geometry ?? {}} />
      <View style={{ width: RULER_DISPLAY_W, gap: 10, marginTop: 12 }}>
        {CHOICES.map(({ id, label }) => {
          const isChosen  = chosen === id;
          const isCorrect = feedback && id === correctAnswer;
          const isWrong   = feedback && isChosen && id !== correctAnswer;
          return (
            <TouchableOpacity key={id} activeOpacity={0.8}
              style={[styles.fillInSubmit, { marginTop: 0,
                backgroundColor: isCorrect ? '#166534' : isWrong ? '#7f1d1d' : isChosen ? '#1d4ed8' : '#1e3a5f',
                borderWidth: 1, borderColor: isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#334155',
              }]}
              onPress={() => handleChoice(id)}
              disabled={!!feedback}
            >
              <Text style={styles.fillInSubmitText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {feedback && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center', marginTop: 10 }]}>
          {feedback === 'correct'
            ? <Text style={[styles.fillInCorrectMsg]}>Correct! 📏</Text>
            : <Text style={[styles.fillInRevealLabel]}>
                Not quite — the {correctAnswer === 'same' ? 'bars are the same length' : `${correctAnswer} bar is longer`}.
              </Text>
          }
        </View>
      )}
    </View>
  );
}

// ── DifferenceRulerVariant — "how much longer is X than Y?" ────
function DifferenceRulerVariant({ q, onResolve, styles, setScrollEnabled }) {
  const rulerUnit = q.geometry?.unit ?? (/(inch|inches|\bin\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const unitLabel = rulerUnit === 'inch' ? 'in' : rulerUnit;
  const isInch    = rulerUnit === 'inch';
  const snapStep  = isInch ? 0.25 : 0.5;

  const rawCorrect = parseFloat(q.correctAnswer ?? '0');
  const correct    = isNaN(rawCorrect)
    ? (isInch ? 3 : 7)
    : (isInch ? Math.min(Math.max(rawCorrect, 0.25), 12) : Math.min(Math.max(rawCorrect, 0.5), 30));
  const maxVal     = Math.max(Math.ceil(correct) + 1, 4);

  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const { value, hasDragged, panResponder } = useRulerDrag({ maxVal, snapStep, setScrollEnabled });

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (feedback) return;
    const tolerance = Math.max(snapStep, correct * 0.08);
    const ok = Math.abs(value - correct) <= tolerance;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2000);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const bar1color = q.geometry?.color ?? 'red';
  const bar2color = q.geometry?.bar2?.color ?? 'blue';

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: 'center' }}>
      <Text style={measStyles.rulerSectionLabel}>Compare the bars</Text>
      <TwoBarStimulus geometry={q.geometry ?? {}} />
      <Text style={measStyles.rulerSectionLabel}>Drag to show the difference · {unitLabel}</Text>
      {hasDragged && !feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W }]}>
          Selected: {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      {feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W },
          isCorrect ? { color: '#4ade80' } : { color: '#f87171' }]}>
          {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      <InteractiveRuler maxVal={maxVal} snapStep={snapStep} isInch={isInch} unitLabel={unitLabel}
        feedback={feedback} value={value} hasDragged={hasDragged} panResponder={panResponder} />
      {isCorrect && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInCorrectMsg, { marginBottom: 4 }]}>Correct! 📏</Text>
          <Text style={measStyles.rulerExplanation}>
            The {bar1color} bar is {formatMeasurement(correct, rulerUnit)} {unitLabel} longer than the {bar2color} bar.
          </Text>
        </View>
      )}
      {isWrong && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInRevealLabel, { marginBottom: 4 }]}>
            Not quite — you chose {formatMeasurement(value, rulerUnit)} {unitLabel}.
          </Text>
          <Text style={measStyles.rulerExplanation}>
            Find the endpoint of each bar, then subtract to find the difference.
          </Text>
          <Text style={[styles.fillInRevealAnswer, { marginTop: 4 }]}>
            Difference: {formatMeasurement(correct, rulerUnit)} {unitLabel}
          </Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 16, width: RULER_DISPLAY_W }]} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Measurement</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── inferRulerSubtype ─────────────────────────────────────────
// When rulerSubtype is missing (e.g. old server sanitizer stripped it),
// infer the correct variant from data that does survive storage:
//   • correctAnswer is a color name  → compare
//   • geometry.start > 0             → offset
//   • question text mentions difference/longer → difference
//   • bar2 present in geometry        → compare or difference (fall back to compare)
const BAR_COLOR_NAMES_SET = new Set(['red','blue','green','orange','purple','yellow']);
function inferRulerSubtype(q) {
  if (q.rulerSubtype) return q.rulerSubtype;
  const ans = String(q.correctAnswer ?? '').toLowerCase().trim();
  if (BAR_COLOR_NAMES_SET.has(ans) || ans === 'same') return 'compare';
  if ((q.geometry?.start ?? 0) > 0) return 'offset';
  if (/how much longer|difference between|longer than/i.test(q.question ?? '')) return 'difference';
  if (q.geometry?.bar2) return 'compare';
  return 'endpoint';
}

// ── RulerRenderer ─────────────────────────────────────────────
// Dispatches to the appropriate variant. Uses inferRulerSubtype so
// the correct variant is chosen even when rulerSubtype was stripped
// by an older server sanitizer that didn't know about the field.
function RulerRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const subtype = inferRulerSubtype(q);
  if (subtype === 'offset')     return <OffsetRulerVariant     q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  if (subtype === 'compare')    return <CompareRulerVariant    q={q} onResolve={onResolve} styles={styles} />;
  if (subtype === 'difference') return <DifferenceRulerVariant q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  return <EndpointRulerVariant q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}

function EndpointRulerVariant({ q, onResolve, styles, setScrollEnabled }) {
  const rulerUnit  = q.geometry?.unit ?? (/(inch|inches|\bin\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const unitLabel  = rulerUnit === 'inch' ? 'in' : rulerUnit;
  const isInch     = rulerUnit === 'inch';
  const snapStep   = isInch ? 0.25 : 0.5;
  const rawCorrect = parseFloat(q.correctAnswer ?? '0');
  // Guard: if correctAnswer isn't a valid number this variant shouldn't be rendering at all
  const correct    = isNaN(rawCorrect)
    ? (isInch ? 3 : 7)  // safe fallback so nothing crashes
    : (isInch ? Math.min(Math.max(rawCorrect, 0.25), 12) : Math.min(Math.max(rawCorrect, 0.5), 30));
  const maxVal     = Math.max(Math.ceil(correct) + 1, 4);

  const BAR_COLOR_NAMES = ['red','blue','green','orange','purple','yellow'];
  const detectedColor   = BAR_COLOR_NAMES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(q.question ?? ''));
  const barColor        = q.geometry?.color ?? detectedColor ?? 'green';

  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const { value, hasDragged, panResponder } = useRulerDrag({ maxVal, snapStep, setScrollEnabled });

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (feedback) return;
    const tolerance = Math.max(snapStep, correct * 0.08);
    const ok = Math.abs(value - correct) <= tolerance;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2000);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const refGeo    = !q.image_url
    ? { type: 'segment', length: correct, unit: rulerUnit, color: barColor, rulerMax: maxVal }
    : null;

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: 'center' }}>
      {refGeo?.type === 'segment' && (
        <>
          <Text style={measStyles.rulerSectionLabel}>Reference</Text>
          <SegmentStimulus geometry={refGeo} />
          <Text style={measStyles.rulerSectionLabel}>Your Measurement · {unitLabel}</Text>
        </>
      )}
      {hasDragged && !feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W }]}>
          Selected: {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      {feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: RULER_DISPLAY_W },
          isCorrect ? { color: '#4ade80' } : { color: '#f87171' }]}>
          {formatMeasurement(value, rulerUnit)} {unitLabel}
        </Text>
      )}
      {!hasDragged && !feedback && (
        <Text style={[measStyles.sliderHint, { width: RULER_DISPLAY_W }]}>
          Drag the marker to where the bar ends
        </Text>
      )}
      <InteractiveRuler maxVal={maxVal} snapStep={snapStep} isInch={isInch} unitLabel={unitLabel}
        feedback={feedback} value={value} hasDragged={hasDragged} panResponder={panResponder} />
      {isCorrect && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInCorrectMsg, { marginBottom: 4 }]}>Correct! 📏</Text>
          <Text style={measStyles.rulerExplanation}>
            The {barColor} bar ends at the {formatMeasurement(correct, rulerUnit)}{unitLabel} mark, so its length is {formatMeasurement(correct, rulerUnit)} {unitLabel}.
          </Text>
        </View>
      )}
      {isWrong && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInRevealLabel, { marginBottom: 4 }]}>
            Not quite — you chose {formatMeasurement(value, rulerUnit)} {unitLabel}.
          </Text>
          <Text style={measStyles.rulerExplanation}>
            Start at 0 and look at where the {barColor} bar ends.
          </Text>
          <Text style={[styles.fillInRevealAnswer, { marginTop: 4 }]}>
            Answer: {formatMeasurement(correct, rulerUnit)} {unitLabel}
          </Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 16, width: RULER_DISPLAY_W }]}
          onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Measurement</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── Measurement styles ────────────────────────────────────────
const measStyles = StyleSheet.create({
  // Protractor
  protContainer: {
    width: 280, height: 178,
    alignSelf: 'center', marginBottom: 4, position: 'relative',
  },
  protArc: {
    position: 'absolute',
    width: PROT_R * 2, height: PROT_R,
    borderTopLeftRadius: PROT_R, borderTopRightRadius: PROT_R,
    borderWidth: 1.5, borderBottomWidth: 0, borderColor: '#334155',
  },
  protMarkLabel: { position: 'absolute', fontSize: 10, color: '#475569', width: 26, textAlign: 'center' },
  protRayLabel:  { position: 'absolute', fontSize: 13, color: '#e2e8f0', fontWeight: '800', fontStyle: 'italic' },
  protReadout: {
    position: 'absolute',
    left: PROT_CX - 32, top: PROT_CY - 52,
    width: 64, textAlign: 'center',
    fontSize: 22, fontWeight: '900', color: '#7c3aed',
  },
  // Ruler
  rulerReading: {
    textAlign: 'center', fontSize: 26, fontWeight: '900',
    color: '#7c3aed', marginBottom: 12,
  },
  rulerLiveReadout: {
    textAlign: 'center', fontSize: 13, fontWeight: '600',
    color: '#64748b', marginBottom: 6, marginTop: 2,
  },
  rulerExplanation: {
    fontSize: 13, color: '#94a3b8', textAlign: 'center',
    marginTop: 4, lineHeight: 18,
  },
  rulerContainer: {
    width: RULER_DISPLAY_W, height: 72,
    alignSelf: 'center', marginBottom: 4, position: 'relative',
  },
  rulerBody: {
    position: 'absolute', top: 0, left: 0,
    width: RULER_DISPLAY_W, height: 30,
    backgroundColor: '#1e293b',
    borderRadius: 4, borderWidth: 1, borderColor: '#334155',
  },
  rulerTickLabel: {
    position: 'absolute',
    width: 16, textAlign: 'center',
    fontSize: 10, color: '#94a3b8', fontWeight: '700',
  },
  rulerMarker: {
    position: 'absolute', top: 0, width: 3, height: 44,
    borderRadius: 2,
  },
  rulerMarkerHandle: {
    position: 'absolute', top: 32, width: 24, height: 20,
    borderRadius: 10, backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  // Shared slider
  sliderRow: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'center', gap: 8, marginTop: 8, marginBottom: 4,
  },
  sliderTrack: {
    width: SLIDER_W, height: 6, borderRadius: 3,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    position: 'relative',
  },
  sliderFill: { height: '100%', borderRadius: 3, backgroundColor: '#7c3aed', position: 'absolute' },
  sliderHandle: {
    position: 'absolute', top: -9, width: 24, height: 24,
    borderRadius: 12, backgroundColor: '#7c3aed',
    borderWidth: 2.5, borderColor: '#a78bfa',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  sliderEndLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', width: 32, textAlign: 'center' },
  sliderHint:        { fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 6 },
  worksheetHint:     { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 2, marginBottom: 4, fontStyle: 'italic' },
  rulerSectionLabel: { width: 280, fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 6, marginBottom: 2, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },

  // v2: scale-choice step
  scaleChoiceBox: {
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1, borderColor: '#334155',
    padding: 14, marginBottom: 12,
  },
  scaleChoicePrompt: {
    fontSize: 13, color: '#cbd5e1', fontWeight: '700',
    textAlign: 'center', marginBottom: 10,
  },
  scaleChoiceRow: {
    flexDirection: 'row', gap: 10, justifyContent: 'center',
  },
  scaleChoiceBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#334155',
    backgroundColor: '#0f172a', alignItems: 'center',
  },
  scaleChoiceBtnSelected: {
    borderColor: '#4ade80', backgroundColor: '#14532d',
  },
  scaleChoiceBtnText: {
    fontSize: 13, color: '#e2e8f0', fontWeight: '700',
  },
  scaleChoiceError: {
    fontSize: 12, color: '#fbbf24', textAlign: 'center',
    marginTop: 8, fontStyle: 'italic',
  },
  scaleConfirmed: {
    backgroundColor: '#14532d', borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
    marginBottom: 8,
  },
  scaleConfirmedText: {
    fontSize: 12, color: '#86efac', textAlign: 'center', fontWeight: '600',
  },

  // v1: typed-answer input row
  typedAnswerRow: {
    alignSelf: 'center', alignItems: 'center', marginTop: 10, marginBottom: 2,
  },
  typedAnswerLabel: {
    fontSize: 13, color: '#94a3b8', marginBottom: 6, textAlign: 'center',
  },
  typedAnswerInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e293b', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#334155',
    paddingHorizontal: 14, paddingVertical: 6,
    gap: 4,
  },
  typedAnswerInput: {
    fontSize: 28, fontWeight: '900', color: '#e2e8f0',
    minWidth: 52, textAlign: 'center',
  },
  typedAnswerUnit: {
    fontSize: 22, fontWeight: '800', color: '#7c3aed',
  },

  // v3: build mode label
  buildModeLabel: {
    fontSize: 13, color: '#94a3b8', textAlign: 'center',
    marginTop: 4, marginBottom: 4, fontStyle: 'italic',
  },
});

// ── FillInRenderer ────────────────────────────────────────────
function FillInRenderer({ q, onResolve, styles }) {
  const [value, setValue]       = useState('');
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (feedback || !value.trim()) return;
    Keyboard.dismiss();
    const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const ans  = norm(value);
    const all  = [q.correctAnswer, ...(q.acceptedAnswers ?? [])].map(norm);
    const correct = all.includes(ans) || all.some(c => isFuzzyMatch(ans, c));
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(correct), 1400);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <View style={[
        styles.fillInBox,
        isCorrect && styles.fillInBoxCorrect,
        isWrong   && styles.fillInBoxWrong,
      ]}>
        <TextInput
          style={[styles.fillInInput, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}
          value={value}
          onChangeText={setValue}
          placeholder="Type your answer…"
          placeholderTextColor="#475569"
          editable={!feedback}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      </View>

      {isWrong && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct answer:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}</Text>
        </View>
      )}
      {isCorrect && (
        <Text style={styles.fillInCorrectMsg}>Correct!</Text>
      )}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, !value.trim() && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={!value.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.fillInSubmitText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── OrderingRenderer ──────────────────────────────────────────
function OrderingRenderer({ q, onResolve, styles }) {
  const [placed, setPlaced]     = useState([]);   // indices of items placed in order
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'
  const items = q.items ?? [];

  function tapChip(itemIdx) {
    if (feedback) return;
    if (placed.includes(itemIdx)) return;
    const next = [...placed, itemIdx];
    setPlaced(next);
    if (next.length === items.length) {
      // Auto-check
      const correct = next.every((v, i) => v === q.correctOrder[i]);
      setFeedback(correct ? 'correct' : 'wrong');
      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setTimeout(() => onResolve(correct), 1800);
    }
  }

  function clear() {
    if (feedback) return;
    setPlaced([]);
  }

  const chipColors = ['#3b82f6','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4'];

  return (
    <View>
      {/* Answer slots */}
      <Text style={styles.orderingLabel}>Your order:</Text>
      <View style={styles.orderingSlots}>
        {items.map((_, slotIdx) => {
          const placedItemIdx = placed[slotIdx];
          const filled  = placedItemIdx !== undefined;
          const correct = feedback && q.correctOrder[slotIdx] === placedItemIdx;
          const wrong   = feedback && !correct && filled;
          return (
            <View key={slotIdx} style={[
              styles.orderingSlot,
              filled && { backgroundColor: chipColors[placedItemIdx % chipColors.length] + '33', borderColor: chipColors[placedItemIdx % chipColors.length] },
              correct && styles.orderingSlotCorrect,
              wrong   && styles.orderingSlotWrong,
            ]}>
              <Text style={styles.orderingSlotNum}>{slotIdx + 1}</Text>
              {filled && (
                <Text style={[styles.orderingSlotText, correct && { color: '#4ade80' }, wrong && { color: '#f87171' }]}>
                  {items[placedItemIdx]}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Chip pool */}
      <Text style={styles.orderingLabel}>Tap to place:</Text>
      <View style={styles.orderingChips}>
        {items.map((item, idx) => {
          const used = placed.includes(idx);
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.orderingChip, { borderColor: chipColors[idx % chipColors.length] }, used && styles.orderingChipUsed]}
              onPress={() => tapChip(idx)}
              disabled={used || !!feedback}
              activeOpacity={0.75}
            >
              <Text style={[styles.orderingChipText, used && styles.orderingChipTextUsed]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!feedback && placed.length > 0 && (
        <TouchableOpacity style={styles.orderingClear} onPress={clear}>
          <Text style={styles.orderingClearText}>Clear</Text>
        </TouchableOpacity>
      )}

      {feedback === 'wrong' && (
        <View style={styles.orderingReveal}>
          <Text style={styles.fillInRevealLabel}>Correct order:</Text>
          <Text style={styles.fillInRevealAnswer}>
            {q.correctOrder.map(i => items[i]).join(' → ')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── TrueFalseRenderer ─────────────────────────────────────────
function TrueFalseRenderer({ q, onResolve, styles }) {
  const [selected, setSelected] = useState(null); // null | true | false
  const correct = q.correctAnswer === true;

  function handleTap(val) {
    if (selected !== null) return;
    setSelected(val);
    const isCorrect = val === correct;
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  function btnStyle(val) {
    if (selected === null) return val ? styles.tfTrue : styles.tfFalse;
    if (val === correct)   return val ? styles.tfTrueCorrect : styles.tfFalseCorrect;
    if (val === selected)  return val ? styles.tfTrueWrong   : styles.tfFalseWrong;
    return [val ? styles.tfTrue : styles.tfFalse, styles.tfDimmed];
  }

  return (
    <View style={styles.tfRow}>
      <TouchableOpacity style={btnStyle(true)}  onPress={() => handleTap(true)}  disabled={selected !== null} activeOpacity={0.8}>
        <Ionicons name="checkmark" size={28} color="#fff" />
        <Text style={styles.tfBtnText}>True</Text>
      </TouchableOpacity>
      <TouchableOpacity style={btnStyle(false)} onPress={() => handleTap(false)} disabled={selected !== null} activeOpacity={0.8}>
        <Ionicons name="close" size={28} color="#fff" />
        <Text style={styles.tfBtnText}>False</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── WordBankRenderer ──────────────────────────────────────────
function WordBankRenderer({ q, onResolve, styles }) {
  const [filled, setFilled]     = useState(null);  // null | word string
  const [feedback, setFeedback] = useState(null);  // null | 'correct' | 'wrong'
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const wordBank  = q.wordBank ?? [];

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function tapWord(word) {
    if (feedback) return;
    setFilled(word);
    const isCorrect = word.toLowerCase().trim() === (q.correctAnswer ?? '').toLowerCase().trim();
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  function clearChoice() {
    if (feedback) return;
    setFilled(null);
  }

  // Split question on ____ to render the blank inline
  const parts = (q.question ?? '').split('____');

  return (
    <View>
      {/* Word bank chips */}
      <Text style={styles.wbBankLabel}>Word Bank:</Text>
      <View style={styles.wbBank}>
        {wordBank.map((word, i) => {
          const isCorrectWord = word.toLowerCase() === (q.correctAnswer ?? '').toLowerCase();
          const isSelected    = filled === word;
          const dim           = !!feedback && !isSelected;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.wbChip,
                isSelected && !feedback && styles.wbChipSelected,
                feedback && isCorrectWord && styles.wbChipCorrect,
                feedback && isSelected && !isCorrectWord && styles.wbChipWrong,
                dim && styles.wbChipDim,
              ]}
              onPress={() => tapWord(word)}
              disabled={!!feedback}
              activeOpacity={0.75}
            >
              <Text style={[styles.wbChipText, (feedback && isCorrectWord) && { color: '#fff' }, (feedback && isSelected && !isCorrectWord) && { color: '#fff' }]}>
                {word}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sentence with blank */}
      <Animated.View style={[styles.wbSentenceCard, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.wbSentence}>
          {parts[0]}
          <Text style={[
            styles.wbBlank,
            filled && !feedback && styles.wbBlankFilled,
            feedback === 'correct' && styles.wbBlankCorrect,
            feedback === 'wrong'   && styles.wbBlankWrong,
          ]}>
            {filled ?? '________'}
          </Text>
          {parts[1] ?? ''}
        </Text>
      </Animated.View>

      {filled && !feedback && (
        <TouchableOpacity style={styles.wbClear} onPress={clearChoice}>
          <Text style={styles.wbClearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── shuffleNoConsecutiveDupes ─────────────────────────────────
// Fisher-Yates shuffle then fix any adjacent pair that shares the same
// correctAnswer or the same question text, preventing a child from seeing
// the same answer (or identical question) back-to-back.
function shuffleNoConsecutiveDupes(arr) {
  if (arr.length <= 1) return [...arr];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const sameQ = (x, y) =>
    String(x?.correctAnswer ?? '') === String(y?.correctAnswer ?? '') ||
    String(x?.question ?? '')     === String(y?.question ?? '');
  for (let i = 1; i < a.length; i++) {
    if (sameQ(a[i], a[i - 1])) {
      const j = a.findIndex((q, k) => k > i && !sameQ(q, a[i - 1]));
      if (j !== -1) [a[i], a[j]] = [a[j], a[i]];
    }
  }
  return a;
}

// ── Main QuizScreen ───────────────────────────────────────────
export default function QuizScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;
  const { activeKid } = useAuth();
  // Shuffle once on mount; guardrail prevents same answer/question back-to-back
  const [questions] = useState(() => shuffleNoConsecutiveDupes(unit.questions ?? []));

  // Resolve subject color for the accent stripe
  const subjectColor = resolveSubject(unit.subject, [])?.color ?? '#60a5fa';

  const [currentIndex, setCurrentIndex]     = useState(0);
  const [selectedIndex, setSelectedIndex]   = useState(null);
  const [score, setScore]                   = useState(0);
  const [answered, setAnswered]             = useState(false);
  const [finished, setFinished]             = useState(false);
  const [hintVisible, setHintVisible]       = useState(false);
  const [passageVisible, setPassageVisible] = useState(false);
  const [zoomImage, setZoomImage]           = useState(null);
  const [enabledGames, setEnabledGames]     = useState({});
  // Locked while a measurement slider is being dragged so ScrollView doesn't compete
  const [scrollEnabled, setScrollEnabled]   = useState(true);

  useEffect(() => {
    getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledGames);
  }, []);

  const progressAnim  = useRef(new Animated.Value(0)).current;
  const hintAnim      = useRef(new Animated.Value(0)).current;
  const celebAnim     = useRef(new Animated.Value(1)).current;
  const answerTimeout = useRef(null);
  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
    celebAnim.setValue(1);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (answerTimeout.current) clearTimeout(answerTimeout.current);
    };
  }, []);

  const toggleHint = useCallback(() => {
    const next = !hintVisible;
    setHintVisible(next);
    Animated.timing(hintAnim, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [hintVisible]);

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>No questions yet</Text>
          <Text style={styles.emptyDesc}>This lesson doesn't have any questions. Try editing it from the Scan tab.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.emptyBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const q              = questions[currentIndex];
  const qType          = q.type ?? 'multiple_choice';
  const isMC           = !q.type || q.type === 'multiple_choice' || q.type === 'visual_mc';
  const isVisual       = q.type === 'visual_mc';
  const safeCorrectIdx = Math.min(Math.max(q.correctIndex ?? 0, 0), (q.options?.length ?? 1) - 1);
  const typeLabel      = TYPE_LABELS[qType];

  // ── Shared answer resolution ─────────────────────────────────
  function resolveAnswer(isCorrect) {
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const nextIndex = currentIndex + 1;
    animateProgress(nextIndex / questions.length);
    answerTimeout.current = setTimeout(() => {
      if (nextIndex >= questions.length) {
        setFinished(true);
        if (activeKid?.id) {
          saveQuizResult({
            kidId: activeKid.id, unitId: unit.id ?? null, unitTitle: unit.title,
            score: newScore, total: questions.length, stars: getStars(newScore, questions.length),
          }).catch(() => {});
        }
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 200); // renderers handle their own 1.4s delay; this is just the transition
  }

  // MC-specific handler (keeps its own answered state for option coloring)
  function handleMCAnswer(index) {
    if (answered) return;
    setSelectedIndex(index);
    setAnswered(true);
    const isCorrect = index === safeCorrectIdx;
    const newScore  = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(newScore);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(celebAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    const nextIndex = currentIndex + 1;
    animateProgress(nextIndex / questions.length);
    answerTimeout.current = setTimeout(() => {
      if (nextIndex >= questions.length) {
        setFinished(true);
        if (activeKid?.id) {
          saveQuizResult({
            kidId: activeKid.id, unitId: unit.id ?? null, unitTitle: unit.title,
            score: newScore, total: questions.length, stars: getStars(newScore, questions.length),
          }).catch(() => {});
        }
      } else {
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setAnswered(false);
      }
    }, 1400);
  }

  function animateProgress(toValue) {
    Animated.timing(progressAnim, { toValue, duration: 400, useNativeDriver: false }).start();
  }

  function restart() {
    setCurrentIndex(0); setSelectedIndex(null); setScore(0);
    setAnswered(false); setFinished(false); setHintVisible(false);
    animateProgress(0);
  }

  function mcOptionStyle(index) {
    if (!answered) return styles.optionBtn;
    if (index === safeCorrectIdx) return [styles.optionBtn, styles.optionCorrect];
    if (index === selectedIndex)  return [styles.optionBtn, styles.optionWrong];
    return [styles.optionBtn, styles.optionDimmed];
  }
  function mcOptionTextStyle(index) {
    if (!answered) return styles.optionText;
    if (index === safeCorrectIdx || index === selectedIndex) return [styles.optionText, styles.optionTextLight];
    return [styles.optionText, styles.optionTextDimmed];
  }
  function mcLetterStyle(index) {
    if (!answered) return styles.letterBadge;
    if (index === safeCorrectIdx) return [styles.letterBadge, styles.letterBadgeCorrect];
    if (index === selectedIndex)  return [styles.letterBadge, styles.letterBadgeWrong];
    return [styles.letterBadge, styles.letterBadgeDimmed];
  }

  // ── Results screen ──────────────────────────────────────────
  if (finished) {
    const stars         = getStars(score, questions.length);
    const pct           = score / questions.length;
    // Resolve which game to reward.
    // If the lesson has reward_config set, use that. Otherwise default to the
    // first available game when there are MC questions (makes all lessons work
    // without requiring parents to configure every lesson individually).
    const hasMCQuestions = questions.some(q => Array.isArray(q.options) && q.options.length >= 2);
    const configuredId   = unit.reward_config?.game;
    const defaultGame    = hasMCQuestions
      ? (AVAILABLE_GAMES.find(g => enabledGames[g.id] !== false) ?? null)
      : null;
    const rewardGame     = configuredId
      ? (enabledGames[configuredId] !== false ? findGame(configuredId) : null)
      : defaultGame;
    const rewardUnlocked = pct >= 0.70 && !!rewardGame;
    const gameLabel      = rewardGame?.label ?? '';

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.resultsContainer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.resultsCard}>
            <Text style={styles.resultsStars}>
              {stars >= 1 ? '⭐' : '☆'}{stars >= 2 ? '⭐' : '☆'}{stars >= 3 ? '⭐' : '☆'}
            </Text>
            <Text style={styles.resultsScore}>{score}/{questions.length}</Text>
            <Text style={styles.resultsLabel}>
              {stars === 3 ? 'Outstanding! 🎉' : stars === 2 ? 'Great work! 👏' : stars === 1 ? 'Good effort! 💪' : 'Keep practicing! 📚'}
            </Text>
            <Text style={styles.resultsUnit}>{unit.title}</Text>
          </View>

          {/* Speed Round unlock — shown when score ≥ 70% and lesson has a reward game */}
          {rewardUnlocked && (
            <TouchableOpacity
              style={styles.rewardUnlockBtn}
              onPress={() => navigation.navigate(rewardGame.routeName, { unit })}
              activeOpacity={0.85}
            >
              <View style={styles.rewardUnlockLeft}>
                <Text style={styles.rewardUnlockEmoji}>{rewardGame?.emoji ?? '🎮'}</Text>
                <View>
                  <Text style={styles.rewardUnlockTitle}>{gameLabel} Unlocked!</Text>
                  <Text style={styles.rewardUnlockSub}>{rewardGame?.description ?? 'Play now!'}</Text>
                </View>
              </View>
              <Text style={styles.rewardUnlockChevron}>›</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.replayBtn} onPress={restart}>
            <Text style={styles.replayBtnText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.homeBtnText}>Back to Lessons</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz screen ─────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Subject-color accent bar above progress */}
      <View style={[styles.subjectAccent, { backgroundColor: subjectColor }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{unit.title}</Text>
          <Text style={styles.headerCounter}>{currentIndex + 1} of {questions.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={scrollEnabled}>

          {/* Context reference card — shown above the question when GPT included one */}
          {q.context && <ContextCard context={q.context} accentColor={subjectColor} />}

          {/* Question card */}
          <Animated.View style={[
            styles.questionCard,
            isVisual && styles.questionCardVisual,
            { borderTopColor: subjectColor, transform: [{ scale: celebAnim }] },
          ]}>
            <View style={styles.questionCardHeader}>
              {/* Type badge */}
              <View style={[styles.typeBadge, { borderColor: subjectColor + '60', backgroundColor: subjectColor + '18' }]}>
                <Text style={[styles.typeBadgeText, { color: subjectColor }]}>
                  {typeLabel ?? (isVisual ? 'Visual Question' : `Question ${currentIndex + 1}`)}
                </Text>
              </View>
            </View>

            {q.image_url && (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setZoomImage(q.image_url)}
                style={styles.questionImageWrap}
              >
                <Image source={{ uri: q.image_url }} style={styles.questionImage} resizeMode="cover" />
                <View style={styles.zoomHint}>
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                  <Text style={styles.zoomHintText}>Tap to enlarge</Text>
                </View>
              </TouchableOpacity>
            )}
            {q.geometry && <GeometryDisplay geometry={q.geometry} />}

            <Markdown style={isVisual ? mdStylesVisual : mdStyles}>
              {q?.question ?? ''}
            </Markdown>
          </Animated.View>

          {/* Hint */}
          {q.hint && (
            <View style={styles.hintRow}>
              <TouchableOpacity onPress={toggleHint} style={styles.hintBtn} activeOpacity={0.8}>
                <Text style={styles.hintBtnText}>{hintVisible ? '💡 Hide hint' : '💡 Show hint'}</Text>
              </TouchableOpacity>
              {hintVisible && (
                <Animated.View style={[styles.hintCard, { opacity: hintAnim }]}>
                  <Text style={styles.hintText}>{q.hint}</Text>
                </Animated.View>
              )}
            </View>
          )}

          {/* ── Renderers by type ── */}
          {isMC ? (
            <View style={styles.optionList}>
              {(q?.options ?? []).map((opt, i) => (
                <TouchableOpacity key={i} style={mcOptionStyle(i)} onPress={() => handleMCAnswer(i)} disabled={answered} activeOpacity={0.8}>
                  <View style={mcLetterStyle(i)}>
                    <Text style={styles.letterText}>{OPTION_LETTERS[i]}</Text>
                  </View>
                  <Text style={mcOptionTextStyle(i)}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : qType === 'fill_in' && q.measurementTool === 'protractor' ? (
            <ProtractorRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} setScrollEnabled={setScrollEnabled} />
          ) : qType === 'fill_in' && q.measurementTool === 'ruler' ? (
            <RulerRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} setScrollEnabled={setScrollEnabled} />
          ) : qType === 'fill_in' ? (
            <FillInRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'ordering' ? (
            <OrderingRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'true_false' ? (
            <TrueFalseRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : qType === 'word_bank' ? (
            <WordBankRenderer key={currentIndex} q={q} onResolve={resolveAnswer} styles={styles} />
          ) : null}

          {/* Read Along */}
          {unit.passage && (
            <TouchableOpacity style={styles.readAlongBar} onPress={() => setPassageVisible(true)} activeOpacity={0.8}>
              <Text style={styles.readAlongIcon}>📖</Text>
              <View style={styles.readAlongTextBlock}>
                <Text style={styles.readAlongLabel}>Read Along</Text>
                <Text style={styles.readAlongSub}>Open the reading to help answer</Text>
              </View>
              <Text style={styles.readAlongChevron}>›</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Image zoom modal */}
      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <TouchableOpacity style={styles.zoomOverlay} activeOpacity={1} onPress={() => setZoomImage(null)}>
          <View style={styles.zoomContainer}>
            <Image source={{ uri: zoomImage }} style={styles.zoomImage} resizeMode="contain" />
            <TouchableOpacity style={styles.zoomCloseBtn} onPress={() => setZoomImage(null)}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reading Passage modal */}
      {unit.passage && (
        <Modal visible={passageVisible} transparent animationType="slide" onRequestClose={() => setPassageVisible(false)}>
          <TouchableOpacity style={styles.passageOverlay} activeOpacity={1} onPress={() => setPassageVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.passageSheet}>
              <View style={styles.passageHandle} />
              <View style={styles.passageModalHeader}>
                <Text style={styles.passageModalTitle}>📖 Reading Passage</Text>
                <TouchableOpacity onPress={() => setPassageVisible(false)}>
                  <Text style={styles.passageCloseX}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.passageModalHint}>Use this text to help answer the questions.</Text>
              <ScrollView style={styles.passageScroll} showsVerticalScrollIndicator>
                <Text style={styles.passageBody}>{unit.passage}</Text>
              </ScrollView>
              <TouchableOpacity style={styles.passageDoneBtn} onPress={() => setPassageVisible(false)}>
                <Text style={styles.passageDoneBtnText}>Back to Quiz</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },

  // Subject accent stripe
  subjectAccent: { height: 3 },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  headerBack:     { width: 40, alignItems: 'flex-start' },
  headerBackText: { fontSize: 22, color: '#94a3b8' },
  headerCenter:   { flex: 1, alignItems: 'center' },
  headerTitle:    { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 1 },
  headerCounter:  { fontSize: 12, color: '#64748b' },

  // Progress
  progressTrack: { height: 4, backgroundColor: '#1e293b' },
  progressFill:  { height: 4, backgroundColor: '#60a5fa' },

  quizContent: { padding: 20, paddingBottom: 48 },

  // Question card
  questionCard: {
    backgroundColor: '#1e293b', borderRadius: 20,
    padding: 20, marginBottom: 16,
    borderTopWidth: 3,
  },
  questionCardVisual: {
    padding: 22, borderWidth: 1, borderTopWidth: 3,
    borderColor: '#312e81', backgroundColor: '#1a1a3e',
  },
  questionCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },

  // Type badge
  typeBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },

  questionImageWrap: { width: '100%', marginBottom: 14, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1e293b' },
  questionImage:     { width: '100%', height: 180 },
  zoomHint: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  zoomHintText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Zoom modal
  zoomOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  zoomContainer: { width: '100%', height: '85%' },
  zoomImage:     { width: '100%', height: '100%' },
  zoomCloseBtn: {
    position: 'absolute', top: 12, right: 16,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },

  // Read Along
  readAlongBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 10, marginBottom: 6, marginHorizontal: 4,
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: 'rgba(96,165,250,0.07)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)',
  },
  readAlongIcon:      { fontSize: 24 },
  readAlongTextBlock: { flex: 1 },
  readAlongLabel:     { fontSize: 14, fontWeight: '700', color: '#60a5fa' },
  readAlongSub:       { fontSize: 11, color: '#475569', marginTop: 1 },
  readAlongChevron:   { fontSize: 22, color: '#60a5fa', fontWeight: '300' },

  // Passage modal
  passageOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  passageSheet:       { backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#1e293b', padding: 24, paddingBottom: 36, maxHeight: '80%' },
  passageHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155', alignSelf: 'center', marginBottom: 20 },
  passageModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  passageModalTitle:  { fontSize: 18, fontWeight: '800', color: '#fff' },
  passageCloseX:      { fontSize: 18, color: '#64748b', padding: 4 },
  passageModalHint:   { fontSize: 13, color: '#64748b', marginBottom: 16 },
  passageScroll:      { maxHeight: 340, marginBottom: 20 },
  passageBody:        { fontSize: 15, color: '#e2e8f0', lineHeight: 24 },
  passageDoneBtn:     { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  passageDoneBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },

  // Audio

  // Hint
  hintRow:     { marginBottom: 16 },
  hintBtn:     { alignSelf: 'flex-start', backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 },
  hintBtnText: { fontSize: 13, fontWeight: '700', color: '#fbbf24' },
  hintCard:    { backgroundColor: 'rgba(251,191,36,0.08)', borderLeftWidth: 3, borderLeftColor: '#fbbf24', borderRadius: 10, padding: 14 },
  hintText:    { fontSize: 14, color: '#fde68a', lineHeight: 20 },

  // Multiple choice
  optionList: { gap: 10 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1e293b', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    borderWidth: 2, borderColor: '#334155',
  },
  optionCorrect:       { backgroundColor: '#14532d', borderColor: '#22c55e' },
  optionWrong:         { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  optionDimmed:        { opacity: 0.45 },
  letterBadge:         { width: 32, height: 32, borderRadius: 10, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  letterBadgeCorrect:  { backgroundColor: '#22c55e' },
  letterBadgeWrong:    { backgroundColor: '#ef4444' },
  letterBadgeDimmed:   { backgroundColor: '#1e293b' },
  letterText:          { fontSize: 13, fontWeight: '800', color: '#94a3b8' },
  optionText:          { flex: 1, fontSize: 16, fontWeight: '600', color: '#e2e8f0', lineHeight: 22 },
  optionTextLight:     { color: '#fff' },
  optionTextDimmed:    { color: '#475569' },

  // Fill in
  fillInBox: {
    borderWidth: 2, borderColor: '#334155', borderRadius: 14,
    backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 10,
  },
  fillInBoxCorrect: { borderColor: '#22c55e', backgroundColor: '#14532d' },
  fillInBoxWrong:   { borderColor: '#ef4444', backgroundColor: '#7f1d1d' },
  fillInInput:      { fontSize: 22, fontWeight: '700', color: '#f1f5f9', paddingVertical: 14 },
  fillInSubmit:     { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center', marginTop: 4 },
  fillInSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  fillInReveal:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6, marginBottom: 4 },
  fillInRevealLabel:  { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  fillInRevealAnswer: { fontSize: 15, fontWeight: '800', color: '#f87171' },
  fillInCorrectMsg: { fontSize: 15, fontWeight: '700', color: '#4ade80', marginTop: 6 },

  // Ordering
  orderingLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10, marginTop: 4 },
  orderingSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  orderingSlot: {
    minWidth: 72, minHeight: 52, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  orderingSlotCorrect: { borderColor: '#22c55e', backgroundColor: '#14532d33' },
  orderingSlotWrong:   { borderColor: '#ef4444', backgroundColor: '#7f1d1d33' },
  orderingSlotNum:     { fontSize: 10, fontWeight: '800', color: '#475569', position: 'absolute', top: 4, left: 6 },
  orderingSlotText:    { fontSize: 15, fontWeight: '700', color: '#e2e8f0', textAlign: 'center' },
  orderingChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  orderingChip: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  orderingChipUsed:     { opacity: 0.25 },
  orderingChipText:     { fontSize: 15, fontWeight: '700', color: '#e2e8f0' },
  orderingChipTextUsed: { color: '#475569' },
  orderingClear:        { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 },
  orderingClearText:    { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  orderingReveal:       { marginTop: 10, padding: 12, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#ef4444' },

  // True / False
  tfRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  tfTrue: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 22, borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 2, borderColor: 'rgba(34,197,94,0.4)',
  },
  tfFalse: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 22, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 2, borderColor: 'rgba(239,68,68,0.4)',
  },
  tfTrueCorrect:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#14532d', borderWidth: 2, borderColor: '#22c55e' },
  tfFalseCorrect: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#14532d', borderWidth: 2, borderColor: '#22c55e' },
  tfTrueWrong:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#7f1d1d', borderWidth: 2, borderColor: '#ef4444' },
  tfFalseWrong:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 22, borderRadius: 16, backgroundColor: '#7f1d1d', borderWidth: 2, borderColor: '#ef4444' },
  tfDimmed:       { opacity: 0.3 },
  tfBtnText:      { fontSize: 20, fontWeight: '800', color: '#fff' },

  // Word bank
  wbBankLabel:    { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  wbBank:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  wbChip: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155',
  },
  wbChipSelected: { borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.15)' },
  wbChipCorrect:  { backgroundColor: '#14532d', borderColor: '#22c55e' },
  wbChipWrong:    { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  wbChipDim:      { opacity: 0.35 },
  wbChipText:     { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  wbSentenceCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 10 },
  wbSentence:     { fontSize: 22, fontWeight: '600', color: '#f1f5f9', lineHeight: 36 },
  wbBlank:        { fontSize: 22, fontWeight: '800', color: '#475569' },
  wbBlankFilled:  { color: '#60a5fa' },
  wbBlankCorrect: { color: '#4ade80' },
  wbBlankWrong:   { color: '#f87171' },
  wbClear:        { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, marginTop: 4 },
  wbClearText:    { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  // Results
  resultsContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn:     { marginBottom: 16 },
  backBtnText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  resultsCard: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultsStars:{ fontSize: 52, marginBottom: 16 },
  resultsScore:{ fontSize: 72, fontWeight: '900', color: '#fff', lineHeight: 80 },
  resultsLabel:{ fontSize: 22, fontWeight: '700', color: '#94a3b8', marginTop: 8, marginBottom: 6 },
  resultsUnit: { fontSize: 14, color: '#475569', textAlign: 'center', maxWidth: 240 },
  // Reward unlock banner
  rewardUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.5)',
  },
  rewardUnlockLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardUnlockEmoji:   { fontSize: 30 },
  rewardUnlockTitle:   { fontSize: 16, fontWeight: '800', color: '#93c5fd', marginBottom: 2 },
  rewardUnlockSub:     { fontSize: 12, color: '#475569', fontWeight: '600' },
  rewardUnlockChevron: { fontSize: 28, color: '#3b82f6', fontWeight: '300' },

  replayBtn:   { backgroundColor: '#2563eb', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 12 },
  replayBtnText:{ fontSize: 17, fontWeight: '700', color: '#fff' },
  homeBtn:     { paddingVertical: 14, alignItems: 'center' },
  homeBtnText: { fontSize: 15, color: '#64748b', fontWeight: '600' },

  // Empty state
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji:  { fontSize: 56, marginBottom: 16 },
  emptyTitle:  { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 8 },
  emptyDesc:   { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn:    { backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText:{ fontSize: 15, fontWeight: '700', color: '#94a3b8' },
});
