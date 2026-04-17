import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Animated, Dimensions, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createKidProfile, deleteKidProfile, updateKidProfile } from '../services/supabase';
import { COLOR_PALETTE, DEFAULT_COLOR, getAvatarColor } from '../utils/avatars';
import KidAvatar from '../components/KidAvatar';

const { width: SCREEN_W } = Dimensions.get('window');

// Floating background bubbles
const BUBBLES = [
  { size: 180, color: 'rgba(167,139,250,0.18)', top: -50,  left: -60,  amplitude: 18, duration: 3200 },
  { size: 110, color: 'rgba(251,207,232,0.35)', top: 60,   right: -30, amplitude: -14, duration: 2600 },
  { size: 80,  color: 'rgba(196,181,253,0.30)', top: 220,  right: 30,  amplitude: 20,  duration: 3800 },
  { size: 140, color: 'rgba(253,230,138,0.22)', bottom: 180, left: -40, amplitude: -16, duration: 4000 },
  { size: 90,  color: 'rgba(167,243,208,0.28)', bottom: 80,  right: 20, amplitude: 12,  duration: 2900 },
  { size: 65,  color: 'rgba(251,207,232,0.30)', bottom: 320, left: 30,  amplitude: -22, duration: 3500 },
  { size: 50,  color: 'rgba(147,197,253,0.30)', top: 380,  left: 60,   amplitude: 15,  duration: 2400 },
];

function BubbleBackground() {
  const anims = useRef(BUBBLES.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: BUBBLES[i].duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: BUBBLES[i].duration, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BUBBLES.map((b, i) => {
        const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, b.amplitude] });
        return (
          <Animated.View key={i} style={{
            position: 'absolute', width: b.size, height: b.size, borderRadius: b.size / 2,
            backgroundColor: b.color,
            top: b.top, bottom: b.bottom, left: b.left, right: b.right,
            transform: [{ translateY }],
          }} />
        );
      })}
    </View>
  );
}

// ── Color picker shared by add + edit forms ───────────────────
function ColorPicker({ selected, onSelect }) {
  return (
    <View style={styles.colorGrid}>
      {COLOR_PALETTE.map(hex => (
        <TouchableOpacity
          key={hex}
          style={[styles.colorSwatch, { backgroundColor: hex }, selected === hex && styles.colorSwatchSelected]}
          onPress={() => onSelect(hex)}
          activeOpacity={0.8}
        >
          {selected === hex && <Ionicons name="checkmark" size={16} color="#fff" />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────
export default function KidSelectScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const mode       = route.params?.mode ?? 'select';

  const { kidProfiles, selectKid, reloadKids, kidLoadError } = useAuth();

  const [showAdd, setShowAdd]     = useState(false);
  const [newName, setNewName]     = useState('');
  const [newColor, setNewColor]   = useState(DEFAULT_COLOR);
  const [saving, setSaving]       = useState(false);

  const [editKid, setEditKid]       = useState(null);
  const [editName, setEditName]     = useState('');
  const [editColor, setEditColor]   = useState(DEFAULT_COLOR);
  const [editSaving, setEditSaving] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleTapKid(kid) {
    await selectKid(kid);
    if (mode === 'select') navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  async function handleAddKid() {
    if (!newName.trim()) { Alert.alert('Name required', "Please enter the child's name."); return; }
    setSaving(true);
    try {
      await createKidProfile(newName.trim(), newColor);
      await reloadKids();
      setNewName(''); setNewColor(DEFAULT_COLOR); setShowAdd(false);
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setSaving(false); }
  }

  function confirmDelete(kid) {
    Alert.alert(`Remove ${kid.name}?`, 'This will delete their profile and all saved progress.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteKidProfile(kid.id); await reloadKids(); }
        catch (err) { Alert.alert('Error', err.message); }
      }},
    ]);
  }

  function openEdit(kid) {
    setEditKid(kid);
    setEditName(kid.name);
    setEditColor(getAvatarColor(kid.avatar));
  }

  function closeEdit() { setEditKid(null); setEditName(''); setEditColor(DEFAULT_COLOR); }

  async function handleSaveEdit() {
    if (!editName.trim()) { Alert.alert('Name required', "Please enter the child's name."); return; }
    setEditSaving(true);
    try {
      await updateKidProfile(editKid.id, { name: editName.trim(), avatar: editColor });
      await reloadKids();
      closeEdit();
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setEditSaving(false); }
  }

  if (kidLoadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <BubbleBackground />
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorTitle}>Couldn't load profiles</Text>
          <Text style={styles.errorDesc}>{kidLoadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reloadKids}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <BubbleBackground />

      {/* Header */}
      <View style={styles.headerRow}>
        {mode === 'manage' ? (
          <>
            <Text style={styles.manageTitleText}>Manage Profiles</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.headerCenter}>
            <Text style={styles.appBadge}>SnapStudy</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {mode === 'select' && (
            <View style={styles.titleSection}>
              <Text style={styles.title}>Who's learning{'\n'}today?</Text>
              <Text style={styles.subtitle}>Tap your name to start!</Text>
            </View>
          )}

          {/* Kid bubbles */}
          <View style={styles.bubblesGrid}>
            {kidProfiles.map(kid => (
              <KidBubble
                key={kid.id} kid={kid} mode={mode}
                onPress={() => handleTapKid(kid)}
                onLongPress={() => confirmDelete(kid)}
                onEdit={() => openEdit(kid)}
              />
            ))}

            {!showAdd && (
              <TouchableOpacity style={styles.addBubbleWrap} onPress={() => setShowAdd(true)}>
                <View style={styles.addBubble}>
                  <Ionicons name="add" size={34} color="#7c3aed" />
                </View>
                <Text style={styles.addBubbleName}>Add Child</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Add form */}
          {showAdd && (
            <View style={styles.addCard}>
              <Text style={styles.addCardTitle}>New Profile</Text>

              {/* Live preview */}
              <View style={styles.previewRow}>
                <KidAvatar name={newName || '?'} color={newColor} size={72} radius={18} />
                <TextInput
                  style={styles.input}
                  placeholder="Child's name"
                  placeholderTextColor="#a78bfa"
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                />
              </View>

              <Text style={styles.fieldLabel}>Pick a colour</Text>
              <ColorPicker selected={newColor} onSelect={setNewColor} />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleAddKid}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Profile</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAdd(false); setNewName(''); setNewColor(DEFAULT_COLOR); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.hint}>Hold a profile to delete it</Text>
        </Animated.View>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={!!editKid} transparent animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEdit}>
            <TouchableOpacity activeOpacity={1} style={styles.editSheet}>
              <View style={styles.editHandle} />
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={closeEdit}>
                  <Ionicons name="close" size={22} color="#7c3aed" />
                </TouchableOpacity>
              </View>

              {/* Live preview */}
              <View style={styles.previewRow}>
                <KidAvatar name={editName || '?'} color={editColor} size={72} radius={18} />
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Child's name"
                  placeholderTextColor="#a78bfa"
                />
              </View>

              <Text style={styles.fieldLabel}>Pick a colour</Text>
              <ColorPicker selected={editColor} onSelect={setEditColor} />

              <TouchableOpacity
                style={[styles.saveBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={editSaving}
              >
                {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Kid bubble ────────────────────────────────────────────────
function KidBubble({ kid, mode, onPress, onLongPress, onEdit }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handlePress() {
    if (mode === 'manage') { onEdit(); return; }
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start(() => onPress());
  }

  return (
    <TouchableOpacity style={styles.kidBubbleWrap} onPress={handlePress} onLongPress={onLongPress} activeOpacity={0.85}>
      <Animated.View style={[styles.kidBubbleShadow, { transform: [{ scale: scaleAnim }] }]}>
        <KidAvatar name={kid.name} color={getAvatarColor(kid.avatar)} size={90} radius={22} />
        {mode === 'manage' && (
          <View style={styles.editBadge}>
            <Ionicons name="pencil" size={11} color="#fff" />
          </View>
        )}
      </Animated.View>
      <Text style={styles.kidName} numberOfLines={1}>{kid.name}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f3ff' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4,
  },
  headerCenter:    { flex: 1, alignItems: 'center' },
  appBadge:        { fontSize: 13, fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 1.5 },
  manageTitleText: { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },
  doneBtn:         { backgroundColor: '#7c3aed', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 7 },
  doneBtnText:     { fontSize: 14, fontWeight: '700', color: '#fff' },

  content:      { paddingHorizontal: 24, paddingBottom: 60, paddingTop: 8 },
  titleSection: { alignItems: 'center', marginBottom: 36, marginTop: 12 },
  title:        { fontSize: 38, fontWeight: '900', color: '#1e1b4b', textAlign: 'center', lineHeight: 46, marginBottom: 8 },
  subtitle:     { fontSize: 16, color: '#7c3aed', fontWeight: '600' },

  bubblesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginBottom: 8 },
  kidBubbleWrap: { alignItems: 'center', width: 100 },
  kidBubbleShadow: {
    marginBottom: 8,
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  kidName: { fontSize: 14, fontWeight: '700', color: '#1e1b4b', textAlign: 'center', maxWidth: 90 },

  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#f5f3ff',
  },

  addBubbleWrap: { alignItems: 'center', width: 100 },
  addBubble: {
    width: 90, height: 90, borderRadius: 22,
    borderWidth: 2.5, borderColor: '#c4b5fd', borderStyle: 'dashed',
    backgroundColor: 'rgba(196,181,253,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  addBubbleName: { fontSize: 14, fontWeight: '700', color: '#7c3aed' },

  // Add / edit shared form styles
  addCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    marginTop: 8, marginBottom: 8,
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
  },
  addCardTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b', marginBottom: 18 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  input: {
    flex: 1, backgroundColor: '#f5f3ff', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, fontWeight: '600', color: '#1e1b4b',
    borderWidth: 2, borderColor: '#ddd6fe',
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#7c3aed',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  // Color picker
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorSwatch: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },

  saveBtn: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  saveBtnText:   { fontSize: 16, fontWeight: '700', color: '#fff' },
  cancelBtn:     { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, color: '#a78bfa', fontWeight: '600' },

  hint: { fontSize: 12, color: '#c4b5fd', textAlign: 'center', marginTop: 20 },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  editHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 20 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  editTitle:  { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },

  // Error state
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorEmoji: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 22, fontWeight: '800', color: '#1e1b4b', marginBottom: 8 },
  errorDesc:  { fontSize: 14, color: '#7c3aed', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  retryBtn:     { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
