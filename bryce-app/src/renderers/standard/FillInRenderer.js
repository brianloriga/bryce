import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TextInput, TouchableOpacity, Animated, Keyboard, StyleSheet } from 'react-native';
import { isFuzzyMatch } from '../../utils/quizHelpers';
import FractionText from '../../components/FractionText';

// ── Fraction equivalence check ────────────────────────────────
function parseFrac(str) {
  const s = String(str).trim();
  if (s.includes('/')) {
    const [n, d] = s.split('/').map(Number);
    if (!isNaN(n) && !isNaN(d) && d !== 0) return n / d;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function fractionsEqual(a, b) {
  const va = parseFrac(a);
  const vb = parseFrac(b);
  if (va === null || vb === null) return false;
  return Math.abs(va - vb) < 1e-9;
}

// Returns true if the expected answer looks like a simple fraction "num/den"
function isFractionQuestion(q) {
  const ca = String(q.correctAnswer ?? '').trim();
  return /^\d+\/\d+$/.test(ca);
}

// ── Split fraction input ──────────────────────────────────────
// Two number-pad fields (numerator / denominator) separated by a fraction bar.
// Much more natural for students than typing "3/4" with the slash keyboard.
function FractionInput({ onValueChange, feedback, onSubmit }) {
  const [num, setNum] = useState('');
  const [den, setDen] = useState('');
  const denRef = useRef(null);

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';
  const numColor  = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#f1f5f9';
  const barColor  = isCorrect ? '#4ade80' : isWrong ? '#f87171' : '#60a5fa';

  function handleNumChange(v) {
    const cleaned = v.replace(/[^0-9]/g, '');
    setNum(cleaned);
    onValueChange(cleaned + '/' + den);
  }

  function handleDenChange(v) {
    const cleaned = v.replace(/[^0-9]/g, '');
    setDen(cleaned);
    onValueChange(num + '/' + cleaned);
  }

  return (
    <View style={fracStyles.container}>
      {/* Numerator */}
      <TextInput
        style={[fracStyles.field, { color: numColor }]}
        value={num}
        onChangeText={handleNumChange}
        keyboardType="number-pad"
        placeholder="?"
        placeholderTextColor="#475569"
        editable={!feedback}
        returnKeyType="next"
        onSubmitEditing={() => denRef.current?.focus()}
        autoFocus
        maxLength={4}
        textAlign="center"
      />

      {/* Fraction bar */}
      <View style={[fracStyles.bar, { backgroundColor: barColor }]} />

      {/* Denominator */}
      <TextInput
        ref={denRef}
        style={[fracStyles.field, { color: numColor }]}
        value={den}
        onChangeText={handleDenChange}
        keyboardType="number-pad"
        placeholder="?"
        placeholderTextColor="#475569"
        editable={!feedback}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        maxLength={4}
        textAlign="center"
      />
    </View>
  );
}

const fracStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 12,
    minWidth: 100,
    alignSelf: 'center',
  },
  field: {
    fontSize: 32,
    fontWeight: '700',
    width: 100,
    paddingVertical: 4,
    textAlign: 'center',
  },
  bar: {
    height: 2.5,
    width: 80,
    borderRadius: 2,
    marginVertical: 4,
  },
});

// ── Main renderer ─────────────────────────────────────────────
export default function FillInRenderer({ q, onResolve, styles }) {
  const [value, setValue]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const useFracInput = isFractionQuestion(q);

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleSubmit() {
    if (feedback || !value.trim()) return;
    Keyboard.dismiss();
    const norm  = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const ans   = norm(value);
    const all   = [q.correctAnswer, ...(q.acceptedAnswers ?? [])];
    const allNorm = all.map(norm);

    const correct = allNorm.includes(ans)
      || allNorm.some(c => isFuzzyMatch(ans, c))
      || all.some(c => fractionsEqual(ans, c));

    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => onResolve(correct), 1400);
  }

  const isCorrect = feedback === 'correct';
  const isWrong   = feedback === 'wrong';

  // The fraction input considers the answer ready when both parts are filled
  const fracReady = useFracInput && value.includes('/') && value.split('/')[0]?.trim() && value.split('/')[1]?.trim();
  const textReady = !useFracInput && value.trim();

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>

      {useFracInput ? (
        <FractionInput
          onValueChange={setValue}
          feedback={feedback}
          onSubmit={handleSubmit}
        />
      ) : (
        <View style={[
          styles.fillInBox,
          isCorrect && styles.fillInBoxCorrect,
          isWrong   && styles.fillInBoxWrong,
        ]}>
          <TextInput
            style={[styles.fillInInput, isCorrect && { color: '#4ade80' }, isWrong && { color: '#f87171' }]}
            value={value}
            onChangeText={setValue}
            placeholder="Type your answer…"
            placeholderTextColor="#475569"
            editable={!feedback}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>
      )}

      {isWrong && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct answer:</Text>
          <FractionText style={styles.fillInRevealAnswer} fontSize={20} centered>
            {q.correctAnswer}
          </FractionText>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct!</Text>}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, !(fracReady || textReady) && { opacity: 0.45 }]}
          onPress={handleSubmit}
          disabled={!(fracReady || textReady)}
          activeOpacity={0.8}
        >
          <Text style={styles.fillInSubmitText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
