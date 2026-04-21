import React, { useState, useEffect } from 'react';
import { Platform, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { SafeAreaProvider }         from 'react-native-safe-area-context';
import { Ionicons }                 from '@expo/vector-icons';
import AsyncStorage                 from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import HomeScreen          from './src/screens/HomeScreen';
import ScanScreen          from './src/screens/ScanScreen';
import AccountScreen       from './src/screens/AccountScreen';
import AuthScreen          from './src/screens/AuthScreen';
import WelcomeScreen       from './src/screens/WelcomeScreen';
import KidSelectScreen     from './src/screens/KidSelectScreen';
import QuizScreen          from './src/screens/QuizScreen';
import OnboardingScreen    from './src/screens/OnboardingScreen';
import PrivacyPolicyScreen from './src/screens/PrivacyPolicyScreen';
import TermsScreen         from './src/screens/TermsScreen';
import ProgressScreen      from './src/screens/ProgressScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Tab bar icon config ───────────────────────────────────────
const TAB_ICONS = {
  Learn:   { active: 'school',                  inactive: 'school-outline' },
  Scan:    { active: 'camera',                  inactive: 'camera-outline' },
  Account: { active: 'person-circle',           inactive: 'person-circle-outline' },
};

// ── Main tabs ─────────────────────────────────────────────────
function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopWidth: theme.id === 'light' ? 1 : 0,
          borderTopColor: theme.id === 'light' ? '#e2e8f0' : 'transparent',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 10,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
        },
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11, fontWeight: '700', letterSpacing: 0.3,
        },
        tabBarIcon: ({ focused, color }) => {
          const icon = focused
            ? TAB_ICONS[route.name]?.active
            : TAB_ICONS[route.name]?.inactive;
          return <Ionicons name={icon ?? 'ellipse'} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Learn"   component={HomeScreen}    options={{ tabBarLabel: 'Learn' }} />
      <Tab.Screen name="Scan"    component={ScanScreen}    options={{ tabBarLabel: 'Scan' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Account' }} />
    </Tab.Navigator>
  );
}

// ── Root navigator ────────────────────────────────────────────
function RootNavigator() {
  const { isLoggedIn, loading, activeKid } = useAuth();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding,   setNeedsOnboarding]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@snapstudy_onboarding_done').then(val => {
      setNeedsOnboarding(!val);
      setOnboardingChecked(true);
    });
  }, []);

  if (loading || !onboardingChecked) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>📚</Text>
        <Text style={styles.splashName}>SnapStudy</Text>
        <ActivityIndicator color="#4ade80" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // ── Not logged in: show Welcome → Auth flow ──────────────────
  if (!isLoggedIn) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ presentation: 'card', animationEnabled: true }}
        />
      </Stack.Navigator>
    );
  }

  // ── Logged in: show Onboarding first time, then KidSelect / Main ──
  let initialRoute = 'Main';
  if (needsOnboarding)    initialRoute = 'Onboarding';
  else if (!activeKid)    initialRoute = 'KidSelect';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Main"          component={MainTabs} />
      <Stack.Screen name="KidSelect"     component={KidSelectScreen} />
      <Stack.Screen name="Onboarding"    component={OnboardingScreen} />
      <Stack.Screen name="Quiz"          component={QuizScreen}          options={{ gestureEnabled: false }} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Terms"         component={TermsScreen}         options={{ presentation: 'modal' }} />
        <Stack.Screen name="Progress"      component={ProgressScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogo: {
    fontSize: 72,
    marginBottom: 12,
  },
  splashName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
});
