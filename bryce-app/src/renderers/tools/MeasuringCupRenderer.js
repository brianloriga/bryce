import React, { useState, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import Svg, {
  Path, Rect, Line,
  Text as SvgText,
  Defs, ClipPath, LinearGradient, Stop,
} from 'react-native-svg';

// ── Per-option accent colors ──────────────────────────────────
const OPTION_ACCENTS = [
  { border: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  { border: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  { border: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
];

// ── Cup SVG geometry ──────────────────────────────────────────
const CUP_LEFT    = 14;   // x of cup top-left corner
const CUP_TOP     = 8;    // y of cup top
const CUP_TOP_W   = 96;   // cup width at top
const CUP_BOT_W   = 72;   // cup width at bottom
const CUP_H       = 168;  // cup height
const WALL        = 3;    // wall thickness

const CUP_RIGHT   = CUP_LEFT + CUP_TOP_W;          // 110
const CUP_BOT_Y   = CUP_TOP + CUP_H;               // 176
const TAPER       = (CUP_TOP_W - CUP_BOT_W) / 2;   // 12 — each side narrows by this

// Interior
const I_LT   = CUP_LEFT + WALL;                     // 17  — interior left at top
const I_RT   = CUP_RIGHT - WALL;                    // 107 — interior right at top
const I_TOP  = CUP_TOP + WALL;                      // 11
const I_LB   = CUP_LEFT + TAPER + WALL;             // 29  — interior left at bottom
const I_RB   = CUP_RIGHT - TAPER - WALL;            // 95  — interior right at bottom
const I_BOT  = CUP_BOT_Y - WALL;                   // 173
const I_H    = I_BOT - I_TOP;                       // 162

// Convert fill level (0–1) to SVG y coordinate
const levelToY    = L => I_TOP + (1 - Math.max(0, Math.min(1, L))) * I_H;
// Right interior wall x at a given y
const rightWallX  = y => I_RT + (y - I_TOP) * (I_RB - I_RT) / I_H;

const SVG_W = 200;
const SVG_H = CUP_BOT_Y + 14;   // 190

// Tick level data
const TICK_LEVELS = [
  { level: 1.00, label: '1 cup', answer: '1 cup'  },
  { level: 0.75, label: '¾ cup', answer: '¾ cup'  },
  { level: 0.50, label: '½ cup', answer: '½ cup'  },
  { level: 0.25, label: '¼ cup', answer: '¼ cup'  },
];

const levelToAnswer = level =>
  TICK_LEVELS.find(t => Math.abs(t.level - level) < 0.01)?.answer ?? `${level} cup`;

// ── SVG Cup Visual ────────────────────────────────────────────
function CupSvg({ fillLevel = 0, targetLevel = null, uid = 'a' }) {
  const clipId = `cc-${uid}`;
  const gradId = `lg-${uid}`;
  const liqY   = levelToY(fillLevel);
  const tgtY   = targetLevel !== null ? levelToY(targetLevel) : null;

  // Paths
  const exterior = `M ${CUP_LEFT},${CUP_TOP} L ${CUP_RIGHT},${CUP_TOP} L ${CUP_RIGHT - TAPER},${CUP_BOT_Y} L ${CUP_LEFT + TAPER},${CUP_BOT_Y} Z`;
  const interior = `M ${I_LT},${I_TOP} L ${I_RT},${I_TOP} L ${I_RB},${I_BOT} L ${I_LB},${I_BOT} Z`;

  // Handle: cubic bezier arcing rightward from mid cup
  const hY1 = CUP_TOP + CUP_H * 0.2;
  const hY2 = CUP_TOP + CUP_H * 0.8;
  const hX1 = CUP_RIGHT - TAPER * (hY1 - CUP_TOP) / CUP_H;
  const hX2 = CUP_RIGHT - TAPER * (hY2 - CUP_TOP) / CUP_H;
  const handle = `M ${hX1},${hY1} C ${hX1 + 34},${hY1} ${hX2 + 34},${hY2} ${hX2},${hY2}`;

  const ticks = TICK_LEVELS.map(t => {
    const y = levelToY(t.level);
    return { ...t, y, rx: rightWallX(y) };
  });

  return (
    <Svg width={SVG_W} height={SVG_H}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={interior} />
        </ClipPath>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#93c5fd" stopOpacity="0.88" />
          <Stop offset="1"   stopColor="#1d4ed8" stopOpacity="0.92" />
        </LinearGradient>
      </Defs>

      {/* ── Cup body ── */}
      <Path d={exterior} fill="#1e293b" stroke="#475569" strokeWidth={WALL + 0.5} />

      {/* ── Liquid ── */}
      {fillLevel > 0.005 && (
        <Rect
          x={CUP_LEFT} y={liqY}
          width={CUP_TOP_W} height={CUP_BOT_Y - liqY + 1}
          fill={`url(#${gradId})`}
          clipPath={`url(#${clipId})`}
        />
      )}

      {/* ── Target line ── */}
      {tgtY !== null && (
        <Line
          x1={I_LT} y1={tgtY} x2={I_RT} y2={tgtY}
          stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"
        />
      )}

      {/* ── Measurement tick marks ── */}
      {ticks.map(t => (
        <Line
          key={t.label}
          x1={t.rx - 16} y1={t.y} x2={t.rx} y2={t.y}
          stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"
        />
      ))}

      {/* ── Handle ── */}
      <Path d={handle} fill="none" stroke="#475569" strokeWidth="4.5" strokeLinecap="round" />

      {/* ── Pour spout (top-left lip) ── */}
      <Rect
        x={CUP_LEFT - 10} y={CUP_TOP}
        width="11" height="8"
        fill="#475569" rx="2" ry="2"
      />

      {/* ── Tick labels (well right of handle) ── */}
      {ticks.map(t => (
        <SvgText
          key={t.label}
          x={148} y={t.y + 4.5}
          fill="#64748b" fontSize="11" fontWeight="bold"
        >
          {t.label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── MC helpers ────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildReadOptions(correctLevel) {
  const correct = levelToAnswer(correctLevel);
  const others  = shuffle(TICK_LEVELS.filter(t => Math.abs(t.level - correctLevel) > 0.01).map(t => t.answer));
  return shuffle([correct, ...others.slice(0, 3)]);
}

function buildFillOptions(addLevel, currentLevel, targetLevel) {
  const correct = levelToAnswer(addLevel);
  const traps = [levelToAnswer(targetLevel), levelToAnswer(currentLevel)].filter(l => l && l !== correct);
  const rest   = TICK_LEVELS
    .filter(t => Math.abs(t.level - addLevel) > 0.01 && Math.abs(t.level - targetLevel) > 0.01 && Math.abs(t.level - currentLevel) > 0.01)
    .map(t => t.answer);
  return shuffle([...new Set([correct, ...traps, ...rest])]).slice(0, 4);
}

function useGridW() {
  const { width } = useWindowDimensions();
  return Math.min(width - 40, 340);
}

// ── AnimatedMCButton ──────────────────────────────────────────
function AnimatedMCButton({ label, accentIdx, onPress, disabled, state }) {
  const scale  = useRef(new Animated.Value(1)).current;
  const accent = OPTION_ACCENTS[accentIdx % 4];

  function onPressIn() {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }

  const stateStyle = state === 'correct' ? cStyles.btnCorrect
    : state === 'wrong'  ? cStyles.btnWrong
    : state === 'dimmed' ? { opacity: 0.3 }
    : { borderColor: accent.border, backgroundColor: accent.bg };

  return (
    <Animated.View style={[cStyles.btnWrap, stateStyle, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={cStyles.btnInner}
        onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        disabled={disabled} activeOpacity={1}
      >
        <Text style={cStyles.btnText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── MCGrid ────────────────────────────────────────────────────
function MCGrid({ options, chosen, feedback, correct, onPick, gridW }) {
  return (
    <View style={[cStyles.mcGrid, { width: gridW }]}>
      {options.map((opt, i) => {
        const isChosen = chosen === opt;
        const isCorr   = feedback && opt === correct;
        const isWrng   = feedback && isChosen && opt !== correct;
        const isDimmed = feedback && !isChosen && opt !== correct;
        const state    = isCorr ? 'correct' : isWrng ? 'wrong' : isDimmed ? 'dimmed' : 'idle';
        return (
          <AnimatedMCButton key={i} label={opt} accentIdx={i}
            onPress={() => onPick(opt)} disabled={!!feedback} state={state} />
        );
      })}
    </View>
  );
}

function FeedbackBox({ ok, children }) {
  return (
    <View style={[cStyles.feedbackBox, !ok && cStyles.feedbackWrong]}>
      <Text style={cStyles.feedbackText}>{children}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ReadMode
// ─────────────────────────────────────────────────────────────
function ReadMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const level   = parseFloat(String(geo.level ?? '0.5'));
  const options = useMemo(() => buildReadOptions(level), [level]);
  const correct = levelToAnswer(level);
  const gridW   = useGridW();

  const [chosen, setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback) return;
    setChosen(opt);
    const ok = opt === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 2200);
  }

  return (
    <View style={cStyles.wrap}>
      <CupSvg fillLevel={level} uid="read" />
      <Text style={cStyles.question}>How much liquid is in the cup?</Text>
      <MCGrid options={options} chosen={chosen} feedback={feedback} correct={correct} onPick={handlePick} gridW={gridW} />
      {feedback === 'correct' && (
        <FeedbackBox ok>
          The liquid reaches the <Text style={{ color: '#4ade80', fontWeight: '800' }}>{correct}</Text> mark. ✓
        </FeedbackBox>
      )}
      {feedback === 'wrong' && chosen && (
        <FeedbackBox ok={false}>
          Find the line the liquid surface is touching — that is the <Text style={{ color: '#f87171', fontWeight: '800' }}>{correct}</Text> mark, not {chosen}.
        </FeedbackBox>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// FillMode
// ─────────────────────────────────────────────────────────────
function FillMode({ q, onResolve }) {
  const geo          = q.geometry ?? {};
  const currentLevel = parseFloat(String(geo.currentLevel ?? geo.level ?? '0.25'));
  const targetLevel  = parseFloat(String(geo.targetLevel ?? '0.75'));
  const addLevel     = parseFloat((targetLevel - currentLevel).toFixed(3));
  const options      = useMemo(() => buildFillOptions(addLevel, currentLevel, targetLevel), [addLevel, currentLevel, targetLevel]);
  const correct      = levelToAnswer(addLevel);
  const currentLabel = levelToAnswer(currentLevel);
  const targetLabel  = levelToAnswer(targetLevel);
  const gridW        = useGridW();

  const [chosen, setChosen]     = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback) return;
    setChosen(opt);
    const ok = opt === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 2200);
  }

  const fillHint = opt => {
    if (opt === targetLabel) return `${targetLabel} is the target, not how much to add. You already have ${currentLabel}, so you need ${correct} more.`;
    if (opt === currentLabel) return `${currentLabel} is how much is already in the cup. Amount to add = target (${targetLabel}) − current (${currentLabel}) = ${correct}.`;
    return `Target (${targetLabel}) − current (${currentLabel}) = ${correct}.`;
  };

  return (
    <View style={cStyles.wrap}>
      <CupSvg fillLevel={currentLevel} targetLevel={targetLevel} uid="fill" />
      <View style={cStyles.badge}>
        <Text style={cStyles.badgeText}>
          Has <Text style={{ color: '#60a5fa', fontWeight: '800' }}>{currentLabel}</Text>
          {'  ·  '}
          Target <Text style={{ color: '#fbbf24', fontWeight: '800' }}>{targetLabel}</Text>
        </Text>
      </View>
      <Text style={cStyles.question}>How much MORE liquid do you need to add?</Text>
      <MCGrid options={options} chosen={chosen} feedback={feedback} correct={correct} onPick={handlePick} gridW={gridW} />
      {feedback === 'correct' && (
        <FeedbackBox ok>
          {targetLabel} − {currentLabel} = <Text style={{ color: '#4ade80', fontWeight: '800' }}>{correct}</Text> more to add. ✓
        </FeedbackBox>
      )}
      {feedback === 'wrong' && chosen && (
        <FeedbackBox ok={false}>{fillHint(chosen)}</FeedbackBox>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CompareMode
// ─────────────────────────────────────────────────────────────
function CompareMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const level1  = parseFloat(String(geo.level  ?? '0.75'));
  const level2  = parseFloat(String(geo.level2 ?? '0.5'));
  const correct = (q.correctAnswer ?? '').toLowerCase().trim();
  const label1  = levelToAnswer(level1);
  const label2  = levelToAnswer(level2);
  const gridW   = useGridW();

  const [chosen, setChosen]     = useState(null);
  const [feedback, setFeedback] = useState(null);

  const CHOICES = [
    { id: 'left',  label: 'Left cup',    accentIdx: 0 },
    { id: 'right', label: 'Right cup',   accentIdx: 1 },
    { id: 'equal', label: 'Same amount', accentIdx: 2 },
  ];

  function handlePick(id) {
    if (feedback) return;
    setChosen(id);
    const ok = id === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const feedbackMsg = () => {
    if (correct === 'equal') return `Both cups reach the ${label1} mark — same amount.`;
    if (correct === 'left')  return `Left has ${label1}, which is more than right's ${label2}.`;
    return `Right has ${label2}, which is more than left's ${label1}.`;
  };

  return (
    <View style={cStyles.wrap}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 8 }}>
        <View style={{ alignItems: 'center' }}>
          <CupSvg fillLevel={level1} uid="cmpL" />
          <Text style={cStyles.cupLabel}>Left</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <CupSvg fillLevel={level2} uid="cmpR" />
          <Text style={cStyles.cupLabel}>Right</Text>
        </View>
      </View>
      <Text style={cStyles.question}>Which cup has more liquid?</Text>
      <View style={[cStyles.choiceGroup, { width: gridW }]}>
        {CHOICES.map(({ id, label, accentIdx }) => {
          const isChosen = chosen === id;
          const isCorr   = feedback && id === correct;
          const isWrng   = feedback && isChosen && id !== correct;
          const isDimmed = feedback && !isChosen && id !== correct;
          const state    = isCorr ? 'correct' : isWrng ? 'wrong' : isDimmed ? 'dimmed' : 'idle';
          return (
            <AnimatedMCButton key={id} label={label} accentIdx={accentIdx}
              onPress={() => handlePick(id)} disabled={!!feedback} state={state} />
          );
        })}
      </View>
      {feedback && <FeedbackBox ok={feedback === 'correct'}>{feedbackMsg()}</FeedbackBox>}
    </View>
  );
}

// ── MeasuringCupRenderer ──────────────────────────────────────
export default function MeasuringCupRenderer({ q, onResolve }) {
  const mode = (q.geometry?.mode ?? '').toLowerCase();
  if (mode === 'fill')    return <FillMode    q={q} onResolve={onResolve} />;
  if (mode === 'compare') return <CompareMode q={q} onResolve={onResolve} />;
  return                         <ReadMode    q={q} onResolve={onResolve} />;
}

// ── Styles ────────────────────────────────────────────────────
const cStyles = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingBottom: 8 },
  question: { fontSize: 15, fontWeight: '700', color: '#cbd5e1', textAlign: 'center', marginBottom: 12, marginTop: 6 },
  badge: {
    backgroundColor: '#1e293b', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155',
    paddingVertical: 8, paddingHorizontal: 16,
    marginBottom: 10, alignSelf: 'stretch',
  },
  badgeText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  cupLabel:  { marginTop: 4, fontSize: 13, fontWeight: '700', color: '#64748b' },
  mcGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'center', marginBottom: 4,
  },
  btnWrap: {
    width: '47%', borderRadius: 16,
    borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#1e293b', overflow: 'hidden',
  },
  btnInner:   { paddingVertical: 22, alignItems: 'center', justifyContent: 'center' },
  btnText:    { fontSize: 20, fontWeight: '800', color: '#e2e8f0' },
  btnCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  btnWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  feedbackBox: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    paddingVertical: 12, paddingHorizontal: 16,
    marginTop: 10, alignSelf: 'stretch',
  },
  feedbackWrong: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.25)',
  },
  feedbackText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
  choiceGroup:  { gap: 10, marginTop: 4 },
});
