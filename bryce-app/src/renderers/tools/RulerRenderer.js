import React, { useState, useRef, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { formatMeasurement } from '../shared/measurementHelpers';

// ── Per-option accent colors ──────────────────────────────────
const OPTION_ACCENTS = [
  { border: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  { border: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  { border: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  { border: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
];

const COLOR_MAP = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  orange: '#f97316', purple: '#a855f7', yellow: '#eab308',
};

// ── Layout helpers (responsive) ───────────────────────────────
const RULER_H   = 44;
const BAR_H     = 16;
const BAR_TOP   = 6;
const RULER_TOP = BAR_TOP + BAR_H + 10;
const CANVAS_H  = RULER_TOP + RULER_H + 30;

function useRulerW() {
  const { width } = useWindowDimensions();
  return Math.min(width - 40, 360);
}

// ── Tick builder ──────────────────────────────────────────────
function buildTicks(rulerMax, isInch) {
  const subs      = isInch ? 4 : 2;
  const labelEvery = rulerMax > 20 ? 5 : rulerMax > 10 ? 2 : 1;
  const ticks = [];
  for (let i = 0; i <= rulerMax * subs; i++) {
    const unitVal = i / subs;
    const isWhole = i % subs === 0;
    const isHalf  = !isWhole && subs >= 4 && i % (subs / 2) === 0;
    const h       = isWhole ? 20 : isHalf ? 13 : 8;
    const showLbl = isWhole && unitVal % labelEvery === 0;
    ticks.push({ x: unitVal, h, isWhole, label: showLbl ? String(unitVal) : null });
  }
  return ticks;
}

// ── Counting step builder ─────────────────────────────────────
// Produces whole-number waypoints then the final value
// e.g. 3.5 → [1, 2, 3, 3.5]
function buildCountSteps(value) {
  const whole = Math.floor(value);
  const steps = [];
  for (let i = 1; i <= whole; i++) steps.push(i);
  if (value - whole > 0.01) steps.push(parseFloat(value.toFixed(3)));
  return steps.length ? steps : [value];
}

// ── RulerFace — SVG ───────────────────────────────────────────
const RULER_LABEL_H = 18;

function RulerFace({ ticks, unit, rulerW, rulerMax }) {
  const ppu  = rulerW / rulerMax;
  const svgH = RULER_H + RULER_LABEL_H + 2;

  return (
    <Svg width={rulerW} height={svgH} style={{ alignSelf: 'flex-start' }}>
      {/* Ruler body */}
      <Rect x="0" y="0" width={rulerW} height={RULER_H}
        fill="#1e293b" stroke="#334155" strokeWidth="1" rx="3" />
      {/* Left accent bar */}
      <Rect x="0" y="0" width="3" height={RULER_H} fill="#a78bfa" rx="1" />

      {/* Tick marks */}
      {ticks.map((t, i) => (
        <Line
          key={i}
          x1={(t.x * ppu).toFixed(2)} y1="0"
          x2={(t.x * ppu).toFixed(2)} y2={t.h}
          stroke={t.isWhole ? '#64748b' : '#475569'}
          strokeWidth={t.isWhole ? 1.5 : 1}
          strokeLinecap="square"
        />
      ))}

      {/* Numeric labels below ticks */}
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <SvgText
          key={i}
          x={(t.x * ppu).toFixed(2)} y={RULER_H + RULER_LABEL_H - 2}
          textAnchor="middle"
          fontSize="11"
          fontWeight={t.x === 0 ? 'bold' : 'normal'}
          fill={t.x === 0 ? '#a78bfa' : '#64748b'}
        >
          {t.label}
        </SvgText>
      ))}

      {/* Unit label at the far right */}
      <SvgText
        x={rulerW - 4} y={RULER_H + RULER_LABEL_H - 2}
        textAnchor="end" fontSize="10" fill="#475569"
      >
        {unit === 'inch' ? 'in' : 'cm'}
      </SvgText>
    </Svg>
  );
}

// ── BarAboveRuler ─────────────────────────────────────────────
function BarAboveRuler({ ticks, unit, rulerW, rulerMax, barStartX, barEndX, barColor, showStartDash = true, countingX = null, countingLabel = null }) {
  const numDash = Math.floor((RULER_TOP + RULER_H) / 6);
  function Dashes({ x, color }) {
    return Array.from({ length: numDash }).map((_, i) => (
      <View key={i} style={{
        position: 'absolute', left: x - 0.75,
        top: (BAR_TOP - 4) + i * 6, width: 1.5, height: 3,
        backgroundColor: color, opacity: 0.65,
      }} />
    ));
  }

  return (
    <View style={[rStyles.canvas, { height: CANVAS_H, width: rulerW }]}>
      {/* Bar */}
      <View style={{
        position: 'absolute', left: barStartX, top: BAR_TOP,
        width: barEndX - barStartX, height: BAR_H,
        backgroundColor: barColor, borderRadius: 3,
      }} />
      <View style={{ position: 'absolute', left: barStartX, top: BAR_TOP - 4, width: 2.5, height: BAR_H + 8, backgroundColor: barColor }} />
      <View style={{ position: 'absolute', left: barEndX - 2.5, top: BAR_TOP - 4, width: 2.5, height: BAR_H + 8, backgroundColor: barColor }} />
      {showStartDash && <Dashes x={barStartX} color="#64748b" />}
      <Dashes x={barEndX} color="#64748b" />

      {/* Counting sweep marker */}
      {countingX != null && (
        <View style={{ position: 'absolute', left: countingX - 1.5, top: BAR_TOP - 10, width: 3, height: CANVAS_H - BAR_TOP + 6, backgroundColor: '#fbbf24', borderRadius: 2, opacity: 0.9 }}>
          {countingLabel != null && (
            <View style={{ position: 'absolute', top: -22, left: -18, backgroundColor: '#fbbf24', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
              <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>{countingLabel}</Text>
            </View>
          )}
        </View>
      )}

      {/* Ruler */}
      <View style={{ position: 'absolute', top: RULER_TOP, left: 0 }}>
        <RulerFace ticks={ticks} unit={unit} rulerW={rulerW} rulerMax={rulerMax} />
      </View>
    </View>
  );
}

// ── MC option builders ────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildEndpointOptions(correct, snapStep) {
  const opts = new Set([correct]);
  const add = v => { const r = parseFloat(v.toFixed(3)); if (r > 0) opts.add(r); };
  add(correct + snapStep);
  add(correct - snapStep);
  add(correct + snapStep * 2);
  if (correct !== Math.ceil(correct))  add(Math.ceil(correct));
  if (correct !== Math.round(correct)) add(Math.round(correct));
  return shuffle([...opts]).slice(0, 4);
}

function buildOffsetOptions(length, startVal, endVal, snapStep) {
  const opts = new Set([length]);
  const add = v => { const r = parseFloat(v.toFixed(3)); if (r > 0) opts.add(r); };
  if (Math.abs(endVal - length) > 0.01)    add(endVal);
  if (startVal > 0 && Math.abs(startVal - length) > 0.01) add(startVal);
  add(length + snapStep);
  add(length - snapStep);
  return shuffle([...opts]).slice(0, 4);
}

function buildDiffOptions(diff, bar1len, bar2len, snapStep) {
  const opts = new Set([diff]);
  const add = v => { const r = parseFloat(v.toFixed(3)); if (r > 0) opts.add(r); };
  add(Math.max(bar1len, bar2len));
  add(diff + snapStep);
  add(diff + snapStep * 2);
  if (diff - snapStep > 0) add(diff - snapStep);
  return shuffle([...opts]).slice(0, 4);
}

// ── Mistake explanations ──────────────────────────────────────
function endpointHint(chosen, correct, unit) {
  const snap = unit === 'inch' ? 0.25 : 0.5;
  const fmt  = v => `${formatMeasurement(v, unit)}${unit === 'inch' ? ' in' : ' cm'}`;
  const countNote = `Count the spaces between marks — each space is one interval.`;
  if (Math.abs(chosen - (correct + snap)) < 0.01)
    return `You went one mark past where the bar ends. The bar ends at ${fmt(correct)}. ${countNote}`;
  if (Math.abs(chosen - (correct - snap)) < 0.01)
    return `You stopped one mark early. Keep counting to ${fmt(correct)}. ${countNote}`;
  if (chosen >= Math.ceil(correct) && correct !== Math.ceil(correct))
    return `The bar ends between whole marks. Look for the ${fmt(correct)} mark between ${fmt(Math.floor(correct))} and ${fmt(Math.ceil(correct))}.`;
  return `The bar ends at the ${fmt(correct)} mark. Start from 0 and count each interval carefully.`;
}

function offsetHint(chosen, correct, startVal, endVal, unit) {
  const fmt  = v => `${formatMeasurement(v, unit)}${unit === 'inch' ? ' in' : ' cm'}`;
  if (Math.abs(chosen - endVal) < 0.01)
    return `${fmt(endVal)} is where the bar ends on the ruler — not its length. Length = end − start = ${fmt(endVal)} − ${fmt(startVal)} = ${fmt(correct)}. Count the spaces FROM the start mark, not from 0.`;
  if (Math.abs(chosen - startVal) < 0.01)
    return `${fmt(startVal)} is where the bar begins. You need to count how many spaces the bar covers: end (${fmt(endVal)}) − start (${fmt(startVal)}) = ${fmt(correct)}.`;
  return `Count from the start mark (${fmt(startVal)}), not from 0. The bar covers ${fmt(correct)} of space.`;
}

function diffHint(chosen, correct, bar1len, bar2len, unit) {
  const fmt  = v => `${formatMeasurement(v, unit)}${unit === 'inch' ? ' in' : ' cm'}`;
  const lngr = Math.max(bar1len, bar2len);
  const shrt = Math.min(bar1len, bar2len);
  if (Math.abs(chosen - lngr) < 0.01)
    return `${fmt(lngr)} is the full length of the longer bar, not how much longer it is. Difference = longer (${fmt(lngr)}) − shorter (${fmt(shrt)}) = ${fmt(correct)}.`;
  return `Subtract shorter from longer: ${fmt(lngr)} − ${fmt(shrt)} = ${fmt(correct)}.`;
}

// ── AnimatedMCButton ──────────────────────────────────────────
function AnimatedMCButton({ label, accentIdx, onPress, disabled, state }) {
  const scale = useRef(new Animated.Value(1)).current;
  const accent = OPTION_ACCENTS[accentIdx % 4];

  function onPressIn() {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  }

  const stateStyle = state === 'correct' ? rStyles.btnCorrect
    : state === 'wrong'   ? rStyles.btnWrong
    : state === 'dimmed'  ? { opacity: 0.3 }
    : state === 'chosen'  ? { borderColor: accent.border, backgroundColor: accent.bg }
    : { borderColor: accent.border, backgroundColor: accent.bg };

  return (
    <Animated.View style={[rStyles.btnWrap, stateStyle, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={rStyles.btnInner}
        onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        disabled={disabled} activeOpacity={1}
      >
        <Text style={rStyles.btnText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── MCOptionRow ───────────────────────────────────────────────
function MCOptionRow({ options, chosen, feedback, correct, unit, onPick, rulerW }) {
  const suf = unit === 'inch' ? ' in' : unit === 'cm' ? ' cm' : '';
  return (
    <View style={[rStyles.mcGrid, { width: rulerW }]}>
      {options.map((opt, i) => {
        const label    = `${formatMeasurement(opt, unit)}${suf}`;
        const isChosen = chosen === opt;
        const isCorr   = feedback && Math.abs(opt - correct) < 0.01;
        const isWrng   = feedback && isChosen && !isCorr;
        const isDimmed = feedback && !isChosen && !isCorr;
        const state    = isCorr ? 'correct' : isWrng ? 'wrong' : isDimmed ? 'dimmed' : isChosen ? 'chosen' : 'idle';
        return (
          <AnimatedMCButton
            key={i} label={label} accentIdx={i}
            onPress={() => onPick(opt)} disabled={!!feedback}
            state={state}
          />
        );
      })}
    </View>
  );
}

// ── useCountingAnimation ──────────────────────────────────────
// Returns { countingStep, triggerCount }
// triggerCount(value, onDone) — runs counting from 1 to value then calls onDone
function useCountingAnimation() {
  const [countingStep, setCountingStep] = useState(null);
  const timerRef = useRef([]);

  function triggerCount(value, onDone) {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    const steps = buildCountSteps(value);
    steps.forEach((step, i) => {
      timerRef.current.push(setTimeout(() => setCountingStep(step), i * 270));
    });
    timerRef.current.push(setTimeout(() => {
      setCountingStep(null);
      onDone();
    }, steps.length * 270 + 100));
  }

  return { countingStep, triggerCount };
}

// ─────────────────────────────────────────────────────────────
// EndpointMode
// ─────────────────────────────────────────────────────────────
function EndpointMode({ q, onResolve }) {
  const rulerW   = useRulerW();
  const geo      = q.geometry ?? {};
  const unit     = geo.unit ?? (/(inch|in\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const isInch   = unit === 'inch';
  const snapStep = isInch ? 0.25 : 0.5;
  const correct  = Math.max(snapStep, isInch
    ? Math.min(parseFloat(q.correctAnswer ?? '3'), 12)
    : Math.min(parseFloat(q.correctAnswer ?? '7'), 30));
  const rulerMax = Math.max(Math.ceil(correct) + 1, 4);
  const ppu      = rulerW / rulerMax;
  const barColor = COLOR_MAP[geo.color ?? 'blue'] ?? '#3b82f6';
  const colorName = geo.color ?? 'blue';
  const ticks    = useMemo(() => buildTicks(rulerMax, isInch), [rulerMax, isInch]);
  const options  = useMemo(() => buildEndpointOptions(correct, snapStep), [correct, snapStep]);
  const { countingStep, triggerCount } = useCountingAnimation();

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback || countingStep != null) return;
    setChosen(opt);
    triggerCount(opt, () => {
      const ok = Math.abs(opt - correct) < 0.01;
      setFeedback(ok ? 'correct' : 'wrong');
      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => onResolve(ok), ok ? 900 : 2400);
    });
  }

  const suf = unit === 'inch' ? ' in' : ' cm';
  const countX = countingStep != null ? Math.round(countingStep * ppu) : null;
  const countLabel = countingStep != null ? `${formatMeasurement(countingStep, unit)}${suf}` : null;

  return (
    <View style={rStyles.wrap}>
      <BarAboveRuler
        ticks={ticks} unit={unit} rulerW={rulerW} rulerMax={rulerMax}
        barStartX={0} barEndX={correct * ppu}
        barColor={barColor} showStartDash={false}
        countingX={countX} countingLabel={countLabel}
      />
      <Text style={rStyles.question}>How long is the {colorName} bar?</Text>
      <MCOptionRow options={options} chosen={chosen} feedback={feedback} correct={correct} unit={unit} onPick={handlePick} rulerW={rulerW} />
      {feedback === 'correct' && (
        <FeedbackBox ok>
          Start from 0 and count: {buildCountSteps(correct).map(s => `${formatMeasurement(s, unit)}${suf}`).join(' → ')} ✓
        </FeedbackBox>
      )}
      {feedback === 'wrong' && chosen != null && (
        <FeedbackBox ok={false}>{endpointHint(chosen, correct, unit)}</FeedbackBox>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// OffsetMode
// ─────────────────────────────────────────────────────────────
function OffsetMode({ q, onResolve }) {
  const rulerW   = useRulerW();
  const geo      = q.geometry ?? {};
  const unit     = geo.unit ?? (/(inch|in\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const isInch   = unit === 'inch';
  const snapStep = isInch ? 0.25 : 0.5;
  const startVal = Math.max(0, parseFloat(String(geo.start ?? '0')));
  const length   = Math.max(snapStep, isInch
    ? Math.min(parseFloat(q.correctAnswer ?? '3'), 12)
    : Math.min(parseFloat(q.correctAnswer ?? '7'), 30));
  const endVal   = startVal + length;
  const rulerMax = Math.max(Math.ceil(endVal) + 1, 4);
  const ppu      = rulerW / rulerMax;
  const barColor = COLOR_MAP[geo.color ?? 'orange'] ?? '#f97316';
  const colorName = geo.color ?? 'orange';
  const ticks    = useMemo(() => buildTicks(rulerMax, isInch), [rulerMax, isInch]);
  const options  = useMemo(() => buildOffsetOptions(length, startVal, endVal, snapStep), [length, startVal, endVal, snapStep]);
  const { countingStep, triggerCount } = useCountingAnimation();

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback || countingStep != null) return;
    setChosen(opt);
    // Animate counting the length FROM startVal
    triggerCount(opt, () => {
      const ok = Math.abs(opt - length) < 0.01;
      setFeedback(ok ? 'correct' : 'wrong');
      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => onResolve(ok), ok ? 900 : 2400);
    });
  }

  const suf      = unit === 'inch' ? ' in' : ' cm';
  const fmtStart = `${formatMeasurement(startVal, unit)}${suf}`;
  const fmtEnd   = `${formatMeasurement(endVal, unit)}${suf}`;
  // Counting marker: moves FROM startVal by counting length steps
  const countX   = countingStep != null ? Math.round((startVal + countingStep) * ppu) : null;
  const countLabel = countingStep != null ? `+${formatMeasurement(countingStep, unit)}` : null;

  return (
    <View style={rStyles.wrap}>
      <BarAboveRuler
        ticks={ticks} unit={unit} rulerW={rulerW} rulerMax={rulerMax}
        barStartX={startVal * ppu} barEndX={endVal * ppu}
        barColor={barColor} showStartDash={true}
        countingX={countX} countingLabel={countLabel}
      />
      <View style={rStyles.badge}>
        <Text style={rStyles.badgeText}>
          The {colorName} bar starts at{' '}
          <Text style={{ color: barColor, fontWeight: '800' }}>{fmtStart}</Text>
        </Text>
      </View>
      <Text style={rStyles.question}>How long is the {colorName} bar?</Text>
      <MCOptionRow options={options} chosen={chosen} feedback={feedback} correct={length} unit={unit} onPick={handlePick} rulerW={rulerW} />
      {feedback === 'correct' && (
        <FeedbackBox ok>
          Count from the start mark: {buildCountSteps(length).map(s => `${formatMeasurement(s, unit)}${suf}`).join(' → ')}. End ({fmtEnd}) − Start ({fmtStart}) = {formatMeasurement(length, unit)}{suf} ✓
        </FeedbackBox>
      )}
      {feedback === 'wrong' && chosen != null && (
        <FeedbackBox ok={false}>{offsetHint(chosen, length, startVal, endVal, unit)}</FeedbackBox>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// CompareMode
// ─────────────────────────────────────────────────────────────
function CompareMode({ q, onResolve }) {
  const rulerW    = useRulerW();
  const geo       = q.geometry ?? {};
  const unit      = geo.unit ?? 'inch';
  const isInch    = unit === 'inch';
  const bar1len   = parseFloat(String(geo.length ?? '5'));
  const bar2len   = parseFloat(String(geo.bar2?.length ?? '3'));
  const bar1color = geo.color ?? 'red';
  const bar2color = geo.bar2?.color ?? 'blue';
  const rulerMax  = Math.max(Math.ceil(Math.max(bar1len, bar2len)) + 1, 4);
  const ppu       = rulerW / rulerMax;
  const c1        = COLOR_MAP[bar1color] ?? '#ef4444';
  const c2        = COLOR_MAP[bar2color] ?? '#3b82f6';
  const ticks     = useMemo(() => buildTicks(rulerMax, isInch), [rulerMax, isInch]);
  const correct   = String(q.correctAnswer ?? '').toLowerCase().trim();

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  const suf    = unit === 'inch' ? ' in' : ' cm';
  const B1_TOP = 4;
  const B2_TOP = B1_TOP + 14 + 6;
  const RUL_T  = B2_TOP + 14 + 8;
  const CVS_H  = RUL_T + RULER_H + 30;

  function handleChoice(id) {
    if (feedback) return;
    setChosen(id);
    const ok = id === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const CHOICES = [
    { id: bar1color, label: `${bar1color.charAt(0).toUpperCase() + bar1color.slice(1)} bar`, accentIdx: 0 },
    { id: bar2color, label: `${bar2color.charAt(0).toUpperCase() + bar2color.slice(1)} bar`, accentIdx: 1 },
    { id: 'same',    label: 'Same length', accentIdx: 2 },
  ];

  return (
    <View style={rStyles.wrap}>
      <View style={[rStyles.canvas, { height: CVS_H, width: rulerW }]}>
        <View style={{ position: 'absolute', left: 0, top: B1_TOP, height: 12, width: bar1len * ppu, backgroundColor: c1, borderRadius: 3 }} />
        <Text style={{ position: 'absolute', left: bar1len * ppu + 6, top: B1_TOP - 1, fontSize: 11, color: c1, fontWeight: '700' }}>{bar1color}</Text>
        <View style={{ position: 'absolute', left: 0, top: B2_TOP, height: 12, width: bar2len * ppu, backgroundColor: c2, borderRadius: 3 }} />
        <Text style={{ position: 'absolute', left: bar2len * ppu + 6, top: B2_TOP - 1, fontSize: 11, color: c2, fontWeight: '700' }}>{bar2color}</Text>
        <View style={{ position: 'absolute', top: RUL_T, left: 0 }}>
          <RulerFace ticks={ticks} unit={unit} rulerW={rulerW} rulerMax={rulerMax} />
        </View>
      </View>
      <Text style={rStyles.question}>Which bar is longer?</Text>
      <View style={[rStyles.choiceGroup, { width: rulerW }]}>
        {CHOICES.map(({ id, label, accentIdx }) => {
          const isChosen = chosen === id;
          const isCorr   = feedback && id === correct;
          const isWrng   = feedback && isChosen && id !== correct;
          const isDimmed = feedback && !isChosen && id !== correct;
          const state    = isCorr ? 'correct' : isWrng ? 'wrong' : isDimmed ? 'dimmed' : isChosen ? 'chosen' : 'idle';
          return (
            <AnimatedMCButton key={id} label={label} accentIdx={accentIdx}
              onPress={() => handleChoice(id)} disabled={!!feedback} state={state} />
          );
        })}
      </View>
      {feedback && (
        <FeedbackBox ok={feedback === 'correct'}>
          {correct === 'same'
            ? `Both bars reach the same mark — they are the same length.`
            : `The ${correct} bar reaches ${formatMeasurement(correct === bar1color ? bar1len : bar2len, unit)}${suf}, which is more than ${formatMeasurement(correct === bar1color ? bar2len : bar1len, unit)}${suf}.`}
        </FeedbackBox>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// DifferenceMode
// ─────────────────────────────────────────────────────────────
function DifferenceMode({ q, onResolve }) {
  const rulerW    = useRulerW();
  const geo       = q.geometry ?? {};
  const unit      = geo.unit ?? 'inch';
  const isInch    = unit === 'inch';
  const snapStep  = isInch ? 0.25 : 0.5;
  const bar1len   = parseFloat(String(geo.length ?? '5'));
  const bar2len   = parseFloat(String(geo.bar2?.length ?? '3'));
  const bar1color = geo.color ?? 'red';
  const bar2color = geo.bar2?.color ?? 'blue';
  const longer    = Math.max(bar1len, bar2len);
  const shorter   = Math.min(bar1len, bar2len);
  const longerColor = bar1len >= bar2len ? bar1color : bar2color;
  const diff      = parseFloat((longer - shorter).toFixed(3));
  const rulerMax  = Math.max(Math.ceil(longer) + 1, 4);
  const ppu       = rulerW / rulerMax;
  const c1        = COLOR_MAP[bar1color] ?? '#ef4444';
  const c2        = COLOR_MAP[bar2color] ?? '#3b82f6';
  const ticks     = useMemo(() => buildTicks(rulerMax, isInch), [rulerMax, isInch]);
  const options   = useMemo(() => buildDiffOptions(diff, bar1len, bar2len, snapStep), [diff, bar1len, bar2len, snapStep]);
  const { countingStep, triggerCount } = useCountingAnimation();

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback || countingStep != null) return;
    setChosen(opt);
    triggerCount(opt, () => {
      const ok = Math.abs(opt - diff) < 0.01;
      setFeedback(ok ? 'correct' : 'wrong');
      if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setTimeout(() => onResolve(ok), ok ? 900 : 2400);
    });
  }

  const B1_TOP = 4;
  const B2_TOP = B1_TOP + 14 + 6;
  const RUL_T  = B2_TOP + 14 + 8;
  const CVS_H  = RUL_T + RULER_H + 30;
  const suf    = unit === 'inch' ? ' in' : ' cm';
  // Counting marker starts at the shorter bar's end
  const countX = countingStep != null ? Math.round((shorter + countingStep) * ppu) : null;
  const countLabel = countingStep != null ? `+${formatMeasurement(countingStep, unit)}` : null;

  return (
    <View style={rStyles.wrap}>
      <View style={[rStyles.canvas, { height: CVS_H, width: rulerW }]}>
        <View style={{ position: 'absolute', left: 0, top: B1_TOP, height: 12, width: bar1len * ppu, backgroundColor: c1, borderRadius: 3 }} />
        <Text style={{ position: 'absolute', left: bar1len * ppu + 6, top: B1_TOP - 1, fontSize: 11, color: c1, fontWeight: '700' }}>{bar1color}</Text>
        <View style={{ position: 'absolute', left: 0, top: B2_TOP, height: 12, width: bar2len * ppu, backgroundColor: c2, borderRadius: 3 }} />
        <Text style={{ position: 'absolute', left: bar2len * ppu + 6, top: B2_TOP - 1, fontSize: 11, color: c2, fontWeight: '700' }}>{bar2color}</Text>
        {/* Yellow bracket over the gap */}
        <View style={{
          position: 'absolute', left: shorter * ppu, top: B1_TOP - 2,
          width: (longer - shorter) * ppu,
          height: B2_TOP + 14 - B1_TOP + 4,
          backgroundColor: 'rgba(250,204,21,0.1)',
          borderWidth: 1.5, borderColor: 'rgba(250,204,21,0.4)', borderRadius: 3,
        }} />
        {/* Counting sweep */}
        {countX != null && (
          <View style={{ position: 'absolute', left: countX - 1.5, top: B1_TOP - 10, width: 3, height: CVS_H - B1_TOP + 6, backgroundColor: '#fbbf24', borderRadius: 2, opacity: 0.9 }}>
            {countLabel && (
              <View style={{ position: 'absolute', top: -22, left: -18, backgroundColor: '#fbbf24', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
                <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>{countLabel}</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ position: 'absolute', top: RUL_T, left: 0 }}>
          <RulerFace ticks={ticks} unit={unit} rulerW={rulerW} rulerMax={rulerMax} />
        </View>
      </View>
      <Text style={rStyles.question}>How much longer is the {longerColor} bar?</Text>
      <MCOptionRow options={options} chosen={chosen} feedback={feedback} correct={diff} unit={unit} onPick={handlePick} rulerW={rulerW} />
      {feedback === 'correct' && (
        <FeedbackBox ok>
          {formatMeasurement(longer, unit)}{suf} − {formatMeasurement(shorter, unit)}{suf} = <Text style={{ color: '#4ade80', fontWeight: '800' }}>{formatMeasurement(diff, unit)}{suf}</Text> ✓
        </FeedbackBox>
      )}
      {feedback === 'wrong' && chosen != null && (
        <FeedbackBox ok={false}>{diffHint(chosen, diff, bar1len, bar2len, unit)}</FeedbackBox>
      )}
    </View>
  );
}

// ── Shared feedback banner ────────────────────────────────────
function FeedbackBox({ ok, children }) {
  return (
    <View style={[rStyles.feedbackBox, !ok && rStyles.feedbackWrong]}>
      <Text style={rStyles.feedbackText}>{children}</Text>
    </View>
  );
}

// ── inferRulerSubtype ─────────────────────────────────────────
const COLOR_SET = new Set(['red','blue','green','orange','purple','yellow']);
function inferRulerSubtype(q) {
  if (q.rulerSubtype) return q.rulerSubtype;
  const ans = String(q.correctAnswer ?? '').toLowerCase().trim();
  if (COLOR_SET.has(ans) || ans === 'same')       return 'compare';
  if ((q.geometry?.start ?? 0) > 0)               return 'offset';
  if (/how much longer|difference|longer than/i.test(q.question ?? '')) return 'difference';
  if (q.geometry?.bar2)                            return 'compare';
  return 'endpoint';
}

// ── RulerRenderer ─────────────────────────────────────────────
export default function RulerRenderer({ q, onResolve }) {
  const subtype = inferRulerSubtype(q);
  if (subtype === 'offset')     return <OffsetMode     q={q} onResolve={onResolve} />;
  if (subtype === 'compare')    return <CompareMode    q={q} onResolve={onResolve} />;
  if (subtype === 'difference') return <DifferenceMode q={q} onResolve={onResolve} />;
  return                               <EndpointMode   q={q} onResolve={onResolve} />;
}

// ── Styles ────────────────────────────────────────────────────
const rStyles = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingBottom: 8 },
  canvas:   { alignSelf: 'center', position: 'relative', marginVertical: 10 },
  rulerBody: {
    height: RULER_H, backgroundColor: '#1e293b',
    borderRadius: 6, borderWidth: 1, borderColor: '#334155',
    position: 'relative', overflow: 'hidden',
  },
  tickLabel: {
    position: 'absolute', top: RULER_H + 4,
    width: 24, textAlign: 'center', fontSize: 10, fontWeight: '700',
  },
  unitLabel: {
    position: 'absolute', top: RULER_H + 18,
    textAlign: 'center', fontSize: 10, color: '#475569', fontWeight: '600', letterSpacing: 0.4,
  },
  question: {
    fontSize: 15, fontWeight: '700', color: '#cbd5e1',
    textAlign: 'center', marginBottom: 12, marginTop: 4,
  },
  badge: {
    backgroundColor: '#1e293b', borderRadius: 10,
    borderWidth: 1, borderColor: '#334155',
    paddingVertical: 8, paddingHorizontal: 16,
    marginBottom: 10, alignSelf: 'stretch',
  },
  badgeText: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
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
  btnText:    { fontSize: 22, fontWeight: '800', color: '#e2e8f0' },
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
