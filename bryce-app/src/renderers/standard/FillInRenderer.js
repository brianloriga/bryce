import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TextInput, TouchableOpacity, Animated, Keyboard } from 'react-native';
import { isFuzzyMatch } from '../../utils/quizHelpers';

export default function FillInRenderer({ q, onResolve, styles }) {
  const [value, setValue]       = useState('');
  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

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
    const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const ans  = norm(value);
    const all  = [q.correctAnswer, ...(q.acceptedAnswers ?? [])].map(norm);
    const correct = all.includes(ans) || all.some(c => isFuzzyMatch(ans, c));
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

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
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

      {isWrong && (
        <View style={styles.fillInReveal}>
          <Text style={styles.fillInRevealLabel}>Correct answer:</Text>
          <Text style={styles.fillInRevealAnswer}>{q.correctAnswer}</Text>
        </View>
      )}
      {isCorrect && <Text style={styles.fillInCorrectMsg}>Correct!</Text>}

      {!feedback && (
        <TouchableOpacity
          style={[styles.fillInSubmit, !value.trim() && { opacity: 0.45 }]}
          onPress={handleSubmit} disabled={!value.trim()} activeOpacity={0.8}>
          <Text style={styles.fillInSubmitText}>Check Answer</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
