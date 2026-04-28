/**
 * AngleMatchingRenderer — "Match each angle to its measure."
 *
 * UI flow:
 *   1. Three angle-drawing rows are shown on the left.
 *   2. A bank of shuffled degree chips sits below.
 *   3. Tap a row to select it (purple highlight).
 *   4. Then tap a chip to assign it to that row.
 *      – If the chip is already assigned elsewhere it is "stolen".
 *   5. When all three rows are filled the answer is auto-checked.
 *   6. Tapping a filled row unassigns it and re-selects the row.
 *
 * Question data shape:
 *   {
 *     type: 'angle_matching',
 *     question: 'Match each angle to its measure.',
 *     pairs: [
 *       { angleDeg: 45,  vertex: 'A', ray1: 'B', ray2: 'C' },
 *       { angleDeg: 90,  vertex: 'D', ray1: 'E', ray2: 'F' },
 *       { angleDeg: 120, vertex: 'G', ray1: 'H', ray2: 'I' },
 *     ],
 *     correctAnswer: 'match',   // used for dedup in shuffle; scoring via onResolve
 *   }
 */
import React, { useState, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Path } from 'react-native-svg';

// ── Local shake animation ────────────────────────────────────────────────────
function useShake() {
  const anim = useRef(new Animated.Value(0)).current;
  function shake() {
    Animated.sequence([
      Animated.timing(anim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }
  return { anim, shake };
}

// ── MiniAngle — SVG angle drawing for each matching row ─────────────────────
const MA_SIZE  = 80;   // square canvas
const MA_CX    = 40;
const MA_CY    = 40;
const MA_ARM   = 32;   // arm radius
const MA_ARC_R = 18;   // arc indicator radius

// Sector arc path for the angle indicator (from 0° to angleDeg, math coords)
function miniSectorPath(angleDeg) {
  const toRad = d => (d * Math.PI) / 180;
  const x1 = MA_CX + MA_ARC_R;                                   // 0° = right
  const y1 = MA_CY;
  const x2 = MA_CX + MA_ARC_R * Math.cos(toRad(angleDeg));
  const y2 = MA_CY - MA_ARC_R * Math.sin(toRad(angleDeg));
  const large = angleDeg > 180 ? 1 : 0;
  return `M ${MA_CX},${MA_CY} L ${x1},${y1} A ${MA_ARC_R},${MA_ARC_R} 0 ${large} 0 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

function MiniAngle({ angleDeg, isSelected, isCorrect, isWrong }) {
  const borderColor = isCorrect  ? '#22c55e'
    : isWrong   ? '#ef4444'
    : isSelected ? '#7c3aed'
    : '#334155';
  const bgColor = isCorrect  ? 'rgba(34,197,94,0.08)'
    : isWrong   ? 'rgba(239,68,68,0.08)'
    : isSelected ? 'rgba(124,58,237,0.12)'
    : '#0f172a';
  const pivotColor = isCorrect ? '#22c55e' : isWrong ? '#ef4444' : '#7c3aed';
  const rayColor   = isSelected ? '#a78bfa' : '#e2e8f0';

  const toRad = d => (d * Math.PI) / 180;
  const tipBaseline = { x: MA_CX + MA_ARM,  y: MA_CY };
  const tipMovable  = {
    x: MA_CX + MA_ARM * Math.cos(toRad(angleDeg)),
    y: MA_CY - MA_ARM * Math.sin(toRad(angleDeg)),
  };

  return (
    <View style={[localStyles.miniAngle, { borderColor, backgroundColor: bgColor }]}>
      <Svg width={MA_SIZE} height={MA_SIZE}>
        {/* Sector fill */}
        <Path d={miniSectorPath(angleDeg)} fill="rgba(100,116,139,0.15)" />

        {/* Baseline ray */}
        <Line
          x1={MA_CX} y1={MA_CY}
          x2={tipBaseline.x.toFixed(2)} y2={tipBaseline.y.toFixed(2)}
          stroke={rayColor} strokeWidth="2" strokeLinecap="round"
        />
        {/* Movable ray */}
        <Line
          x1={MA_CX} y1={MA_CY}
          x2={tipMovable.x.toFixed(2)} y2={tipMovable.y.toFixed(2)}
          stroke={rayColor} strokeWidth="2" strokeLinecap="round"
        />
        {/* Pivot dot */}
        <Circle cx={MA_CX} cy={MA_CY} r="4" fill={pivotColor} />
      </Svg>
    </View>
  );
}

// ── Main renderer ────────────────────────────────────────────────────────────
export default function AngleMatchingRenderer({ q, onResolve, styles }) {
  const pairs = useMemo(() => q.pairs ?? [], []);

  // Shuffle label order so chips don't line up with rows (rotate by 1).
  const shuffledLabels = useMemo(() => {
    const vals = pairs.map(p => p.angleDeg);
    if (vals.length > 1) {
      const last = vals.pop();
      vals.unshift(last);
    }
    return vals;
  }, [pairs]);

  // assignments[rowIdx] = chipIdx assigned to that row, or null
  const [assignments, setAssignments] = useState(() => Array(pairs.length).fill(null));
  const [selectedRow,  setSelectedRow]  = useState(null);
  const [feedback,     setFeedback]     = useState(null);
  const { anim: shakeAnim, shake }      = useShake();

  const usedChips = new Set(assignments.filter(a => a !== null));

  function handleRowTap(rowIdx) {
    if (feedback) return;
    if (selectedRow === rowIdx) {
      setSelectedRow(null);
    } else if (assignments[rowIdx] !== null) {
      // Unassign this row and select it
      const next = [...assignments];
      next[rowIdx] = null;
      setAssignments(next);
      setSelectedRow(rowIdx);
    } else {
      setSelectedRow(rowIdx);
    }
  }

  function handleChipTap(chipIdx) {
    if (feedback || selectedRow === null) return;

    // Build next state: steal from any other row that had this chip, assign to selectedRow
    const next = assignments.map((a, i) => {
      if (i === selectedRow) return chipIdx;
      if (a === chipIdx)     return null;
      return a;
    });

    setAssignments(next);
    setSelectedRow(null);

    if (next.every(a => a !== null)) {
      const isCorrect = next.every((ci, rowIdx) => shuffledLabels[ci] === pairs[rowIdx].angleDeg);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      isCorrect
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : (shake(), Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
      setTimeout(() => onResolve(isCorrect), 1800);
    }
  }

  function handleReset() {
    setAssignments(Array(pairs.length).fill(null));
    setSelectedRow(null);
  }

  const hasAnyAssignment = assignments.some(a => a !== null);

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>

      {/* ── Matching rows ── */}
      {pairs.map((pair, rowIdx) => {
        const chipIdx    = assignments[rowIdx];
        const isSelected = selectedRow === rowIdx && !feedback;
        const isCorrect  = !!feedback && chipIdx !== null && shuffledLabels[chipIdx] === pair.angleDeg;
        const isWrong    = !!feedback && chipIdx !== null && !isCorrect;

        return (
          <TouchableOpacity
            key={rowIdx}
            style={[localStyles.matchRow, isSelected && localStyles.matchRowSelected]}
            onPress={() => handleRowTap(rowIdx)}
            disabled={!!feedback}
            activeOpacity={0.75}
          >
            <MiniAngle
              angleDeg={pair.angleDeg}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isWrong={isWrong}
            />
            <Text style={[localStyles.arrow, isSelected && { color: '#a78bfa' }]}>→</Text>
            <View style={[
              localStyles.slot,
              chipIdx !== null && localStyles.slotFilled,
              isCorrect && localStyles.slotCorrect,
              isWrong   && localStyles.slotWrong,
            ]}>
              <Text style={[
                localStyles.slotText,
                isCorrect && { color: '#4ade80' },
                isWrong   && { color: '#f87171' },
              ]}>
                {chipIdx !== null ? `${shuffledLabels[chipIdx]}°` : '___'}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* ── Tap instruction ── */}
      {!feedback && (
        <Text style={localStyles.instruction}>
          {selectedRow !== null
            ? '↓ Now tap a degree to match it'
            : 'Tap an angle row to select it, then tap its degree'}
        </Text>
      )}

      {/* ── Degree chip bank ── */}
      {!feedback && (
        <View style={localStyles.chipBank}>
          {shuffledLabels.map((deg, chipIdx) => {
            const isUsed      = usedChips.has(chipIdx);
            const canTap      = selectedRow !== null;
            return (
              <TouchableOpacity
                key={chipIdx}
                style={[
                  localStyles.chip,
                  isUsed && localStyles.chipUsed,
                  canTap && !isUsed && localStyles.chipAvailable,
                ]}
                onPress={() => handleChipTap(chipIdx)}
                disabled={!canTap || !!feedback}
                activeOpacity={0.75}
              >
                <Text style={[localStyles.chipText, isUsed && localStyles.chipTextUsed]}>
                  {deg}°
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Reset button ── */}
      {!feedback && hasAnyAssignment && (
        <TouchableOpacity style={localStyles.resetBtn} onPress={handleReset} activeOpacity={0.8}>
          <Text style={localStyles.resetBtnText}>↺  Reset</Text>
        </TouchableOpacity>
      )}

      {/* ── Feedback ── */}
      {feedback === 'correct' && (
        <Text style={styles.fillInCorrectMsg}>All matched correctly! 📐</Text>
      )}
      {feedback === 'wrong' && (
        <View style={[styles.fillInReveal, { flexDirection: 'column', gap: 4 }]}>
          <Text style={styles.fillInRevealLabel}>Correct matches:</Text>
          {pairs.map((p, i) => (
            <Text key={i} style={styles.fillInRevealAnswer}>
              Angle {i + 1} → {p.angleDeg}°
            </Text>
          ))}
        </View>
      )}

      {/* ── Footer hint ── */}
      <Text style={localStyles.hint}>Tap an angle, then tap the matching degree.</Text>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  matchRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 10,
    padding: 8, borderRadius: 14,
    borderWidth: 2, borderColor: 'transparent',
    backgroundColor: '#1e293b',
  },
  matchRowSelected: {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  miniAngle: {
    width: 80, height: 80,
    position: 'relative', borderRadius: 10,
    borderWidth: 1.5, overflow: 'visible',
  },
  arrow: {
    fontSize: 20, color: '#475569', fontWeight: '700',
  },
  slot: {
    flex: 1, height: 44, borderRadius: 10,
    borderWidth: 2, borderColor: '#334155',
    borderStyle: 'dashed',
    backgroundColor: '#0f172a',
    alignItems: 'center', justifyContent: 'center',
  },
  slotFilled: {
    borderStyle: 'solid',
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  slotCorrect: {
    borderStyle: 'solid',
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  slotWrong: {
    borderStyle: 'solid',
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  slotText: {
    fontSize: 18, fontWeight: '800', color: '#a78bfa',
  },
  instruction: {
    fontSize: 12, color: '#64748b', textAlign: 'center',
    marginTop: 4, marginBottom: 10, fontStyle: 'italic',
  },
  chipBank: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'center', marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12, borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  chipUsed: {
    opacity: 0.25, borderColor: '#1e293b',
  },
  chipAvailable: {
    borderColor: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  chipText: {
    fontSize: 18, fontWeight: '800', color: '#e2e8f0',
  },
  chipTextUsed: {
    color: '#475569',
  },
  resetBtn: {
    alignSelf: 'center',
    paddingVertical: 8, paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, marginBottom: 8,
  },
  resetBtnText: {
    fontSize: 13, color: '#94a3b8', fontWeight: '600',
  },
  hint: {
    fontSize: 12, color: '#475569', textAlign: 'center',
    marginTop: 8, fontStyle: 'italic',
  },
});
