import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signOut } from '../services/supabase';
import { getParentPin, setParentPin, clearParentPin } from '../utils/pinStorage';
import KidAvatar from '../components/KidAvatar';

// ─────────────────────────────────────────────────────────────
// PIN PAD (theme-aware)
// ─────────────────────────────────────────────────────────────
function PinPad({ onComplete, title, subtitle, error, onForgot, theme }) {
  const [digits, setDigits]   = useState([]);
  const [waiting, setWaiting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => createPinStyles(theme), [theme]);

  useEffect(() => {
    if (error) {
      setDigits([]);
      setWaiting(false);
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
    if (digits.length >= 4 || waiting) return;
    const next = [...digits, n];
    setDigits(next);
    if (next.length === 4) {
      setWaiting(true);
      setTimeout(() => {
        setDigits([]);
        setWaiting(false);
        onComplete(next.join(''));
      }, 220);
    }
  }

  function del() {
    if (waiting) return;
    setDigits(prev => prev.slice(0, -1));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[styles.dot, digits.length > i && styles.dotFilled]} />
        ))}
      </Animated.View>

      {error ? <Text style={styles.errorText}>{error}</Text> : <View style={styles.errorSpacer} />}

      <View style={styles.grid}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <TouchableOpacity key={n} style={styles.key} onPress={() => tap(String(n))}>
            <Text style={styles.keyText}>{n}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyEmpty} />
        <TouchableOpacity style={styles.key} onPress={() => tap('0')}>
          <Text style={styles.keyText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={del}>
          <Ionicons name="backspace-outline" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      {onForgot && (
        <TouchableOpacity onPress={onForgot} style={styles.forgotBtn}>
          <Text style={styles.forgotText}>I forgot my PIN</Text>
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
  const { theme, toggleTheme, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const lottieRef   = useRef(null);
  const animatingRef = useRef(false);
  // Plain number (0-1) for static display. Light = frame 30, Dark = frame 115, total = 481.
  const [lottieProgress, setLottieProgress] = useState(() => isDark ? 115 / 481 : 30 / 481);

  const [pinState, setPinState] = useState('checking');
  const [setupPin, setSetupPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [hasPin, setHasPin]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkPin();
    }, [])
  );

  async function checkPin() {
    const saved = await getParentPin();
    setHasPin(!!saved);
    setPinState(saved ? 'locked' : 'unlocked');
    setPinError('');
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
      setSetupPin('');
      setPinState('setup1');
      setPinError("PINs didn't match — please try again.");
      return;
    }
    await setParentPin(entered);
    setSetupPin('');
    setHasPin(true);
    setPinState('unlocked');
    setPinError('');
  }

  function handleRemovePin() {
    Alert.alert(
      'Remove PIN',
      'This will disable the parent lock. Anyone can access Account settings without a PIN.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove PIN', style: 'destructive',
          onPress: async () => {
            await clearParentPin();
            setHasPin(false);
          },
        },
      ]
    );
  }

  function handleForgotPin() {
    Alert.alert(
      'Reset PIN',
      "To reset your PIN you'll need to sign out and sign back in.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out & Reset', style: 'destructive',
          onPress: async () => { await signOut(); setPinState('setup1'); },
        },
      ]
    );
  }

  function handleThemeToggle() {
    if (animatingRef.current) return;
    animatingRef.current = true;
    if (isDark) {
      lottieRef.current?.play(300, 385); // moon → sun
    } else {
      lottieRef.current?.play(30, 115);  // sun → moon
    }
    toggleTheme();
  }

  function handleLottieFinish() {
    animatingRef.current = false;
    // isDark is now the NEW value; lock progress to the correct static frame
    setLottieProgress(isDark ? 115 / 481 : 30 / 481);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            await clearParentPin();
            await signOut();
          } catch (err) { Alert.alert('Error', err.message); }
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
        <StatusBar style={theme.statusBar} />
        <PinPad theme={theme}
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
        <StatusBar style={theme.statusBar} />
        <PinPad theme={theme}
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
        <StatusBar style={theme.statusBar} />
        <PinPad theme={theme}
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
      <StatusBar style={theme.statusBar} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Account</Text>
          <TouchableOpacity
            style={styles.lockBtn}
            onPress={async () => {
              const saved = await getParentPin();
              setPinState(saved ? 'locked' : 'setup1');
            }}
          >
            <Ionicons name="lock-closed-outline" size={14} color={theme.textSub} style={{ marginRight: 5 }} />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>

        {/* PIN banner */}
        {isLoggedIn && (
          <>
            <TouchableOpacity
              style={[styles.pinBanner, hasPin && styles.pinBannerSet]}
              onPress={() => setPinState('setup1')}
            >
              <Text style={styles.pinBannerEmoji}>{hasPin ? '🔐' : '🔑'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pinBannerTitle, hasPin && styles.pinBannerTitleSet]}>
                  {hasPin ? 'Reset Parent PIN' : 'Set a Parent PIN'}
                </Text>
                <Text style={[styles.pinBannerDesc, hasPin && styles.pinBannerDescSet]}>
                  {hasPin
                    ? 'Change your existing 4-digit PIN'
                    : 'Prevent kids from changing account settings'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={hasPin ? theme.accent : '#a16207'} />
            </TouchableOpacity>

            {hasPin && (
              <TouchableOpacity style={styles.removePinBtn} onPress={handleRemovePin}>
                <Ionicons name="lock-open-outline" size={15} color={theme.danger} style={{ marginRight: 6 }} />
                <Text style={styles.removePinText}>Remove PIN lock</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Profile card */}
        <View style={styles.profileCard}>
          <KidAvatar name={activeKid?.name ?? '?'} color={activeKid?.avatar} size={56} radius={14} />
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

        {/* Auth action */}
        {isLoggedIn ? (
          <TouchableOpacity style={styles.dangerBtn} onPress={handleSignOut}>
            <Text style={styles.dangerBtnText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.primaryBtnText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        )}

        {/* Child profiles */}
        {isLoggedIn && (
          <>
            <Text style={styles.sectionTitle}>Child Profiles</Text>
            <View style={styles.card}>
              {kidProfiles.map((kid, i) => (
                <View key={kid.id} style={[
                  styles.kidRow,
                  activeKid?.id === kid.id && styles.kidRowActive,
                  i < kidProfiles.length - 1 && styles.kidRowBorder,
                ]}>
                  <View style={{ marginRight: 12 }}>
                    <KidAvatar name={kid.name} color={kid.avatar} size={40} radius={10} />
                  </View>
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
                <Ionicons name="person-add-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                <Text style={styles.manageKidsBtnText}>Manage Profiles</Text>
              </TouchableOpacity>
            </View>

            {/* Game Library shortcut */}
            <TouchableOpacity
              style={[styles.progressBtn, { marginBottom: 10 }]}
              onPress={() => navigation.navigate('GameManager')}
              activeOpacity={0.8}
            >
              <View style={styles.progressBtnLeft}>
                <View style={[styles.progressBtnIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                  <Ionicons name="game-controller-outline" size={20} color="#8b5cf6" />
                </View>
                <View>
                  <Text style={styles.progressBtnTitle}>Game Library</Text>
                  <Text style={styles.progressBtnSub}>Enable &amp; manage mini-games</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>

            {/* Progress dashboard shortcut */}
            <TouchableOpacity
              style={styles.progressBtn}
              onPress={() => navigation.navigate('Progress')}
              activeOpacity={0.8}
            >
              <View style={styles.progressBtnLeft}>
                <View style={styles.progressBtnIcon}>
                  <Ionicons name="bar-chart-outline" size={20} color="#4ade80" />
                </View>
                <View>
                  <Text style={styles.progressBtnTitle}>View Progress</Text>
                  <Text style={styles.progressBtnSub}>Scores, stars &amp; activity by child</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#475569" />
            </TouchableOpacity>
          </>
        )}

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.card}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>FREE PLAN</Text>
          </View>
          <Text style={styles.planTitle}>SnapStudy Basic</Text>
          <Text style={styles.planDesc}>All built-in lessons included. Upgrade for AI scanning.</Text>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => Alert.alert(
              'Beta Access',
              "You're in beta! All features — including AI scanning — are free during testing.\n\nSubscriptions will unlock when the app launches publicly.",
              [{ text: 'Got it!', style: 'default' }]
            )}
          >
            <Text style={styles.upgradeBtnText}>Upgrade — $4.99/month</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.themeRow}>
            <Text style={styles.themeLabel}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <TouchableOpacity onPress={handleThemeToggle} activeOpacity={0.8}>
              <LottieView
                ref={lottieRef}
                source={require('../../assets/lottie-animations/Dark Mode Button.json')}
                progress={lottieProgress}
                autoPlay={false}
                loop={false}
                resizeMode="contain"
                onAnimationFinish={handleLottieFinish}
                style={styles.lottieToggle}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dev Preview shortcut — only in __DEV__ builds */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devPreviewBtn}
            onPress={() => navigation.navigate('DevPreview')}
            activeOpacity={0.8}>
            <Ionicons name="flask" size={18} color="#f59e0b" />
            <Text style={styles.devPreviewBtnText}>🔧 Dev Preview</Text>
            <Ionicons name="chevron-forward" size={16} color="#92400e" />
          </TouchableOpacity>
        )}

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          {[
            { label: 'Privacy Policy',    ionicon: 'shield-checkmark-outline', screen: 'PrivacyPolicy' },
            { label: 'Terms of Service',  ionicon: 'document-text-outline',    screen: 'Terms' },
            { label: 'Restore Purchases', ionicon: 'refresh-outline',          screen: null },
            { label: 'App Version 1.0.0', ionicon: 'information-circle-outline', screen: null },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={i}
              style={[styles.listRow, i < arr.length - 1 && styles.listRowBorder]}
              onPress={() => item.screen && navigation.navigate(item.screen)}
              activeOpacity={item.screen ? 0.6 : 1}
            >
              <Ionicons name={item.ionicon} size={19} color={theme.textSub} style={{ marginRight: 12, width: 24 }} />
              <Text style={styles.listLabel}>{item.label}</Text>
              {item.screen && <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// DYNAMIC STYLES
// ─────────────────────────────────────────────────────────────
function createStyles(t) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 60 },

    headerRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 16,
    },
    pageTitle: { fontSize: 30, fontWeight: '800', color: t.text },
    lockBtn: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: t.bgCard, borderRadius: 20,
      paddingHorizontal: 14, paddingVertical: 7,
      borderWidth: 1, borderColor: t.border,
    },
    lockBtnText: { fontSize: 13, fontWeight: '600', color: t.textSub },

    // PIN banner — no PIN
    pinBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: '#fefce8', borderRadius: 14,
      borderWidth: 1, borderColor: '#fde68a',
      padding: 14, marginBottom: 16,
    },
    pinBannerEmoji: { fontSize: 22 },
    pinBannerTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
    pinBannerDesc:  { fontSize: 12, color: '#a16207', marginTop: 1 },
    // PIN banner — PIN set
    pinBannerSet:       { backgroundColor: t.accentDim, borderColor: t.accent + '40' },
    pinBannerTitleSet:  { color: t.accent },
    pinBannerDescSet:   { color: t.textSub },

    // Profile
    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: t.bgCard, borderRadius: 16, padding: 16,
      marginBottom: 12,
      borderWidth: 1, borderColor: t.border,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    userName:  { fontSize: 18, fontWeight: '700', color: t.text },
    userEmail: { fontSize: 13, color: t.textSub, marginTop: 1 },

    primaryBtn: {
      backgroundColor: t.accent, borderRadius: 14,
      paddingVertical: 15, alignItems: 'center', marginBottom: 20,
    },
    primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },

    dangerBtn: {
      backgroundColor: t.id === 'dark' ? t.danger : t.dangerDim,
      borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 24,
      borderWidth: t.id === 'dark' ? 0 : 1, borderColor: t.danger + '40',
    },
    dangerBtnText: { fontSize: 15, fontWeight: '700', color: t.id === 'dark' ? '#fff' : t.danger },

    removePinBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      marginTop: -8, marginBottom: 16, paddingVertical: 8,
    },
    removePinText: { fontSize: 13, fontWeight: '600', color: t.danger },

    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: t.textMuted,
      textTransform: 'uppercase', letterSpacing: 1,
      marginBottom: 8, marginTop: 8,
    },

    card: {
      backgroundColor: t.bgCard, borderRadius: 16, marginBottom: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: t.border,
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
    },

    kidRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    kidRowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    kidRowActive: { backgroundColor: t.accentDim },
    kidName:      { flex: 1, fontSize: 16, fontWeight: '600', color: t.text },
    activeBadge: {
      backgroundColor: t.accent, borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#000' },

    manageKidsBtn: {
      paddingVertical: 14, alignItems: 'center',
      borderTopWidth: 1, borderTopColor: t.border,
      flexDirection: 'row', justifyContent: 'center',
      backgroundColor: t.accentDim,
    },
    manageKidsBtnText: { fontSize: 14, fontWeight: '700', color: t.id === 'dark' ? '#fff' : t.accent },

    progressBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: t.bgCard, borderRadius: 16, padding: 16,
      marginTop: 12,
      borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
    },
    progressBtnLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
    progressBtnIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: 'rgba(74,222,128,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    progressBtnTitle: { fontSize: 15, fontWeight: '700', color: t.text, marginBottom: 2 },
    progressBtnSub:   { fontSize: 12, color: t.textSub },

    planBadge: {
      backgroundColor: t.accentDim, borderRadius: 6,
      margin: 16, marginBottom: 6,
      paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start',
    },
    planBadgeText: { fontSize: 11, fontWeight: '700', color: t.accent, letterSpacing: 0.5 },
    planTitle:     { fontSize: 17, fontWeight: '700', color: t.text, paddingHorizontal: 16, marginBottom: 4 },
    planDesc:      { fontSize: 13, color: t.textSub, paddingHorizontal: 16, marginBottom: 14 },
    upgradeBtn: {
      backgroundColor: '#f59e0b', margin: 16, marginTop: 0,
      borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    },
    upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    // Appearance / theme toggle
    themeRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    themeLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
    lottieToggle: { width: 88, height: 50 },

    listRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: t.border },
    listLabel: { flex: 1, fontSize: 15, color: t.text },

    devPreviewBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)',
      paddingVertical: 14, paddingHorizontal: 16,
      marginBottom: 20,
    },
    devPreviewBtnText: {
      flex: 1, fontSize: 15, fontWeight: '700', color: '#fbbf24',
    },
  });
}

function createPinStyles(t) {
  return StyleSheet.create({
    container: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 32, paddingBottom: 24,
    },
    title:    { fontSize: 26, fontWeight: '800', color: t.text, marginBottom: 6, textAlign: 'center' },
    subtitle: { fontSize: 14, color: t.textSub, marginBottom: 28, textAlign: 'center' },

    dotsRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    dot: {
      width: 18, height: 18, borderRadius: 9,
      borderWidth: 2, borderColor: t.borderStrong, backgroundColor: 'transparent',
    },
    dotFilled: { backgroundColor: t.accent, borderColor: t.accent },

    errorText:    { fontSize: 13, color: t.danger, fontWeight: '600', marginBottom: 12, height: 18 },
    errorSpacer:  { height: 30 },

    grid: {
      flexDirection: 'row', flexWrap: 'wrap',
      width: 280, gap: 12, marginTop: 12,
    },
    key: {
      width: 80, height: 72, borderRadius: 16,
      backgroundColor: t.bgCard,
      borderWidth: 1, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
    },
    keyEmpty: { width: 80, height: 72 },
    keyText:  { fontSize: 24, fontWeight: '600', color: t.text },

    forgotBtn:  { marginTop: 24 },
    forgotText: { fontSize: 14, color: t.textMuted, fontWeight: '600', textDecorationLine: 'underline' },
  });
}
