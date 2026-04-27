import React, { useState, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { measStyles } from '../shared/measurementStyles';

// ── Layout constants ───────────────────────────────────────────
const BAR_W   = 300;
const BAR_H   = 60;
const SEG_GAP = 3;

// ── Helpers ────────────────────────────────────────────────────
function formatFraction(num, den) {
  return `${num}/${den}`;
}

function toDecimal(num, den) {
  return num / den;
}

// Returns a clean decimal string for post-answer explanations: "0.75", "0.667"
function decimalLabel(num, den) {
  const d = num / den;
  // Check if it terminates cleanly at 2 decimal places
  if (Math.round(d * 100) / 100 === d) return d.toFixed(2).replace(/\.?0+$/, '');
  return d.toFixed(3).replace(/0+$/, '');
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Improved distractor pool ───────────────────────────────────
// Mixes cross-denominator distractors with same-denominator ones so the
// student must correctly identify BOTH numerator and denominator.
//
// Strategy: 1 same-numerator/different-denominator + 1 same-denominator/
// different-numerator + 1 from a common-fractions pool as fallback.
function buildReadOptions(parts, shaded) {
  const correct = formatFraction(shaded, parts);
  const seen    = new Set([correct]);
  const pool    = [];

  // 1. Cross-denom: same numerator, adjacent denominator
  //    Forces student to check the total-parts count, not just the shaded count.
  const adjDenoms = shuffleArr(
    [parts - 2, parts - 1, parts + 1, parts + 2, parts + 3]
      .filter(d => d >= 2 && d <= 10 && d !== parts && shaded < d), // proper fractions only
  );
  for (const d of adjDenoms) {
    if (pool.length >= 1) break;
    const f = formatFraction(shaded, d);
    if (!seen.has(f)) { seen.add(f); pool.push(f); }
  }

  // 2. Same-denom: different shaded count
  //    Forces student to count shaded parts correctly.
  const sameDenomCands = shuffleArr(
    Array.from({ length: parts }, (_, i) => i + 1)
      .filter(i => i !== shaded)
      .map(i => formatFraction(i, parts)),
  );
  for (const f of sameDenomCands) {
    if (pool.length >= 2) break;
    if (!seen.has(f)) { seen.add(f); pool.push(f); }
  }

  // 3. Common-fractions fallback (ensures we always have 3 distractors)
  const commonFracs = shuffleArr([
    '1/2', '1/3', '2/3', '1/4', '3/4', '2/5', '3/5', '4/5',
    '1/6', '5/6', '3/8', '5/8', '7/8', '1/10', '3/10', '7/10',
  ]);
  for (const f of commonFracs) {
    if (pool.length >= 3) break;
    if (!seen.has(f)) { seen.add(f); pool.push(f); }
  }

  return { options: shuffleArr([correct, ...pool.slice(0, 3)]), correct };
}

// ── FractionBar (shared display + optional interaction) ────────
// read / compare: interactive=false, shaded first N segments statically colored
// shade / equivalent: interactive=true, shadedSet is a Set of tapped indices
function FractionBar({
  parts, shaded = 0,
  interactive = false, shadedSet, onTap, feedback,
  color = '#4ade80',           // shaded color
  height = BAR_H,
}) {
  return (
    <View style={{ width: BAR_W, flexDirection: 'row', alignSelf: 'center', marginVertical: 10 }}>
      {Array.from({ length: parts }, (_, i) => {
        const isShaded = interactive ? (shadedSet?.has(i) ?? false) : i < shaded;
        const isFirst  = i === 0;
        const isLast   = i === parts - 1;

        const bgColor = (() => {
          if (feedback === 'correct' && isShaded) return '#22c55e';
          if (feedback === 'wrong'   && isShaded) return '#ef4444';
          if (isShaded) return color;
          return '#1e293b';
        })();

        return (
          <TouchableOpacity
            key={i}
            activeOpacity={interactive ? 0.65 : 1}
            disabled={!interactive || !!feedback}
            onPress={() => onTap?.(i)}
            style={{
              flex: 1,
              height,
              marginLeft:  isFirst ? 0 : SEG_GAP / 2,
              marginRight: isLast  ? 0 : SEG_GAP / 2,
              backgroundColor: bgColor,
              borderTopLeftRadius:     isFirst ? 10 : 0,
              borderBottomLeftRadius:  isFirst ? 10 : 0,
              borderTopRightRadius:    isLast  ? 10 : 0,
              borderBottomRightRadius: isLast  ? 10 : 0,
              borderWidth:  interactive && !feedback && !isShaded ? 1.5 : 0,
              borderColor:  '#334155',
              borderStyle:  'dashed',
            }}
          />
        );
      })}
    </View>
  );
}

// ── FractionLabel ──────────────────────────────────────────────
function FractionLabel({ num, den, color = '#e2e8f0', size = 22 }) {
  return (
    <View style={fbStyles.fracLabelWrap}>
      <Text style={[fbStyles.fracLabelNum, { color, fontSize: size }]}>{num}</Text>
      <View style={[fbStyles.fracLabelLine, { backgroundColor: color, width: size * 1.2 }]} />
      <Text style={[fbStyles.fracLabelDen, { color, fontSize: size }]}>{den}</Text>
    </View>
  );
}

// ── ReadMode ───────────────────────────────────────────────────
function ReadMode({ q, onResolve }) {
  const geo    = q.geometry ?? {};
  const parts  = Number(geo.parts  ?? 4);
  const shaded = Number(geo.shaded ?? 3);

  const { options, correct } = useMemo(
    () => buildReadOptions(parts, shaded),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(opt) {
    if (feedback) return;
    setChosen(opt);
    const ok = opt === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1600);
  }

  // Build a targeted explanation for the wrong answer
  function wrongExplanation(chosen) {
    const [cn, cd] = chosen.split('/').map(Number);
    const correctFrac = formatFraction(shaded, parts);
    if (cd !== parts && cn === shaded) {
      return `The bar has ${parts} equal parts total — count all the segments, not just the shaded ones. The denominator is ${parts}, not ${cd}. The answer is ${correctFrac}.`;
    }
    if (cd === parts && cn !== shaded) {
      return `Count only the green (shaded) parts — there are ${shaded}, not ${cn}. The answer is ${correctFrac}.`;
    }
    return `The bar has ${shaded} shaded parts out of ${parts} equal parts. The fraction is ${correctFrac}.`;
  }

  return (
    <View style={fbStyles.modeWrap}>
      <FractionBar parts={parts} shaded={shaded} feedback={feedback} />

      <Text style={fbStyles.instruction}>What fraction of the bar is shaded?</Text>

      <View style={measStyles.estimateGrid}>
        {options.map((opt) => {
          const isChosen  = chosen === opt;
          const isCorrect = !!feedback && opt === correct;
          const isWrong   = !!feedback && isChosen && opt !== correct;
          const isDimmed  = !!feedback && !isChosen && opt !== correct;
          const [n, d] = opt.split('/');
          return (
            <TouchableOpacity
              key={opt}
              style={[
                measStyles.estimateBtn,
                fbStyles.fractionMCBtn,
                isChosen  && measStyles.estimateBtnChosen,
                isCorrect && measStyles.estimateBtnCorrect,
                isWrong   && measStyles.estimateBtnWrong,
                isDimmed  && measStyles.estimateBtnDimmed,
              ]}
              onPress={() => handlePick(opt)}
              disabled={!!feedback}
            >
              <Text style={fbStyles.mcNum}>{n}</Text>
              <View style={fbStyles.mcLine} />
              <Text style={fbStyles.mcDen}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {feedback === 'wrong' && chosen && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            {wrongExplanation(chosen)}
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            {shaded} out of {parts} equal parts shaded — that{"'"}s {correct}! 🎉
          </Text>
        </View>
      )}
    </View>
  );
}

// ── ShadeMode ──────────────────────────────────────────────────
function ShadeMode({ q, onResolve }) {
  const geo    = q.geometry ?? {};
  const parts  = Number(geo.parts  ?? 4);
  const target = Number(geo.shaded ?? 3);

  const [tapped,   setTapped]   = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);

  function handleTap(i) {
    setTapped(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function handleCheck() {
    if (feedback) return;
    const ok = tapped.size === target;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const count   = tapped.size;
  const tooMany = count > target;
  const noneYet = count === 0;
  const counterColor = tooMany ? '#f87171' : count === target ? '#4ade80' : '#64748b';

  return (
    <View style={fbStyles.modeWrap}>
      <View style={fbStyles.targetBadge}>
        <Text style={fbStyles.targetLabel}>Shade</Text>
        <FractionLabel num={target} den={parts} color="#4ade80" size={26} />
        <Text style={fbStyles.targetLabel}>of the bar</Text>
      </View>

      <FractionBar
        parts={parts} shaded={target}
        interactive shadedSet={tapped} onTap={handleTap} feedback={feedback}
      />

      <Text style={[fbStyles.counter, { color: counterColor }]}>
        {noneYet
          ? `Tap ${target} segment${target !== 1 ? 's' : ''} to shade them`
          : tooMany
          ? `${count} tapped — too many! Tap green ones to unshade.`
          : `${count} of ${target} tapped`}
      </Text>

      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            You need exactly {target} out of {parts} segments.
            {tooMany
              ? ` You tapped ${count} — tap a green segment to remove it.`
              : ` You tapped ${count} — ${target - count} more needed.`}
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <Text style={fbStyles.correctMsg}>
          ✓ You shaded {formatFraction(target, parts)} of the bar!
        </Text>
      )}

      {!feedback && (
        <View style={[fbStyles.actionRow, { width: BAR_W }]}>
          <TouchableOpacity style={fbStyles.resetBtn} onPress={() => setTapped(new Set())}>
            <Text style={fbStyles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fbStyles.checkBtn, noneYet && fbStyles.checkBtnDisabled]}
            onPress={handleCheck}
            disabled={noneYet}
          >
            <Text style={fbStyles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── CompareMode ────────────────────────────────────────────────
// Two fraction bars stacked. Student decides which is greater — or if equal.
// Fraction labels are shown so the task is about magnitude reasoning,
// not just visual estimation.
function CompareMode({ q, onResolve }) {
  const geo     = q.geometry ?? {};
  const parts1  = Number(geo.parts   ?? 4);
  const shaded1 = Number(geo.shaded  ?? 3);
  const parts2  = Number(geo.parts2  ?? 3);
  const shaded2 = Number(geo.shaded2 ?? 2);

  // Compute correct answer independently so we never trust AI arithmetic
  const val1    = toDecimal(shaded1, parts1);
  const val2    = toDecimal(shaded2, parts2);
  const epsilon = 0.0001;
  const correct = Math.abs(val1 - val2) < epsilon ? 'equal'
    : val1 > val2 ? 'top' : 'bottom';

  const [chosen,   setChosen]   = useState(null);
  const [feedback, setFeedback] = useState(null);

  function handlePick(choice) {
    if (feedback) return;
    setChosen(choice);
    const ok = choice === correct;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const frac1 = formatFraction(shaded1, parts1);
  const frac2 = formatFraction(shaded2, parts2);

  const btnStyles = (choice) => [
    fbStyles.compareBtn,
    chosen === choice && !feedback && fbStyles.compareBtnChosen,
    feedback && choice === correct    && fbStyles.compareBtnCorrect,
    feedback && chosen === choice && choice !== correct && fbStyles.compareBtnWrong,
    feedback && chosen !== choice && choice !== correct && { opacity: 0.35 },
  ];

  return (
    <View style={fbStyles.modeWrap}>
      <Text style={fbStyles.instruction}>Which fraction is greater?</Text>

      {/* Top bar */}
      <View style={fbStyles.compareBarRow}>
        <FractionLabel num={shaded1} den={parts1} color="#60a5fa" size={20} />
        <View style={{ flex: 1 }}>
          <FractionBar parts={parts1} shaded={shaded1} color="#60a5fa" height={52} />
        </View>
      </View>

      {/* VS divider */}
      <View style={fbStyles.vsDivider}>
        <View style={fbStyles.vsDividerLine} />
        <Text style={fbStyles.vsText}>vs</Text>
        <View style={fbStyles.vsDividerLine} />
      </View>

      {/* Bottom bar */}
      <View style={fbStyles.compareBarRow}>
        <FractionLabel num={shaded2} den={parts2} color="#f472b6" size={20} />
        <View style={{ flex: 1 }}>
          <FractionBar parts={parts2} shaded={shaded2} color="#f472b6" height={52} />
        </View>
      </View>

      {/* Answer buttons */}
      <View style={fbStyles.compareRow}>
        <TouchableOpacity style={btnStyles('top')} onPress={() => handlePick('top')} disabled={!!feedback}>
          <Text style={fbStyles.compareBtnText}>◀ Top</Text>
          <Text style={fbStyles.compareBtnSub}>is greater</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[btnStyles('equal'), fbStyles.compareBtnMiddle]} onPress={() => handlePick('equal')} disabled={!!feedback}>
          <Text style={fbStyles.compareBtnText}>Equal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={btnStyles('bottom')} onPress={() => handlePick('bottom')} disabled={!!feedback}>
          <Text style={fbStyles.compareBtnText}>Bottom ▶</Text>
          <Text style={fbStyles.compareBtnSub}>is greater</Text>
        </TouchableOpacity>
      </View>

      {/* Post-answer explanation */}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            {correct === 'equal'
              ? `✓ They are equal! ${frac1} = ${frac2} = ${decimalLabel(shaded1, parts1)}`
              : correct === 'top'
              ? `✓ ${frac1} (${decimalLabel(shaded1, parts1)}) > ${frac2} (${decimalLabel(shaded2, parts2)})`
              : `✓ ${frac2} (${decimalLabel(shaded2, parts2)}) > ${frac1} (${decimalLabel(shaded1, parts1)})`}
          </Text>
        </View>
      )}
      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            {frac1} = {decimalLabel(shaded1, parts1)} and {frac2} = {decimalLabel(shaded2, parts2)}.
            {' '}{correct === 'equal'
              ? 'They are actually equal — the same amount is shaded in both bars!'
              : correct === 'top'
              ? `${frac1} is larger because ${decimalLabel(shaded1, parts1)} > ${decimalLabel(shaded2, parts2)}.`
              : `${frac2} is larger because ${decimalLabel(shaded2, parts2)} > ${decimalLabel(shaded1, parts1)}.`}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── EquivalentMode ─────────────────────────────────────────────
// Shows a reference bar (static). Student shades a second bar with a
// DIFFERENT number of parts to show the SAME fraction value.
function EquivalentMode({ q, onResolve }) {
  const geo    = q.geometry ?? {};
  const parts  = Number(geo.parts  ?? 2);
  const shaded = Number(geo.shaded ?? 1);
  const parts2 = Number(geo.parts2 ?? 4);

  // How many of parts2 should be shaded to be equivalent
  const target = Math.round((shaded / parts) * parts2);

  const [tapped,   setTapped]   = useState(() => new Set());
  const [feedback, setFeedback] = useState(null);

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
    const ok = tapped.size === target;
    setFeedback(ok ? 'correct' : 'wrong');
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(ok), ok ? 900 : 1800);
  }

  const count   = tapped.size;
  const noneYet = count === 0;

  return (
    <View style={fbStyles.modeWrap}>
      <Text style={fbStyles.instruction}>
        Shade the bottom bar to show the same fraction.
      </Text>

      {/* Reference bar */}
      <View style={fbStyles.equivSection}>
        <View style={fbStyles.equivLabelRow}>
          <Text style={fbStyles.equivSectionLabel}>REFERENCE</Text>
          <FractionLabel num={shaded} den={parts} color="#60a5fa" size={18} />
        </View>
        <FractionBar parts={parts} shaded={shaded} color="#60a5fa" height={50} />
      </View>

      {/* Equals connector */}
      <View style={fbStyles.equalsRow}>
        <View style={fbStyles.equalsLine} />
        <Text style={fbStyles.equalsSymbol}>=</Text>
        <View style={fbStyles.equalsLine} />
      </View>

      {/* Interactive bar */}
      <View style={fbStyles.equivSection}>
        <View style={fbStyles.equivLabelRow}>
          <Text style={fbStyles.equivSectionLabel}>YOUR ANSWER</Text>
          <FractionLabel
            num={count}
            den={parts2}
            color={feedback === 'correct' ? '#4ade80' : feedback === 'wrong' ? '#f87171' : '#94a3b8'}
            size={18}
          />
        </View>
        <FractionBar
          parts={parts2} shaded={target}
          interactive shadedSet={tapped} onTap={handleTap} feedback={feedback}
          color="#4ade80" height={50}
        />
      </View>

      {/* Counter */}
      <Text style={[fbStyles.counter, { color: count === target ? '#4ade80' : '#64748b' }]}>
        {noneYet ? `Tap to shade ${target} of ${parts2} parts` : `${count} of ${parts2} parts shaded`}
      </Text>

      {feedback === 'wrong' && (
        <View style={measStyles.estimateDiagnostic}>
          <Text style={measStyles.estimateDiagnosticText}>
            {formatFraction(shaded, parts)} means {shaded} out of every {parts} equal parts.
            {' '}In a bar with {parts2} parts you need to shade {target} —
            {' '}because {formatFraction(shaded, parts)} = {formatFraction(target, parts2)}.
          </Text>
        </View>
      )}
      {feedback === 'correct' && (
        <View style={measStyles.estimateBanner}>
          <Text style={measStyles.estimateBannerText}>
            ✓ {formatFraction(shaded, parts)} = {formatFraction(target, parts2)} — equivalent fractions! 🎉
          </Text>
        </View>
      )}

      {!feedback && (
        <View style={[fbStyles.actionRow, { width: BAR_W }]}>
          <TouchableOpacity style={fbStyles.resetBtn} onPress={() => setTapped(new Set())}>
            <Text style={fbStyles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fbStyles.checkBtn, noneYet && fbStyles.checkBtnDisabled]}
            onPress={handleCheck}
            disabled={noneYet}
          >
            <Text style={fbStyles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Main export ────────────────────────────────────────────────
export default function FractionBarRenderer({ q, onResolve }) {
  const mode = q.geometry?.mode ?? 'read';
  if (mode === 'shade')      return <ShadeMode      q={q} onResolve={onResolve} />;
  if (mode === 'compare')    return <CompareMode     q={q} onResolve={onResolve} />;
  if (mode === 'equivalent') return <EquivalentMode  q={q} onResolve={onResolve} />;
  return                            <ReadMode        q={q} onResolve={onResolve} />;
}

// ── Styles ─────────────────────────────────────────────────────
const fbStyles = StyleSheet.create({
  modeWrap: {
    alignItems: 'center', paddingBottom: 8,
  },

  instruction: {
    fontSize: 14, fontWeight: '600', color: '#94a3b8',
    textAlign: 'center', marginBottom: 4,
  },

  // Stacked fraction label (numerator / line / denominator)
  fracLabelWrap: {
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },
  fracLabelNum: {
    fontWeight: '900', lineHeight: 26,
  },
  fracLabelLine: {
    height: 2, borderRadius: 1, marginVertical: 1,
  },
  fracLabelDen: {
    fontWeight: '900', lineHeight: 26,
  },

  // Read mode — MC buttons with stacked fraction notation
  fractionMCBtn: {
    paddingVertical: 16, gap: 2,
  },
  mcNum:  { fontSize: 20, fontWeight: '900', color: '#e2e8f0', lineHeight: 22 },
  mcLine: { width: 32, height: 2, backgroundColor: '#64748b', borderRadius: 1 },
  mcDen:  { fontSize: 20, fontWeight: '900', color: '#e2e8f0', lineHeight: 22 },

  // Shade / Equivalent mode
  targetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1e293b', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#4ade80',
    paddingVertical: 8, paddingHorizontal: 16,
    marginBottom: 4,
  },
  targetLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },

  counter: {
    fontSize: 13, fontWeight: '600',
    textAlign: 'center', marginTop: 2, marginBottom: 8,
  },

  correctMsg: {
    fontSize: 15, fontWeight: '700', color: '#4ade80',
    textAlign: 'center', marginTop: 8,
  },

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

  // ── Compare mode ──────────────────────────────────────────────
  compareBarRow: {
    flexDirection: 'row', alignItems: 'center', width: BAR_W + 50,
    paddingLeft: 4,
  },
  vsDivider: {
    flexDirection: 'row', alignItems: 'center', width: BAR_W + 50,
    marginVertical: 2,
  },
  vsDividerLine: { flex: 1, height: 1, backgroundColor: '#1e293b' },
  vsText: { fontSize: 12, fontWeight: '800', color: '#475569', marginHorizontal: 10 },

  compareRow: {
    flexDirection: 'row', gap: 8, marginTop: 12, width: BAR_W,
  },
  compareBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#334155', gap: 2,
  },
  compareBtnMiddle: {
    paddingVertical: 14,
  },
  compareBtnChosen:  { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)' },
  compareBtnCorrect: { backgroundColor: '#14532d', borderColor: '#22c55e' },
  compareBtnWrong:   { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  compareBtnText: { fontSize: 13, fontWeight: '800', color: '#e2e8f0' },
  compareBtnSub:  { fontSize: 10, fontWeight: '600', color: '#94a3b8' },

  // ── Equivalent mode ───────────────────────────────────────────
  equivSection: {
    width: BAR_W + 50,
  },
  equivLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, paddingLeft: 4,
  },
  equivSectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#475569',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  equalsRow: {
    flexDirection: 'row', alignItems: 'center', width: BAR_W + 50,
    marginVertical: 4,
  },
  equalsLine: { flex: 1, height: 1, backgroundColor: '#1e293b' },
  equalsSymbol: {
    fontSize: 20, fontWeight: '900', color: '#64748b', marginHorizontal: 12,
  },
});
