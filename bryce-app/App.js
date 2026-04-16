import React from 'react';
import { Platform, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { SafeAreaProvider }         from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import GameScreen      from './src/screens/GameScreen';
import ScanScreen      from './src/screens/ScanScreen';
import AccountScreen   from './src/screens/AccountScreen';
import AuthScreen      from './src/screens/AuthScreen';
import KidSelectScreen from './src/screens/KidSelectScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICON = {
  Play:    '🎮',
  Scan:    '📸',
  Account: '👤',
};

// ── Main tabs (shown when a kid is active OR user is guest) ──
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.6 }}>
            {TAB_ICON[route.name] ?? '●'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Play"    component={GameScreen}    options={{ tabBarLabel: 'Play' }} />
      <Tab.Screen name="Scan"    component={ScanScreen}    options={{ tabBarLabel: 'Scan' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Account' }} />
    </Tab.Navigator>
  );
}

// ── Root navigator — decides which flow to show ───────────────
function RootNavigator() {
  const { isLoggedIn, loading, kidProfiles, activeKid } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>📚</Text>
        <Text style={styles.splashName}>BryceLearning</Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      </View>
    );
  }

  // Guest flow: show main tabs directly (no account required)
  // Logged-in flow:
  //   - No kids yet → KidSelect
  //   - Kids exist but none selected → KidSelect
  //   - Kid selected → MainTabs
  const showKidSelect = isLoggedIn && (kidProfiles.length === 0 || !activeKid);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showKidSelect ? (
        // Logged in but no kid selected — KidSelect is the only screen
        <Stack.Screen name="KidSelect" component={KidSelectScreen} />
      ) : (
        // Guest or logged-in with active kid — full app available
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ presentation: 'modal' }}
          />
          <Stack.Screen name="KidSelect" component={KidSelectScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#2563eb',
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
