import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/supabase';
import { getParentPin, setParentPin } from '../utils/pinStorage';

// ─────────────────────────────────────────────────────────────
// PIN PAD COMPONENT
// ─────────────────────────────────────────────────────────────
function PinPad({ onComplete, title, subtitle, error, onForgot }) {
  const [digits, setDigits] = useState([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      setDigits([]);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  function tap(n) {
    if (digits.length >= 4) return;
    const next = [...digits, n];
    setDigits(next);
    if (next.length === 4) onComplete(next.join(''));
  }

  function del() { setDigits(prev => prev.slice(0, -1)); }

  return (
    <View style={pin.container}>
      <Text style={pin.title}>{title}</Text>
      {subtitle ? <Text style={pin.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[pin.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[pin.dot, digits.length > i && pin.dotFilled]} />
        ))}
      </Animated.View>

      {error ? <Text style={pin.errorText}>{error}</Text> : null}

      <View style={pin.grid}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <TouchableOpacity key={n} style={pin.key} onPress={() => tap(String(n))}>
            <Text style={pin.keyText}>{n}</Text>
          </TouchableOpacity>
        ))}
        <View style={pin.keyEmpty} />
        <TouchableOpacity style={pin.key} onPress={() => tap('0')}>
          <Text style={pin.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={pin.key} onPress={del}>
          <Text style={pin.keyText}>⌫</Text>
        </TouchableOpacity>
      </View>

      {onForgot && (
        <TouchableOpacity onPress={onForgot} style={pin.forgotBtn}>
          <Text style={pin.forgotText}>I forgot my PIN</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// ACCOUNT SCREEN
// ─────────────────────────────────────────────────────────────
export default function AccountScreen() {
  const navigation = useNavigation();
  const { user, activeKid, kidProfiles, isLoggedIn } = useAuth();

  const [pinState, setPinState]       = useState('checking'); // 'checking' | 'locked' | 'setup1' | 'setup2' | 'unlocked'
  const [setupPin, setSetupPin]       = useState('');
  const [pinError, setPinError]       = useState('');

  // Re-lock every time Account tab is focused
  useFocusEffect(
    useCallback(() => {
      checkPin();
    }, [])
  );

  async function checkPin() {
    const saved = await getParentPin();
    if (!saved) {
      // No PIN set yet — unlock but prompt to set one
      setPinState('unlocked');
    } else {
      setPinState('locked');
      setPinError('');
    }
  }

  async function handleEnterPin(entered) {
    const saved = await getParentPin();
    if (entered === saved) {
      setPinState('unlocked');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Try again.');
    }
  }

  function handleSetupPin1(entered) {
    setSetupPin(entered);
    setPinState('setup2');
    setPinError('');
  }

  async function handleSetupPin2(entered) {
    if (entered !== setupPin) {
      setPinError('PINs don\'t match. Start again.');
      setPinState('setup1');
      setSetupPin('');
      return;
    }
    await setParentPin(entered);
    setPinState('unlocked');
    setPinError('');
    Alert.alert('PIN saved', 'Your parent PIN is set. Kids will need this PIN to access Account settings.');
  }

  function handleForgotPin() {
    Alert.alert(
      'Reset PIN',
      'To reset your PIN you\'ll need to sign out and sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out & Reset', style: 'destructive',
          onPress: async () => {
            await signOut();
            setPinState('setup1');
          },
        },
      ]
    );
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch (err) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  }

  // ── PIN states ──────────────────────────────────────────────
  if (pinState === 'checking') {
    return <View style={styles.safe} />;
  }

  if (pinState === 'locked') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <PinPad
          title="Parent Area 🔒"
          subtitle="Enter your PIN to continue"
          error={pinError}
          onComplete={handleEnterPin}
          onForgot={handleForgotPin}
        />
      </SafeAreaView>
    );
  }

  if (pinState === 'setup1') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <PinPad
          title="Set a Parent PIN 🔑"
          subtitle="Choose a 4-digit PIN to protect this area"
          error={pinError}
          onComplete={handleSetupPin1}
        />
      </SafeAreaView>
    );
  }

  if (pinState === 'setup2') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <PinPad
          title="Confirm your PIN ✅"
          subtitle="Enter the same PIN again"
          error={pinError}
          onComplete={handleSetupPin2}
        />
      </SafeAreaView>
    );
  }

  // ── Unlocked — full account screen ─────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Account</Text>
          <TouchableOpacity
            style={styles.lockBtn}
            onPress={async () => {
              const saved = await getParentPin();
              if (saved) {
                setPinState('locked');
              } else {
                setPinState('setup1');
              }
            }}
          >
            <Text style={styles.lockBtnText}>🔒 Lock</Text>
          </TouchableOpacity>
        </View>

        {/* No PIN set — prompt */}
        {!isLoggedIn ? null : (
          <TouchableOpacity
            style={styles.pinBanner}
            onPress={() => setPinState('setup1')}
          >
            <Text style={styles.pinBannerEmoji}>🔑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinBannerTitle}>Set a Parent PIN</Text>
              <Text style={styles.pinBannerDesc}>Prevent kids from changing account settings</Text>
            </View>
            <Text style={styles.pinBannerArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Profile */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarEmoji}>{activeKid?.avatar ?? '👤'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {isLoggedIn ? (
              <>
                <Text style={styles.userName}>{activeKid?.name ?? 'No profile selected'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </>
            ) : (
              <>
                <Text style={styles.userName}>Guest</Text>
                <Text style={styles.userEmail}>Progress saved locally only</Text>
              </>
            )}
          </View>
        </View>

        {/* Auth actions */}
        {isLoggedIn ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
            <Text style={styles.dangerBtnText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.primaryBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        )}

        {/* Kids section */}
        {isLoggedIn && (
          <>
            <Text style={styles.sectionTitle}>Child Profiles</Text>
            <View style={styles.card}>
              {kidProfiles.map(kid => (
                <View key={kid.id} style={[styles.kidRow, activeKid?.id === kid.id && styles.kidRowActive]}>
                  <Text style={styles.kidAvatar}>{kid.avatar}</Text>
                  <Text style={styles.kidName}>{kid.name}</Text>
                  {activeKid?.id === kid.id && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Playing</Text>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.manageKidsBtn}
                onPress={() => navigation.navigate('KidSelect', { mode: 'manage' })}
              >
                <Text style={styles.manageKidsBtnText}>＋  Manage Profiles</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.card}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>FREE PLAN</Text>
          </View>
          <Text style={styles.planTitle}>BryceLearning Basic</Text>
          <Text style={styles.planDesc}>All built-in units included. Upgrade for AI scanning.</Text>
          <TouchableOpacity style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>⚡  Upgrade — $4.99/month</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          {[
            { label: 'Privacy Policy', icon: '🔒' },
            { label: 'Terms of Service', icon: '📄' },
            { label: 'Restore Purchases', icon: '🔄' },
            { label: 'App Version 1.0.0', icon: 'ℹ️' },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.listRow, i < arr.length - 1 && styles.listRowBorder]}
            >
              <Text style={styles.listIcon}>{item.icon}</Text>
              <Text style={styles.listLabel}>{item.label}</Text>
              <Text style={styles.listArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 60 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  pageTitle: { fontSize: 30, fontWeight: '800', color: '#0f172a' },
  lockBtn: {
    backgroundColor: '#f1f5f9', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  lockBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },

  pinBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fefce8', borderRadius: 14,
    borderWidth: 1, borderColor: '#fde68a',
    padding: 14, marginBottom: 16,
  },
  pinBannerEmoji: { fontSize: 22 },
  pinBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  pinBannerDesc:  { fontSize: 12, color: '#a16207', marginTop: 1 },
  pinBannerArrow: { fontSize: 20, color: '#a16207' },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  userName:    { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  userEmail:   { fontSize: 13, color: '#64748b', marginTop: 1 },

  primaryBtn: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginBottom: 20,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  dangerBtn: {
    backgroundColor: '#fee2e2', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginBottom: 24,
  },
  dangerBtnText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 8,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  kidRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  kidRowActive: { backgroundColor: '#eff6ff' },
  kidAvatar: { fontSize: 24, marginRight: 12 },
  kidName:   { flex: 1, fontSize: 16, fontWeight: '600', color: '#1e293b' },
  activeBadge: {
    backgroundColor: '#2563eb', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  manageKidsBtn: {
    paddingVertical: 14, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  manageKidsBtnText: { fontSize: 14, fontWeight: '700', color: '#2563eb' },

  planBadge: {
    backgroundColor: '#dbeafe', borderRadius: 6, margin: 16, marginBottom: 6,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
  },
  planBadgeText: { fontSize: 11, fontWeight: '700', color: '#1e40af', letterSpacing: 0.5 },
  planTitle:     { fontSize: 17, fontWeight: '700', color: '#1e293b', paddingHorizontal: 16, marginBottom: 4 },
  planDesc:      { fontSize: 13, color: '#64748b', paddingHorizontal: 16, marginBottom: 14 },
  upgradeBtn: {
    backgroundColor: '#f59e0b', margin: 16, marginTop: 0,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listIcon:  { fontSize: 18, marginRight: 12, width: 26 },
  listLabel: { flex: 1, fontSize: 15, color: '#1e293b' },
  listArrow: { fontSize: 20, color: '#94a3b8' },
});

// PIN pad styles
const pin = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingBottom: 24,
  },
  title:    { fontSize: 26, fontWeight: '800', color: '#0f172a', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 28, textAlign: 'center' },

  dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#cbd5e1', backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#2563eb', borderColor: '#2563eb' },

  errorText: { fontSize: 13, color: '#ef4444', fontWeight: '600', marginBottom: 12, height: 18 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    width: 280, gap: 12, marginTop: 12,
  },
  key: {
    width: 80, height: 72, borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  keyEmpty: { width: 80, height: 72 },
  keyText:  { fontSize: 24, fontWeight: '600', color: '#1e293b' },

  forgotBtn: { marginTop: 24 },
  forgotText: { fontSize: 14, color: '#94a3b8', fontWeight: '600', textDecorationLine: 'underline' },
});
