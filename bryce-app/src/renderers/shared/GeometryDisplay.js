import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function GeometryDisplay({ geometry }) {
  if (!geometry?.type) return null;

  if (geometry.type === 'pie') {
    const slices = geometry.slices ?? [];
    const total  = slices.reduce((s, x) => s + (x.fraction ?? 0), 0) || 1;
    return (
      <View style={styles.container}>
        <View style={styles.pieStrip}>
          {slices.map((s, i) => (
            <View key={i} style={[
              styles.pieSegment,
              { flex: (s.fraction ?? 0) / total, backgroundColor: s.color ?? '#6366f1' },
              i === 0 && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
              i === slices.length - 1 && { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
            ]} />
          ))}
        </View>
        <View style={styles.pieLegend}>
          {slices.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color ?? '#6366f1' }]} />
              <Text style={styles.legendText}>{s.label ?? ''} ({Math.round((s.fraction ?? 0) * 100)}%)</Text>
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
      <View style={styles.container}>
        <View style={[styles.barChart, { height: CHART_H + 32 }]}>
          {bars.map((b, i) => {
            const barH = Math.max(4, ((b.value ?? 0) / maxVal) * CHART_H);
            return (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barValue}>{b.value}</Text>
                <View style={[styles.bar, { height: barH }]} />
                <Text style={styles.barLabel} numberOfLines={1}>{b.label ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.barBaseline} />
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
      <View style={styles.container}>
        <View style={[styles.shapeWrapper, shapeStyle]}>
          {geometry.label ? <Text style={styles.shapeLabel}>{geometry.label}</Text> : null}
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
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
