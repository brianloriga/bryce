import React, { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';
import Svg, { Line, Path, Circle, Text as SvgText } from 'react-native-svg';

// ── Constants ─────────────────────────────────────────────────────
const CHART_H = 160;   // inner chart height (bars / line area)
const Y_W     = 38;    // y-axis label column width
const TOP_P   = 12;    // top padding above chart
const X_H     = 22;    // x-axis label row height

const TREND_OPTIONS = ['Increasing', 'Decreasing', 'Stays the same'];

// ── Helpers ───────────────────────────────────────────────────────
function niceMax(v) {
  if (v <= 0)   return 10;
  if (v <= 5)   return 5;
  if (v <= 10)  return 10;
  if (v <= 20)  return 20;
  if (v <= 25)  return 25;
  if (v <= 50)  return 50;
  if (v <= 100) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Auto-generate 4 MC options for read_value mode from dataset
function buildReadValueMC(values, targetIdx) {
  if (targetIdx < 0 || targetIdx >= values.length) return { mcOptions: [], mcCorrectIdx: 0 };
  const correct = values[targetIdx];

  // Prefer other dataset values as distractors (most pedagogically meaningful)
  const otherVals = [...new Set(values.filter((_, i) => i !== targetIdx))];
  let distractors = shuffle(otherVals).slice(0, 3);

  // Fill with arithmetic neighbors if not enough distinct values
  if (distractors.length < 3) {
    const step = Math.max(1, Math.round(Math.max(...values) * 0.2));
    for (const d of [correct + step, correct - step, correct + 2 * step, correct - 2 * step]) {
      if (distractors.length >= 3) break;
      if (d !== correct && d >= 0 && !distractors.includes(d)) distractors.push(d);
    }
  }

  const all = shuffle([correct, ...distractors.slice(0, 3)]);
  return { mcOptions: all.map(String), mcCorrectIdx: all.indexOf(correct) };
}

// Diagnostic wrong-answer feedback for chart questions
function buildWrongFeedback(mode, geo, q) {
  const { labels = [], values = [], targetLabel, unit } = geo;

  if (mode === 'read_value' && targetLabel) {
    const idx = labels.indexOf(targetLabel);
    if (idx >= 0) {
      const val = values[idx];
      return `Check the ${targetLabel} bar — its label shows ${val}${unit ? ' ' + unit : ''} at the top.`;
    }
    return `Find the ${targetLabel} bar and read the value label at its top.`;
  }

  if (mode === 'compare') {
    return q.hint ?? 'Read each bar carefully, then compare the values.';
  }

  if (mode === 'trend') {
    return 'Trace the line from left to right — is each point higher, lower, or level with the one before?';
  }

  return 'Look at the chart carefully and try again.';
}

// ── BarChart ──────────────────────────────────────────────────────
function BarChart({ labels, values, targetLabel, yLabel, xLabel, mode, chartW }) {
  const maxVal  = Math.max(...values, 1);
  const gridMax = niceMax(maxVal);
  const barAreaW = chartW - Y_W;
  const gridPcts = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={{ width: chartW }}>
      {yLabel ? <Text style={styles.axisLabelY}>{yLabel}</Text> : null}

      {/* Chart row: y-labels + bar area */}
      <View style={{ flexDirection: 'row' }}>

        {/* Y-axis value labels */}
        <View style={{ width: Y_W, height: CHART_H + TOP_P, position: 'relative' }}>
          {gridPcts.map(pct => (
            <Text
              key={pct}
              style={{
                position: 'absolute',
                right: 5,
                top: TOP_P + CHART_H - pct * CHART_H - 7,
                fontSize: 9,
                color: '#64748b',
                fontWeight: '600',
              }}
            >
              {Math.round(pct * gridMax)}
            </Text>
          ))}
        </View>

        {/* Bar + gridline area */}
        <View style={{ width: barAreaW, height: CHART_H + TOP_P, position: 'relative' }}>

          {/* Horizontal grid lines */}
          {gridPcts.map(pct => (
            <View
              key={pct}
              style={{
                position: 'absolute',
                left: 0, right: 0,
                top: TOP_P + CHART_H - pct * CHART_H,
                height: pct === 1 ? 2 : 1,
                backgroundColor: pct === 1 ? '#334155' : '#1e293b',
              }}
            />
          ))}

          {/* Left axis line */}
          <View style={{ position: 'absolute', left: 0, top: TOP_P, bottom: 0, width: 2, backgroundColor: '#334155' }} />

          {/* Bars row (aligned to bottom) */}
          <View style={{
            position: 'absolute',
            left: 2, right: 0,
            top: TOP_P, height: CHART_H,
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: 4,
          }}>
            {labels.map((label, i) => {
              const barH     = Math.max(2, Math.round((values[i] / gridMax) * CHART_H));
              const isTarget = mode === 'read_value' && label === targetLabel;
              return (
                <View key={label} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 2 }}>
                  <View style={[
                    styles.bar,
                    isTarget ? styles.barTarget : styles.barDefault,
                    { height: barH },
                  ]}>
                    {/* Value label floating above the bar */}
                    <Text style={[styles.barValueLabel, isTarget && styles.barValueLabelTarget]}>
                      {values[i]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: Y_W + 2 }}>
        {labels.map(label => (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.xLabel} numberOfLines={1}>{label}</Text>
          </View>
        ))}
      </View>

      {xLabel ? <Text style={styles.axisLabelX}>{xLabel}</Text> : null}
    </View>
  );
}

// ── LineChart ─────────────────────────────────────────────────────
function LineChart({ labels, values, yLabel, xLabel, chartW }) {
  const maxVal  = Math.max(...values, 1);
  const gridMax = niceMax(maxVal);

  const PAD    = { left: Y_W, right: 12, top: TOP_P, bottom: X_H };
  const innerW = chartW - PAD.left - PAD.right;
  const innerH = CHART_H;
  const svgH   = TOP_P + CHART_H + X_H;

  const n    = labels.length;
  const getX = i => PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const getY = v  => PAD.top + innerH - (v / gridMax) * innerH;

  const pts  = values.map((v, i) => ({ x: getX(i), y: getY(v) }));
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${getX(n - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${getX(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const gridPcts = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={{ width: chartW }}>
      {yLabel ? <Text style={styles.axisLabelY}>{yLabel}</Text> : null}

      <Svg width={chartW} height={svgH}>

        {/* Horizontal grid lines */}
        {gridPcts.map(pct => (
          <Line
            key={pct}
            x1={PAD.left}
            y1={PAD.top + innerH - pct * innerH}
            x2={PAD.left + innerW}
            y2={PAD.top + innerH - pct * innerH}
            stroke={pct === 1 ? '#334155' : '#1e293b'}
            strokeWidth={pct === 1 ? 2 : 1}
          />
        ))}

        {/* Y-axis line */}
        <Line
          x1={PAD.left} y1={PAD.top}
          x2={PAD.left} y2={PAD.top + innerH}
          stroke="#334155" strokeWidth={2}
        />

        {/* Area fill */}
        <Path d={areaD} fill="rgba(96,165,250,0.10)" />

        {/* Line path */}
        <Path
          d={lineD}
          stroke="#60a5fa"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data point dots */}
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x} cy={p.y} r={4.5}
            fill="#60a5fa"
            stroke="#0f172a"
            strokeWidth={1.5}
          />
        ))}

        {/* Value labels above each dot */}
        {pts.map((p, i) => (
          <SvgText
            key={`val-${i}`}
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill="#94a3b8"
          >
            {values[i]}
          </SvgText>
        ))}

        {/* Y-axis value labels */}
        {gridPcts.map(pct => (
          <SvgText
            key={pct}
            x={PAD.left - 5}
            y={PAD.top + innerH - pct * innerH + 4}
            textAnchor="end"
            fontSize="9"
            fontWeight="600"
            fill="#64748b"
          >
            {Math.round(pct * gridMax)}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {labels.map((label, i) => (
          <SvgText
            key={label}
            x={getX(i)}
            y={PAD.top + innerH + 15}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="#64748b"
          >
            {label}
          </SvgText>
        ))}
      </Svg>

      {xLabel ? <Text style={styles.axisLabelX}>{xLabel}</Text> : null}
    </View>
  );
}

// ── Option button ─────────────────────────────────────────────────
function OptionButton({ label, state, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.optBtn, styles[`opt_${state}`]]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.optText, styles[`optText_${state}`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main renderer ─────────────────────────────────────────────────
export default function ChartReaderRenderer({ q, onResolve }) {
  const geo = q.geometry ?? {};
  const {
    chartType   = 'bar',
    labels      = [],
    values      = [],
    mode        = 'read_value',
    targetLabel,
    unit,
    yLabel,
    xLabel,
  } = geo;

  const { width: screenW } = useWindowDimensions();
  const chartW = Math.min(screenW - 44, 360);

  // MC options — auto-generated for read_value, AI-provided for compare
  const { mcOptions, mcCorrectIdx } = useMemo(() => {
    if (mode === 'read_value') {
      const idx = labels.indexOf(targetLabel);
      return buildReadValueMC(values, idx);
    }
    if (mode === 'compare') {
      return { mcOptions: q.options ?? [], mcCorrectIdx: q.correctIndex ?? 0 };
    }
    return { mcOptions: [], mcCorrectIdx: -1 }; // trend uses TREND_OPTIONS
  }, [mode, values, labels, targetLabel, q.options, q.correctIndex]);

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(idx) {
    if (feedback) return;
    setChosen(idx);
    Haptics.selectionAsync();

    let isCorrect;
    if (mode === 'trend') {
      const norm = s => s.toLowerCase().trim();
      isCorrect = norm(TREND_OPTIONS[idx]) === norm(q.correctAnswer ?? '');
    } else {
      isCorrect = idx === mcCorrectIdx;
    }

    setFeedback(isCorrect ? 'correct' : 'wrong');
    Haptics.notificationAsync(
      isCorrect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );

    if (isCorrect) {
      // Short delay — just enough for the button to flash green; Lottie handles celebration
      setTimeout(() => onResolve(true), 400);
    } else {
      setTimeout(() => { setFeedback(null); setChosen(null); }, 2000);
    }
  }

  const displayOptions = mode === 'trend' ? TREND_OPTIONS : mcOptions;

  return (
    <View style={styles.root}>

      {/* Chart card */}
      <View style={styles.chartCard}>
        {chartType === 'line' ? (
          <LineChart
            labels={labels} values={values}
            yLabel={yLabel} xLabel={xLabel}
            chartW={chartW}
          />
        ) : (
          <BarChart
            labels={labels} values={values}
            targetLabel={targetLabel}
            yLabel={yLabel} xLabel={xLabel}
            mode={mode} chartW={chartW}
          />
        )}
      </View>

      {/* Target hint for read_value */}
      {mode === 'read_value' && targetLabel ? (
        <Text style={styles.targetHint}>
          {'Find '}
          <Text style={styles.targetHighlight}>{targetLabel}</Text>
          {' on the chart'}
        </Text>
      ) : null}

      {/* Answer options — always 2-column grid; 3 items land bottom-left naturally */}
      <View style={styles.optionsGrid}>
        {displayOptions.map((opt, idx) => {
          const state = !feedback
            ? (chosen === idx ? 'selected' : 'idle')
            : idx === chosen && feedback === 'correct' ? 'correct'
            : idx === chosen && feedback === 'wrong'   ? 'wrong'
            : 'dim';
          const label = (mode === 'read_value' && unit) ? `${opt} ${unit}` : opt;
          return (
            <OptionButton
              key={opt}
              label={label}
              state={state}
              onPress={() => handlePick(idx)}
              disabled={!!feedback}
            />
          );
        })}
      </View>

      {/* Wrong-answer diagnostic feedback only — Lottie handles correct celebration */}
      {feedback === 'wrong' && (
        <View style={styles.wrongBanner}>
          <Text style={styles.wrongText}>{buildWrongFeedback(mode, geo, q)}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingBottom: 8,
    width: '100%',
  },

  // Chart container card
  chartCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
  },

  // Axis labels
  axisLabelY: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  axisLabelX: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  xLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },

  // Bars
  bar: {
    width: '80%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    overflow: 'visible',
  },
  barDefault: {
    backgroundColor: '#60a5fa',
  },
  barTarget: {
    backgroundColor: '#fbbf24',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },

  // Value label above each bar (positioned absolute, floats above bar top)
  barValueLabel: {
    position: 'absolute',
    top: -15,
    left: -20,
    right: -20,
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  barValueLabelTarget: {
    color: '#fbbf24',
  },

  // Target hint
  targetHint: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  targetHighlight: {
    color: '#fbbf24',
    fontWeight: '800',
  },

  // Options — 2-column grid; justifyContent flex-start so 3rd item lands bottom-left
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
    width: '100%',
    marginBottom: 10,
  },
  optBtn: {
    width: '48%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },

  opt_idle:     { backgroundColor: '#1e293b', borderColor: '#334155' },
  opt_selected: { backgroundColor: '#334155', borderColor: '#f1f5f9' },
  opt_correct:  { backgroundColor: '#052e16', borderColor: '#4ade80' },
  opt_wrong:    { backgroundColor: '#1c0a0a', borderColor: '#ef4444' },
  opt_dim:      { backgroundColor: '#1e293b', borderColor: '#1e293b', opacity: 0.45 },

  optText:           { fontSize: 14, fontWeight: '700', color: '#cbd5e1', textAlign: 'center' },
  optText_idle:      { color: '#cbd5e1' },
  optText_selected:  { color: '#f1f5f9' },
  optText_correct:   { color: '#4ade80' },
  optText_wrong:     { color: '#fca5a5' },
  optText_dim:       { color: '#475569' },

  // Wrong feedback only — no success banner (Lottie handles correct celebration)
  wrongBanner: {
    backgroundColor: '#1c0a0a',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 4,
    width: '100%',
    alignItems: 'center',
  },
  wrongText: { color: '#fca5a5', fontWeight: '600', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
