import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createKidProfile, deleteKidProfile } from '../services/supabase';

const AVATARS = ['🦁','🐯','🦊','🐼','🐨','🐸','🦄','🐲','🚀','⭐','🎮','🌈'];

const AVATAR_COLORS = {
  '🦁': '#fde68a', '🐯': '#fed7aa', '🦊': '#fca5a5', '🐼': '#d1d5db',
  '🐨': '#a5b4fc', '🐸': '#86efac', '🦄': '#f5d0fe', '🐲': '#6ee7b7',
  '🚀': '#bae6fd', '⭐': '#fef08a', '🎮': '#c4b5fd', '🌈': '#fbcfe8',
};

export default function KidSelectScreen() {
  const { kidProfiles, selectKid, reloadKids, activeKid } = useAuth();
  const navigation = useNavigation();

  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [newAvatar, setNewAvatar] = useState('🦁');
  const [saving, setSaving]       = useState(false);

  // Navigate to Main as soon as an active kid is set
  useEffect(() => {
    if (activeKid) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  }, [activeKid]);

  async function handleTapKid(kid) {
    await selectKid(kid);
    // navigation.reset fires via the useEffect above once activeKid updates
  }

  async function handleAddKid() {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Please enter the child\'s name.');
      return;
    }
    setSaving(true);
    try {
      await createKidProfile(newName.trim(), newAvatar);
      await reloadKids();
      setNewName(''); setNewAvatar('🦁'); setShowAdd(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(kid) {
    Alert.alert(
      `Remove ${kid.name}?`,
      'This will delete their profile and all saved progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteKidProfile(kid.id);
              await reloadKids();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>BryceLearning</Text>
          <Text style={styles.heading}>Who's playing?</Text>
        </View>
        <TouchableOpacity
          style={styles.accountLink}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.accountLinkText}>Account</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Kid cards */}
        {kidProfiles.map(kid => (
          <TouchableOpacity
            key={kid.id}
            style={styles.kidCard}
            onPress={() => handleTapKid(kid)}
            onLongPress={() => confirmDelete(kid)}
            activeOpacity={0.85}
          >
            <View style={[styles.avatarCircle, { backgroundColor: AVATAR_COLORS[kid.avatar] ?? '#e2e8f0' }]}>
              <Text style={styles.avatarEmoji}>{kid.avatar}</Text>
            </View>
            <Text style={styles.kidName}>{kid.name}</Text>
            <Text style={styles.playLabel}>Tap to play</Text>
          </TouchableOpacity>
        ))}

        {/* Add child */}
        {!showAdd ? (
          <TouchableOpacity style={styles.addCard} onPress={() => setShowAdd(true)}>
            <Text style={styles.addPlus}>+</Text>
            <Text style={styles.addLabel}>Add a Child</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Profile</Text>

            <TextInput
              style={styles.input}
              placeholder="Child's name"
              placeholderTextColor="#94a3b8"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Choose an avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[
                    styles.avatarOption,
                    { backgroundColor: AVATAR_COLORS[a] ?? '#e2e8f0' },
                    newAvatar === a && styles.avatarSelected,
                  ]}
                  onPress={() => setNewAvatar(a)}
                >
                  <Text style={styles.avatarOptionEmoji}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleAddKid}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Save Profile</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowAdd(false); setNewName(''); }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hint}>Hold a profile to delete it</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#f1f5f9',
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
  },
  accountLink: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  accountLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 12,
  },

  // Kid card — big and tappable
  kidCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 34,
  },
  kidName: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  playLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },

  // Add child card
  addCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 4,
  },
  addPlus: {
    fontSize: 32,
    color: '#94a3b8',
    lineHeight: 36,
  },
  addLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },

  // Add form
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    gap: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: '#2563eb',
  },
  avatarOptionEmoji: {
    fontSize: 26,
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
  },

  hint: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 8,
  },
});
