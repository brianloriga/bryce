import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/supabase';

export default function AccountScreen() {
  const navigation = useNavigation();
  const { user, activeKid, kidProfiles, selectKid, reloadKids, isLoggedIn } = useAuth();

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>

        {/* Profile area */}
        <View style={styles.profileArea}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>{activeKid?.avatar ?? '👤'}</Text>
          </View>
          {isLoggedIn ? (
            <>
              <Text style={styles.userName}>{activeKid?.name ?? 'No kid selected'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </>
          ) : (
            <>
              <Text style={styles.userName}>Guest</Text>
              <Text style={styles.userEmail}>Progress is saved locally only</Text>
            </>
          )}
        </View>

        {/* Sign In / Sign Out */}
        {isLoggedIn ? (
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.signInButtonText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        {/* Kid profiles (only shown when logged in) */}
        {isLoggedIn && (
          <>
            <Text style={styles.sectionTitle}>Kids</Text>
            {kidProfiles.map(kid => (
              <TouchableOpacity
                key={kid.id}
                style={[styles.kidRow, activeKid?.id === kid.id && styles.kidRowActive]}
                onPress={() => selectKid(kid)}
              >
                <Text style={styles.kidRowAvatar}>{kid.avatar}</Text>
                <Text style={styles.kidRowName}>{kid.name}</Text>
                {activeKid?.id === kid.id && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Playing</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.manageKidsBtn}
              onPress={() => navigation.navigate('KidSelect')}
            >
              <Text style={styles.manageKidsBtnText}>＋  Manage Kid Profiles</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
          </>
        )}

        {/* Subscription */}
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>FREE PLAN</Text>
          </View>
          <Text style={styles.planTitle}>BryceLearning Basic</Text>
          <Text style={styles.planDesc}>All built-in math, reading, and science units included.</Text>
          <View style={styles.planFeatures}>
            {[
              '✅ All current game units',
              '✅ Star tracking & boss battles',
              '✅ Works on any device',
              '🔒 AI textbook scanning (Premium)',
              '🔒 Custom units (Premium)',
              '🔒 Cloud sync across devices (Premium)',
            ].map((f, i) => (
              <Text key={i} style={styles.planFeatureItem}>{f}</Text>
            ))}
          </View>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>⚡  Upgrade to Premium — $4.99/mo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        {[
          { label: 'Privacy Policy',    icon: '🔒' },
          { label: 'Terms of Service',  icon: '📄' },
          { label: 'Restore Purchases', icon: '🔄' },
          { label: 'App Version 1.0.0', icon: 'ℹ️' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.listRow}>
            <Text style={styles.listRowIcon}>{item.icon}</Text>
            <Text style={styles.listRowLabel}>{item.label}</Text>
            <Text style={styles.listRowArrow}>›</Text>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content:   { padding: 24, paddingBottom: 48 },

  profileArea: { alignItems: 'center', marginBottom: 20 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#dbeafe',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  avatarEmoji:  { fontSize: 36 },
  userName:     { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  userEmail:    { fontSize: 13, color: '#64748b' },

  signInButton: {
    backgroundColor: '#2563eb', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginBottom: 20,
  },
  signInButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  signOutButton: {
    backgroundColor: '#fee2e2', borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', marginBottom: 20,
  },
  signOutButtonText: { fontSize: 15, fontWeight: '700', color: '#ef4444' },

  divider:       { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },
  sectionTitle:  {
    fontSize: 12, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  kidRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  kidRowActive:  { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  kidRowAvatar:  { fontSize: 26, marginRight: 12 },
  kidRowName:    { flex: 1, fontSize: 16, fontWeight: '600', color: '#1e293b' },
  activeBadge: {
    backgroundColor: '#2563eb', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  manageKidsBtn: {
    borderWidth: 1.5, borderColor: '#2563eb', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  manageKidsBtnText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },

  planCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 4,
  },
  planBadge: {
    backgroundColor: '#dbeafe', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 10,
  },
  planBadgeText:   { fontSize: 11, fontWeight: '700', color: '#1e40af', letterSpacing: 0.5 },
  planTitle:       { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  planDesc:        { fontSize: 13, color: '#64748b', marginBottom: 14 },
  planFeatures:    { marginBottom: 16 },
  planFeatureItem: { fontSize: 14, color: '#334155', marginBottom: 6, lineHeight: 20 },
  upgradeButton: {
    backgroundColor: '#f59e0b', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  upgradeButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  listRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  listRowIcon:  { fontSize: 18, marginRight: 12, width: 26 },
  listRowLabel: { flex: 1, fontSize: 15, color: '#1e293b' },
  listRowArrow: { fontSize: 20, color: '#94a3b8' },
});
