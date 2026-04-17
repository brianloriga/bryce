import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { signIn, signUp } from '../services/supabase';

export default function AuthScreen({ route }) {
  const [mode, setMode]             = useState(route?.params?.initialMode ?? 'signin'); // 'signin' | 'signup'
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [consentChecked, setConsent] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleSubmit() {
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    if (mode === 'signup' && password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (mode === 'signup' && !consentChecked) {
      setErrorMsg('Please confirm you are a parent or guardian to create an account.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password);
        setSuccessMsg('Account created! Check your email for a confirmation link, then sign in.');
        setMode('signin');
        setPassword(''); setConfirm('');
      } else {
        await signIn(email.trim(), password);
        // AuthContext listener will pick up the new session automatically
      }
    } catch (err) {
      console.error('[AuthScreen] error:', err);
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/appicon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>
              <Text style={styles.namePart1}>Snap</Text>
              <Text style={styles.namePart2}>Study</Text>
            </Text>
            <Text style={styles.tagline}>
              {mode === 'signup'
                ? 'Create a parent account to get started!'
                : 'Welcome back! Sign in to continue.'}
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === 'signup' ? 'Create Account' : 'Sign In'}
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="parent@email.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={styles.consentRow}
                  onPress={() => setConsent(v => !v)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, consentChecked && styles.checkboxChecked]}>
                    {consentChecked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.consentText}>
                    I confirm I am a parent or guardian (18+) creating this account for my child's use.
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}
            {successMsg ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {successMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>
                    {mode === 'signup' ? 'Create Account →' : 'Sign In →'}
                  </Text>
              }
            </TouchableOpacity>

            {mode === 'signup' && (
              <Text style={styles.legalNote}>
                By creating an account you agree to our Terms of Service and Privacy Policy.
                This account is for parents — children do not need their own accounts.
              </Text>
            )}
          </View>

          {/* Toggle mode */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
            </Text>
            <TouchableOpacity onPress={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setPassword(''); setConfirm('');
            }}>
              <Text style={styles.switchLink}>
                {mode === 'signup' ? ' Sign In' : ' Create one'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.guestNote}>
            You can also play as a guest — progress won't sync across devices.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  kav: { flex: 1 },
  scroll: {
    padding: 24,
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 10,
  },
  appName: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  namePart1: { color: '#4ade80' },
  namePart2: { color: '#c084fc' },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
  },
  successBox: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.3)',
  },
  successText: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '500',
  },
  consentRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 16, marginTop: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#16a34a', borderColor: '#16a34a',
  },
  checkmark: { fontSize: 13, fontWeight: '800', color: '#fff' },
  consentText: {
    flex: 1, fontSize: 13,
    color: 'rgba(255,255,255,0.65)', lineHeight: 19,
  },
  legalNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c084fc',
    textDecorationLine: 'underline',
  },
  guestNote: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
