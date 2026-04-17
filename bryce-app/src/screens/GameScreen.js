import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { handleProgressUpdate } from '../services/progressSync';

// WebView is native-only
const WebView = Platform.OS !== 'web'
  ? require('react-native-webview').WebView
  : null;

const GAME_URL = 'https://brianloriga.github.io/bryce/';

// ── WebView injection script ─────────────────────────────────
// Intercepts localStorage writes so we can sync progress to Supabase.
// Also pre-loads the kid's cloud scores into localStorage on first render.
function buildInjectedScript(initialPayload) {
  const payloadStr = initialPayload
    ? JSON.stringify(initialPayload).replace(/'/g, "\\'")
    : null;

  return `
(function() {
  // 1. Pre-load cloud scores if available
  ${payloadStr ? `
  try {
    var existing = window.localStorage.getItem('bryceLearning');
    if (!existing) {
      window.localStorage.setItem('bryceLearning', '${payloadStr}');
    }
  } catch(e) {}
  ` : ''}

  // 2. Intercept localStorage.setItem to notify React Native on every save
  var _origSet = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = function(key, value) {
    _origSet(key, value);
    if (key === 'bryceLearning') {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress_update',
          data: value
        }));
      } catch(e) {}
    }
  };

  // 3. Send current state on load (handles page refresh)
  try {
    var current = window.localStorage.getItem('bryceLearning');
    if (current) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'progress_init',
        data: current
      }));
    }
  } catch(e) {}
})();
true; // Required by React Native WebView
`;
}

// Web platform fallback — WebView only works in native Expo Go
function WebFallback() {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackEmoji}>📱</Text>
      <Text style={styles.fallbackTitle}>Open in Expo Go</Text>
      <Text style={styles.fallbackDesc}>
        The games run natively in the Expo Go app.{'\n'}
        Download it from the App Store, then scan the QR code from the terminal.
      </Text>
      <TouchableOpacity
        style={styles.fallbackBtn}
        onPress={() => Linking.openURL(GAME_URL)}
      >
        <Text style={styles.fallbackBtnText}>Or play in browser →</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GameScreen() {
  const webViewRef = useRef(null);
  const { activeKid, initialLocalStoragePayload } = useAuth();

  if (Platform.OS === 'web') return <WebFallback />;

  // ── Handle messages from the WebView ────────────────────────
  const onMessage = useCallback(async (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'progress_update' || msg.type === 'progress_init') {
        await handleProgressUpdate(msg.data);
      }
    } catch {
      // Non-JSON messages from the web app (ads, etc.) are ignored
    }
  }, []);

  // ── Reload WebView when active kid changes ───────────────────
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [activeKid?.id]);

  const injectedScript = buildInjectedScript(initialLocalStoragePayload);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {activeKid && (
        <View style={styles.kidBanner}>
          <Text style={styles.kidBannerText}>
            {activeKid.avatar}  {activeKid.name}
          </Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ uri: GAME_URL }}
        style={styles.webView}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading BryceLearning…</Text>
          </View>
        )}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        onMessage={onMessage}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        allowsBackForwardNavigationGestures={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563eb',
  },
  kidBanner: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
  },
  kidBannerText: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '600',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  fallbackEmoji:  { fontSize: 64, marginBottom: 16 },
  fallbackTitle:  { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 12 },
  fallbackDesc: {
    fontSize: 15, color: 'rgba(255,255,255,0.85)',
    textAlign: 'center', lineHeight: 24, marginBottom: 28,
  },
  fallbackBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2, borderColor: '#fff',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13,
  },
  fallbackBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
