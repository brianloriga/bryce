import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji:    '📸',
    title:    'Scan any textbook',
    subtitle: 'Point your camera at any page and AI instantly writes 9 practice questions from the content.',
    bg:       '#0f2027',
    accent:   '#4ade80',
  },
  {
    emoji:    '👧🏽👦🏻',
    title:    'One account, every kid',
    subtitle: 'Create a profile for each child. Progress saves to the cloud so learning follows them everywhere.',
    bg:       '#1a0533',
    accent:   '#c084fc',
  },
  {
    emoji:    '⭐',
    title:    'Watch them shine',
    subtitle: 'Kids earn stars, beat scores, and build confidence one quiz at a time. You can see it all.',
    bg:       '#001f3f',
    accent:   '#60a5fa',
  },
];

export default function OnboardingScreen() {
  const navigation   = useNavigation();
  const scrollRef    = useRef(null);
  const [index, setIndex] = useState(0);
  const dotAnim = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  function goTo(next) {
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    Animated.parallel([
      Animated.timing(dotAnim[index], { toValue: 0, duration: 200, useNativeDriver: false }),
      Animated.timing(dotAnim[next],  { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
    setIndex(next);
  }

  async function finish() {
    await AsyncStorage.setItem('@snapstudy_onboarding_done', '1');
    navigation.replace('KidSelect');
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: slide.bg }]}>
      <StatusBar style="light" />

      {/* Skip */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Text style={styles.slideEmoji}>{s.emoji}</Text>
            <Text style={[styles.slideTitle, { color: s.accent }]}>{s.title}</Text>
            <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const dotWidth = dotAnim[i].interpolate({
            inputRange: [0, 1], outputRange: [8, 24],
          });
          const dotOpacity = dotAnim[i].interpolate({
            inputRange: [0, 1], outputRange: [0.35, 1],
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: slide.accent }]}
            />
          );
        })}
      </View>

      {/* Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
          onPress={isLast ? finish : () => goTo(index + 1)}
          activeOpacity={0.85}
        >
          <Text style={[styles.nextBtnText, { color: slide.bg }]}>
            {isLast ? "Let's go →" : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },

  topBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4,
  },
  skipBtn:  { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontSize: 15, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },

  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingBottom: 32,
  },
  slideEmoji:    { fontSize: 90, marginBottom: 32, textAlign: 'center' },
  slideTitle:    { fontSize: 30, fontWeight: '900', textAlign: 'center', marginBottom: 16 },
  slideSubtitle: {
    fontSize: 17, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', lineHeight: 26,
  },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6, marginBottom: 24,
  },
  dot: { height: 8, borderRadius: 4 },

  bottomBar: { paddingHorizontal: 24, paddingBottom: 24 },
  nextBtn: {
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 8,
  },
  nextBtnText: { fontSize: 18, fontWeight: '800' },
});
