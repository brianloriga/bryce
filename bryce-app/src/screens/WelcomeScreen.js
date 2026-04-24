import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Animated, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';


// ── Floating bubbles ──────────────────────────────────────────
const BUBBLES = [
  { size: 100, top: '2%',  left: '-5%',  color: 'rgba(134,239,172,0.12)', delay: 0    },
  { size: 70,  top: '8%',  right: '0%',  color: 'rgba(167,139,250,0.15)', delay: 500  },
  { size: 50,  top: '28%', left: '2%',   color: 'rgba(74,222,128,0.12)',  delay: 900  },
  { size: 80,  top: '52%', right: '-8%', color: 'rgba(192,132,252,0.13)', delay: 300  },
  { size: 55,  top: '68%', left: '5%',   color: 'rgba(134,239,172,0.10)', delay: 700  },
  { size: 45,  top: '83%', right: '15%', color: 'rgba(167,139,250,0.12)', delay: 1100 },
  { size: 90,  top: '38%', left: '72%',  color: 'rgba(74,222,128,0.08)',  delay: 200  },
];

function FloatingBubble({ size, top, left, right, color, delay }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -16, duration: 3200, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0,   duration: 3200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, left, right },
        { transform: [{ translateY: y }] },
      ]}
    />
  );
}

// ── Welcome Screen ────────────────────────────────────────────
export default function WelcomeScreen({ navigation }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(48)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Bubbles */}
      {BUBBLES.map((b, i) => <FloatingBubble key={i} {...b} />)}

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: slide }] }]}>

            {/* Icon */}
            <Image
              source={require('../../assets/appicon.png')}
              style={styles.icon}
              resizeMode="contain"
            />

            {/* Name */}
            <Text style={styles.appName}>
              <Text style={styles.namePart1}>Snap</Text>
              <Text style={styles.namePart2}>Study</Text>
            </Text>

            {/* CTAs */}
            <View style={styles.ctaArea}>
              <TouchableOpacity
                style={styles.btnSignIn}
                onPress={() => navigation.navigate('Auth', { initialMode: 'signin' })}
                activeOpacity={0.85}
              >
                <Text style={styles.btnSignInText}>Sign In →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnCreate}
                onPress={() => navigation.navigate('Auth', { initialMode: 'signup' })}
                activeOpacity={0.85}
              >
                <Text style={styles.btnCreateText}>Create Account</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.footNote}>
              Parents sign in — kids just tap their picture!
            </Text>

            {/* Dev-only shortcut — visible only in __DEV__ builds */}
            {__DEV__ && (
              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => navigation.navigate('DevPreview')}
                activeOpacity={0.7}
              >
                <Text style={styles.devBtnText}>🔧 Dev Preview</Text>
              </TouchableOpacity>
            )}

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  safe: { flex: 1 },
  bubble: { position: 'absolute' },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    width: Platform.OS === 'web' ? 200 : '48%',
    height: Platform.OS === 'web' ? 200 : undefined,
    aspectRatio: Platform.OS === 'web' ? undefined : 1,
    marginBottom: 12,
  },

  appName: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 48,
  },
  namePart1: { color: '#4ade80' },  // green-400 — accessible on dark
  namePart2: { color: '#c084fc' },  // purple-400 — accessible on dark

  ctaArea: {
    width: '100%',
    gap: 14,
    marginBottom: 28,
  },
  btnSignIn: {
    backgroundColor: '#16a34a',   // green-700 — WCAG AA with white text
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  btnSignInText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnCreate: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a855f7',  // purple-500
  },
  btnCreateText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c084fc',  // purple-400
  },

  footNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
  },
  devBtn: {
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  devBtnText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
});
