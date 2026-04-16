import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { createKidProfile, deleteKidProfile } from '../services/supabase';

const AVATARS = ['🦁','🐯','🦊','🐼','🐨','🐸','🦄','🐲','🚀','⭐','🎮','🌈'];

export default function KidSelectScreen() {
  const { kidProfiles, selectKid, reloadKids } = useAuth();

  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState('');
  const [newAvatar, setNewAvatar] = useState('🦁');
  const [saving, setSaving]     = useState(false);

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

  function handleDeleteKid(kid) {
    Alert.alert(
      `Remove ${kid.name}?`,
      'This will delete their profile and all saved progress. This cannot be undone.',
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
      <ScrollView contentContainerStyle={styles.content}>

        <Text style={styles.title}>Who's playing? 🎮</Text>
        <Text style={styles.subtitle}>Select a profile to load their progress.</Text>

        {/* Kid cards */}
        {kidProfiles.map(kid => (
          <TouchableOpacity
            key={kid.id}
            style={styles.kidCard}
            onPress={() => { console.log('[KidCard] tapped:', kid.name); selectKid(kid); }}
            onLongPress={() => handleDeleteKid(kid)}
          >
            <Text style={styles.kidAvatar}>{kid.avatar}</Text>
            <View style={styles.kidInfo}>
              <Text style={styles.kidName}>{kid.name}</Text>
              <Text style={styles.kidHint}>Tap to play · Hold to delete</Text>
            </View>
            <Text style={styles.kidArrow}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Add kid */}
        {!showAdd ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>＋  Add a Child</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>Add a Child</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Bryce"
              placeholderTextColor="#94a3b8"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Pick an avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map(a => (
                <TouchableOpacity
                  key={a}
                  style={[styles.avatarOption, newAvatar === a && styles.avatarSelected]}
                  onPress={() => setNewAvatar(a)}
                >
                  <Text style={styles.avatarOptionEmoji}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.addCardActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowAdd(false); setNewName(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleAddKid}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 24,
  },
  kidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  kidAvatar: {
    fontSize: 40,
    marginRight: 16,
  },
  kidInfo: {
    flex: 1,
  },
  kidName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  kidHint: {
    fontSize: 12,
    color: '#94a3b8',
  },
  kidArrow: {
    fontSize: 24,
    color: '#94a3b8',
  },
  addBtn: {
    borderWidth: 2,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },
  addCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  addCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 16,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  avatarOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  avatarOptionEmoji: {
    fontSize: 24,
  },
  addCardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
