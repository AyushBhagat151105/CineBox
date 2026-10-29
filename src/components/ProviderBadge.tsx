import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProviderId } from '@/types';

interface ProviderBadgeProps {
  provider: ProviderId;
  size?: 'small' | 'medium';
}

const PROVIDER_CONFIG: Record<
  ProviderId,
  { label: string; bg: string; text: string; border: string }
> = {
  hdhub4u: {
    label: 'HDHub4u',
    bg: 'rgba(16, 185, 129, 0.15)',
    text: '#10b981',
    border: 'rgba(16, 185, 129, 0.4)',
  },
  fourkhdhub: {
    label: '4KHDHub',
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.4)',
  },
  addons: {
    label: 'Stremio',
    bg: 'rgba(147, 51, 234, 0.15)',
    text: '#c084fc',
    border: 'rgba(147, 51, 234, 0.4)',
  },
  bdix: {
    label: 'BDIX',
    bg: 'rgba(59, 130, 246, 0.15)',
    text: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.4)',
  },
};

export const ProviderBadge: React.FC<ProviderBadgeProps> = ({ provider, size = 'small' }) => {
  const config = PROVIDER_CONFIG[provider] || {
    label: provider.toUpperCase(),
    bg: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    border: 'rgba(255, 255, 255, 0.2)',
  };

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        isSmall ? styles.smallBadge : styles.mediumBadge,
      ]}>
      <Text
        style={[
          styles.text,
          { color: config.text },
          isSmall ? styles.smallText : styles.mediumText,
        ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mediumBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  smallText: {
    fontSize: 10,
  },
  mediumText: {
    fontSize: 12,
  },
});
