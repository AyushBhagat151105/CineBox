import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sleek Minimalist Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Privacy & Disclaimer</Text>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#10b981" />
            <Text style={styles.heroBadgeText}>CLIENT-SIDE ARCHITECTURE</Text>
          </View>
          <Text style={styles.heroTitle}>Your Privacy is Built-In</Text>
          <Text style={styles.heroSubtitle}>
            CineBox is an open-source federated indexer and native media player. No tracking, no user accounts, and 100% on-device data sovereignty.
          </Text>
        </View>

        {/* Section 1: Non-Hosting Disclaimer */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconPill, { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}>
              <Ionicons name="server-outline" size={18} color="#e50914" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.cardTitle}>No Content Hosting</Text>
              <Text style={styles.cardCategory}>LEGAL ARCHITECTURE</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            CineBox does not upload, store, host, or distribute any media files, copyrighted videos, or streams on any server.
          </Text>
          <View style={styles.divider} />
          <Text style={styles.cardSubBody}>
            The app operates exclusively as a federated search indexer and media playback client. It parses publicly accessible third-party web directories in real-time and streams directly from those sources to your device.
          </Text>
        </View>

        {/* Section 2: Zero Tracking & Telemetry */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconPill, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="eye-off-outline" size={18} color="#3b82f6" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.cardTitle}>Zero Tracking & Telemetry</Text>
              <Text style={styles.cardCategory}>DATA SOVEREIGNTY</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View style={[styles.bulletDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>No User Accounts</Text>
                <Text style={styles.featureDesc}>No email, phone number, sign-in, or registration is ever required.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.bulletDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>Zero Analytics or Trackers</Text>
                <Text style={styles.featureDesc}>No Google Analytics, advertising identifiers, or telemetry SDKs are bundled.</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.bulletDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>100% Local Device Storage</Text>
                <Text style={styles.featureDesc}>Your watch history and bookmarks remain strictly within your device's sandbox.</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: Third-Party Infrastructure */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconPill, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Ionicons name="cloud-outline" size={18} color="#f59e0b" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.cardTitle}>Third-Party Infrastructure</Text>
              <Text style={styles.cardCategory}>NETWORK SESSIONS</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            When you play a stream, your device establishes a direct connection with the third-party host or CDN serving the file. CineBox has no control over external third-party hosts or their availability.
          </Text>
        </View>

        {/* Section 4: User Responsibility */}
        <View style={styles.sectionCard}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconPill, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
              <Ionicons name="shield-outline" size={18} color="#a855f7" />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.cardTitle}>User Responsibility</Text>
              <Text style={styles.cardCategory}>COMPLIANCE & TERMS</Text>
            </View>
          </View>
          <Text style={styles.cardBody}>
            CineBox is an open-source research and interoperability project. Users are responsible for ensuring their usage conforms with local laws and regulations governing digital media.
          </Text>
        </View>

        <View style={styles.footerWrap}>
          <Text style={styles.footerVersion}>CineBox Client v1.0.0</Text>
          <Text style={styles.footerTagline}>Designed for simplicity, speed, and privacy.</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topBarRight: {
    width: 38,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#12121a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e1e2c',
    padding: 20,
    alignItems: 'flex-start',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  heroBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: '#12121a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e1e2c',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cardCategory: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  cardBody: {
    color: '#d1d5db',
    fontSize: 13,
    lineHeight: 20,
  },
  cardSubBody: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: '#1c1c28',
    marginVertical: 12,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 17,
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  footerVersion: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '700',
  },
  footerTagline: {
    color: '#374151',
    fontSize: 11,
  },
});
