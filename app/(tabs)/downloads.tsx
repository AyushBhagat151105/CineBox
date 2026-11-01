import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store';
import { downloaderService, formatBytes } from '@/services/downloader';
import { DownloadItem } from '@/types';
import { cleanDisplayTitle } from '@/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 800;

type FilterTab = 'all' | 'completed' | 'active';

export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const downloads = useAppStore((s) => s.downloads);
  const clearCompleted = useAppStore((s) => s.clearCompletedDownloads);

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [freeSpaceBytes, setFreeSpaceBytes] = useState<number>(0);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusedTab, setFocusedTab] = useState<FilterTab | null>(null);

  // Refresh free disk storage space
  const refreshStorage = async () => {
    const space = await downloaderService.getFreeDiskSpace();
    setFreeSpaceBytes(space);
  };

  useEffect(() => {
    refreshStorage();
    downloaderService.migrateLegacyDownloads().then(refreshStorage).catch(() => {});
    const interval = setInterval(refreshStorage, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute storage used by CineBox downloads
  const totalDownloadedBytes = useMemo(() => {
    return downloads.reduce((acc, item) => {
      if (item.status === 'completed') {
        return acc + (item.bytesWritten || item.totalBytes || 0);
      }
      return acc + (item.bytesWritten || 0);
    }, 0);
  }, [downloads]);

  // Filtered download items
  const filteredDownloads = useMemo(() => {
    if (activeTab === 'completed') {
      return downloads.filter((d) => d.status === 'completed');
    }
    if (activeTab === 'active') {
      return downloads.filter((d) => d.status !== 'completed');
    }
    return downloads;
  }, [downloads, activeTab]);

  const activeCount = useMemo(() => {
    return downloads.filter((d) => d.status !== 'completed').length;
  }, [downloads]);

  const completedCount = useMemo(() => {
    return downloads.filter((d) => d.status === 'completed').length;
  }, [downloads]);

  const handlePlay = async (item: DownloadItem) => {
    console.log(`[DownloadsScreen] ▶️ Play requested for: "${item.title}"`);
    await downloaderService.playOffline(item);
  };

  const handlePause = async (id: string) => {
    await downloaderService.pauseDownload(id);
  };

  const handleResume = async (id: string) => {
    await downloaderService.resumeDownload(id);
  };

  const handleDelete = (item: DownloadItem) => {
    Alert.alert(
      'Delete Download',
      `Delete "${cleanDisplayTitle(item.title)}" from local storage? This will free up ${formatBytes(item.bytesWritten || item.totalBytes || 0)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (item.status === 'completed') {
              await downloaderService.deleteDownloadedFile(item.id);
            } else {
              await downloaderService.cancelDownload(item.id);
            }
            await refreshStorage();
          },
        },
      ]
    );
  };

  const handleClearCompleted = () => {
    if (completedCount === 0) return;
    Alert.alert(
      'Clear All Completed',
      'Do you want to delete all completed downloaded videos from device storage?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            for (const item of downloads) {
              if (item.status === 'completed') {
                await downloaderService.deleteDownloadedFile(item.id);
              }
            }
            await refreshStorage();
          },
        },
      ]
    );
  };

  const renderDownloadItem = ({ item }: { item: DownloadItem }) => {
    const isCompleted = item.status === 'completed';
    const isDownloading = item.status === 'downloading';
    const isPaused = item.status === 'paused';
    const isFailed = item.status === 'failed';
    const isCardFocused = focusedId === item.id;

    const posterSource = item.localPosterUri
      ? { uri: item.localPosterUri }
      : item.posterUrl
      ? { uri: item.posterUrl }
      : null;

    const displaySize = item.sizeFormatted || formatBytes(item.totalBytes || item.bytesWritten || 0);

    return (
      <View
        style={[
          styles.downloadCard,
          isCardFocused && styles.downloadCardFocused,
        ]}>
        {/* Left Poster Thumbnail */}
        <Pressable
          focusable={true}
          onFocus={() => setFocusedId(item.id)}
          onBlur={() => setFocusedId((p) => (p === item.id ? null : p))}
          onPress={() => (isCompleted ? handlePlay(item) : undefined)}
          style={styles.posterContainer}>
          {posterSource ? (
            <Image source={posterSource} style={styles.cardPoster} />
          ) : (
            <View style={[styles.cardPoster, styles.posterFallback]}>
              <Ionicons name="film-outline" size={24} color="#666677" />
            </View>
          )}
          {isCompleted && (
            <View style={styles.posterPlayOverlay}>
              <Ionicons name="play" size={20} color="#ffffff" />
            </View>
          )}
        </Pressable>

        {/* Center Details */}
        <View style={styles.cardInfo}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {cleanDisplayTitle(item.title)}
          </Text>

          <View style={styles.metaRow}>
            {item.season !== undefined && item.episode !== undefined && (
              <View style={styles.epTag}>
                <Text style={styles.epTagText}>
                  S{item.season} E{item.episode}
                </Text>
              </View>
            )}
            {item.quality && (
              <View style={styles.qualityTag}>
                <Text style={styles.qualityTagText}>{item.quality.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.sizeText}>{displaySize}</Text>
          </View>

          {/* Progress / Status Display */}
          {isCompleted ? (
            <View style={styles.statusRow}>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
              <Text style={styles.readyText}>Ready for offline playback</Text>
            </View>
          ) : (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(2, item.progressPercent || 0)}%`,
                      backgroundColor: isFailed ? '#ef4444' : isPaused ? '#f59e0b' : '#e50914',
                    },
                  ]}
                />
              </View>

              <View style={styles.progressStatsRow}>
                <Text style={styles.percentText}>
                  {isFailed ? 'Download Failed' : isPaused ? 'Paused' : `${item.progressPercent}%`}
                </Text>
                {isDownloading && (
                  <Text style={styles.speedText}>
                    {item.downloadSpeed || ''} {item.estimatedTimeLeft ? `• ${item.estimatedTimeLeft}` : ''}
                  </Text>
                )}
                {isFailed && item.error && (
                  <Text numberOfLines={1} style={styles.errorText}>
                    {item.error}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Right Action Controls */}
        <View style={styles.cardActions}>
          {isCompleted ? (
            <View style={styles.completedActions}>
              <Pressable
                focusable={true}
                onPress={() => handlePlay(item)}
                style={({ pressed }) => [styles.playBtn, pressed && styles.btnPressed]}>
                <Ionicons name="play" size={16} color="#ffffff" />
                <Text style={styles.playBtnText}>PLAY</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                focusable={true}
                onPress={() => handleDelete(item)}
                style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={17} color="#8a8a9e" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.activeActions}>
              {isDownloading ? (
                <Pressable
                  hitSlop={8}
                  focusable={true}
                  onPress={() => handlePause(item.id)}
                  style={styles.controlBtn}>
                  <Ionicons name="pause" size={17} color="#ffffff" />
                </Pressable>
              ) : (
                <Pressable
                  hitSlop={8}
                  focusable={true}
                  onPress={() => handleResume(item.id)}
                  style={[styles.controlBtn, styles.resumeBtn]}>
                  <Ionicons name="play" size={17} color="#ffffff" />
                </Pressable>
              )}
              <Pressable
                hitSlop={8}
                focusable={true}
                onPress={() => handleDelete(item)}
                style={styles.iconBtn}>
                <Ionicons name="close" size={18} color="#8a8a9e" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerBadge}>
            <Ionicons name="download" size={18} color="#e50914" />
          </View>
          <View>
            <Text style={styles.title}>Downloads</Text>
            <Text style={styles.subtitle}>Offline watch library & downloads</Text>
          </View>
        </View>

        {completedCount > 0 && (
          <Pressable
            focusable={true}
            onPress={handleClearCompleted}
            style={({ pressed }) => [styles.clearAllBtn, pressed && styles.btnPressed]}>
            <Ionicons name="trash-outline" size={13} color="#8a8a9e" />
            <Text style={styles.clearAllText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      {/* Storage Meter Banner */}
      <View style={styles.storageBanner}>
        <View style={styles.storageRow}>
          <View style={styles.storageInfoLeft}>
            <Ionicons name="server-outline" size={14} color="#8a8a9e" />
            <Text style={styles.storageUsedText}>
              CineBox Offline: <Text style={styles.storageHighlight}>{formatBytes(totalDownloadedBytes)}</Text>
            </Text>
          </View>
          <Text style={styles.storageFreeText}>
            {formatBytes(freeSpaceBytes)} <Text style={styles.storageFreeSub}>free</Text>
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        {[
          { id: 'all' as FilterTab, label: `All (${downloads.length})` },
          { id: 'completed' as FilterTab, label: `Downloaded (${completedCount})` },
          { id: 'active' as FilterTab, label: `Downloading (${activeCount})` },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const isFocused = focusedTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              focusable={true}
              onFocus={() => setFocusedTab(tab.id)}
              onBlur={() => setFocusedTab((p) => (p === tab.id ? null : p))}
              style={[
                styles.tabPill,
                isActive && styles.tabPillActive,
                isFocused && styles.tabPillFocused,
              ]}
              onPress={() => setActiveTab(tab.id)}>
              <Text
                style={[
                  styles.tabPillText,
                  isActive && styles.tabPillTextActive,
                  isFocused && styles.tabPillTextFocused,
                ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Downloads List or Empty State */}
      {filteredDownloads.length > 0 ? (
        <FlatList
          data={filteredDownloads}
          keyExtractor={(item) => item.id}
          renderItem={renderDownloadItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="cloud-download-outline" size={48} color="#38384a" />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'completed'
              ? 'No Completed Downloads'
              : activeTab === 'active'
              ? 'No Active Downloads'
              : 'No Downloads Yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Save movies and episodes to watch offline anywhere without an internet connection or buffering.
          </Text>

          <Pressable
            focusable={true}
            style={({ pressed }) => [styles.exploreBtn, pressed && styles.btnPressed]}
            onPress={() => router.push('/(tabs)')}>
            <Ionicons name="film-outline" size={16} color="#ffffff" />
            <Text style={styles.exploreBtnText}>Browse Movies & Series</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#8a8a9e',
    fontSize: 11.5,
    marginTop: 1,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#242436',
  },
  clearAllText: {
    fontSize: 11,
    color: '#8a8a9e',
    fontWeight: '600',
  },
  btnPressed: {
    opacity: 0.75,
  },
  storageBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#14141e',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#20202e',
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageUsedText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  storageHighlight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  storageFreeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  storageFreeSub: {
    color: '#8a8a9e',
    fontSize: 11,
    fontWeight: '400',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#161622',
    borderWidth: 1,
    borderColor: '#242436',
  },
  tabPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  tabPillFocused: {
    borderColor: '#e50914',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
  },
  tabPillText: {
    color: '#8a8a9e',
    fontSize: 12,
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  tabPillTextFocused: {
    color: '#e50914',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#13131d',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#202030',
    gap: 12,
  },
  downloadCardFocused: {
    borderColor: '#e50914',
    borderWidth: 2,
    backgroundColor: '#1a1a26',
    elevation: 6,
  },
  posterContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardPoster: {
    width: 60,
    height: 84,
    borderRadius: 8,
    backgroundColor: '#1e1e2c',
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  epTag: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e50914',
  },
  epTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  qualityTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  qualityTagText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '800',
  },
  sizeText: {
    color: '#8a8a9e',
    fontSize: 11,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  readyText: {
    color: '#10b981',
    fontSize: 11.5,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 4,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#262638',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  speedText: {
    color: '#8a8a9e',
    fontSize: 10,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 10,
    maxWidth: 160,
  },
  cardActions: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  completedActions: {
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e50914',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  playBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#242436',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBtn: {
    backgroundColor: '#e50914',
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#161622',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#777788',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
