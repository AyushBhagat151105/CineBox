import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface NavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: '/(tabs)' | '/(tabs)/search' | '/(tabs)/favorites' | '/(tabs)/settings' | '/(tabs)/downloads';
}

const TOP_NAV_ITEMS: NavItem[] = [
  { id: 'search', label: 'Search', icon: 'search', path: '/(tabs)/search' },
  { id: 'home', label: 'Home', icon: 'film', path: '/(tabs)' },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: 'downloads', label: 'Downloads', icon: 'download-outline', path: '/(tabs)/downloads' },
  { id: 'favorites', label: 'Watchlist', icon: 'bookmark', path: '/(tabs)/favorites' },
  { id: 'settings', label: 'Settings', icon: 'settings-sharp', path: '/(tabs)/settings' },
];

export function TVSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const isCurrentActive = (item: NavItem) => {
    if (item.id === 'home') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    }
    return pathname.includes(item.id);
  };

  const renderNavButton = (item: NavItem) => {
    const active = isCurrentActive(item);
    const isFocused = focusedId === item.id;

    return (
      <Pressable
        key={item.id}
        focusable={true}
        hasTVPreferredFocus={item.id === 'home'}
        onFocus={() => setFocusedId(item.id)}
        onBlur={() => setFocusedId((prev) => (prev === item.id ? null : prev))}
        onPress={() => router.push(item.path)}
        style={[
          styles.navButton,
          active && styles.navButtonActive,
          isFocused && styles.navButtonFocused,
        ]}>
        <Ionicons
          name={item.icon}
          size={22}
          color={isFocused ? '#ffffff' : active ? '#e50914' : '#8a8a9e'}
        />
        <Text
          style={[
            styles.navLabel,
            active && styles.navLabelActive,
            isFocused && styles.navLabelFocused,
          ]}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.sidebar}>
      {/* Brand Icon Header */}
      <View style={styles.brandBox}>
        <View style={styles.brandBadge}>
          <Ionicons name="film" size={20} color="#e50914" />
        </View>
      </View>

      {/* Top Navigation Links (Search, Home) */}
      <View style={styles.navGroup}>
        {TOP_NAV_ITEMS.map(renderNavButton)}
      </View>

      {/* Center Spacer to span both screen halves for D-Pad horizontal alignment */}
      <View style={styles.centerSpacer} />

      {/* Bottom Navigation Links (Watchlist, Settings) */}
      <View style={styles.navGroup}>
        {BOTTOM_NAV_ITEMS.map(renderNavButton)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 76,
    backgroundColor: '#08080c',
    borderRightWidth: 1,
    borderRightColor: '#161622',
    alignItems: 'center',
    paddingVertical: 18,
    zIndex: 100,
  },
  brandBox: {
    marginBottom: 20,
    alignItems: 'center',
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  navGroup: {
    gap: 16,
    alignItems: 'center',
    width: '100%',
  },
  centerSpacer: {
    flex: 1,
  },
  navButton: {
    width: 60,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  navButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  navButtonFocused: {
    backgroundColor: '#e50914',
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
    elevation: 12,
    shadowColor: '#e50914',
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  navLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#8a8a9e',
    marginTop: 3,
  },
  navLabelActive: {
    color: '#e50914',
    fontWeight: '800',
  },
  navLabelFocused: {
    color: '#ffffff',
    fontWeight: '900',
  },
});
