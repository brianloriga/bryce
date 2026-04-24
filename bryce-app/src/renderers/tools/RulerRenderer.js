import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity, Animated, PanResponder, StyleSheet } from 'react-native';
import { SegmentStimulus, TwoBarStimulus, formatMeasurement } from '../shared/measurementHelpers';
import { measStyles, RULER_DISPLAY_W } from '../shared/measurementStyles';

// ── Shared drag hook ───────────────────────────────────────────
export function useRulerDrag({ maxVal, snapStep, setScrollEnabled }) {
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
      setScrollEnabled?.(false); setHasDragged(true);
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

// ── InteractiveRuler ───────────────────────────────────────────
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

// ── EndpointRulerVariant ───────────────────────────────────────
function EndpointRulerVariant({ q, onResolve, styles, setScrollEnabled }) {
  const rulerUnit  = q.geometry?.unit ?? (/(inch|inches|\bin\b)/i.test(q.question ?? '') ? 'inch' : 'cm');
  const unitLabel  = rulerUnit === 'inch' ? 'in' : rulerUnit;
  const isInch     = rulerUnit === 'inch';
  const snapStep   = isInch ? 0.25 : 0.5;
  const rawCorrect = parseFloat(q.correctAnswer ?? '0');
  const correct    = isNaN(rawCorrect)
    ? (isInch ? 3 : 7)
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
        <Text style={[measStyles.sliderHint, { width: RULER_DISPLAY_W }]}>Drag the marker to where the bar ends</Text>
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
          <Text style={measStyles.rulerExplanation}>Start at 0 and look at where the {barColor} bar ends.</Text>
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

// ── OffsetRulerVariant ─────────────────────────────────────────
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

// ── CompareRulerVariant ────────────────────────────────────────
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
              onPress={() => handleChoice(id)} disabled={!!feedback}>
              <Text style={styles.fillInSubmitText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {feedback && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center', marginTop: 10 }]}>
          {feedback === 'correct'
            ? <Text style={styles.fillInCorrectMsg}>Correct! 📏</Text>
            : <Text style={styles.fillInRevealLabel}>
                Not quite — the {correctAnswer === 'same' ? 'bars are the same length' : `${correctAnswer} bar is longer`}.
              </Text>
          }
        </View>
      )}
    </View>
  );
}

// ── DifferenceRulerVariant ─────────────────────────────────────
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

// ── inferRulerSubtype ──────────────────────────────────────────
// Reconstructs the correct variant when rulerSubtype is missing from
// stored data (old server sanitizer didn't know about the field).
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

// ── RulerRenderer ──────────────────────────────────────────────
export default function RulerRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const subtype = inferRulerSubtype(q);
  if (subtype === 'offset')     return <OffsetRulerVariant     q={q} onResolve={onResolve} styles={styles} />;
  if (subtype === 'compare')    return <CompareRulerVariant    q={q} onResolve={onResolve} styles={styles} />;
  if (subtype === 'difference') return <DifferenceRulerVariant q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
  return <EndpointRulerVariant q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}
