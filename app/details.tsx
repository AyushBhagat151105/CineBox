import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '../src/providers/aggregator';
import {
  MediaDetails,
  ProviderId,
  Release,
  PlaybackSource,
} from '../src/types/models';
import { ProviderBadge } from '../src/components/ProviderBadge';
import { QualityBadge } from '../src/components/QualityBadge';
import { useAppStore } from '../src/store/useAppStore';
import { usePlayerStore } from '../src/store/usePlayerStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    provider: ProviderId;
    id: string;
    title: string;
    year?: string;
    posterUrl?: string;
    mediaType?: 'movie' | 'series';
    resumeSeconds?: string;
  }>();

  const { isFavorite, toggleFavorite } = useAppStore();
  const { setPlayback, setAvailableReleases } = usePlayerStore();

  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [resolvingRelease, setResolvingRelease] = useState<string | null>(null);

  const mediaId = params.id;
  const provider = params.provider;
  const isFav = isFavorite(mediaId);

  const loadMedia = useCallback(async () => {
    try {
      setLoadingReleases(true);
      const prov = aggregator.getProvider(provider);

      // Fetch details
      if (prov) {
        try {
          const d = await prov.details(mediaId);
          setDetails(d);
        } catch {
          // Fallback to basic details
          setDetails({
            id: { provider, value: mediaId },
            title: params.title || 'Unknown Title',
            mediaType: params.mediaType || 'movie',
            year: params.year,
            posterUrl: params.posterUrl,
            genres: [],
            dubs: [],
            seasons: [],
          });
        }
      }

      // Collate releases
      const rels = await aggregator.getAllReleases([{ provider, id: mediaId }]);
      setReleases(rels);
      setAvailableReleases(rels);
    } catch (err) {
      console.warn('Failed loading releases:', err);
    } finally {
      setLoadingReleases(false);
    }
  }, [provider, mediaId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handlePlayRelease = async (release: Release) => {
    setResolvingRelease(release.filename);
    try {
      const source = await aggregator.resolveWithFallback([release]);
      const resumeSec = params.resumeSeconds ? parseInt(params.resumeSeconds, 10) : 0;

      setPlayback(source, release, resumeSec);

      router.push({
        pathname: '/player',
        params: {
          title: params.title || details?.title || release.filename,
          streamUrl: source.url,
          mediaId,
          provider,
          posterUrl: params.posterUrl || details?.posterUrl || '',
          resumeSeconds: resumeSec.toString(),
        },
      });
    } catch (err: any) {
      Alert.alert('Playback Failed', err.message || 'Could not resolve stream source');
    } finally {
      setResolvingRelease(null);
    }
  };

  const handleQuickPlay = async () => {
    if (releases.length === 0) return;
    setResolvingRelease('quick_play');
    try {
      const source = await aggregator.resolveWithFallback(releases);
      const chosenRelease = releases[0];
      const resumeSec = params.resumeSeconds ? parseInt(params.resumeSeconds, 10) : 0;

      setPlayback(source, chosenRelease, resumeSec);

      router.push({
        pathname: '/player',
        params: {
          title: params.title || details?.title || 'Video Player',
          streamUrl: source.url,
          mediaId,
          provider,
          posterUrl: params.posterUrl || details?.posterUrl || '',
          resumeSeconds: resumeSec.toString(),
        },
      });
    } catch (err: any) {
      Alert.alert('Auto-Play Failed', err.message || 'All mirrors exhausted');
    } finally {
      setResolvingRelease(null);
    }
  };

  const poster = details?.posterUrl || params.posterUrl;
  const backdrop = details?.backdropUrl || poster;

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
          onPress={() =>
            toggleFavorite({
              mediaId,
              provider,
              title: params.title || details?.title || '',
              mediaType: params.mediaType || 'movie',
              posterUrl: poster,
              year: params.year,
            })
          }
          activeOpacity={0.7}>
          <Ionicons
            name={isFav ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={isFav ? '#e50914' : '#ffffff'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Backdrop Banner */}
        <View style={styles.backdropContainer}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdropImage} resizeMode="cover" />
          ) : (
            <View style={styles.fallbackBackdrop} />
          )}
          <View style={styles.backdropOverlay} />
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          <View style={styles.posterAndMeta}>
            {poster ? (
              <Image source={{ uri: poster }} style={styles.posterImage} resizeMode="cover" />
            ) : null}

            <View style={styles.metaContainer}>
              <View style={styles.providerTagRow}>
                <ProviderBadge provider={provider} size="medium" />
                {details?.imdbRating && (
                  <View style={styles.ratingTag}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={styles.ratingText}>
                      {Number(details.imdbRating).toFixed(1)}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.title}>{details?.title || params.title}</Text>

              <View style={styles.infoMetaRow}>
                {params.year ? <Text style={styles.metaText}>{params.year}</Text> : null}
                {details?.duration ? (
                  <Text style={styles.metaText}>{details.duration}</Text>
                ) : null}
                <Text style={styles.mediaTypeText}>
                  {(params.mediaType || 'movie').toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Play Action Button */}
          <TouchableOpacity
            style={[styles.quickPlayBtn, releases.length === 0 && styles.disabledBtn]}
            onPress={handleQuickPlay}
            disabled={releases.length === 0 || resolvingRelease !== null}
            activeOpacity={0.8}>
            {resolvingRelease === 'quick_play' ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#ffffff" />
                <Text style={styles.quickPlayText}>
                  {releases.length > 0 ? `Play in ${releases[0].quality}` : 'Finding Streams...'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Overview */}
          {details?.description ? (
            <View style={styles.synopsisContainer}>
              <Text style={styles.sectionHeader}>OVERVIEW</Text>
              <Text style={styles.synopsisText}>{details.description}</Text>
            </View>
          ) : null}

          {/* Dubbed Audio Languages (MovieBox) */}
          {details?.dubs && details.dubs.length > 0 && (
            <View style={styles.dubsContainer}>
              <Text style={styles.sectionHeader}>AVAILABLE DUBBED AUDIO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dubsScroll}>
                {details.dubs.map((dub) => (
                  <TouchableOpacity
                    key={dub.subjectId}
                    style={styles.dubChip}
                    onPress={() => {
                      router.replace({
                        pathname: '/details',
                        params: {
                          provider: 'moviebox',
                          id: dub.subjectId,
                          title: `${params.title} (${dub.language})`,
                          posterUrl: params.posterUrl,
                          mediaType: params.mediaType,
                        },
                      });
                    }}>
                    <Ionicons name="volume-medium" size={14} color="#10b981" />
                    <Text style={styles.dubText}>{dub.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Available Quality Releases */}
          <View style={styles.releasesContainer}>
            <View style={styles.releasesHeaderRow}>
              <Text style={styles.sectionHeader}>AVAILABLE RELEASES ({releases.length})</Text>
              <Text style={styles.releasesSub}>Auto-Failover enabled</Text>
            </View>

            {loadingReleases ? (
              <View style={styles.releasesLoading}>
                <ActivityIndicator size="small" color="#e50914" />
                <Text style={styles.releasesLoadingText}>Parsing HubCloud & stream mirrors...</Text>
              </View>
            ) : releases.length > 0 ? (
              releases.map((rel, index) => {
                const isResolving = resolvingRelease === rel.filename;
                const isDual = /dual|hindi/i.test(rel.filename);

                return (
                  <TouchableOpacity
                    key={`${rel.provider}_${index}`}
                    style={styles.releaseCard}
                    onPress={() => handlePlayRelease(rel)}
                    disabled={resolvingRelease !== null}
                    activeOpacity={0.75}>
                    <View style={styles.releaseTop}>
                      <View style={styles.releaseBadges}>
                        <QualityBadge quality={rel.quality} isDualAudio={isDual} />
                        <ProviderBadge provider={rel.provider} size="small" />
                      </View>
                      {rel.size && <Text style={styles.releaseSize}>{rel.size}</Text>}
                    </View>

                    <Text numberOfLines={2} style={styles.releaseFilename}>
                      {rel.filename}
                    </Text>

                    <View style={styles.releaseBottom}>
                      <Text style={styles.mirrorCount}>
                        {rel.mirrors.length} Mirror{rel.mirrors.length > 1 ? 's' : ''} (HubCloud / Direct)
                      </Text>
                      {isResolving ? (
                        <ActivityIndicator size="small" color="#e50914" />
                      ) : (
                        <View style={styles.playLink}>
                          <Text style={styles.playLinkText}>STREAM</Text>
                          <Ionicons name="chevron-forward" size={14} color="#e50914" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.noReleases}>
                <Text style={styles.noReleasesText}>No direct streams found for this release.</Text>
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
    marginTop: -80,
    paddingHorizontal: 16,
  },
  posterAndMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  posterImage: {
    width: 110,
    height: 165,
    borderRadius: 8,
    backgroundColor: '#1e1e2c',
    borderWidth: 1,
    borderColor: '#2e2e42',
  },
  metaContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 6,
  },
  providerTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  infoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaText: {
    color: '#8e8e9e',
    fontSize: 12,
  },
  mediaTypeText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
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
    borderWidth: 1,
    borderColor: '#202030',
  },
  releaseTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  playLinkText: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noReleases: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noReleasesText: {
    color: '#666677',
    fontSize: 13,
  },
});
