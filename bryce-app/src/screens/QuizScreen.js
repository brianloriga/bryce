import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Markdown from '@ronradtke/react-native-markdown-display';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Image, Modal, TextInput,
  KeyboardAvoidingView, Platform, Keyboard,
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
    const correct = all.includes(ans);
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
  const [audioPlaying, setAudioPlaying]     = useState(false);
  const [audioLoading, setAudioLoading]     = useState(false);
  const [passageVisible, setPassageVisible] = useState(false);
  const [zoomImage, setZoomImage]           = useState(null);
  const [enabledGames, setEnabledGames]     = useState({});

  useEffect(() => {
    getEnabledMap(GAME_REGISTRY.map(g => g.id)).then(setEnabledGames);
  }, []);

  const progressAnim  = useRef(new Animated.Value(0)).current;
  const hintAnim      = useRef(new Animated.Value(0)).current;
  const celebAnim     = useRef(new Animated.Value(1)).current;
  const answerTimeout = useRef(null);
  const soundRef      = useRef(null);

  async function unloadSound() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setAudioPlaying(false);
  }

  useEffect(() => {
    setHintVisible(false);
    hintAnim.setValue(0);
    celebAnim.setValue(1);
    unloadSound();
  }, [currentIndex]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      if (answerTimeout.current) clearTimeout(answerTimeout.current);
      unloadSound();
    };
  }, []);

  const toggleAudio = useCallback(async () => {
    if (audioPlaying) { await unloadSound(); return; }
    const url = questions[currentIndex]?.audio_url;
    if (!url) return;
    setAudioLoading(true);
    try {
      await unloadSound();
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setAudioPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish || status.error) { setAudioPlaying(false); soundRef.current = null; }
      });
    } catch (_) { setAudioPlaying(false); }
    finally { setAudioLoading(false); }
  }, [audioPlaying, currentIndex, questions]);

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
    unloadSound();
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
    unloadSound();
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
    unloadSound(); animateProgress(0);
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
        <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
              {q.audio_url ? (
                <TouchableOpacity onPress={toggleAudio} style={styles.audioBtn} activeOpacity={0.7} disabled={audioLoading}>
                  <Text style={[styles.audioBtnIcon, audioPlaying && styles.audioBtnActive]}>
                    {audioLoading ? '⏳' : audioPlaying ? '🔊' : '🔈'}
                  </Text>
                </TouchableOpacity>
              ) : null}
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
  audioBtn:       { padding: 4 },
  audioBtnIcon:   { fontSize: 20, opacity: 0.55 },
  audioBtnActive: { opacity: 1 },

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
