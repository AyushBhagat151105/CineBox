import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAppStore } from '@/store';
import { getActiveHDHub4uDomain } from '@/providers/hdhub4u/domain';
import { adService, ADS_ENABLED } from '@/services/ads';
import { updaterService, UpdateInfo } from '@/services/updater';
import { UpdateModal } from '@/components';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    clearHistory,
    watchHistory,
    favorites,
    skipSeconds,
    setSkipSeconds,
    preferredPlayer,
    setPreferredPlayer,
  } = useAppStore();

  const [hdhubDomain, setHdhubDomain] = useState<string>('Probing...');
  const [probing, setProbing] = useState<boolean>(true);
  const [remainingAdMinutes, setRemainingAdMinutes] = useState<number>(0);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [manualUpdateInfo, setManualUpdateInfo] = useState<UpdateInfo | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  useEffect(() => {
    checkDomains();
    checkAdStatus();
  }, []);

  const checkAdStatus = async () => {
    const mins = await adService.getRemainingUnlockMinutes();
    setRemainingAdMinutes(mins);
  };

  const handleCheckUpdateManual = async () => {
    if (!ADS_ENABLED) {
      Alert.alert(
        'VIP Build (👑)',
        `You are running CineBox v${Constants.expoConfig?.version || '1.0.0'} VIP.\n\nOTA updates are disabled on VIP builds to preserve your ad-free status.`
      );
      return;
    }
    setCheckingUpdate(true);
    try {
      const info = await updaterService.checkForUpdates();
      if (info) {
        setManualUpdateInfo(info);
      } else {
        Alert.alert(
          'Up to Date',
          `You are running the latest version of CineBox (v${Constants.expoConfig?.version || '1.0.0'}).`
        );
      }
    } catch {
      Alert.alert('Check Failed', 'Could not reach GitHub Releases. Please check your internet connection.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const checkDomains = async () => {
    setProbing(true);
    try {
      const active = await getActiveHDHub4uDomain();
      setHdhubDomain(active.replace(/^https?:\/\//, ''));
    } catch {
      setHdhubDomain('hdhub4u.ms');
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
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>
        {/* Native Video Engine */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>VIDEO PLAYER ENGINE</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(255, 140, 0, 0.15)' }]}>
                <Ionicons name="film-outline" size={18} color="#ff8c00" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Native External Player</Text>
                <Text style={styles.settingSubtitle}>
                  Direct system intent dispatch (VLC, MX Player, Just Player)
                </Text>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Text style={[styles.pillBadgeText, { color: '#10b981' }]}>NATIVE</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingBlock}>
              <View style={styles.settingHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                  <Ionicons name="play-circle-outline" size={18} color="#3b82f6" />
                </View>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Default Video Player</Text>
                  <Text style={styles.settingSubtitle}>
                    Pick your player or prompt the system chooser on each play
                  </Text>
                </View>
              </View>

              <View style={styles.segmentedControl}>
                {[
                  { id: 'ask' as const, label: 'Ask / Chooser' },
                  { id: 'vlc' as const, label: 'VLC' },
                  { id: 'mx' as const, label: 'MX Player' },
                  { id: 'just' as const, label: 'Just Player' },
                ].map((item) => {
                  const isActive = (preferredPlayer || 'ask') === item.id;
                  const isFocused = focusedControl === `player_${item.id}`;
                  return (
                    <Pressable
                      key={item.id}
                      focusable={true}
                      onFocus={() => setFocusedControl(`player_${item.id}`)}
                      onBlur={() => setFocusedControl(null)}
                      onPress={() => setPreferredPlayer(item.id)}
                      style={[
                        styles.segmentBtn,
                        isActive && styles.segmentBtnActive,
                        isFocused && styles.segmentBtnFocused,
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          (isActive || isFocused) && styles.segmentTextActive,
                        ]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Player Gestures & Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PLAYER GESTURES & SEEKING</Text>

          <View style={styles.card}>
            {/* Double Tap Skip Setting with Full Width Segmented Control */}
            <View style={styles.settingBlock}>
              <View style={styles.settingHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}>
                  <Ionicons name="play-forward" size={18} color="#e50914" />
                </View>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Double-Tap Skip Duration</Text>
                  <Text style={styles.settingSubtitle}>
                    Double-tap left half to rewind, right half to jump
                  </Text>
                </View>
              </View>

              <View style={styles.segmentedControl}>
                {[5, 10, 15, 30].map((sec) => {
                  const isActive = (skipSeconds || 10) === sec;
                  const isFocused = focusedControl === `skip_${sec}`;
                  return (
                    <Pressable
                      key={sec}
                      focusable={true}
                      onFocus={() => setFocusedControl(`skip_${sec}`)}
                      onBlur={() => setFocusedControl(null)}
                      onPress={() => setSkipSeconds(sec)}
                      style={[
                        styles.segmentBtn,
                        isActive && styles.segmentBtnActive,
                        isFocused && styles.segmentBtnFocused,
                      ]}>
                      <Text
                        style={[
                          styles.segmentText,
                          (isActive || isFocused) && styles.segmentTextActive,
                        ]}>
                        {sec}s
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Vertical Swipe Gestures Info */}
            <View style={styles.settingRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="hand-left-outline" size={18} color="#f59e0b" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Vertical Cinema Swipes</Text>
                <Text style={styles.settingSubtitle}>
                  Left half: Brightness • Right half: Volume
                </Text>
              </View>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>ENABLED</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Auto-Failover */}
            <View style={styles.settingRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="refresh-circle-outline" size={18} color="#10b981" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Silent Stream Auto-Failover</Text>
                <Text style={styles.settingSubtitle}>
                  Seamless background switch when a mirror stalls
                </Text>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Text style={[styles.pillBadgeText, { color: '#10b981' }]}>ACTIVE</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Updates & Version Check */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>UPDATES & DISTRIBUTION</Text>
          <View style={styles.card}>
            <Pressable
              focusable={true}
              onFocus={() => setFocusedControl('check_update')}
              onBlur={() => setFocusedControl(null)}
              onPress={handleCheckUpdateManual}
              style={[
                styles.clickableRow,
                focusedControl === 'check_update' && styles.clickableRowFocused,
              ]}
              disabled={checkingUpdate}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#e50914" />
                ) : (
                  <Ionicons name="cloud-download-outline" size={18} color="#e50914" />
                )}
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Check for Updates</Text>
                <Text style={styles.settingSubtitle}>
                  {!ADS_ENABLED
                    ? `v${Constants.expoConfig?.version || '1.0.0'} • VIP Build (OTA Disabled)`
                    : `Current version: v${Constants.expoConfig?.version || '1.0.0'} • GitHub Releases`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* Privacy & Legal Architecture */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & TRANSPARENCY</Text>
          <View style={styles.card}>
            <Pressable
              focusable={true}
              onFocus={() => setFocusedControl('privacy')}
              onBlur={() => setFocusedControl(null)}
              onPress={() => router.push('/privacy')}
              style={[
                styles.clickableRow,
                focusedControl === 'privacy' && styles.clickableRowFocused,
              ]}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="shield-checkmark" size={18} color="#10b981" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Privacy Policy & Non-Hosting Disclaimer</Text>
                <Text style={styles.settingSubtitle}>
                  Zero telemetry • No tracking • Client-side indexer only
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* Federated Provider Status */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>FEDERATED CATALOG GATEWAYS</Text>
          <View style={styles.card}>
            {/* HDHub4u */}
            <View style={styles.providerRow}>
              <View style={styles.providerLeft}>
                <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                <View>
                  <Text style={styles.providerName}>HDHub4u Gateway</Text>
                  <Text style={styles.providerSub}>Domain: {hdhubDomain}</Text>
                </View>
              </View>
              {probing ? (
                <ActivityIndicator size="small" color="#10b981" />
              ) : (
                <TouchableOpacity onPress={checkDomains} style={styles.refreshBtn}>
                  <Ionicons name="refresh" size={14} color="#10b981" />
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
                  <Text style={styles.providerSub}>Remux / Web-DL 2160p</Text>
                </View>
              </View>
              <View style={[styles.pillBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Text style={[styles.pillBadgeText, { color: '#10b981' }]}>ONLINE</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Ad & Monetization Status */}
            <View style={styles.providerRow}>
              <View style={styles.providerLeft}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: !ADS_ENABLED ? '#f59e0b' : '#10b981',
                    },
                  ]}
                />
                <View>
                  <Text style={styles.providerName}>
                    {!ADS_ENABLED ? 'Creator VIP Mode' : 'Sponsor Network'}
                  </Text>
                  <Text style={styles.providerSub}>
                    {!ADS_ENABLED
                      ? 'Ad-Free Developer Build'
                      : 'Active • Rewarded ad on video play'}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.pillBadge,
                  {
                    backgroundColor: !ADS_ENABLED
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.12)',
                  },
                ]}>
                <Text
                  style={[
                    styles.pillBadgeText,
                    {
                      color: !ADS_ENABLED ? '#f59e0b' : '#10b981',
                    },
                  ]}>
                  {!ADS_ENABLED ? 'VIP' : 'ENABLED'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Data & Cache */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>STORAGE & LOCAL DATA</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(156, 163, 175, 0.12)' }]}>
                <Ionicons name="time-outline" size={18} color="#9ca3af" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Watch History</Text>
                <Text style={styles.settingSubtitle}>Saved resume timestamps</Text>
              </View>
              <Text style={styles.countBadge}>{watchHistory.length} items</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(156, 163, 175, 0.12)' }]}>
                <Ionicons name="bookmark-outline" size={18} color="#9ca3af" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Watchlist</Text>
                <Text style={styles.settingSubtitle}>Saved movies and series</Text>
              </View>
              <Text style={styles.countBadge}>{favorites.length} items</Text>
            </View>

            <View style={styles.divider} />

            <Pressable
              focusable={true}
              onFocus={() => setFocusedControl('clear_history')}
              onBlur={() => setFocusedControl(null)}
              onPress={handleClearHistory}
              style={[
                styles.clickableRow,
                focusedControl === 'clear_history' && styles.clickableRowFocused,
              ]}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </View>
              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingTitle, { color: '#ef4444' }]}>Clear Watch History</Text>
                <Text style={styles.settingSubtitle}>Reset local playback positions</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#ef4444" />
            </Pressable>
          </View>
        </View>

        <View style={styles.aboutWrap}>
          <Text style={styles.aboutTitle}>
            CineBox v{Constants.expoConfig?.version || '1.0.0'} {!ADS_ENABLED ? '👑 VIP' : ''}
          </Text>
          <Text style={styles.aboutSub}>Engineered for pure cinematic playback.</Text>
        </View>
      </ScrollView>
      <UpdateModal
        updateInfo={manualUpdateInfo}
        visible={!!manualUpdateInfo}
        onClose={() => setManualUpdateInfo(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#12121a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e1e2c',
    overflow: 'hidden',
  },
  settingBlock: {
    padding: 16,
    gap: 12,
  },
  settingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  settingSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1e1e2c',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#e50914',
  },
  segmentBtnFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    backgroundColor: '#e50914',
    transform: [{ scale: 1.05 }],
  },
  segmentText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  clickableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  clickableRowFocused: {
    borderColor: '#ffffff',
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderRadius: 12,
    transform: [{ scale: 1.01 }],
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  providerName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  providerSub: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  pillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillBadgeText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countBadge: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#1a1a24',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a24',
  },
  aboutWrap: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  aboutTitle: {
    color: '#4b5563',
    fontSize: 13,
    fontWeight: '700',
  },
  aboutSub: {
    color: '#374151',
    fontSize: 11,
  },
});
