import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GameScreen from './src/screens/GameScreen';
import ScanScreen from './src/screens/ScanScreen';
import AccountScreen from './src/screens/AccountScreen';

const Tab = createBottomTabNavigator();

const TAB_ICON = {
  Play:    { active: '🎮', inactive: '🎮' },
  Scan:    { active: '📸', inactive: '📸' },
  Account: { active: '👤', inactive: '👤' },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
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
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 22 }}>
                {TAB_ICON[route.name]?.[focused ? 'active' : 'inactive'] ?? '●'}
              </Text>
            ),
          })}
        >
          <Tab.Screen
            name="Play"
            component={GameScreen}
            options={{ tabBarLabel: 'Play' }}
          />
          <Tab.Screen
            name="Scan"
            component={ScanScreen}
            options={{ tabBarLabel: 'Scan' }}
          />
          <Tab.Screen
            name="Account"
            component={AccountScreen}
            options={{ tabBarLabel: 'Account' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
