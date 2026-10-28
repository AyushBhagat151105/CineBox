import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { WatchHistoryItem } from '../types/models';
import { Ionicons } from '@expo/vector-icons';
import { ProviderBadge } from './ProviderBadge';

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  onPress?: () => void;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ item }) => {
  const router = useRouter();

  const progressPercent =
    item.durationSeconds > 0
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : 0;

  const handleResume = () => {
    router.push({
      pathname: '/details',
      params: {
        provider: item.provider,
        id: item.mediaId,
        title: item.title,
        posterUrl: item.posterUrl || '',
        resumeSeconds: item.positionSeconds.toString(),
      },
    });
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remainingMins}m`;
    return `${mins}m left`;
  };

  const timeLeft = Math.max(0, item.durationSeconds - item.positionSeconds);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handleResume}
      style={styles.card}>
      <View style={styles.thumbnailContainer}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.fallbackThumbnail}>
            <Ionicons name="film" size={24} color="#555" />
          </View>
        )}

        <View style={styles.playOverlay}>
          <Ionicons name="play" size={20} color="#ffffff" />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.badgeRow}>
          <ProviderBadge provider={item.provider} size="small" />
          {timeLeft > 0 && <Text style={styles.timeLeft}>{formatTime(timeLeft)}</Text>}
        </View>
        <Text numberOfLines={1} style={styles.title}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.releaseName}>
          {item.releaseName || 'Resume playback'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: '#14141c',
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#20202c',
  },
  thumbnailContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    backgroundColor: '#1a1a24',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fallbackThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: '#e50914',
  },
  info: {
    padding: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeLeft: {
    color: '#8e8e9e',
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  releaseName: {
    color: '#777788',
    fontSize: 11,
  },
});
