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

// ── SegmentStimulus — draws a ruler with a colored bar ────────
function SegmentStimulus({ geometry }) {
  const { length = 1, unit = 'inch', color = 'red', rulerMax = Math.ceil(length) + 1 } = geometry;
  const W        = 280;
  const pxPerUnit = W / rulerMax;
  const barWidth  = Math.round(length * pxPerUnit);
  const unitLabel = unit === 'inch' ? 'in' : unit;

  const COLOR_MAP = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
    orange: '#f97316', purple: '#a855f7', yellow: '#eab308',
  };
  const barColor = COLOR_MAP[color] ?? color;

  // Ticks: whole units + halves
  const ticks = [];
  for (let i = 0; i <= rulerMax * 2; i++) {
    const isWhole = i % 2 === 0;
    const x = Math.round((i / 2) * pxPerUnit);
    ticks.push({ x, isWhole, label: isWhole ? String(i / 2) : null });
  }

  // Layout (all positions relative to the outer canvas):
  //   0–22  : colored bar
  //   26–52 : ruler body (tick marks, no overflow needed)
  //   54–70 : number labels (below ruler, outside ruler body)
  //   72–82 : unit label
  return (
    <View style={[stimStyles.segCanvas, { height: 88 }]}>

      {/* ── Colored bar with end caps ── */}
      <View style={{ position: 'absolute', left: 0, top: 4, height: 16, width: barWidth, backgroundColor: barColor, borderRadius: 3 }} />
      {/* left cap */}
      <View style={{ position: 'absolute', left: 0,           top: 0, width: 2, height: 24, backgroundColor: barColor }} />
      {/* right cap */}
      <View style={{ position: 'absolute', left: barWidth - 2, top: 0, width: 2, height: 24, backgroundColor: barColor }} />

      {/* ── Ruler body (tick marks only, no text inside) ── */}
      <View style={{ position: 'absolute', left: 0, top: 26, width: W, height: 28, backgroundColor: '#1e293b', borderRadius: 4, borderWidth: 1, borderColor: '#334155' }}>
        {ticks.map((t, i) => (
          <View key={i} style={{
            position: 'absolute', left: t.x - 0.75, top: 0,
            width: 1.5, height: t.isWhole ? 18 : 10,
            backgroundColor: t.isWhole ? '#64748b' : '#475569',
          }} />
        ))}
      </View>

      {/* ── Number labels — positioned in canvas, below the ruler body ── */}
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <Text key={i} style={{
          position: 'absolute',
          left: t.x - 10, top: 56,
          width: 20, textAlign: 'center',
          fontSize: 11, color: '#94a3b8', fontWeight: '700',
        }}>{t.label}</Text>
      ))}

      {/* ── Unit label ── */}
      <Text style={{ position: 'absolute', right: 2, top: 72, fontSize: 10, color: '#64748b', fontWeight: '600' }}>
        {unitLabel}
      </Text>
    </View>
  );
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
const PROT_TICK_STEP   = 10; // minor tick every 10°
const PROT_R      = 108; // arc radius
const PROT_CX     = 140; // center x  (container width = 280)
const PROT_CY     = 130; // center y  (baseline of semicircle)
const SLIDER_W    = 240; // slider track width

function ProtractorRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const [angleDeg, setAngleDeg] = useState(90);
  const [feedback,  setFeedback]  = useState(null);
  const sliderXRef = useRef((90 / 180) * SLIDER_W);
  const startXRef  = useRef(sliderXRef.current);
  const shakeAnim  = useRef(new Animated.Value(0)).current;

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
      // Capture phase fires before ScrollView can claim the gesture
      onStartShouldSetPanResponderCapture: () => !feedback,
      onMoveShouldSetPanResponderCapture:  () => true,
      onStartShouldSetPanResponder:        () => !feedback,
      onMoveShouldSetPanResponder:         () => true,
      // Never let the OS hand the gesture to someone else mid-drag
      onPanResponderTerminationRequest:    () => false,
      // Jump handle to wherever the finger lands on the track
      onPanResponderGrant: (e) => {
        setScrollEnabled?.(false);
        const x = Math.max(0, Math.min(SLIDER_W, e.nativeEvent.locationX));
        sliderXRef.current = x;
        startXRef.current  = x;
        setAngleDeg(Math.round((x / SLIDER_W) * 180));
      },
      onPanResponderMove: (_, gs) => {
        const nx = Math.max(0, Math.min(SLIDER_W, startXRef.current + gs.dx));
        sliderXRef.current = nx;
        setAngleDeg(Math.round((nx / SLIDER_W) * 180));
      },
      onPanResponderRelease:   () => { setScrollEnabled?.(true); },
      onPanResponderTerminate: () => { setScrollEnabled?.(true); },
    })
  ).current;

  function handleSubmit() {
    if (feedback) return;
    const correct    = parseFloat(q.correctAnswer ?? '0');
    const isCorrect  = Math.abs(angleDeg - correct) <= 5; // ±5° tolerance
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else           { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  const isCorrect  = feedback === 'correct';
  const isWrong    = feedback === 'wrong';
  const armColor   = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed';
  const sliderLeft = (angleDeg / 180) * SLIDER_W;

  // Reference angle — drawn inside the protractor so student reads the scale
  const refAngle = parseFloat(q.correctAnswer ?? '0');
  const geo      = q.geometry?.type === 'angle' ? q.geometry : null;
  const refRad   = (refAngle * Math.PI) / 180;
  const refTipX  = PROT_CX + (PROT_R - 6) * Math.cos(refRad);
  const refTipY  = PROT_CY - (PROT_R - 6) * Math.sin(refRad);
  const r0TipX   = PROT_CX + (PROT_R - 6); // ray1 tip (0°)

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {/* ── Protractor visual — reference arm drawn inside ── */}
      <View style={measStyles.protContainer}>
        {/* Outer arc (semicircle) */}
        <View style={[measStyles.protArc, { left: PROT_CX - PROT_R, top: PROT_CY - PROT_R }]} />
        {/* Baseline */}
        <View style={{ position: 'absolute', left: PROT_CX - PROT_R - 6, top: PROT_CY - 1, width: PROT_R * 2 + 12, height: 1.5, backgroundColor: '#475569' }} />

        {/* Minor tick marks every 10° along the arc */}
        {Array.from({ length: 19 }, (_, i) => (i + 1) * PROT_TICK_STEP - PROT_TICK_STEP).map(deg => {
          const isLabel = PROT_LABEL_MARKS.includes(deg);
          if (isLabel) return null; // labels have their own marks
          const r   = (deg * Math.PI) / 180;
          const tx1 = PROT_CX + (PROT_R - 4) * Math.cos(r);
          const ty1 = PROT_CY - (PROT_R - 4) * Math.sin(r);
          const tx2 = PROT_CX + (PROT_R + 4) * Math.cos(r);
          const ty2 = PROT_CY - (PROT_R + 4) * Math.sin(r);
          // Draw as a tiny rotated line
          const tickLen = 8;
          return <View key={deg} style={armStyle(tx1, ty1, tickLen, deg, '#334155', 1.5)} />;
        })}

        {/* Reference arm — the angle to measure (white "pencil line" through the protractor) */}
        <View style={armStyle(PROT_CX, PROT_CY, PROT_R + 18, refAngle, '#e2e8f0', 1.5)} />
        {/* Angle arc between 0° and the reference angle */}
        {Array.from({ length: Math.round(refAngle / 3) }, (_, i) => {
          const a = (i / Math.round(refAngle / 3)) * refAngle;
          const r = (a * Math.PI) / 180;
          return <View key={i} style={{ position: 'absolute', left: PROT_CX + 36 * Math.cos(r) - 1.5, top: PROT_CY - 36 * Math.sin(r) - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#7c3aed', opacity: 0.5 }} />;
        })}

        {/* Fixed arm (0° → right) */}
        <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, 0, '#475569')} />
        {/* Movable arm (student-controlled) */}
        <View style={armStyle(PROT_CX, PROT_CY, PROT_R - 6, angleDeg, armColor, 3)} />

        {/* Center dot */}
        <View style={{ position: 'absolute', left: PROT_CX - 5, top: PROT_CY - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#94a3b8' }} />

        {/* Degree labels at major marks */}
        {PROT_LABEL_MARKS.map(mark => {
          const rad    = (mark * Math.PI) / 180;
          const lx     = PROT_CX + (PROT_R + 18) * Math.cos(rad);
          const ly     = PROT_CY - (PROT_R + 18) * Math.sin(rad);
          const isNear = Math.abs(mark - angleDeg) <= 6;
          return (
            <Text key={mark} style={[measStyles.protMarkLabel, { left: lx - 13, top: ly - 8 }, isNear && { color: armColor, fontWeight: '800' }]}>
              {mark}°
            </Text>
          );
        })}

        {/* Ray labels from geometry (vertex, ray1 at 0°, ray2 at refAngle) */}
        {geo && <>
          <Text style={[measStyles.protRayLabel, { left: PROT_CX - 8, top: PROT_CY + 10 }]}>{geo.vertex}</Text>
          <Text style={[measStyles.protRayLabel, { left: r0TipX + 5, top: PROT_CY - 8 }]}>{geo.ray1}</Text>
          <Text style={[measStyles.protRayLabel, { left: refTipX + (refAngle > 90 ? -20 : 5), top: refTipY - 16 }]}>{geo.ray2}</Text>
        </>}

        {/* Angle readout in center of arc */}
        <Text style={[measStyles.protReadout, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}>
          {angleDeg}°
        </Text>
      </View>

      {/* ── Slider — panHandlers on the whole track so dragging anywhere works ── */}
      <View style={measStyles.sliderRow}>
        <Text style={measStyles.sliderEndLabel}>0°</Text>
        <View style={measStyles.sliderTrack} {...panResponder.panHandlers}>
          <View style={[measStyles.sliderFill, { width: sliderLeft }]} />
          <View style={[measStyles.sliderHandle, { left: sliderLeft - 12 }]} pointerEvents="none" />
        </View>
        <Text style={measStyles.sliderEndLabel}>180°</Text>
      </View>
      <Text style={measStyles.sliderHint}>Tap or drag anywhere on the bar</Text>

      {!q.image_url && !q.geometry && (
        <Text style={measStyles.worksheetHint}>📖 Reference your worksheet to see the angle</Text>
      )}

      {isWrong && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct angle:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}°</Text>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct! 📐</Text>}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 20 }]} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Angle</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── RulerRenderer ─────────────────────────────────────────────
const RULER_DISPLAY_W = 280;

function RulerRenderer({ q, onResolve, styles, setScrollEnabled }) {
  // Prefer geometry.rulerMax (set by AI alongside unit), fall back to rulerMaxCm
  const rulerUnit = q.geometry?.unit ?? 'cm';
  const unitLabel = rulerUnit === 'inch' ? 'in' : rulerUnit;
  const maxCm     = q.geometry?.rulerMax ?? q.rulerMaxCm ?? 10;
  const cmPx      = RULER_DISPLAY_W / maxCm; // pixels per unit
  const [valueCm,  setValueCm]  = useState(maxCm / 2);
  const [feedback, setFeedback] = useState(null);
  const valueXRef  = useRef((maxCm / 2) * cmPx);
  const startXRef  = useRef(valueXRef.current);
  const shakeAnim  = useRef(new Animated.Value(0)).current;

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
      // Capture phase fires before ScrollView can claim the gesture
      onStartShouldSetPanResponderCapture: () => !feedback,
      onMoveShouldSetPanResponderCapture:  () => true,
      onStartShouldSetPanResponder:        () => !feedback,
      onMoveShouldSetPanResponder:         () => true,
      // Never let the OS hand the gesture to someone else mid-drag
      onPanResponderTerminationRequest:    () => false,
      // Jump marker to wherever the finger lands on the ruler
      onPanResponderGrant: (e) => {
        setScrollEnabled?.(false);
        const x = Math.max(0, Math.min(RULER_DISPLAY_W, e.nativeEvent.locationX));
        valueXRef.current = x;
        startXRef.current = x;
        setValueCm(Math.round((x / RULER_DISPLAY_W) * maxCm * 10) / 10);
      },
      onPanResponderMove: (_, gs) => {
        const nx = Math.max(0, Math.min(RULER_DISPLAY_W, startXRef.current + gs.dx));
        valueXRef.current = nx;
        setValueCm(Math.round((nx / RULER_DISPLAY_W) * maxCm * 10) / 10);
      },
      onPanResponderRelease:   () => { setScrollEnabled?.(true); },
      onPanResponderTerminate: () => { setScrollEnabled?.(true); },
    })
  ).current;

  function handleSubmit() {
    if (feedback) return;
    const correct   = parseFloat(q.correctAnswer ?? '0');
    const tolerance = Math.max(0.3, correct * 0.1); // ±10% or ±0.3 cm
    const isCorrect = Math.abs(valueCm - correct) <= tolerance;
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else           { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  const isCorrect  = feedback === 'correct';
  const isWrong    = feedback === 'wrong';
  const markerLeft = (valueCm / maxCm) * RULER_DISPLAY_W;

  // Build whole-unit and half-unit tick marks
  const ticks = [];
  for (let i = 0; i <= maxCm * 2; i++) {
    const isCm = i % 2 === 0;
    const xPos = Math.round((i / 2) * cmPx);
    const h    = isCm ? 16 : 9;
    ticks.push({ x: xPos, h, isCm, label: isCm ? String(i / 2) : null });
  }

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      {/* ── Segment drawing — shown when AI provided geometry ── */}
      {q.geometry?.type === 'segment' && <SegmentStimulus geometry={q.geometry} />}

      {/* Reading */}
      <Text style={[measStyles.rulerReading, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}>
        {valueCm.toFixed(1)} {unitLabel}
      </Text>

      {/* ── Ruler visual ── */}
      <View style={measStyles.rulerContainer}>
        {/* Ruler body (tick marks only — no text inside, avoids clipping on Android) */}
        <View style={measStyles.rulerBody}>
          {ticks.map((t, idx) => (
            <View key={idx} style={{ position: 'absolute', left: t.x - 0.75, top: 0, width: 1.5, height: t.h, backgroundColor: t.isCm ? '#64748b' : '#475569' }} />
          ))}
        </View>

        {/* Number labels outside the ruler body so they never clip */}
        {ticks.filter(t => t.label !== null).map((t, idx) => (
          <Text key={`l${idx}`} style={[measStyles.rulerTickLabel, { left: t.x - 8, top: 34 }]}>{t.label}</Text>
        ))}

        {/* Unit label */}
        <Text style={{ position: 'absolute', right: 2, top: 34, fontSize: 9, color: '#475569', fontWeight: '600' }}>{unitLabel}</Text>

        {/* panHandlers on the whole ruler body so any touch/drag works */}
        <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} {...panResponder.panHandlers} />
        {/* Marker — visual only, no panHandlers needed */}
        <View style={[measStyles.rulerMarker, { left: markerLeft - 1.5, backgroundColor: isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#7c3aed' }]} pointerEvents="none" />
        <View style={[measStyles.rulerMarkerHandle, { left: markerLeft - 12 }]} pointerEvents="none" />
      </View>
      <Text style={measStyles.sliderHint}>Tap or drag anywhere on the ruler</Text>

      {!q.image_url && !q.geometry && (
        <Text style={measStyles.worksheetHint}>📖 Reference your worksheet for the measurement</Text>
      )}

      {isWrong && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct measurement:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer} {unitLabel}</Text>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct! 📏</Text>}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 20 }]} onPress={handleSubmit} activeOpacity={0.8}>
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
  sliderHint:     { fontSize: 11, color: '#475569', textAlign: 'center', marginBottom: 6 },
  worksheetHint:  { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 2, marginBottom: 4, fontStyle: 'italic' },
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

// ── Main QuizScreen ───────────────────────────────────────────
export default function QuizScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { unit }   = route.params;
  const { activeKid } = useAuth();
  const questions  = unit.questions ?? [];

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
  fillInSubmit:     { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  fillInSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
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
