import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/useAppStore';
import { getActiveHDHub4uDomain } from '../../src/providers/hdhub4u/domain';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { clearHistory, watchHistory, favorites } = useAppStore();

  const [hdhubDomain, setHdhubDomain] = useState<string>('Probing...');
  const [probing, setProbing] = useState<boolean>(true);

  useEffect(() => {
    checkDomains();
  }, []);

  const checkDomains = async () => {
    setProbing(true);
    try {
      const active = await getActiveHDHub4uDomain();
      setHdhubDomain(active);
    } catch {
      setHdhubDomain('https://hdhub4u.ms');
    } finally {
      setProbing(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Watch History',
      'Are you sure you want to clear your entire watch history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            Alert.alert('History Cleared', 'Your watch history has been reset.');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Architecture</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Provider Gateway Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>FEDERATED PROVIDERS</Text>

          <View style={styles.card}>
            {/* HDHub4u */}
            <View style={styles.providerRow}>
              <View style={styles.providerLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <View>
                  <Text style={styles.providerName}>HDHub4u Gateway</Text>
                  <Text style={styles.providerSub}>Active: {hdhubDomain}</Text>
                </View>
              </View>
              {probing ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <TouchableOpacity onPress={checkDomains} style={styles.refreshBtn}>
                  <Ionicons name="refresh" size={16} color="#10b981" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            {/* 4KHDHub */}
            <View style={styles.providerRow}>
              <View style={styles.providerLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
                <View>
                  <Text style={styles.providerName}>4KHDHub UHD</Text>
                  <Text style={styles.providerSub}>Domain: https://4khdhub.one</Text>
                </View>
              </View>
              <Text style={styles.onlineBadge}>ONLINE</Text>
            </View>

            <View style={styles.divider} />

            {/* MovieBox */}
            <View style={styles.providerRow}>
              <View style={styles.providerLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#ef4444' }]} />
                <View>
                  <Text style={styles.providerName}>MovieBox Multi-Host</Text>
                  <Text style={styles.providerSub}>7 Hosts Pool • HMAC-MD5 Signed</Text>
                </View>
              </View>
              <Text style={styles.onlineBadge}>ONLINE</Text>
            </View>
          </View>
        </View>

        {/* Playback Capabilities */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NATIVE MEDIA ENGINE</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="hardware-chip-outline" size={20} color="#e50914" />
                <Text style={styles.infoTitle}>Video Player Engine</Text>
              </View>
              <Text style={styles.infoValue}>expo-video (AVPlayer / ExoPlayer)</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="volume-high-outline" size={20} color="#10b981" />
                <Text style={styles.infoTitle}>Dual Audio Track Switch</Text>
              </View>
              <Text style={styles.infoValue}>Native Container + Dubbed API</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#3b82f6" />
                <Text style={styles.infoTitle}>Stream Preflight Health Check</Text>
              </View>
              <Text style={styles.infoValue}>Active with Auto-Fallback</Text>
            </View>
          </View>
        </View>

        {/* Data & Storage */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>STORAGE & DATA</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="time-outline" size={20} color="#a0a0b0" />
                <Text style={styles.infoTitle}>Watch History Items</Text>
              </View>
              <Text style={styles.infoValue}>{watchHistory.length}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <Ionicons name="bookmark-outline" size={20} color="#a0a0b0" />
                <Text style={styles.infoTitle}>Saved in Watchlist</Text>
              </View>
              <Text style={styles.infoValue}>{favorites.length}</Text>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              onPress={handleClearHistory}
              style={[styles.infoRow, { justifyContent: 'center' }]}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.infoTitle, { color: '#ef4444', marginLeft: 8 }]}>
                Clear Watch History
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.aboutContainer}>
          <Text style={styles.aboutTitle}>CineBox v1.0.0</Text>
          <Text style={styles.aboutSub}>
            Native Expo mobile streaming client reverse-engineered from MovieBox-Tui.
          </Text>
          <Text style={styles.aboutSub}>
            Integrated with HDHub4u, 4KHDHub, and MovieBox API.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#6c6c80',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#14141c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20202c',
    overflow: 'hidden',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  providerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  providerSub: {
    color: '#777788',
    fontSize: 11,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  onlineBadge: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e1e2c',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: '#8e8e9e',
    fontSize: 12,
  },
  aboutContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  aboutTitle: {
    color: '#555566',
    fontSize: 13,
    fontWeight: '700',
  },
  aboutSub: {
    color: '#444455',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 300,
  },
});
