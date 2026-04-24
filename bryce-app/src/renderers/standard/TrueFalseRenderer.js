import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TrueFalseRenderer({ q, onResolve, styles }) {
  const [selected, setSelected] = useState(null);
  const correct = q.correctAnswer === true;

  function handleTap(val) {
    if (selected !== null) return;
    setSelected(val);
    const isCorrect = val === correct;
    if (isCorrect) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => onResolve(isCorrect), 1400);
  }

  function btnStyle(val) {
    if (selected === null) return val ? styles.tfTrue : styles.tfFalse;
    if (val === correct)   return val ? styles.tfTrueCorrect : styles.tfFalseCorrect;
    if (val === selected)  return val ? styles.tfTrueWrong   : styles.tfFalseWrong;
    return [val ? styles.tfTrue : styles.tfFalse, styles.tfDimmed];
  }

  return (
    <View style={styles.tfRow}>
      <TouchableOpacity style={btnStyle(true)}  onPress={() => handleTap(true)}  disabled={selected !== null} activeOpacity={0.8}>
        <Ionicons name="checkmark" size={28} color="#fff" />
        <Text style={styles.tfBtnText}>True</Text>
      </TouchableOpacity>
      <TouchableOpacity style={btnStyle(false)} onPress={() => handleTap(false)} disabled={selected !== null} activeOpacity={0.8}>
        <Ionicons name="close" size={28} color="#fff" />
        <Text style={styles.tfBtnText}>False</Text>
      </TouchableOpacity>
    </View>
  );
}
