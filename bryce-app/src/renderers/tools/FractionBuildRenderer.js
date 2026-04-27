import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { measStyles } from '../shared/measurementStyles';

// ── Layout constants ───────────────────────────────────────────
const BAR_W   = 300;
const BAR_H   = 60;
const SEG_GAP = 3;
const MIN_PARTS = 2;
const MAX_PARTS = 12;

// ── Helpers ────────────────────────────────────────────────────
function parseTarget(str) {
  const parts = String(str).split('/');
  if (parts.length === 2) {
    const n = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (!isNaN(n) && !isNaN(d) && d > 0) return [n, d];
  }
  return [3, 4]; // safe fallback
}

// ── FractionLabel — stacked fraction display ───────────────────
function FractionLabel({ num, den, color = '#e2e8f0', size = 22 }) {
  return (
    <View style={bStyles.fracWrap}>
      <Text style={[bStyles.fracNum, { color, fontSize: size }]}>{num}</Text>
      <View style={[bStyles.fracLine, { backgroundColor: color, width: size * 1.2 }]} />
      <Text style={[bStyles.fracDen, { color, fontSize: size }]}>{den}</Text>
    </View>
  );
}

// ── FractionBar — segmented bar with tap interaction ───────────
function FractionBar({ parts, shadedSet, onTap, feedback }) {
  return (
    <View style={{ width: BAR_W, flexDirection: 'row', alignSelf: 'center', marginVertical: 12 }}>
      {Array.from({ length: parts }, (_, i) => {
        const isShaded = shadedSet?.has(i) ?? false;
        const isFirst  = i === 0;
        const isLast   = i === parts - 1;

        const bgColor = (() => {
          if (feedback === 'correct' && isShaded) return '#22c55e';
          if (feedback === 'wrong'   && isShaded) return '#ef4444';
          if (isShaded) return '#4ade80';
          return '#1e293b';
        })();

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.65}
            disabled={!!feedback}
            onPress={() => onTap?.(i)}
            style={{
              flex: 1,
              height: BAR_H,
              marginLeft:  isFirst ? 0 : SEG_GAP / 2,
              marginRight: isLast  ? 0 : SEG_GAP / 2,
              backgroundColor: bgColor,
              borderTopLeftRadius:     isFirst ? 10 : 0,
              borderBottomLeftRadius:  isFirst ? 10 : 0,
              borderTopRightRadius:    isLast  ? 10 : 0,
              borderBottomRightRadius: isLast  ? 10 : 0,
              borderWidth:  !feedback && !isShaded ? 1.5 : 0,
              borderColor:  '#334155',
              borderStyle:  'dashed',
            }}
          />
        );
      })}
    </View>
  );
}

// ── StepperRow — +/− control for denominator ──────────────────
function StepperRow({ value, min, max, onChange, disabled }) {
  return (
    <View style={bStyles.stepperRow}>
      <TouchableOpacity
        style={[bStyles.stepBtn, (value <= min || disabled) && bStyles.stepBtnDisabled]}
        onPress={() => onChange(-1)}
        disabled={value <= min || disabled}
      >
        <Text style={bStyles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <View style={bStyles.stepLabelBox}>
        <Text style={bStyles.stepCount}>{value}</Text>
        <Text style={bStyles.stepSub}>equal parts</Text>
      </View>
      <TouchableOpacity
        style={[bStyles.stepBtn, (value >= max || disabled) && bStyles.stepBtnDisabled]}
        onPress={() => onChange(+1)}
        disabled={value >= max || disabled}
      >
        <Text style={bStyles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── BuildMode ──────────────────────────────────────────────────
// Student sets BOTH the denominator (via stepper) AND the
// numerator (by tapping segments). Both must match the target.
function BuildMode({ q, onResolve }) {
  const geo = q.geometry ?? {};
  const [targetNum, targetDen] = parseTarget(geo.target ?? '3/4');

  // Start at a different value so the student can't just hit Check immediately
  const startParts = targetDen === MIN_PARTS ? MIN_PARTS + 1 : MIN_PARTS;

  const [parts,    setParts]    = useState(startParts);
  const [tapped,   setTapped]   = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);

  function changeParts(delta) {
    if (feedback) return;
    const next = Math.max(MIN_PARTS, Math.min(MAX_PARTS, parts + delta));
    if (next !== parts) {
      setParts(next);
      setTapped(new Set());
      Haptics.selectionAsync();
    }
  }

  function handleTap(i) {
    if (feedback) return;
    setTapped(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleCheck() {
    if (feedback) return;
    const ok = parts === targetDen && tapped.size === targetNum;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  function handleReset() {
    setParts(startParts);
    setTapped(new Set());
    setFeedback(null);
  }

  const count       = tapped.size;
  const partsRight  = parts === targetDen;
  const countRight  = count === targetNum;
  const noneYet     = count === 0;

  // Live status hint — guides student toward the answer step-by-step
  const statusColor = partsRight && countRight ? '#4ade80' : partsRight ? '#60a5fa' : '#64748b';
  const statusMsg = (() => {
    if (partsRight && countRight) return '✓ Looks right! Press Check to confirm.';
    if (partsRight && count > targetNum)  return `Too many shaded — tap a green segment to remove ${count - targetNum}.`;
    if (partsRight && count > 0)  return `Good denominator! Shade ${targetNum - count} more segment${targetNum - count !== 1 ? 's' : ''}.`;
    if (partsRight) return `Right! Now tap ${targetNum} segment${targetNum !== 1 ? 's' : ''} to shade them.`;
    return `${parts} part${parts !== 1 ? 's' : ''} — adjust to reach the right denominator.`;
  })();

  // Wrong-answer explanation after Check
  const wrongExplanation = (() => {
    if (!partsRight && !countRight) {
      return `${targetNum}/${targetDen} needs ${targetDen} equal parts and ${targetNum} shaded. You have ${parts} parts with ${count} shaded.`;
    }
    if (!partsRight) {
      return `The denominator tells you how many equal parts. ${targetNum}/${targetDen} → ${targetDen} parts. Adjust the stepper.`;
    }
    return `Right denominator (${targetDen})! But you need ${targetNum} shaded — you shaded ${count}.`;
  })();

  return (
    <View style={bStyles.modeWrap}>
      {/* Target fraction badge */}
      <View style={bStyles.targetBadge}>
        <Text style={bStyles.targetLabel}>Build this fraction:</Text>
        <FractionLabel num={targetNum} den={targetDen} color="#4ade80" size={28} />
      </View>

      {/* Step 1 — denominator stepper */}
      <View style={bStyles.stepSection}>
        <Text style={bStyles.stepSectionLabel}>① Set the number of equal parts</Text>
        <StepperRow
          value={parts}
          min={MIN_PARTS}
          max={MAX_PARTS}
          onChange={changeParts}
          disabled={!!feedback}
        />
      </View>

      {/* Step 2 — shade the numerator */}
      <View style={bStyles.stepSection}>
        <Text style={bStyles.stepSectionLabel}>② Shade the correct number of parts</Text>
        <FractionBar parts={parts} shadedSet={tapped} onTap={handleTap} feedback={feedback} />
      </View>

      {/* Live fraction display + status */}
      <View style={bStyles.liveRow}>
        <FractionLabel
          num={count} den={parts}
          color={partsRight && countRight ? '#4ade80' : '#94a3b8'}
          size={20}
        />
        <Text style={[bStyles.statusMsg, { color: statusColor }]}>{statusMsg}</Text>
      </View>

      {/* Post-feedback banners */}
      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>{wrongExplanation}</Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            ✓ {targetNum}/{targetDen} — {targetNum} shaded out of {targetDen} equal parts! 🎉
          </Text>
        </View>
      )}

      {/* Action buttons */}
      {!feedback ? (
        <View style={[bStyles.actionRow, { width: BAR_W }]}>
          <TouchableOpacity style={bStyles.resetBtn} onPress={handleReset}>
            <Text style={bStyles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[bStyles.checkBtn, noneYet && bStyles.checkBtnDisabled]}
            onPress={handleCheck}
            disabled={noneYet}
          >
            <Text style={bStyles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // After wrong: offer a retry
        feedback === 'wrong' && (
          <TouchableOpacity style={[bStyles.checkBtn, { width: BAR_W, marginTop: 12 }]} onPress={handleReset}>
            <Text style={bStyles.checkBtnText}>Try Again</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}

// ── Main export ────────────────────────────────────────────────
export default function FractionBuildRenderer({ q, onResolve }) {
  return <BuildMode q={q} onResolve={onResolve} />;
}

// ── Styles ─────────────────────────────────────────────────────
const bStyles = StyleSheet.create({
  modeWrap: {
    alignItems: 'center', paddingBottom: 8,
  },

  // Stacked fraction label
  fracWrap:  { alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  fracNum:   { fontWeight: '900', lineHeight: 26 },
  fracLine:  { height: 2.5, borderRadius: 1, marginVertical: 1 },
  fracDen:   { fontWeight: '900', lineHeight: 26 },

  // Target badge
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1e293b', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#4ade80',
    paddingVertical: 10, paddingHorizontal: 20,
    marginBottom: 12,
  },
  targetLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  // Step sections
  stepSection: {
    width: BAR_W, marginBottom: 4,
  },
  stepSectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#475569',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6,
  },

  // Stepper row
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 0,
  },
  stepBtn: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { fontSize: 28, fontWeight: '900', color: '#e2e8f0', lineHeight: 32 },
  stepLabelBox: {
    width: 120, alignItems: 'center', gap: 2,
  },
  stepCount: { fontSize: 36, fontWeight: '900', color: '#4ade80', lineHeight: 40 },
  stepSub:   { fontSize: 12, fontWeight: '600', color: '#64748b' },

  // Live fraction row
  liveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 0, marginBottom: 8, width: BAR_W,
  },
  statusMsg: {
    flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row', gap: 12, marginTop: 12,
  },
  resetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: '#334155', alignItems: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '700', color: '#94a3b8' },
  checkBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#4ade80', alignItems: 'center',
  },
  checkBtnDisabled: { backgroundColor: '#334155', opacity: 0.5 },
  checkBtnText: { fontSize: 16, fontWeight: '800', color: '#052e16' },
});
