import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '@/providers';
import {
  MediaDetails,
  ProviderId,
  Release,
} from '@/types';
import { ProviderBadge, QualityBadge, ReleaseBadgeRow, TrailerPlayer, TrailerPlayerRef } from '@/components';
import { useAppStore, usePlayerStore } from '@/store';
import { cleanDisplayTitle } from '@/utils';
import { vlcService } from '@/services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Extract primitive route params
  const {
    provider,
    id: mediaId,
    title: paramTitle = '',
    year: paramYear,
    posterUrl: paramPosterUrl,
    mediaType: paramMediaType,
    resumeSeconds: paramResumeSeconds,
  } = useLocalSearchParams<{
    provider: ProviderId;
    id: string;
    title?: string;
    year?: string;
    posterUrl?: string;
    mediaType?: 'movie' | 'series';
    resumeSeconds?: string;
  }>();

  // Selective Zustand hooks to avoid unnecessary re-renders
  const isFav = useAppStore((s) => s.favorites.some((f) => f.mediaId === mediaId));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const getProgress = useAppStore((s) => s.getProgress);
  const setPlayback = usePlayerStore((s) => s.setPlayback);
  const setAvailableReleases = usePlayerStore((s) => s.setAvailableReleases);

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [resolvingRelease, setResolvingRelease] = useState<string | null>(null);
  const trailerRef = useRef<TrailerPlayerRef>(null);

  // Quality & Series Organization States
  const [selectedQuality, setSelectedQuality] = useState<string>('all');
  const [selectedSeason, setSelectedSeason] = useState<number | 'packs' | 'all'>('all');
  const [selectedEpisode, setSelectedEpisode] = useState<number | 'all'>('all');

  // TV Remote Focus States
  const [focusedQuickPlay, setFocusedQuickPlay] = useState(false);
  const [focusedFav, setFocusedFav] = useState(false);
  const [focusedQuality, setFocusedQuality] = useState<string | null>(null);
  const [focusedRel, setFocusedRel] = useState<string | null>(null);

  // Load media and releases once per unique (provider, mediaId)
  useEffect(() => {
    let active = true;

    async function load() {
      if (!provider || !mediaId) return;

      try {
        setLoadingReleases(true);
        const prov = aggregator.getProvider(provider);

        if (prov) {
          try {
            const d = await prov.details(mediaId);
            if (active) setDetails(d);
          } catch {
            if (active) {
              setDetails({
                id: { provider, value: mediaId },
                title: paramTitle || 'Unknown Title',
                mediaType: paramMediaType || 'movie',
                year: paramYear,
                posterUrl: paramPosterUrl,
                genres: [],
                dubs: [],
                seasons: [],
              });
            }
          }
        }

        const rels = await aggregator.getAllReleases([{ provider, id: mediaId }]);
        if (active) {
          setReleases(rels);
          setAvailableReleases(rels);

          const seasonsFound = Array.from(
            new Set(rels.filter((r) => r.season !== undefined).map((r) => r.season!))
          ).sort((a, b) => a - b);

          if (seasonsFound.length > 0) {
            setSelectedSeason(seasonsFound[0]);
          }
        }
      } catch (err) {
        console.warn('Failed loading releases:', err);
      } finally {
        if (active) {
          setLoadingReleases(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [provider, mediaId]);

  const isSeries =
    paramMediaType === 'series' ||
    details?.mediaType === 'series' ||
    releases.some((r) => r.season !== undefined || r.episode !== undefined);

  // Available seasons list
  const availableSeasons = useMemo(() => {
    const set = new Set<number>();
    let hasPacks = false;
    for (const r of releases) {
      if (r.season !== undefined) set.add(r.season);
      if (r.episode === undefined && /pack|complete/i.test(r.filename)) hasPacks = true;
    }
    return {
      seasons: Array.from(set).sort((a, b) => a - b),
      hasPacks,
    };
  }, [releases]);

  // Available episodes for selected season
  const availableEpisodes = useMemo(() => {
    if (selectedSeason === 'all' || selectedSeason === 'packs') return [];
    const eps = new Set<number>();
    for (const r of releases) {
      if (r.season === selectedSeason && r.episode !== undefined) {
        eps.add(r.episode);
      }
    }
    return Array.from(eps).sort((a, b) => a - b);
  }, [releases, selectedSeason]);

  // Filtered releases based on Season, Episode and Quality
  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      // 1. Season filter
      if (isSeries && availableSeasons.seasons.length > 0) {
        if (selectedSeason === 'packs') {
          if (r.episode !== undefined) return false;
        } else if (selectedSeason !== 'all') {
          if (r.season !== undefined && r.season !== selectedSeason) return false;
        }
      }

      // 2. Episode filter - STRICT: if episode is selected, MUST match and exclude packs
      if (selectedEpisode !== 'all' && selectedSeason !== 'packs') {
        if (r.episode !== selectedEpisode) return false;
      }

      // 3. Quality filter
      if (selectedQuality !== 'all') {
        const q = (r.quality || '').toLowerCase();
        if (selectedQuality === '4k' && !q.includes('4k') && !q.includes('2160')) return false;
        if (selectedQuality === '1080p' && !q.includes('1080')) return false;
        if (selectedQuality === '720p' && !q.includes('720')) return false;
        if (selectedQuality === '480p' && !q.includes('480')) return false;
      }

      return true;
    });
  }, [releases, isSeries, availableSeasons, selectedSeason, selectedEpisode, selectedQuality]);

  // Active watch progress for dynamic Resume / Watched status
  const currentActiveProgress = useMemo(() => {
    const s = typeof selectedSeason === 'number' ? selectedSeason : undefined;
    const ep = typeof selectedEpisode === 'number' ? selectedEpisode : undefined;
    return getProgress(mediaId, s, ep) || getProgress(mediaId);
  }, [getProgress, mediaId, selectedSeason, selectedEpisode]);

  const hasWatchProgress =
    currentActiveProgress &&
    currentActiveProgress.positionSeconds > 10 &&
    !currentActiveProgress.completed;
  const isWatched = Boolean(currentActiveProgress?.completed);

  // Format seconds to "1h 45m" or "14m"
  const formatProgressTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Quality counts for badges
  const qualityCounts = useMemo(() => {
    let count4k = 0;
    let count1080 = 0;
    let count720 = 0;
    let count480 = 0;

    for (const r of releases) {
      const q = (r.quality || '').toLowerCase();
      if (q.includes('4k') || q.includes('2160')) count4k++;
      else if (q.includes('1080')) count1080++;
      else if (q.includes('720')) count720++;
      else if (q.includes('480')) count480++;
    }

    return { total: releases.length, count4k, count1080, count720, count480 };
  }, [releases]);

  const handlePlayRelease = async (release: Release) => {
    console.log(`[Details] ▶️ User clicked Play for release: "${release.filename}"`);
    setResolvingRelease(release.filename);
    try {
      // Find candidate mirrors for seamless auto-failover
      const candidates = [
        release,
        ...releases.filter(
          (r) =>
            r !== release &&
            r.season === release.season &&
            r.episode === release.episode
        ),
      ];
      console.log(`[Details] 📋 Prepared ${candidates.length} candidate(s) for playback failover`);

      const source = await aggregator.resolveWithFallback(candidates);
      const resumeSec = paramResumeSeconds
        ? parseInt(paramResumeSeconds, 10)
        : currentActiveProgress?.positionSeconds || 0;

      console.log(`[Details] 🎯 Stream resolved successfully: ${source.url.slice(0, 80)}... (resume: ${resumeSec}s)`);

      setPlayback(source, release, resumeSec);
      setAvailableReleases(candidates.length > 0 ? candidates : releases);

      const preferredPlayer = useAppStore.getState().preferredPlayer;
      console.log(`[Details] 🚀 Handing off to VLC Service (preferredPlayer: ${preferredPlayer})`);
      await vlcService.launch({
        streamUrl: source.url,
        title: cleanDisplayTitle(paramTitle || details?.title || release.filename),
        mediaId,
        provider,
        posterUrl: paramPosterUrl || details?.posterUrl || '',
        backdropUrl: details?.backdropUrl || paramPosterUrl || details?.posterUrl || '',
        releaseName: release.releaseName || release.filename,
        season: release.season,
        episode: release.episode,
        resumeSeconds: resumeSec,
        headers: source.headers,
        forceChooser: preferredPlayer === 'chooser',
      });
    } catch (err: any) {
      console.error(`[Details] ❌ Playback failed:`, err?.message);
      Alert.alert('Playback Failed', err.message || 'Could not resolve stream source');
    } finally {
      setResolvingRelease(null);
    }
  };

  const handleQuickPlay = async () => {
    const pool = filteredReleases.length > 0 ? filteredReleases : releases;
    if (pool.length === 0) return;
    console.log(`[Details] ⚡ Quick Play initiated across pool of ${pool.length} release(s)`);
    setResolvingRelease('quick_play');
    try {
      const source = await aggregator.resolveWithFallback(pool);
      const chosenRelease = pool[0];
      const resumeSec = paramResumeSeconds
        ? parseInt(paramResumeSeconds, 10)
        : currentActiveProgress?.positionSeconds || 0;

      console.log(`[Details] 🎯 Quick Play stream resolved: ${source.url.slice(0, 80)}... (resume: ${resumeSec}s)`);

      setPlayback(source, chosenRelease, resumeSec);
      setAvailableReleases(pool);

      const preferredPlayer = useAppStore.getState().preferredPlayer;
      console.log(`[Details] 🚀 Quick Play handing off to VLC Service (preferredPlayer: ${preferredPlayer})`);
      await vlcService.launch({
        streamUrl: source.url,
        title: cleanDisplayTitle(paramTitle || details?.title || 'Video Player'),
        mediaId,
        provider,
        posterUrl: paramPosterUrl || details?.posterUrl || '',
        backdropUrl: details?.backdropUrl || paramPosterUrl || details?.posterUrl || '',
        releaseName: chosenRelease.releaseName || chosenRelease.filename,
        season: chosenRelease.season,
        episode: chosenRelease.episode,
        resumeSeconds: resumeSec,
        headers: source.headers,
        forceChooser: preferredPlayer === 'chooser',
      });
    } catch (err: any) {
      console.error(`[Details] ❌ Quick Play failed:`, err?.message);
      Alert.alert('Auto-Play Failed', err.message || 'All mirrors exhausted');
    } finally {
      setResolvingRelease(null);
    }
  };

  const poster = details?.posterUrl || paramPosterUrl;
  const backdrop = details?.backdropUrl || poster;
  const displayTitle = cleanDisplayTitle(details?.title || paramTitle);

  return (
    <View style={styles.container}>
      {/* Top Floating Back and Favorite Buttons */}
      <View style={[styles.floatingBar, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => {
            console.log(`[Details] 🔖 Bookmark tapped for mediaId: "${mediaId}" (current isFav: ${isFav})`);
            toggleFavorite({
              mediaId,
              provider,
              title: paramTitle || details?.title || '',
              mediaType: isSeries ? 'series' : 'movie',
              posterUrl: poster,
              year: paramYear,
            });
          }}
          activeOpacity={0.7}>
          <Ionicons
            name={isFav ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isFav ? '#e50914' : '#ffffff'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Backdrop Banner with Official Autoplay Trailer (Full Brightness, 16:9 Cinematic) */}
        <TrailerPlayer
          ref={trailerRef}
          title={cleanDisplayTitle(details?.title || paramTitle)}
          year={paramYear || details?.year}
          posterUrl={poster}
          backdropUrl={backdrop}
          height={Math.round(SCREEN_WIDTH * 0.5625)}
          width={SCREEN_WIDTH}
          borderRadius={0}
          isActive={true}
          autoPlayDelay={400}
          showSoundToggle={true}
        />

        {/* Content Body */}
        <View style={styles.contentBody}>
          {/* Metadata Top Row */}
          <View style={styles.headerMetaRow}>
            <ProviderBadge provider={provider} size="medium" />
            {details?.imdbRating && (
              <View style={styles.ratingTag}>
                <Ionicons name="star" size={12} color="#fbbf24" />
                <Text style={styles.ratingText}>
                  {Number(details.imdbRating).toFixed(1)}
                </Text>
              </View>
            )}
            {paramYear ? <Text style={styles.metaYearText}>{paramYear}</Text> : null}
            {details?.duration ? (
              <Text style={styles.metaYearText}>{details.duration}</Text>
            ) : null}
            <View style={styles.mediaTypePill}>
              <Text style={styles.mediaTypeText}>
                {isSeries ? 'SERIES' : 'MOVIE'}
              </Text>
            </View>
          </View>

          {/* Cinematic Title */}
          <Text style={styles.title}>{displayTitle}</Text>

          {/* Action Row: Quick Play & Watch Trailer */}
          <View style={styles.actionRowContainer}>
            <Pressable
              focusable={true}
              onFocus={() => setFocusedQuickPlay(true)}
              onBlur={() => setFocusedQuickPlay(false)}
              style={[
                styles.quickPlayBtn,
                isWatched && styles.watchedPlayBtn,
                releases.length === 0 && styles.disabledBtn,
                focusedQuickPlay && styles.quickPlayBtnFocused,
              ]}
              onPress={handleQuickPlay}
              disabled={releases.length === 0 || resolvingRelease !== null}>
              {resolvingRelease === 'quick_play' ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <View style={styles.quickPlayContent}>
                  <Ionicons
                    name={isWatched ? 'checkmark-circle' : hasWatchProgress ? 'play-forward' : 'play'}
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.quickPlayText}>
                    {isWatched
                      ? 'Watched · Watch Again'
                      : hasWatchProgress
                      ? `Resume (${formatProgressTime(currentActiveProgress!.positionSeconds)})`
                      : filteredReleases.length > 0
                      ? `Play ${filteredReleases[0].quality}`
                      : releases.length > 0
                      ? `Play in ${releases[0].quality}`
                      : 'Finding Streams...'}
                  </Text>
                </View>
              )}
              {/* Progress bar line if resuming */}
              {hasWatchProgress && currentActiveProgress && currentActiveProgress.durationSeconds > 0 && (
                <View style={styles.buttonProgressBarBg}>
                  <View
                    style={[
                      styles.buttonProgressBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(
                            5,
                            (currentActiveProgress.positionSeconds / currentActiveProgress.durationSeconds) * 100
                          )
                        )}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </Pressable>

            <Pressable
              focusable={true}
              onFocus={() => setFocusedFav(true)}
              onBlur={() => setFocusedFav(false)}
              style={[styles.trailerActionBtn, focusedFav && styles.trailerActionBtnFocused]}
              onPress={() => trailerRef.current?.openFullscreen()}>
              <Ionicons name="film-outline" size={18} color="#ffffff" />
              <Text style={styles.trailerActionText}>Trailer</Text>
            </Pressable>
          </View>

          {/* Overview */}
          {details?.description ? (
            <View style={styles.synopsisContainer}>
              <Text style={styles.sectionHeader}>OVERVIEW</Text>
              <Text style={styles.synopsisText}>{details.description}</Text>
            </View>
          ) : null}

          {/* Series Organization & Filters */}
          <View style={styles.releasesContainer}>
            <View style={styles.releasesHeaderRow}>
              <Text style={styles.sectionHeader}>
                RELEASES ({filteredReleases.length}/{releases.length})
              </Text>
              <Text style={styles.releasesSub}>Auto-Failover enabled</Text>
            </View>

            {/* Quality Filter Pills */}
            <View style={styles.qualityPillsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.qualityPill, selectedQuality === 'all' && styles.qualityPillActive]}
                  onPress={() => setSelectedQuality('all')}>
                  <Text style={[styles.qualityPillText, selectedQuality === 'all' && styles.qualityPillTextActive]}>
                    All ({qualityCounts.total})
                  </Text>
                </TouchableOpacity>

                {qualityCounts.count4k > 0 && (
                  <TouchableOpacity
                    style={[styles.qualityPill, selectedQuality === '4k' && styles.qualityPillActive]}
                    onPress={() => setSelectedQuality('4k')}>
                    <Text style={[styles.qualityPillText, selectedQuality === '4k' && styles.qualityPillTextActive]}>
                      4K UHD ({qualityCounts.count4k})
                    </Text>
                  </TouchableOpacity>
                )}

                {qualityCounts.count1080 > 0 && (
                  <TouchableOpacity
                    style={[styles.qualityPill, selectedQuality === '1080p' && styles.qualityPillActive]}
                    onPress={() => setSelectedQuality('1080p')}>
                    <Text style={[styles.qualityPillText, selectedQuality === '1080p' && styles.qualityPillTextActive]}>
                      1080p FHD ({qualityCounts.count1080})
                    </Text>
                  </TouchableOpacity>
                )}

                {qualityCounts.count720 > 0 && (
                  <TouchableOpacity
                    style={[styles.qualityPill, selectedQuality === '720p' && styles.qualityPillActive]}
                    onPress={() => setSelectedQuality('720p')}>
                    <Text style={[styles.qualityPillText, selectedQuality === '720p' && styles.qualityPillTextActive]}>
                      720p HD ({qualityCounts.count720})
                    </Text>
                  </TouchableOpacity>
                )}

                {qualityCounts.count480 > 0 && (
                  <TouchableOpacity
                    style={[styles.qualityPill, selectedQuality === '480p' && styles.qualityPillActive]}
                    onPress={() => setSelectedQuality('480p')}>
                    <Text style={[styles.qualityPillText, selectedQuality === '480p' && styles.qualityPillTextActive]}>
                      480p ({qualityCounts.count480})
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {/* Season Tabs (for TV Series) */}
            {isSeries && availableSeasons.seasons.length > 0 && (
              <View style={styles.seasonsSection}>
                <Text style={styles.subSectionTitle}>SEASONS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonsScroll}>
                  {availableSeasons.seasons.map((s) => (
                    <TouchableOpacity
                      key={`s_${s}`}
                      style={[styles.seasonTab, selectedSeason === s && styles.seasonTabActive]}
                      onPress={() => {
                        setSelectedSeason(s);
                        setSelectedEpisode('all');
                      }}>
                      <Text style={[styles.seasonTabText, selectedSeason === s && styles.seasonTabTextActive]}>
                        Season {s}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {availableSeasons.hasPacks && (
                    <TouchableOpacity
                      style={[styles.seasonTab, selectedSeason === 'packs' && styles.seasonTabActive]}
                      onPress={() => {
                        setSelectedSeason('packs');
                        setSelectedEpisode('all');
                      }}>
                      <Text style={[styles.seasonTabText, selectedSeason === 'packs' && styles.seasonTabTextActive]}>
                        Complete Packs
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.seasonTab, selectedSeason === 'all' && styles.seasonTabActive]}
                    onPress={() => {
                      setSelectedSeason('all');
                      setSelectedEpisode('all');
                    }}>
                    <Text style={[styles.seasonTabText, selectedSeason === 'all' && styles.seasonTabTextActive]}>
                      All Seasons
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* Episode Grid (for TV Series when a specific season is selected) */}
            {isSeries && availableEpisodes.length > 0 && (
              <View style={styles.episodesSection}>
                <Text style={styles.subSectionTitle}>EPISODES</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.episodesScroll}>
                  <TouchableOpacity
                    style={[styles.episodeChip, selectedEpisode === 'all' && styles.episodeChipActive]}
                    onPress={() => setSelectedEpisode('all')}>
                    <Text style={[styles.episodeChipText, selectedEpisode === 'all' && styles.episodeChipTextActive]}>
                      All
                    </Text>
                  </TouchableOpacity>

                  {availableEpisodes.map((ep) => {
                    const s = typeof selectedSeason === 'number' ? selectedSeason : undefined;
                    const epProg = getProgress(mediaId, s, ep);
                    const epDone = epProg?.completed;
                    const isSelected = selectedEpisode === ep;

                    return (
                      <TouchableOpacity
                        key={`ep_${ep}`}
                        style={[
                          styles.episodeChip,
                          isSelected && styles.episodeChipActive,
                          epDone && styles.episodeChipWatched,
                        ]}
                        onPress={() => setSelectedEpisode(ep)}>
                        {epDone ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color="#10b981"
                            style={{ marginRight: 3 }}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.episodeChipText,
                            isSelected && styles.episodeChipTextActive,
                            epDone && styles.episodeChipTextWatched,
                          ]}>
                          EP {ep < 10 ? `0${ep}` : ep}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Releases List */}
            {loadingReleases ? (
              <View style={styles.releasesLoading}>
                <ActivityIndicator size="small" color="#e50914" />
                <Text style={styles.releasesLoadingText}>Parsing HubCloud & stream mirrors...</Text>
              </View>
            ) : filteredReleases.length > 0 ? (
              filteredReleases.map((rel, index) => {
                const isResolving = resolvingRelease === rel.filename;
                const isDual = /dual|hindi/i.test(rel.filename);

                const relKey = `${rel.provider}_${index}`;
                const isRelFocused = focusedRel === relKey;

                return (
                  <Pressable
                    key={relKey}
                    focusable={true}
                    onFocus={() => setFocusedRel(relKey)}
                    onBlur={() => setFocusedRel((p) => (p === relKey ? null : p))}
                    style={[
                      styles.releaseCard,
                      isRelFocused && styles.releaseCardFocused,
                    ]}
                    onPress={() => handlePlayRelease(rel)}
                    disabled={resolvingRelease !== null}>
                    <View style={styles.releaseTop}>
                      <View style={styles.releaseBadges}>
                        <QualityBadge quality={rel.quality} isDualAudio={isDual} />
                        <ProviderBadge provider={rel.provider} size="small" />
                        {rel.season !== undefined && rel.episode !== undefined && (
                          <View style={styles.episodeTag}>
                            <Text style={styles.episodeTagText}>
                              S{rel.season} E{rel.episode}
                            </Text>
                          </View>
                        )}
                      </View>
                      {rel.size && <Text style={styles.releaseSize}>{rel.size}</Text>}
                    </View>

                    {/* Technical Print Feature Chips (IMAX, REMUX, 4K UHD, HDR, Audio) */}
                    <View style={styles.releaseFeatureRow}>
                      <ReleaseBadgeRow releaseName={rel.releaseName || rel.filename} maxTags={5} />
                    </View>

                    <Text numberOfLines={2} style={[styles.releaseFilename, isRelFocused && styles.releaseFilenameFocused]}>
                      {rel.filename}
                    </Text>

                    <View style={styles.releaseBottom}>
                      <Text style={styles.mirrorCount}>
                        {rel.mirrors.length} Mirror{rel.mirrors.length > 1 ? 's' : ''} (HubCloud / Direct)
                      </Text>
                      {isResolving ? (
                        <ActivityIndicator size="small" color="#e50914" />
                      ) : (
                        <View style={[styles.playLink, isRelFocused && styles.playLinkFocused]}>
                          <Text style={[styles.playLinkText, isRelFocused && styles.playLinkTextFocused]}>STREAM</Text>
                          <Ionicons name="chevron-forward" size={14} color={isRelFocused ? '#ffffff' : '#e50914'} />
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.noReleases}>
                <Text style={styles.noReleasesText}>
                  No releases found for selected season/episode/quality filter.
                </Text>
                <TouchableOpacity
                  style={styles.resetFilterBtn}
                  onPress={() => {
                    setSelectedQuality('all');
                    setSelectedSeason('all');
                    setSelectedEpisode('all');
                  }}>
                  <Text style={styles.resetFilterText}>Reset Filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
  floatingBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  backdropContainer: {
    width: SCREEN_WIDTH,
    height: 250,
    position: 'relative',
    backgroundColor: '#101018',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  fallbackBackdrop: {
    width: '100%',
    height: '100%',
    backgroundColor: '#161622',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 15, 0.65)',
  },
  contentBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ratingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  metaYearText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaTypePill: {
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  mediaTypeText: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 14,
  },
  actionRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  quickPlayBtn: {
    flex: 1,
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickPlayBtnFocused: {
    borderColor: '#ffffff',
    borderWidth: 3,
    transform: [{ scale: 1.04 }],
    elevation: 8,
    shadowColor: '#ffffff',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  trailerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1b1b28',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  trailerActionBtnFocused: {
    borderColor: '#e50914',
    borderWidth: 2.5,
    backgroundColor: '#281b1f',
    transform: [{ scale: 1.05 }],
    elevation: 6,
  },
  trailerActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickPlayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  watchedPlayBtn: {
    backgroundColor: '#1b3b2b',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  buttonProgressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  buttonProgressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  disabledBtn: {
    backgroundColor: '#2e2e38',
  },
  quickPlayText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  synopsisContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    color: '#6e6e84',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subSectionTitle: {
    color: '#8e8e9e',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  synopsisText: {
    color: '#cccccc',
    fontSize: 13,
    lineHeight: 20,
  },
  dubsContainer: {
    marginBottom: 20,
  },
  dubsScroll: {
    flexDirection: 'row',
  },
  dubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#242436',
  },
  dubText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  releasesContainer: {
    marginBottom: 20,
  },
  releasesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  releasesSub: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '600',
  },
  qualityPillsRow: {
    marginBottom: 14,
  },
  qualityPill: {
    backgroundColor: '#14141e',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#222232',
  },
  qualityPillActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  qualityPillText: {
    color: '#8e8e9e',
    fontSize: 12,
    fontWeight: '600',
  },
  qualityPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  seasonsSection: {
    marginBottom: 14,
  },
  seasonsScroll: {
    flexDirection: 'row',
  },
  seasonTab: {
    backgroundColor: '#161622',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#242436',
  },
  seasonTabActive: {
    backgroundColor: '#252538',
    borderColor: '#e50914',
  },
  seasonTabText: {
    color: '#a0a0b2',
    fontSize: 12,
    fontWeight: '600',
  },
  seasonTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  episodesSection: {
    marginBottom: 14,
  },
  episodesScroll: {
    flexDirection: 'row',
  },
  episodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#20202e',
  },
  episodeChipActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  episodeChipWatched: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  episodeChipText: {
    color: '#7e7e90',
    fontSize: 11,
    fontWeight: '600',
  },
  episodeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  episodeChipTextWatched: {
    color: '#10b981',
  },
  episodeTag: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  episodeTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  releasesLoading: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
  },
  releasesLoadingText: {
    color: '#777788',
    fontSize: 12,
  },
  releaseCard: {
    backgroundColor: '#14141e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#202030',
  },
  releaseCardFocused: {
    borderColor: '#e50914',
    borderWidth: 2.5,
    backgroundColor: '#1c1c28',
    transform: [{ scale: 1.02 }],
    shadowColor: '#e50914',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  releaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  releaseFeatureRow: {
    marginBottom: 8,
  },
  releaseBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  releaseSize: {
    color: '#8e8e9e',
    fontSize: 11,
    fontWeight: '600',
  },
  releaseFilename: {
    color: '#e4e4ed',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  releaseFilenameFocused: {
    color: '#ffffff',
    fontWeight: '800',
  },
  releaseBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mirrorCount: {
    color: '#777788',
    fontSize: 11,
  },
  playLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  playLinkFocused: {
    backgroundColor: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  playLinkText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playLinkTextFocused: {
    color: '#ffffff',
    fontWeight: '800',
  },
  noReleases: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  noReleasesText: {
    color: '#666677',
    fontSize: 13,
    textAlign: 'center',
  },
  resetFilterBtn: {
    backgroundColor: '#1e1e2c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  resetFilterText: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '700',
  },
});
