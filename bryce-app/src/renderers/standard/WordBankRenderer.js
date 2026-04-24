import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

export default function WordBankRenderer({ q, onResolve, styles }) {
  const [filled, setFilled]     = useState(null);
  const [feedback, setFeedback] = useState(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const wordBank  = q.wordBank ?? [];

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function tapWord(word) {
    if (feedback) return;
    setFilled(word);
    const isCorrect = word.toLowerCase().trim() === (q.correctAnswer ?? '').toLowerCase().trim();
    setFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else         { shake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  function clearChoice() {
    if (feedback) return;
    setFilled(null);
  }

  const parts = (q.question ?? '').split('____');

  return (
    <View>
      <Text style={styles.wbBankLabel}>Word Bank:</Text>
      <View style={styles.wbBank}>
        {wordBank.map((word, i) => {
          const isCorrectWord = word.toLowerCase() === (q.correctAnswer ?? '').toLowerCase();
          const isSelected    = filled === word;
          const dim           = !!feedback && !isSelected;
          return (
            <TouchableOpacity key={i}
              style={[
                styles.wbChip,
                isSelected && !feedback && styles.wbChipSelected,
                feedback && isCorrectWord && styles.wbChipCorrect,
                feedback && isSelected && !isCorrectWord && styles.wbChipWrong,
                dim && styles.wbChipDim,
              ]}
              onPress={() => tapWord(word)} disabled={!!feedback} activeOpacity={0.75}>
              <Text style={[styles.wbChipText, (feedback && isCorrectWord) && { color: '#fff' }, (feedback && isSelected && !isCorrectWord) && { color: '#fff' }]}>
                {word}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Animated.View style={[styles.wbSentenceCard, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.wbSentence}>
          {parts[0]}
          <Text style={[
            styles.wbBlank,
            filled && !feedback && styles.wbBlankFilled,
            feedback === 'correct' && styles.wbBlankCorrect,
            feedback === 'wrong'   && styles.wbBlankWrong,
          ]}>
            {filled ?? '________'}
          </Text>
          {parts[1] ?? ''}
        </Text>
      </Animated.View>

      {filled && !feedback && (
        <TouchableOpacity style={styles.wbClear} onPress={clearChoice}>
          <Text style={styles.wbClearText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
