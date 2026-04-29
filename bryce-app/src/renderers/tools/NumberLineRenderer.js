// NumberLineRenderer.js — redesigned v2
// 5 priority modes: read, place, missing, partition, distance
// Core principle: no live value readout during placement. Think first → submit → feedback.
import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, Animated, PanResponder,
  StyleSheet, useWindowDimensions,
} from 'react-native';
import Svg, {
  Line, Circle, Rect, Path, G, Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { formatNLValue } from '../shared/measurementHelpers';

// ── Layout constants ──────────────────────────────────────────
const NL_PAD     = 26;   // horizontal padding inside SVG
const NL_LINE_Y  = 40;   // y of the horizontal line
const NL_SVG_H   = 92;   // total SVG height
const DOT_Y      = NL_LINE_Y - 16; // dot centre y
const DOT_R      = 13;             // dot radius
const DOT_STROKE = 2.5;
const TICK_MAJOR = 22;   // major tick height
const TICK_MINOR = 12;   // minor tick height
const LABEL_Y    = NL_LINE_Y + TICK_MAJOR + 14;

// ── Color palette ─────────────────────────────────────────────
const POINT_COLORS = {
  purple: '#a78bfa', blue: '#60a5fa', green: '#4ade80',
  orange: '#fb923c', red: '#f87171', yellow: '#fbbf24',
};
const NEG_TINT  = 'rgba(248,113,113,0.14)';
const POS_TINT  = 'rgba(96,165,250,0.08)';

// ── useNLWidth — responsive canvas width ─────────────────────
function useNLWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width - 40, 360);
}

// ── buildTicks ───────────────────────────────────────────────
// Returns ticks array and helper values.
function buildTicks(min, max, step, W) {
  const usable   = W - NL_PAD * 2;
  const numSteps = Math.max(1, Math.min(Math.round((max - min) / step), 20));
  const realStep = (max - min) / numSteps;
  const ticks    = [];
  for (let i = 0; i <= numSteps; i++) {
    const v = Math.round((min + i * realStep) * 1e5) / 1e5;
    const x = NL_PAD + (i / numSteps) * usable;
    ticks.push({ v, x, i });
  }
  // Label every tick unless there are many
  const labelEvery = numSteps > 16 ? 4 : numSteps > 12 ? 2 : 1;
  return { ticks, numSteps, realStep, usable, labelEvery };
}

// ── snapToNearest — find closest tick to pixel X ─────────────
function snapToNearest(rawX, ticks) {
  let best = ticks[0], bestDist = Infinity;
  for (const t of ticks) {
    const d = Math.abs(rawX - t.x);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

// ── NLSvgContent — all SVG drawing elements ──────────────────
// Used by both the static NLCanvas and the interactive PlaceMode.
// Must return only react-native-svg elements (no Views).
function NLSvgContent({
  W, usable, min, max, step, ticks, labelEvery,
  // optional features
  showNegZone   = false,   // tint left of zero red
  endLabelsOnly = false,   // only show 0 and max labels
  prePlacedDots = [],      // [{value, color}]
  labeledPoints = [],      // [{value, label, color}] — distance mode
  missingValue  = null,    // show "?" at this tick value
  selectedTick  = null,    // student's current snap position (place mode)
  feedbackColor = null,    // null | 'correct' | 'wrong'
  targetTick    = null,    // correct tick revealed after wrong answer
  showBracket   = false,   // draw a span bracket between labeledPoints (distance)
}) {
  const range = max - min;
  const lineX1 = NL_PAD - 8;
  const lineX2 = W - NL_PAD + 8;

  // Zero position (for color zones)
  const zeroX = range > 0 ? NL_PAD + ((-min) / range) * usable : NL_PAD;

  return (
    <>
      {/* Negative tint zone (left of zero) */}
      {showNegZone && min < 0 && (
        <Rect
          x={NL_PAD} y={NL_LINE_Y - 6}
          width={Math.max(0, Math.min(zeroX - NL_PAD, usable))}
          height={12} fill={NEG_TINT} rx="2"
        />
      )}
      {/* Positive tint zone (right of zero if negatives present) */}
      {showNegZone && min < 0 && max > 0 && (
        <Rect
          x={zeroX} y={NL_LINE_Y - 6}
          width={Math.max(0, (W - NL_PAD) - zeroX)}
          height={12} fill={POS_TINT} rx="2"
        />
      )}

      {/* Main line */}
      <Line x1={lineX1} y1={NL_LINE_Y} x2={lineX2} y2={NL_LINE_Y}
        stroke="#475569" strokeWidth="3" strokeLinecap="round" />

      {/* Arrowheads */}
      <Path
        d={`M ${lineX1} ${NL_LINE_Y} L ${lineX1 + 9} ${NL_LINE_Y - 5} L ${lineX1 + 9} ${NL_LINE_Y + 5} Z`}
        fill="#475569"
      />
      <Path
        d={`M ${lineX2} ${NL_LINE_Y} L ${lineX2 - 9} ${NL_LINE_Y - 5} L ${lineX2 - 9} ${NL_LINE_Y + 5} Z`}
        fill="#475569"
      />

      {/* Tick marks */}
      {ticks.map(t => {
        const isMajor = t.i % labelEvery === 0;
        const h       = isMajor ? TICK_MAJOR : TICK_MINOR;
        return (
          <Line key={`tk${t.i}`}
            x1={t.x.toFixed(1)} y1={NL_LINE_Y}
            x2={t.x.toFixed(1)} y2={(NL_LINE_Y + h).toFixed(1)}
            stroke={isMajor ? '#64748b' : '#3d4f6b'}
            strokeWidth={isMajor ? '2' : '1.5'}
            strokeLinecap="round"
          />
        );
      })}

      {/* Tick labels */}
      {ticks.map(t => {
        const isEnd = t.i === 0 || t.i === ticks.length - 1;
        const show  = endLabelsOnly ? isEnd : t.i % labelEvery === 0;
        if (!show) return null;
        const isMissing = missingValue !== null && Math.abs(t.v - missingValue) < 0.0001;
        if (isMissing) return null; // rendered as "?" badge below
        const negColor = t.v < 0 ? '#fca5a5' : '#94a3b8';
        return (
          <SvgText key={`lb${t.i}`}
            x={t.x.toFixed(1)} y={LABEL_Y}
            textAnchor="middle" fontSize="12" fontWeight="bold" fill={negColor}
          >
            {formatNLValue(t.v, step)}
          </SvgText>
        );
      })}

      {/* "?" badge for missing mode */}
      {missingValue !== null && (() => {
        const qt = ticks.find(t => Math.abs(t.v - missingValue) < 0.0001);
        if (!qt) return null;
        return (
          <G key="qmark">
            <Circle cx={qt.x.toFixed(1)} cy={LABEL_Y - 8} r="12"
              fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />
            <SvgText x={qt.x.toFixed(1)} y={LABEL_Y - 3}
              textAnchor="middle" fontSize="13" fontWeight="bold" fill="#60a5fa">
              ?
            </SvgText>
          </G>
        );
      })()}

      {/* Distance bracket (between two labeled points) */}
      {showBracket && labeledPoints.length === 2 && (() => {
        const p1 = labeledPoints[0], p2 = labeledPoints[1];
        const x1 = (NL_PAD + ((p1.value - min) / range) * usable).toFixed(1);
        const x2 = (NL_PAD + ((p2.value - min) / range) * usable).toFixed(1);
        const bracketY = DOT_Y - 22;
        return (
          <G key="bracket">
            <Line x1={x1} y1={bracketY} x2={x2} y2={bracketY}
              stroke="#7c3aed" strokeWidth="2" strokeDasharray="4 3" />
            <Line x1={x1} y1={bracketY - 4} x2={x1} y2={bracketY + 4}
              stroke="#7c3aed" strokeWidth="2" />
            <Line x1={x2} y1={bracketY - 4} x2={x2} y2={bracketY + 4}
              stroke="#7c3aed" strokeWidth="2" />
          </G>
        );
      })()}

      {/* Pre-placed dots (read mode) */}
      {prePlacedDots.map((dot, idx) => {
        const px = (NL_PAD + ((dot.value - min) / range) * usable).toFixed(1);
        const fc = POINT_COLORS[dot.color] ?? '#a78bfa';
        return (
          <G key={`pd${idx}`}>
            <Circle cx={px} cy={DOT_Y} r={DOT_R}
              fill={fc} stroke={fc} strokeWidth={DOT_STROKE} opacity="0.95" />
          </G>
        );
      })}

      {/* Labeled points (distance mode) */}
      {labeledPoints.map((pt, idx) => {
        const px = (NL_PAD + ((pt.value - min) / range) * usable).toFixed(1);
        const fc = POINT_COLORS[pt.color] ?? '#a78bfa';
        return (
          <G key={`lp${idx}`}>
            <Circle cx={px} cy={DOT_Y} r={DOT_R}
              fill={fc} stroke={fc} strokeWidth={DOT_STROKE} />
            <SvgText x={px} y={DOT_Y + 5}
              textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0f172a">
              {pt.label}
            </SvgText>
          </G>
        );
      })}

      {/* Student placement dot (place mode) */}
      {selectedTick && (
        <G key="student">
          <Circle
            cx={selectedTick.x.toFixed(1)} cy={DOT_Y} r={DOT_R}
            fill={
              feedbackColor === 'correct' ? '#4ade80' :
              feedbackColor === 'wrong'   ? '#f87171' : '#7c3aed'
            }
            stroke={
              feedbackColor === 'correct' ? '#16a34a' :
              feedbackColor === 'wrong'   ? '#dc2626' : '#a78bfa'
            }
            strokeWidth={DOT_STROKE}
          />
        </G>
      )}

      {/* Correct target ghost revealed after wrong answer */}
      {feedbackColor === 'wrong' && targetTick && (
        <G key="target-ghost">
          <Circle
            cx={targetTick.x.toFixed(1)} cy={DOT_Y} r={DOT_R}
            fill="rgba(74,222,128,0.25)"
            stroke="#4ade80" strokeWidth={DOT_STROKE}
            strokeDasharray="4 2"
          />
          <SvgText x={targetTick.x.toFixed(1)} y={DOT_Y - DOT_R - 5}
            textAnchor="middle" fontSize="10" fontWeight="bold" fill="#4ade80">
            {formatNLValue(targetTick.v, step)}
          </SvgText>
        </G>
      )}
    </>
  );
}

// ── NLCanvas — static wrapper for non-interactive modes ───────
function NLCanvas({ W, svgProps, children }) {
  return (
    <Svg width={W} height={NL_SVG_H} style={{ alignSelf: 'center' }} {...svgProps}>
      {children}
    </Svg>
  );
}

// ── MCOptions — shared multiple-choice answer buttons ─────────
function MCOptions({ options, correctIndex, onResolve, styles }) {
  const [selected,  setSelected]  = useState(null);
  const [feedback,  setFeedback]  = useState(null);

  function pick(idx) {
    if (feedback) return;
    setSelected(idx);
    const ok = idx === correctIndex;
    setFeedback(ok ? 'correct' : 'wrong');
    Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
    setTimeout(() => onResolve(ok), 1600);
  }

  return (
    <View style={{ width: '100%', gap: 9, marginTop: 14 }}>
      {options.map((opt, idx) => {
        const isSelected = selected === idx;
        const isCorrect  = !!feedback && idx === correctIndex;
        const isWrong    = !!feedback && isSelected && idx !== correctIndex;
        return (
          <TouchableOpacity
            key={idx}
            style={[
              nlLocal.mcBtn,
              isCorrect ? nlLocal.mcBtnCorrect :
              isWrong   ? nlLocal.mcBtnWrong   :
              isSelected ? nlLocal.mcBtnSelected : null,
            ]}
            onPress={() => pick(idx)} disabled={!!feedback} activeOpacity={0.8}
          >
            <Text style={nlLocal.mcBtnText}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
      {feedback && (
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          {feedback === 'correct'
            ? <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
            : <Text style={styles.fillInRevealLabel}>
                Not quite — the answer is <Text style={{ fontWeight: '800' }}>{options[correctIndex]}</Text>.
              </Text>
          }
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 1 — ReadMode (Point Identification)
// Pre-placed colored dot; student picks value from 4 MC options.
// ═══════════════════════════════════════════════════════════════
function ReadMode({ q, onResolve, styles }) {
  const W   = useNLWidth();
  const geo = q.geometry ?? {};
  const min = typeof geo.min  === 'number' ? geo.min  : 0;
  const max = typeof geo.max  === 'number' ? geo.max  : 10;
  const step = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 1;
  const target     = typeof geo.target === 'number' ? geo.target : (min + max) / 2;
  const pointColor = geo.pointColor ?? 'purple';
  const options      = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const { ticks, usable, labelEvery } = buildTicks(min, max, step, W);

  return (
    <View style={{ alignItems: 'center' }}>
      <NLCanvas W={W}>
        <NLSvgContent
          W={W} usable={usable} min={min} max={max} step={step}
          ticks={ticks} labelEvery={labelEvery}
          showNegZone={min < 0}
          prePlacedDots={[{ value: target, color: pointColor }]}
        />
      </NLCanvas>
      <MCOptions options={options} correctIndex={correctIndex}
        onResolve={onResolve} styles={styles} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 2 — PlaceMode
// Student snaps a point to the nearest tick.
// NO live readout while dragging — submit button required.
// ═══════════════════════════════════════════════════════════════
function PlaceMode({ q, onResolve, styles, setScrollEnabled }) {
  const W   = useNLWidth();
  const geo = q.geometry ?? {};
  const min = typeof geo.min  === 'number' ? geo.min  : 0;
  const max = typeof geo.max  === 'number' ? geo.max  : 10;
  const step = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 1;
  const rawTarget = typeof geo.target === 'number'
    ? geo.target
    : parseFloat(String(q.correctAnswer ?? ((min + max) / 2)));
  const target = isNaN(rawTarget) ? (min + max) / 2 : Math.max(min, Math.min(max, rawTarget));
  const { ticks, usable, realStep, labelEvery } = buildTicks(min, max, step, W);
  const targetTick = snapToNearest(NL_PAD + ((target - min) / (max - min)) * usable, ticks);

  const [selectedTick, setSelectedTick] = useState(null);
  const [feedback,     setFeedback]     = useState(null);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const startXRef  = useRef(null);
  const lockedRef  = useRef(false);
  const lastSnapI  = useRef(-1);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => !lockedRef.current,
    onMoveShouldSetPanResponderCapture:  () => !lockedRef.current,
    onStartShouldSetPanResponder:        () => !lockedRef.current,
    onMoveShouldSetPanResponder:         () => !lockedRef.current,
    onPanResponderTerminationRequest:    () => false,
    onPanResponderGrant: (e) => {
      if (lockedRef.current) return;
      setScrollEnabled?.(false);
      startXRef.current = e.nativeEvent.locationX;
      const snapped = snapToNearest(e.nativeEvent.locationX, ticks);
      if (snapped.i !== lastSnapI.current) {
        lastSnapI.current = snapped.i;
        Haptics.selectionAsync();
        setSelectedTick(snapped);
      }
    },
    onPanResponderMove: (_, gs) => {
      if (lockedRef.current) return;
      const rawX    = (startXRef.current ?? NL_PAD) + gs.dx;
      const snapped = snapToNearest(rawX, ticks);
      if (snapped.i !== lastSnapI.current) {
        lastSnapI.current = snapped.i;
        Haptics.selectionAsync();
        setSelectedTick(snapped);
      }
    },
    onPanResponderRelease:   () => setScrollEnabled?.(true),
    onPanResponderTerminate: () => setScrollEnabled?.(true),
  })).current;

  lockedRef.current = !!feedback;

  function handleSubmit() {
    if (!selectedTick || feedback) return;
    const ok = selectedTick.i === targetTick.i;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else   { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(ok), 2200);
  }

  // Show value badge only after submit
  const revealedValue = feedback ? formatNLValue(selectedTick?.v ?? target, step) : null;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Target value instruction badge */}
      <View style={nlLocal.targetBadge}>
        <Text style={nlLocal.targetLabel}>Place the point at</Text>
        <Text style={nlLocal.targetValue}>{formatNLValue(target, step)}</Text>
      </View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }], width: W }}>
        <View style={{ width: W, height: NL_SVG_H }}>
          {/* SVG — no pointer events so overlay captures touches */}
          <Svg width={W} height={NL_SVG_H} pointerEvents="none"
            style={{ position: 'absolute', top: 0, left: 0 }}>
            <NLSvgContent
              W={W} usable={usable} min={min} max={max} step={step}
              ticks={ticks} labelEvery={labelEvery}
              showNegZone={min < 0}
              selectedTick={selectedTick}
              feedbackColor={feedback}
              targetTick={feedback === 'wrong' ? targetTick : null}
            />
          </Svg>
          {/* Transparent touch overlay */}
          <View
            style={{ position: 'absolute', top: 0, left: 0, width: W, height: NL_SVG_H, zIndex: 2 }}
            {...panResponder.panHandlers}
          />
        </View>
      </Animated.View>

      {!selectedTick && !feedback && (
        <Text style={nlLocal.placeHint}>Tap or drag to place the point, then tap Check</Text>
      )}

      {selectedTick && !feedback && (
        <Text style={nlLocal.placeHint}>Tap Check when you're ready</Text>
      )}

      {feedback === 'correct' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInCorrectMsg}>Correct! 🎯</Text>
          <Text style={nlLocal.feedbackSub}>
            {formatNLValue(target, step)} is the right position.
          </Text>
        </View>
      )}
      {feedback === 'wrong' && (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={styles.fillInRevealLabel}>
            Not quite — you placed at {revealedValue}.
          </Text>
          <Text style={styles.fillInRevealAnswer}>
            Answer: {formatNLValue(target, step)}
          </Text>
        </View>
      )}

      {!feedback && (
        <TouchableOpacity
          style={[nlLocal.checkBtn, !selectedTick && nlLocal.checkBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selectedTick}
          activeOpacity={0.8}
        >
          <Text style={nlLocal.checkBtnText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 3 — MissingMode
// Shows a sequence with one value hidden as "?". Student picks
// the missing number from MC options.
// ═══════════════════════════════════════════════════════════════
function MissingMode({ q, onResolve, styles }) {
  const W   = useNLWidth();
  const geo = q.geometry ?? {};
  const min = typeof geo.min  === 'number' ? geo.min  : 0;
  const max = typeof geo.max  === 'number' ? geo.max  : 20;
  const step = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 5;
  const missingValue = typeof geo.missingValue === 'number' ? geo.missingValue : null;
  const options      = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const { ticks, usable, labelEvery } = buildTicks(min, max, step, W);

  return (
    <View style={{ alignItems: 'center' }}>
      <NLCanvas W={W}>
        <NLSvgContent
          W={W} usable={usable} min={min} max={max} step={step}
          ticks={ticks} labelEvery={1}
          showNegZone={min < 0}
          missingValue={missingValue}
        />
      </NLCanvas>
      <MCOptions options={options} correctIndex={correctIndex}
        onResolve={onResolve} styles={styles} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 4 — PartitionMode  (was "count")
// Unlabeled interior ticks. Student counts equal parts from MC.
// CRITICAL for fraction understanding.
// ═══════════════════════════════════════════════════════════════
function PartitionMode({ q, onResolve, styles }) {
  const W   = useNLWidth();
  const geo = q.geometry ?? {};
  const min  = typeof geo.min  === 'number' ? geo.min  : 0;
  const max  = typeof geo.max  === 'number' ? geo.max  : 1;
  const step = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 0.25;
  const options      = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const { ticks, usable } = buildTicks(min, max, step, W);

  // Label every section with a small number above the midpoint (section counting aid)
  const numSections = ticks.length - 1;
  const range       = max - min;

  return (
    <View style={{ alignItems: 'center' }}>
      <NLCanvas W={W}>
        {/* Standard line/ticks but only 0 and max labeled */}
        <NLSvgContent
          W={W} usable={usable} min={min} max={max} step={step}
          ticks={ticks} labelEvery={1}
          endLabelsOnly={true}
        />
        {/* Section count numbers above the line */}
        {ticks.slice(0, -1).map((t, idx) => {
          const midX = ((t.x + ticks[idx + 1].x) / 2).toFixed(1);
          return (
            <SvgText key={`sn${idx}`}
              x={midX} y={NL_LINE_Y - 6}
              textAnchor="middle" fontSize="9" fontWeight="bold" fill="#475569">
              {idx + 1}
            </SvgText>
          );
        })}
      </NLCanvas>
      <Text style={nlLocal.partitionHint}>
        {numSections} tick mark{numSections !== 1 ? 's' : ''} — count the spaces
      </Text>
      <MCOptions options={options} correctIndex={correctIndex}
        onResolve={onResolve} styles={styles} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE 5 — DistanceMode
// Two labeled colored points on the line. Student picks the
// distance between them from MC options.
// ═══════════════════════════════════════════════════════════════
function DistanceMode({ q, onResolve, styles }) {
  const W   = useNLWidth();
  const geo = q.geometry ?? {};
  const min  = typeof geo.min  === 'number' ? geo.min  : 0;
  const max  = typeof geo.max  === 'number' ? geo.max  : 10;
  const step = typeof geo.step === 'number' && geo.step > 0 ? geo.step : 1;
  const points       = Array.isArray(geo.points) ? geo.points : [];
  const options      = Array.isArray(q.options) ? q.options : [];
  const correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  const { ticks, usable, labelEvery } = buildTicks(min, max, step, W);

  return (
    <View style={{ alignItems: 'center' }}>
      <NLCanvas W={W}>
        <NLSvgContent
          W={W} usable={usable} min={min} max={max} step={step}
          ticks={ticks} labelEvery={labelEvery}
          showNegZone={min < 0}
          labeledPoints={points}
          showBracket={points.length === 2}
        />
      </NLCanvas>
      <MCOptions options={options} correctIndex={correctIndex}
        onResolve={onResolve} styles={styles} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// NumberLineRenderer — dispatcher
// ═══════════════════════════════════════════════════════════════
export default function NumberLineRenderer({ q, onResolve, styles, setScrollEnabled }) {
  const mode = (q.mode ?? q.geometry?.mode ?? 'place').toLowerCase();

  if (mode === 'read')                      return <ReadMode      q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'missing')                   return <MissingMode   q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'partition' || mode === 'count') return <PartitionMode q={q} onResolve={onResolve} styles={styles} />;
  if (mode === 'distance')                  return <DistanceMode  q={q} onResolve={onResolve} styles={styles} />;
  // default: place
  return <PlaceMode q={q} onResolve={onResolve} styles={styles} setScrollEnabled={setScrollEnabled} />;
}

// ── Local styles ──────────────────────────────────────────────
const nlLocal = StyleSheet.create({
  // Place mode: target badge
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14,
  },
  targetLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  targetValue: { fontSize: 22, fontWeight: '900', color: '#a78bfa' },

  // Place mode: hints
  placeHint: {
    fontSize: 12, color: '#475569', textAlign: 'center',
    marginTop: 8, fontStyle: 'italic',
  },
  feedbackSub: {
    fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center',
  },

  // Place mode: check button
  checkBtn: {
    marginTop: 18, backgroundColor: '#16a34a', borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 32, alignItems: 'center',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
  },
  checkBtnDisabled: {
    backgroundColor: '#1e3a2f', shadowOpacity: 0,
    borderWidth: 1, borderColor: '#334155',
  },
  checkBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Partition mode hint
  partitionHint: {
    fontSize: 11, color: '#475569', textAlign: 'center',
    marginTop: 2, marginBottom: 2, fontStyle: 'italic',
  },

  // MC buttons
  mcBtn: {
    paddingVertical: 14, paddingHorizontal: 18,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#334155',
    backgroundColor: '#1e3a5f', alignItems: 'center',
  },
  mcBtnSelected: { backgroundColor: '#1d4ed8', borderColor: '#60a5fa' },
  mcBtnCorrect:  { backgroundColor: '#166534', borderColor: '#4ade80' },
  mcBtnWrong:    { backgroundColor: '#7f1d1d', borderColor: '#f87171' },
  mcBtnText:     { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
});
