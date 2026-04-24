// Shared measurement components and helpers used by tool renderers.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Arm: a thin rect from (cx,cy) pointing at angleDeg for `length` px.
// Rotation in RN is around the view center, so we position the view
// such that its center is the midpoint of the arm — then rotate.
export function armStyle(cx, cy, length, angleDeg, color, thickness = 2) {
  const rad = (angleDeg * Math.PI) / 180;
  const ex  = cx + length * Math.cos(rad);
  const ey  = cy - length * Math.sin(rad);
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

// Renders fractions for inch measurements; decimals otherwise.
export function formatMeasurement(val, unit) {
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

// Formats a number line value: whole numbers as integers, quarter/half
// fractions as glyphs, decimals with step-appropriate precision.
export function formatNLValue(v, step) {
  const rounded = Math.round(v * 100000) / 100000;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
  const whole = Math.floor(rounded);
  const frac  = Math.round((rounded - whole) * 100000) / 100000;
  if (step <= 0.5 && step > 0) {
    const f4 = Math.round(frac * 4) / 4;
    const FL = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
    if (Math.abs(frac - f4) < 0.001 && FL[f4]) {
      return whole === 0 ? FL[f4] : `${whole} ${FL[f4]}`;
    }
  }
  const places = step < 1 && step.toString().includes('.')
    ? step.toString().split('.')[1].length
    : 1;
  return rounded.toFixed(places);
}

// ── AngleStimulus — draws two labeled rays from a vertex ──────
export function AngleStimulus({ geometry }) {
  const { angleDeg = 90, vertex = 'M', ray1 = 'N', ray2 = 'L' } = geometry;
  const cx = 130, cy = 120, armLen = 90;
  const rad = (angleDeg * Math.PI) / 180;
  const r1ex = cx + armLen;
  const r1ey = cy;
  const r2ex = cx + armLen * Math.cos(rad);
  const r2ey = cy - armLen * Math.sin(rad);
  const arcR = 28;
  const arcTicks = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * angleDeg;
    const r = (a * Math.PI) / 180;
    arcTicks.push({ x: cx + arcR * Math.cos(r), y: cy - arcR * Math.sin(r) });
  }
  return (
    <View style={stimStyles.angleCanvas}>
      {arcTicks.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.x - 1.5, top: p.y - 1.5, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#94a3b8' }} />
      ))}
      <View style={armStyle(cx, cy, armLen, 0, '#e2e8f0', 2.5)} />
      <View style={armStyle(cx, cy, armLen, angleDeg, '#e2e8f0', 2.5)} />
      <View style={{ position: 'absolute', left: r1ex - 4, top: r1ey - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' }} />
      <View style={{ position: 'absolute', left: r2ex - 4, top: r2ey - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#94a3b8' }} />
      <View style={{ position: 'absolute', left: cx - 5, top: cy - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#7c3aed' }} />
      <Text style={[stimStyles.angleLabel, { left: cx - 8, top: cy + 8 }]}>{vertex}</Text>
      <Text style={[stimStyles.angleLabel, { left: r1ex + 6, top: r1ey - 8 }]}>{ray1}</Text>
      <Text style={[stimStyles.angleLabel, { left: r2ex + (r2ex > cx ? 4 : -20), top: r2ey - (angleDeg > 150 ? 6 : 20) }]}>{ray2}</Text>
    </View>
  );
}

// ── SegmentStimulus — draws a ruler with a colored bar ─────────
// Supports an optional `start` offset so the bar can begin at a
// non-zero position (used by the "offset" ruler subtype).
export function SegmentStimulus({ geometry, compact = false }) {
  const {
    length = 1, start = 0, unit = 'inch', color = 'red',
    rulerMax: rawMax = Math.max(Math.ceil(length + start) + 1, 4),
  } = geometry;
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
  const canvasH  = compact ? 74 : 90;
  const barTop   = compact ? 3 : 5;
  const barH     = compact ? 10 : 14;
  const rulerTop = compact ? 20 : 28;
  return (
    <View style={[stimStyles.segCanvas, { height: canvasH }]}>
      {start > 0 && (
        <View style={{ position: 'absolute', left: 0, top: barTop + barH / 2, height: 2,
          width: barLeft, backgroundColor: '#334155', borderRadius: 1 }} />
      )}
      <View style={{ position: 'absolute', left: barLeft, top: barTop,
        height: barH, width: barWidth, backgroundColor: barColor, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: barLeft,              top: barTop - 4, width: 2, height: barH + 8, backgroundColor: barColor }} />
      <View style={{ position: 'absolute', left: barLeft + barWidth - 2, top: barTop - 4, width: 2, height: barH + 8, backgroundColor: barColor }} />
      <View style={{ position: 'absolute', left: 0, top: rulerTop, width: W, height: 28,
        backgroundColor: '#1e293b', borderRadius: 4, borderWidth: 1, borderColor: '#334155' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 18, backgroundColor: '#a78bfa', borderRadius: 1 }} />
        {ticks.map((t, i) => (
          <View key={i} style={{ position: 'absolute', left: t.x - 0.75, top: 0,
            width: 1.5, height: t.h, backgroundColor: t.isWhole ? '#64748b' : '#475569' }} />
        ))}
      </View>
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <Text key={i} style={{ position: 'absolute', left: t.x - 10, top: rulerTop + 30,
          width: 20, textAlign: 'center',
          fontSize: 10, color: t.x === 0 ? '#a78bfa' : '#94a3b8', fontWeight: '700' }}>
          {t.label}
        </Text>
      ))}
    </View>
  );
}

// ── TwoBarStimulus — two bars on the same ruler (compare / difference) ──
export function TwoBarStimulus({ geometry }) {
  const {
    length = 5, start = 0, unit = 'inch', color = 'red',
    bar2 = { length: 3, color: 'blue' },
    rulerMax: rawMax = 10,
  } = geometry;
  const b2len    = bar2.length ?? 3;
  const b2color  = bar2.color  ?? 'blue';
  const rulerMax = Math.max(rawMax, Math.ceil(Math.max(length, b2len) + start) + 1, 4);
  const W        = 280;
  const pxPerUnit = W / rulerMax;
  const isInch   = unit === 'inch';
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
  return (
    <View style={[stimStyles.segCanvas, { height: 112 }]}>
      <View style={{ position: 'absolute', left: 0, top: 2,  height: 12, width: b1w, backgroundColor: c1, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: 0,     top: 0, width: 2, height: 16, backgroundColor: c1 }} />
      <View style={{ position: 'absolute', left: b1w-2, top: 0, width: 2, height: 16, backgroundColor: c1 }} />
      <View style={{ position: 'absolute', left: 0, top: 20, height: 12, width: b2w, backgroundColor: c2, borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: 0,     top: 18, width: 2, height: 16, backgroundColor: c2 }} />
      <View style={{ position: 'absolute', left: b2w-2, top: 18, width: 2, height: 16, backgroundColor: c2 }} />
      <View style={{ position: 'absolute', left: 0, top: 38, width: W, height: 28,
        backgroundColor: '#1e293b', borderRadius: 4, borderWidth: 1, borderColor: '#334155' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: 3, height: 18, backgroundColor: '#a78bfa', borderRadius: 1 }} />
        {ticks.map((t, i) => (
          <View key={i} style={{ position: 'absolute', left: t.x - 0.75, top: 0,
            width: 1.5, height: t.h, backgroundColor: t.isWhole ? '#64748b' : '#475569' }} />
        ))}
      </View>
      {ticks.filter(t => t.label !== null).map((t, i) => (
        <Text key={i} style={{ position: 'absolute', left: t.x - 10, top: 68,
          width: 20, textAlign: 'center',
          fontSize: 10, color: t.x === 0 ? '#a78bfa' : '#94a3b8', fontWeight: '700' }}>
          {t.label}
        </Text>
      ))}
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
});
