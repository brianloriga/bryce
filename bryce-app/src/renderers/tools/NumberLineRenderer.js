import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity, Animated, PanResponder, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import { formatNLValue } from '../shared/measurementHelpers';
import { measStyles, NL_W, NL_PAD, NL_USABLE } from '../shared/measurementStyles';

const NL_POINT_COLORS = {
  green: '#4ade80', blue: '#60a5fa', purple: '#a78bfa',
  orange: '#fb923c', red: '#f87171', yellow: '#fbbf24',
};

// ── useNLGeo — parses common geometry fields ───────────────────
function useNLGeo(q) {
  const geo      = q.geometry ?? {};
  const min      = typeof geo.min  === 'number' ? geo.min  : 0;
  const max      = typeof geo.max  === 'number' ? geo.max  : 10;
  const rawStep  = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 1;
  const numSteps = Math.min(Math.round((max - min) / rawStep), 20);
  const step     = numSteps > 0 ? (max - min) / numSteps : 1;
  const range    = max - min;
  const ticks    = [];
  for (let i = 0; i <= numSteps; i++) {
    const v = Math.round((min + i * step) * 100000) / 100000;
    const x = NL_PAD + (i / numSteps) * NL_USABLE;
    ticks.push({ v, x, i });
  }
  const labelEvery = numSteps > 16 ? 4 : numSteps > 12 ? 2 : 1;
  return { geo, min, max, step, numSteps, range, ticks, labelEvery };
}

// ── useNumberLineDrag ──────────────────────────────────────────
function useNumberLineDrag({ min, max, step, setScrollEnabled }) {
  const range = max - min;
  function snapNL(raw) {
    const snapped = Math.round((raw - min) / step) * step + min;
    const clamped = Math.max(min, Math.min(max, snapped));
    return Math.round(clamped * 100000) / 100000;
  }
  const midVal = snapNL(min + range / 2);
  const midX   = NL_PAD + ((midVal - min) / range) * NL_USABLE;

  const [value,      setValue]      = useState(midVal);
  const [hasDragged, setHasDragged] = useState(false);
  const startXRef = useRef(midX);
  const lockedRef = useRef(false);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !lockedRef.current,
    onMoveShouldSetPanResponderCapture:  () => !lockedRef.current,
    onStartShouldSetPanResponder:        () => !lockedRef.current,
    onMoveShouldSetPanResponder:         () => !lockedRef.current,
    onPanResponderTerminationRequest:    () => false,
    onPanResponderGrant: (e) => {
      if (lockedRef.current) return;
      setScrollEnabled?.(false); setHasDragged(true);
      const x = Math.max(NL_PAD, Math.min(NL_W - NL_PAD, e.nativeEvent.locationX));
      startXRef.current = x;
      setValue(snapNL(min + ((x - NL_PAD) / NL_USABLE) * range));
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current) return;
      const nx = Math.max(NL_PAD, Math.min(NL_W - NL_PAD, startXRef.current + gs.dx));
      setValue(snapNL(min + ((nx - NL_PAD) / NL_USABLE) * range));
    },
    onPanResponderRelease:   () => setScrollEnabled?.(true),
    onPanResponderTerminate: () => setScrollEnabled?.(true),
  })).current;

  return { value, hasDragged, panResponder, lockedRef };
}

// ── SVG NumberLine constants ───────────────────────────────────
const NL_SVG_H   = 80;
const NL_LINE_Y  = 30;   // y of the horizontal line
const NL_TICK_Y2 = NL_LINE_Y + 14;
const NL_LABEL_Y = NL_TICK_Y2 + 13;
const NL_DOT_Y   = NL_LINE_Y - 12;   // centre of the dot circle
const NL_DOT_R   = 11;

// ── StaticNumberLine — SVG, no drag ───────────────────────────
function StaticNumberLine({ min, range, step, ticks, labelEvery, dotValue, dotColor, endLabelsOnly, showSectionNums }) {
  const dotX = dotValue !== undefined
    ? NL_PAD + ((dotValue - min) / range) * NL_USABLE
    : null;

  return (
    <Svg width={NL_W} height={NL_SVG_H} style={{ alignSelf: 'center', marginBottom: 4 }}>
      {/* Main line */}
      <Line x1={NL_PAD} y1={NL_LINE_Y} x2={NL_W - NL_PAD} y2={NL_LINE_Y}
        stroke="#475569" strokeWidth="2" strokeLinecap="round" />

      {/* End arrows */}
      <Line x1={NL_PAD - 10} y1={NL_LINE_Y} x2={NL_PAD} y2={NL_LINE_Y}
        stroke="#334155" strokeWidth="2" strokeLinecap="round" />
      <Line x1={NL_W - NL_PAD} y1={NL_LINE_Y} x2={NL_W - NL_PAD + 10} y2={NL_LINE_Y}
        stroke="#334155" strokeWidth="2" strokeLinecap="round" />

      {/* Tick marks */}
      {ticks.map(t => (
        <Line key={t.i}
          x1={t.x.toFixed(1)} y1={NL_LINE_Y}
          x2={t.x.toFixed(1)} y2={NL_TICK_Y2}
          stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"
        />
      ))}

      {/* Tick labels */}
      {ticks.map(t => {
        const isEndpoint = t.i === 0 || t.i === ticks.length - 1;
        const show = endLabelsOnly ? isEndpoint : t.i % labelEvery === 0;
        return show ? (
          <SvgText key={`l${t.i}`}
            x={t.x.toFixed(1)} y={NL_LABEL_Y}
            textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94a3b8"
          >
            {formatNLValue(t.v, step)}
          </SvgText>
        ) : null;
      })}

      {/* Section numbers (count mode) */}
      {showSectionNums && ticks.slice(0, -1).map((t, idx) => {
        const midX = (t.x + ticks[idx + 1].x) / 2;
        return (
          <SvgText key={`sn${idx}`}
            x={midX.toFixed(1)} y={NL_LINE_Y - 8}
            textAnchor="middle" fontSize="9" fontWeight="bold" fill="#94a3b8"
          >
            {idx + 1}
          </SvgText>
        );
      })}

      {/* Pre-placed dot */}
      {dotX !== null && (
        <Circle
          cx={dotX.toFixed(1)} cy={NL_DOT_Y}
          r={NL_DOT_R} fill={dotColor ?? '#7c3aed'}
          stroke="#a78bfa" strokeWidth="2.5"
        />
      )}
    </Svg>
  );
}

// ── NLMCMode — multiple-choice for read + count modes ─────────
function NLMCMode({ q, onResolve, styles, dotValue, sectionLabel, endLabelsOnly, showSectionNums }) {
  const { geo, min, range, step, ticks, labelEvery } = useNLGeo(q);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const options      = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const dotColor     = NL_POINT_COLORS[geo.pointColor] ?? '#7c3aed';

  function handlePick(idx) {
    if (feedback) return;
    setSelected(idx);
    const ok = idx === correctIndex;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), 1600);
  }

  return (
    <View style={{ alignItems: 'center' }}>
      {sectionLabel && <Text style={measStyles.rulerSectionLabel}>{sectionLabel}</Text>}
      <StaticNumberLine min={min} range={range} step={step} ticks={ticks} labelEvery={labelEvery}
        dotValue={dotValue} dotColor={dotColor} endLabelsOnly={endLabelsOnly} showSectionNums={showSectionNums} />
      <View style={{ width: NL_W, gap: 10, marginTop: 8 }}>
        {options.map((opt, idx) => {
          const isSelected = selected === idx;
          const isCorrect  = feedback && idx === correctIndex;
          const isWrong    = feedback && isSelected && idx !== correctIndex;
          return (
            <TouchableOpacity key={idx}
              style={[styles.fillInSubmit, { marginTop: 0,
                backgroundColor: isCorrect ? '#166534' : isWrong ? '#7f1d1d' : isSelected ? '#1d4ed8' : '#1e3a5f',
                borderWidth: 1, borderColor: isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#334155',
              }]}
              onPress={() => handlePick(idx)} disabled={!!feedback} activeOpacity={0.8}>
              <Text style={styles.fillInSubmitText}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {feedback && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center', marginTop: 10 }]}>
          {feedback === 'correct'
            ? <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
            : <Text style={styles.fillInRevealLabel}>Not quite — the answer is {options[correctIndex]}.</Text>
          }
        </View>
      )}
    </View>
  );
}

// ── NLPlaceMode — drag-to-target ───────────────────────────────
function NLPlaceMode({ q, onResolve, styles, setScrollEnabled }) {
  const { geo, min, max, step, range, ticks, labelEvery } = useNLGeo(q);
  const rawTarget = typeof geo.target === 'number'
    ? geo.target
    : parseFloat(String(q.correctAnswer ?? (min + range / 2)));
  const target = isNaN(rawTarget) ? (min + max) / 2 : Math.max(min, Math.min(max, rawTarget));

  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const { value, hasDragged, panResponder, lockedRef } = useNumberLineDrag({ min, max, step, setScrollEnabled });
  lockedRef.current = !!feedback;

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
    const ok = Math.abs(value - target) <= step / 2 + 0.0001;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else  { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2000);
  }

  const isCorrect  = feedback === 'correct';
  const isWrong    = feedback === 'wrong';
  const pointX     = NL_PAD + ((value - min) / range) * NL_USABLE;
  const pointColor = isCorrect ? '#4ade80' : isWrong ? '#f87171' : hasDragged ? '#a78bfa' : '#7c3aed';

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }], alignItems: 'center' }}>
      {/* SVG line + ticks; transparent touch overlay sits on top for drag */}
      <View style={{ width: NL_W, height: NL_SVG_H }}>
        <Svg width={NL_W} height={NL_SVG_H} pointerEvents="none">
          <Line x1={NL_PAD} y1={NL_LINE_Y} x2={NL_W - NL_PAD} y2={NL_LINE_Y}
            stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          {ticks.map(t => (
            <Line key={t.i}
              x1={t.x.toFixed(1)} y1={NL_LINE_Y}
              x2={t.x.toFixed(1)} y2={NL_TICK_Y2}
              stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"
            />
          ))}
          {ticks.map(t => t.i % labelEvery === 0 ? (
            <SvgText key={`l${t.i}`}
              x={t.x.toFixed(1)} y={NL_LABEL_Y}
              textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94a3b8"
            >
              {formatNLValue(t.v, step)}
            </SvgText>
          ) : null)}
          {/* Draggable dot */}
          <Circle
            cx={pointX.toFixed(1)} cy={NL_DOT_Y}
            r={NL_DOT_R} fill={pointColor}
            stroke="#a78bfa" strokeWidth="2.5"
          />
        </Svg>
        {/* Transparent touch layer for drag */}
        <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} {...panResponder.panHandlers} />
      </View>
      {!hasDragged && !feedback && (
        <Text style={[measStyles.sliderHint, { width: NL_W }]}>Drag the point to the correct position</Text>
      )}
      {hasDragged && !feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: NL_W }]}>Selected: {formatNLValue(value, step)}</Text>
      )}
      {feedback && (
        <Text style={[measStyles.rulerLiveReadout, { width: NL_W },
          isCorrect ? { color: '#4ade80' } : { color: '#f87171' }]}>
          {formatNLValue(value, step)}
        </Text>
      )}
      {isCorrect && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInCorrectMsg, { marginBottom: 4 }]}>Correct! 🎯</Text>
          <Text style={measStyles.rulerExplanation}>{formatNLValue(target, step)} is in the right spot on the number line.</Text>
        </View>
      )}
      {isWrong && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', alignItems: 'center' }]}>
          <Text style={[styles.fillInRevealLabel, { marginBottom: 4 }]}>Not quite — you placed at {formatNLValue(value, step)}.</Text>
          <Text style={[styles.fillInRevealAnswer, { marginTop: 4 }]}>Answer: {formatNLValue(target, step)}</Text>
        </View>
      )}
      {!feedback && (
        <TouchableOpacity style={[styles.fillInSubmit, { marginTop: 16, width: NL_W }]} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ── NumberLineRenderer ─────────────────────────────────────────
export default function NumberLineRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const mode = q.mode ?? q.geometry?.mode ?? 'place';
  if (mode === 'read') {
    const geo = q.geometry ?? {};
    const gMin = typeof geo.min === 'number' ? geo.min : 0;
    const gMax = typeof geo.max === 'number' ? geo.max : 1;
    const rawTarget = typeof geo.target === 'number'
      ? geo.target
      : parseFloat(String(q.correctAnswer ?? 0));
    const target = isNaN(rawTarget) ? (gMin + gMax) / 2 : Math.max(gMin, Math.min(gMax, rawTarget));
    return <NLMCMode q={q} onResolve={onResolve} styles={styles} dotValue={target} sectionLabel="Read the number line" endLabelsOnly />;
  }
  if (mode === 'count') {
    return <NLMCMode q={q} onResolve={onResolve} styles={styles} dotValue={undefined} sectionLabel="Count the equal parts" endLabelsOnly showSectionNums />;
  }
  return <NLPlaceMode q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}
