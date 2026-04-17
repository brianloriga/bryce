import React from 'react';
import { Platform, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator }     from '@react-navigation/stack';
import { SafeAreaProvider }         from 'react-native-safe-area-context';
import { Ionicons }                 from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import HomeScreen     from './src/screens/HomeScreen';
import ScanScreen     from './src/screens/ScanScreen';
import AccountScreen  from './src/screens/AccountScreen';
import AuthScreen     from './src/screens/AuthScreen';
import KidSelectScreen from './src/screens/KidSelectScreen';
import QuizScreen     from './src/screens/QuizScreen';

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
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 20,
        },
        tabBarActiveTintColor: '#60a5fa',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
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

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>📚</Text>
        <Text style={styles.splashName}>BryceLearning</Text>
        <ActivityIndicator color="#60a5fa" style={{ marginTop: 24 }} />
      </View>
    );
  }

  const initialRoute = (isLoggedIn && !activeKid) ? 'KidSelect' : 'Main';

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Main"      component={MainTabs} />
      <Stack.Screen name="Auth"      component={AuthScreen}     options={{ presentation: 'modal' }} />
      <Stack.Screen name="KidSelect" component={KidSelectScreen} />
      <Stack.Screen name="Quiz"      component={QuizScreen}     options={{ gestureEnabled: false }} />
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
