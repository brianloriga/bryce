import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Placeholder screen for Phase 2 (User Accounts) and Phase 4 (Subscription)
// Will be fully built in those phases.

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.avatarArea}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👤</Text>
          </View>
          <Text style={styles.guestLabel}>Guest User</Text>
          <Text style={styles.guestSub}>Sign in to save progress &amp; unlock scanning</Text>
        </View>

        <TouchableOpacity style={styles.signInButton}>
          <Text style={styles.signInButtonText}>Sign In / Create Account</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.planCard}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>FREE PLAN</Text>
          </View>
          <Text style={styles.planTitle}>BryceLearning Basic</Text>
          <Text style={styles.planDesc}>All built-in math, reading, and science units.</Text>
          <View style={styles.planFeatures}>
            {['✅ All current game units', '✅ Star tracking', '✅ Boss battles', '🔒 AI textbook scanning', '🔒 Custom units', '🔒 Cloud sync'].map((f, i) => (
              <Text key={i} style={styles.planFeatureItem}>{f}</Text>
            ))}
          </View>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>⚡ Upgrade to Premium — $4.99/mo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>About</Text>
        {[
          { label: 'Privacy Policy', icon: '🔒' },
          { label: 'Terms of Service', icon: '📄' },
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  avatarArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  guestLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  guestSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  signInButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 28,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 4,
  },
  planBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
    letterSpacing: 0.5,
  },
  planTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  planDesc: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 14,
  },
  planFeatures: {
    marginBottom: 16,
  },
  planFeatureItem: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  listRowIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 26,
  },
  listRowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  listRowArrow: {
    fontSize: 20,
    color: '#94a3b8',
  },
});
