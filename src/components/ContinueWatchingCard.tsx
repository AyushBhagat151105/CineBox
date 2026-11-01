import { aggregator } from '@/providers';
import { vlcService, downloaderService } from '@/services';
import { useAppStore, usePlayerStore } from '@/store';
import { WatchHistoryItem } from '@/types';
import { cleanDisplayTitle, normalizeShowTitle } from '@/utils';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { ProviderBadge } from './ProviderBadge';
import { ReleaseBadgeRow } from './ReleaseBadgeRow';

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  onPress?: () => void;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = React.memo(({ item }) => {
  const router = useRouter();
  const setPlayback = usePlayerStore((s) => s.setPlayback);
  const setAvailableReleases = usePlayerStore((s) => s.setAvailableReleases);
  const [isResuming, setIsResuming] = useState(false);

  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const preferredPlayer = useAppStore((s) => s.preferredPlayer);
  const downloads = useAppStore((s) => s.downloads);

  // Check if this item is downloaded and available offline on disk
  const offlineDownload = useMemo(() => {
    return downloads.find((d) => {
      if (d.status !== 'completed' || !d.fileUri) return false;
      const isSeriesItem = item.season !== undefined && item.episode !== undefined;
      if (isSeriesItem) {
        if (d.season !== item.season || d.episode !== item.episode) return false;
      }
      return (
        d.mediaId === item.mediaId ||
        normalizeShowTitle(d.title) === normalizeShowTitle(item.title)
      );
    });
  }, [downloads, item.mediaId, item.season, item.episode, item.title]);

  const isOffline = !!offlineDownload;

  const progressPercent =
    item.durationSeconds > 0
      ? Math.min(100, Math.round((item.positionSeconds / item.durationSeconds) * 100))
      : 0;

  const isSeries = item.season !== undefined && item.episode !== undefined;
  const imageUri = item.backdropUrl || item.posterUrl;

  const handleResume = async () => {
    if (isResuming) return;
    setIsResuming(true);
    try {
      // 0. Priority: If offline copy exists, launch directly without network calls!
      if (offlineDownload) {
        console.log(`[ContinueWatching] ⚡ Playing offline downloaded media for "${item.title}" at ${item.positionSeconds}s`);
        const launched = await downloaderService.playOffline(offlineDownload, item.positionSeconds);
        if (launched) {
          setIsResuming(false);
          return;
        }
      }

      // 1. Fetch available releases for this item
      const releases = await aggregator.getAllReleases([
        { provider: item.provider, id: item.mediaId },
      ]);

      if (releases.length > 0) {
        // Filter by episode if available
        let candidates = releases;
        if (item.episode !== undefined) {
          const epMatches = releases.filter(
            (r) => r.episode === item.episode && (item.season === undefined || r.season === item.season)
          );
          if (epMatches.length > 0) candidates = epMatches;
        }

        const source = await aggregator.resolveWithFallback(candidates);
        setPlayback(source, candidates[0], item.positionSeconds);
        setAvailableReleases(candidates);

        await vlcService.launch({
          streamUrl: source.url,
          title: cleanDisplayTitle(item.title),
          mediaId: item.mediaId,
          provider: item.provider,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          releaseName: candidates[0]?.releaseName || item.releaseName,
          season: item.season,
          episode: item.episode,
          resumeSeconds: item.positionSeconds,
          durationSeconds: item.durationSeconds,
          headers: source.headers,
          forceChooser: preferredPlayer === 'chooser',
        });
        return;
      }
    } catch {
      // If direct resume fails, seamlessly fallback to details page
    } finally {
      setIsResuming(false);
    }

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

  const handleLongPress = () => {
    Alert.alert(
      'Remove from Continue Watching',
      `Do you want to remove "${item.title}" from your continue watching list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFromHistory(item.mediaId, item.season, item.episode),
        },
      ]
    );
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remainingMins}m left`;
    return `${mins}m left`;
  };

  const timeLeft = Math.max(0, item.durationSeconds - item.positionSeconds);

  const [isCardFocused, setIsCardFocused] = useState(false);

  return (
    <Pressable
      focusable={true}
      onFocus={() => setIsCardFocused(true)}
      onBlur={() => setIsCardFocused(false)}
      onPress={handleResume}
      onLongPress={handleLongPress}
      style={[styles.card, isCardFocused && styles.cardFocused]}>
      {/* 16:9 Widescreen Backdrop Banner */}
      <View style={styles.thumbnailContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumbnail} />
        ) : (
          <View style={styles.fallbackThumbnail}>
            <Ionicons name="film-outline" size={32} color="#555" />
          </View>
        )}

        {/* Top Floating Badges (Series Episode, Offline Badge & Provider) */}
        <View style={styles.topBadgeRow}>
          <View style={styles.leftBadges}>
            {isSeries && (
              <View style={styles.seriesPill}>
                <Text style={styles.seriesPillText}>
                  S{item.season}:E{item.episode}
                </Text>
              </View>
            )}
            {isOffline && (
              <View style={styles.offlineBadge}>
                <Ionicons name="arrow-down-circle" size={13} color="#22c55e" />
                <Text style={styles.offlineBadgeText}>OFFLINE</Text>
              </View>
            )}
          </View>
          <ProviderBadge provider={item.provider} size="small" />
        </View>

        {/* Center Play Resume Button */}
        <View style={styles.playOverlay}>
          {isResuming ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="play" size={20} color="#ffffff" style={{ marginLeft: 2 }} />
          )}
        </View>

        {/* Netflix-style Sleek Progress Bar */}
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Media & Release Information */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {cleanDisplayTitle(item.title)}
          </Text>
          {timeLeft > 0 && <Text style={styles.timeLeft}>{formatTime(timeLeft)}</Text>}
        </View>

        {isSeries && (
          <Text numberOfLines={1} style={styles.episodeSubtitle}>
            {item.episodeTitle ? `Episode ${item.episode} · ${item.episodeTitle}` : `Episode ${item.episode}`}
          </Text>
        )}

        {/* Technical Print Feature Chips (IMAX, REMUX, 4K, HDR, Audio) */}
        <View style={styles.badgeRow}>
          <ReleaseBadgeRow releaseName={item.releaseName} maxTags={3} />
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 250,
    backgroundColor: '#12131a',
    borderRadius: 10,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1e212d',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  cardFocused: {
    borderColor: '#e50914',
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
    shadowColor: '#e50914',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
  thumbnailContainer: {
    width: '100%',
    height: 140, // 16:9 widescreen ratio
    position: 'relative',
    backgroundColor: '#171924',
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
    backgroundColor: '#171924',
  },
  topBadgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  leftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 6.5,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.6)',
  },
  offlineBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  seriesPill: {
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  seriesPillText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  progressBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressBarFill: {
    height: 3.5,
    backgroundColor: '#e50914',
  },
  info: {
    padding: 10,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  episodeSubtitle: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '500',
  },
  timeLeft: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  badgeRow: {
    marginTop: 2,
  },
});
