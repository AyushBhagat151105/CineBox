import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QualityBadgeProps {
  quality: string;
  isDualAudio?: boolean;
}

export const QualityBadge: React.FC<QualityBadgeProps> = ({ quality, isDualAudio }) => {
  const is4K = /4k|2160/i.test(quality);
  const is1080 = /1080/i.test(quality);

  let bg = '#252530';
  let textColor = '#e0e0ec';
  let label = quality;

  if (is4K) {
    bg = '#f59e0b';
    textColor = '#000000';
    label = '4K UHD';
  } else if (is1080) {
    bg = '#3b82f6';
    textColor = '#ffffff';
    label = '1080p FHD';
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.text, { color: textColor }]}>{label}</Text>
      </View>
      {isDualAudio && (
        <View style={[styles.badge, styles.dualAudio]}>
          <Text style={styles.dualText}>DUAL AUDIO</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dualAudio: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 0.8,
  },
  dualText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '700',
  },
});
