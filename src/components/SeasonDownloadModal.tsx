import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProviderId, Release } from '@/types';
import { cleanDisplayTitle } from '@/utils';
import { downloaderService, formatBytes } from '@/services/downloader';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface SeasonEdition {
  key: string;
  quality: string;
  printType: string;
  sampleFilename: string;
  sizePerEpisode?: string;
  totalEstimatedSize?: string;
  totalEpisodes: number;
  episodes: Array<{ episodeNumber: number; release: Release }>;
  isDualAudio: boolean;
  tags: string[];
}

export function extractSeasonEditions(releases: Release[], seasonNumber: number): SeasonEdition[] {
  const targetReleases = releases.filter(
    (r) => (r.season === seasonNumber || r.season === undefined) && r.episode !== undefined
  );

  const map = new Map<
    string,
    {
      key: string;
      quality: string;
      printType: string;
      sampleFilename: string;
      episodesMap: Map<number, Release>;
      isDualAudio: boolean;
      sampleRelease: Release;
      tags: string[];
    }
  >();

  for (const r of targetReleases) {
    const f = (r.filename || '').toUpperCase();
    const is1080p = f.includes('1080P');
    const is720p = f.includes('720P');
    const is480p = f.includes('480P');
    const is4K = !is1080p && !is720p && !is480p && (f.includes('2160P') || f.includes('4K') || f.includes('UHD') || r.quality === '4K');

    const isRemux = f.includes('REMUX');
    const isHdr = f.includes('HDR') || f.includes('DV') || f.includes('DOLBY VISION');
    const isHevc = f.includes('HEVC') || f.includes('X265') || f.includes('10BIT');
    const isDual = /dual|hindi|multi/i.test(r.filename);

    const qualityLabel = is4K ? '4K UHD' : is1080p ? '1080p FHD' : is720p ? '720p HD' : is480p ? '480p SD' : r.quality || '1080p';
    const printType = isRemux ? 'REMUX' : isHdr ? 'HDR / DV' : isHevc ? '10-Bit HEVC' : 'WEB-DL x264';

    const tags: string[] = [];
    if (isDual) tags.push('Dual Audio (Hindi + Eng)');
    if (f.includes('ATMOS')) tags.push('Dolby Atmos');
    if (f.includes('DD5.1') || f.includes('DD+')) tags.push('5.1 Surround');
    if (f.includes('ESUB') || f.includes('ESUBS')) tags.push('English Subs');
    if (isHdr) tags.push('HDR10 / DV');
    if (isHevc) tags.push('10-Bit HEVC');

    // Clean episode indicator to group into cohesive edition
    const cleanSignature = (r.filename || '')
      .replace(/S0?\d+\s*E0?\d+/gi, '')
      .replace(/·\s*E\d+/gi, '')
      .replace(/\bE0?\d+\b/gi, '')
      .replace(/\[.*?E\d+.*?\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const key = `${qualityLabel}_${printType}_${isDual ? 'dual' : 'orig'}_${cleanSignature.slice(0, 35)}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        quality: qualityLabel,
        printType,
        sampleFilename: r.filename,
        episodesMap: new Map(),
        isDualAudio: isDual,
        sampleRelease: r,
        tags,
      });
    }
    map.get(key)!.episodesMap.set(r.episode!, r);
  }

  return Array.from(map.values()).map((ed) => {
    const eps = Array.from(ed.episodesMap.entries())
      .map(([epNum, rel]) => ({ episodeNumber: epNum, release: rel }))
      .sort((a, b) => a.episodeNumber - b.episodeNumber);

    const count = eps.length;
    let totalEstimatedSize = '';
    if (ed.sampleRelease.sizeBytes && ed.sampleRelease.sizeBytes > 0) {
      totalEstimatedSize = formatBytes(ed.sampleRelease.sizeBytes * count);
    } else if (ed.sampleRelease.size) {
      const match = ed.sampleRelease.size.match(/([\d\.]+)\s*(GB|MB|KB)/i);
      if (match) {
        const val = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const total = val * count;
        if (unit === 'MB' && total >= 1024) {
          totalEstimatedSize = `~${(total / 1024).toFixed(1)} GB`;
        } else {
          totalEstimatedSize = `~${total.toFixed(1)} ${unit}`;
        }
      }
    }

    return {
      key: ed.key,
      quality: ed.quality,
      printType: ed.printType,
      sampleFilename: ed.sampleFilename,
      sizePerEpisode: ed.sampleRelease.size,
      totalEstimatedSize,
      totalEpisodes: count,
      episodes: eps,
      isDualAudio: ed.isDualAudio,
      tags: ed.tags,
    };
  });
}

export interface SeasonDownloadModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  provider: ProviderId;
  mediaId: string;
  posterUrl?: string;
  availableSeasons: number[];
  initialSeason?: number;
  releases: Release[];
  onSeasonQueued?: (seasonNum: number, count: number) => void;
}

export const SeasonDownloadModal: React.FC<SeasonDownloadModalProps> = ({
  visible,
  onClose,
  title,
  provider,
  mediaId,
  posterUrl,
  availableSeasons,
  initialSeason,
  releases,
  onSeasonQueued,
}) => {
  const [selectedSeason, setSelectedSeason] = useState<number>(
    initialSeason || availableSeasons[0] || 1
  );
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [focusedEditionKey, setFocusedEditionKey] = useState<string | null>(null);

  // Sync selectedSeason if initialSeason changes
  React.useEffect(() => {
    if (initialSeason) {
      setSelectedSeason(initialSeason);
    } else if (availableSeasons.length > 0 && !availableSeasons.includes(selectedSeason)) {
      setSelectedSeason(availableSeasons[0]);
    }
  }, [initialSeason, availableSeasons]);

  const editions = useMemo(() => {
    return extractSeasonEditions(releases, selectedSeason);
  }, [releases, selectedSeason]);

  if (!visible) return null;

  const handleQueueEdition = async (edition: SeasonEdition) => {
    if (isEnqueuing) return;
    setIsEnqueuing(true);

    try {
      console.log(`[SeasonDownloadModal] 📥 Queuing Season ${selectedSeason} (${edition.quality} ${edition.printType}) with ${edition.episodes.length} episodes`);

      const queuedCount = await downloaderService.enqueueSeason({
        mediaId,
        title,
        provider,
        seasonNumber: selectedSeason,
        episodes: edition.episodes.map((e) => ({
          episodeNumber: e.episodeNumber,
          release: e.release,
        })),
        posterUrl,
      });

      onClose();

      if (onSeasonQueued) {
        onSeasonQueued(selectedSeason, queuedCount);
      } else {
        Alert.alert(
          'Season Queued Successfully',
          `Added ${queuedCount} episodes of Season ${selectedSeason} to download queue.\n\nEpisodes will download sequentially step-by-step in the background with live notification progress.`
        );
      }
    } catch (err: any) {
      console.error('[SeasonDownloadModal] Error queuing season:', err);
      Alert.alert('Queue Error', err?.message || 'Could not queue season downloads');
    } finally {
      setIsEnqueuing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="cloud-download" size={20} color="#e50914" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Download Season {selectedSeason}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {cleanDisplayTitle(title)} • Sequential Queue
                </Text>
              </View>
            </View>

            <Pressable
              hitSlop={10}
              onPress={onClose}
              disabled={isEnqueuing}
              style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8a8a9e" />
            </Pressable>
          </View>

          {/* Season Selector Tabs (if multiple seasons available) */}
          {availableSeasons.length > 1 && (
            <View style={styles.seasonTabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.seasonTabsContainer}>
                {availableSeasons.map((s) => {
                  const isActive = selectedSeason === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSelectedSeason(s)}
                      style={[styles.seasonTab, isActive && styles.seasonTabActive]}>
                      <Text style={[styles.seasonTabText, isActive && styles.seasonTabTextActive]}>
                        Season {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Instructions Banner */}
          <View style={styles.instructionBanner}>
            <Ionicons name="information-circle-outline" size={14} color="#a1a1aa" />
            <Text style={styles.instructionText}>
              Select your preferred edition. Episodes will download one-by-one automatically in the background.
            </Text>
          </View>

          {/* Editions List */}
          <ScrollView
            style={styles.editionsScroll}
            contentContainerStyle={styles.editionsScrollContent}
            showsVerticalScrollIndicator={true}>
            {isEnqueuing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e50914" />
                <Text style={styles.loadingText}>Adding episodes to queue...</Text>
              </View>
            ) : editions.length > 0 ? (
              editions.map((ed) => {
                const isFocused = focusedEditionKey === ed.key;
                const is4K = ed.quality.includes('4K');
                const is1080p = ed.quality.includes('1080');

                return (
                  <View
                    key={ed.key}
                    style={[styles.editionCard, isFocused && styles.editionCardFocused]}>
                    {/* Top Row: Quality Badges + Episode Count */}
                    <View style={styles.editionTopRow}>
                      <View style={styles.badgeGroup}>
                        <View
                          style={[
                            styles.qualityBadge,
                            is4K ? styles.badge4K : is1080p ? styles.badge1080 : styles.badgeSD,
                          ]}>
                          <Text style={styles.qualityBadgeText}>{ed.quality}</Text>
                        </View>
                        <View style={styles.printBadge}>
                          <Text style={styles.printBadgeText}>{ed.printType}</Text>
                        </View>
                      </View>

                      <View style={styles.episodeCountPill}>
                        <Ionicons name="layers-outline" size={12} color="#10b981" />
                        <Text style={styles.episodeCountText}>
                          {ed.totalEpisodes} Episode{ed.totalEpisodes > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Technical Feature Chips */}
                    {ed.tags.length > 0 && (
                      <View style={styles.tagsRow}>
                        {ed.tags.map((tag, idx) => (
                          <View key={idx} style={styles.tagChip}>
                            <Text style={styles.tagChipText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Sample Filename */}
                    <Text numberOfLines={2} style={styles.filenameText}>
                      {ed.sampleFilename}
                    </Text>

                    {/* Bottom Row: Size Specs & Action Button */}
                    <View style={styles.editionBottomRow}>
                      <View style={styles.sizeColumn}>
                        {ed.sizePerEpisode ? (
                          <Text style={styles.sizePerEpText}>
                            ~{ed.sizePerEpisode} / ep
                          </Text>
                        ) : null}
                        {ed.totalEstimatedSize ? (
                          <Text style={styles.totalSizeText}>
                            Total: {ed.totalEstimatedSize}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        focusable={true}
                        onFocus={() => setFocusedEditionKey(ed.key)}
                        onBlur={() => setFocusedEditionKey((p) => (p === ed.key ? null : p))}
                        onPress={() => handleQueueEdition(ed)}
                        style={({ pressed }) => [
                          styles.queueBtn,
                          pressed && styles.queueBtnPressed,
                          isFocused && styles.queueBtnFocused,
                        ]}>
                        <Ionicons name="download-outline" size={15} color="#ffffff" style={{ marginRight: 5 }} />
                        <Text style={styles.queueBtnText}>
                          Queue {ed.totalEpisodes} Eps
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="alert-circle-outline" size={36} color="#666677" />
                <Text style={styles.emptyText}>
                  No episode releases found for Season {selectedSeason}.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Close */}
          <View style={styles.footer}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isEnqueuing}>
              <Text style={styles.cancelBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 24, 520),
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: '#12121a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262638',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2d',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8a8a9e',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1c28',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seasonTabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2d',
    backgroundColor: '#0e0e14',
  },
  seasonTabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a26',
    borderWidth: 1,
    borderColor: '#2a2a3c',
  },
  seasonTabActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  seasonTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8a8a9e',
  },
  seasonTabTextActive: {
    color: '#ffffff',
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
    gap: 6,
  },
  instructionText: {
    fontSize: 11,
    color: '#9ca3af',
    flex: 1,
    lineHeight: 15,
  },
  editionsScroll: {
    flexGrow: 1,
    maxHeight: SCREEN_HEIGHT * 0.54,
  },
  editionsScrollContent: {
    padding: 14,
    gap: 12,
  },
  editionCard: {
    backgroundColor: '#181824',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262638',
    padding: 14,
  },
  editionCardFocused: {
    borderColor: '#e50914',
    backgroundColor: '#202030',
  },
  editionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badge4K: {
    backgroundColor: '#d97706',
  },
  badge1080: {
    backgroundColor: '#2563eb',
  },
  badgeSD: {
    backgroundColor: '#4b5563',
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  printBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#2a2a3e',
    borderWidth: 1,
    borderColor: '#3a3a52',
  },
  printBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  episodeCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  episodeCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  tagChip: {
    backgroundColor: '#222232',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#303046',
  },
  tagChipText: {
    fontSize: 10,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  filenameText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 10,
  },
  editionBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222232',
    paddingTop: 10,
  },
  sizeColumn: {
    justifyContent: 'center',
  },
  sizePerEpText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f8fafc',
  },
  totalSizeText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  queueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  queueBtnPressed: {
    opacity: 0.8,
  },
  queueBtnFocused: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  queueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#8a8a9e',
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#666677',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e1e2d',
    alignItems: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#8a8a9e',
    fontWeight: '600',
  },
});
