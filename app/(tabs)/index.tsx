import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '@/providers';
import { CatalogItem, WatchHistoryItem } from '@/types';
import { MovieCard, ContinueWatchingCard, ProviderBadge, TrailerPlayer } from '@/components';
import { useAppStore } from '@/store';
import { cleanMovieTitle, cleanDisplayTitle, normalizeShowTitle } from '@/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 800;
const TV_SIDEBAR_WIDTH = isTV ? 76 : 0;
const CONTENT_WIDTH = SCREEN_WIDTH - TV_SIDEBAR_WIDTH;
const NUM_COLUMNS = isTV ? 5 : 3;
const CARD_SPACING = isTV ? 14 : 8;
const HORIZONTAL_PADDING = isTV ? 20 : 12;
const CARD_WIDTH = Math.floor(
  (CONTENT_WIDTH - (HORIZONTAL_PADDING * 2) - (CARD_SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS
);

export type HomeCategory =
  | 'all'
  | 'movies'
  | 'series'
  | '4k'
  | 'bollywood'
  | 'trending';

export type GenreFilter =
  | 'all'
  | 'action'
  | 'scifi'
  | 'thriller'
  | 'comedy'
  | 'drama'
  | 'horror'
  | 'anime';

interface CategoryOption {
  id: HomeCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'all', label: 'All', icon: 'flame' },
  { id: 'movies', label: 'Movies', icon: 'film' },
  { id: 'series', label: 'Web Series', icon: 'tv' },
  { id: '4k', label: '4K IMAX', icon: 'diamond' },
  { id: 'bollywood', label: 'Bollywood', icon: 'globe' },
  { id: 'trending', label: 'Global Hits', icon: 'trending-up' },
];

const GENRES: { id: GenreFilter; label: string }[] = [
  { id: 'all', label: 'All Genres' },
  { id: 'action', label: 'Action' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'drama', label: 'Drama' },
  { id: 'horror', label: 'Horror' },
  { id: 'anime', label: 'Anime' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const watchHistory = useAppStore((s) => s.watchHistory);

  // Deduplicate and filter Continue Watching items:
  // - Never show completed content (≥90% / completed: true)
  // - Show at most ONE card per series/show (latest active episode)
  const continueWatchingList = useMemo(() => {
    const seenShows = new Set<string>();
    const result: WatchHistoryItem[] = [];

    for (const item of watchHistory) {
      // 1. Completed items (≥90% or completed: true) are finished and should not clutter "Continue Watching"
      const isCompleted =
        item.completed ||
        (item.durationSeconds > 0 && item.positionSeconds / item.durationSeconds >= 0.9);
      if (isCompleted) continue;

      // 2. Identify the series/show uniquely so a show NEVER repeats
      // If it's a TV series (season, episode, or series title), normalize title to group all seasons/episodes together
      const isSeries = item.season !== undefined || item.episode !== undefined || /season|series/i.test(item.title);
      const normalizedTitle = normalizeShowTitle(item.title);
      const showKey = isSeries ? `series_${normalizedTitle}` : `${item.provider}_${item.mediaId}`;

      if (seenShows.has(showKey)) continue;
      seenShows.add(showKey);
      result.push(item);
    }

    console.log('[HomeScreen] 📺 continueWatchingList computed:', result.map((r) => `${r.title} S${r.season}:E${r.episode} (${r.positionSeconds}s)`));
    return result;
  }, [watchHistory]);

  const flatListRef = useRef<FlatList>(null);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<HomeCategory>('all');
  const [selectedGenre, setSelectedGenre] = useState<GenreFilter>('all');

  // TV Remote Focus States
  const [focusedCat, setFocusedCat] = useState<string | null>(null);
  const [focusedGenre, setFocusedGenre] = useState<string | null>(null);
  const [focusedSearch, setFocusedSearch] = useState(false);
  const [focusedHero, setFocusedHero] = useState(false);

  // Content & Pagination States
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Spotlight & Curated Row Items (Mode A)
  const [featuredItem, setFeaturedItem] = useState<CatalogItem | null>(null);
  const [curated4k, setCurated4k] = useState<CatalogItem[]>([]);
  const [curatedBollywood, setCuratedBollywood] = useState<CatalogItem[]>([]);

  // 1. Initial / Category Switch Load
  const loadCategoryFeed = useCallback(
    async (category: HomeCategory, genre: GenreFilter, pageNum = 1) => {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const targetGenre = genre === 'all' ? undefined : genre;
        const newItems = await aggregator.browseCategory(category, pageNum, targetGenre);

        if (pageNum === 1) {
          setCatalogItems(newItems);
          setHasMore(newItems.length >= 8);

          // In "All" mode, setup Spotlight and curated rows on initial load
          if (category === 'all' && genre === 'all') {
            if (newItems.length > 0) {
              setFeaturedItem(newItems[0]);
            }
            // Fetch initial 4K and Bollywood highlights for horizontal preview
            const fourkProvider = aggregator.getProvider('fourkhdhub');
            const hdhubProvider = aggregator.getProvider('hdhub4u');

            if (fourkProvider) {
              fourkProvider.search('4k', 1).then((res) => setCurated4k(res.slice(0, 10))).catch(() => {});
            }
            if (hdhubProvider) {
              hdhubProvider.search('2026', 1).then((res) => setCuratedBollywood(res.slice(0, 10))).catch(() => {});
            }
          }
        } else {
          setCatalogItems((prev) => {
            const existingIds = new Set(prev.map((i) => `${i.id.provider}_${i.id.value}`));
            const filteredNew = newItems.filter((i) => !existingIds.has(`${i.id.provider}_${i.id.value}`));
            return [...prev, ...filteredNew];
          });
          setHasMore(newItems.length > 0);
        }
      } catch (err) {
        console.warn(`[HomeScreen] Failed loading feed for ${category}:`, err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Category / Genre Change Effect
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    loadCategoryFeed(selectedCategory, selectedGenre, 1);
  }, [selectedCategory, selectedGenre, loadCategoryFeed]);

  // Infinite Scroll Pagination Handler
  const handleEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadCategoryFeed(selectedCategory, selectedGenre, nextPage);
  }, [loading, loadingMore, hasMore, page, selectedCategory, selectedGenre, loadCategoryFeed]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadCategoryFeed(selectedCategory, selectedGenre, 1);
  }, [selectedCategory, selectedGenre, loadCategoryFeed]);

  // Card Key Extractor
  const keyExtractor = useCallback(
    (item: CatalogItem) => `${item.id.provider}_${item.id.value}`,
    []
  );

  // Continue Watching Key Extractor
  const continueWatchingKeyExtractor = useCallback(
    (item: WatchHistoryItem) => `${item.mediaId}_${item.season ?? 0}_${item.episode ?? 0}`,
    []
  );

  // Render Movie Card in Grid
  const renderGridItem = useCallback(
    ({ item }: { item: CatalogItem }) => (
      <View style={{ width: CARD_WIDTH }}>
        <MovieCard
          item={item}
          width={CARD_WIDTH}
          height={Math.round(CARD_WIDTH * 1.48)}
        />
      </View>
    ),
    []
  );

  // Header Sub-Component
  const renderHeader = useMemo(() => {
    const isDefaultAll = selectedCategory === 'all' && selectedGenre === 'all';

    return (
      <View style={styles.headerContainer}>
        {/* Category Selector Pills */}
        <View style={styles.categoriesSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsScroll}
            data={CATEGORIES}
            keyExtractor={(cat) => cat.id}
            renderItem={({ item: cat }) => {
              const active = selectedCategory === cat.id;
              const isFocused = focusedCat === cat.id;
              return (
                <Pressable
                  focusable={true}
                  onFocus={() => setFocusedCat(cat.id)}
                  onBlur={() => setFocusedCat((prev) => (prev === cat.id ? null : prev))}
                  style={[
                    styles.categoryPill,
                    active && styles.categoryPillActive,
                    isFocused && styles.categoryPillFocused,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}>
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={active || isFocused ? '#ffffff' : '#94a3b8'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.categoryPillText, (active || isFocused) && styles.categoryPillTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Secondary Genre Sub-Filters */}
        <View style={styles.genresSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsScroll}
            data={GENRES}
            keyExtractor={(g) => g.id}
            renderItem={({ item: g }) => {
              const active = selectedGenre === g.id;
              const isFocused = focusedGenre === g.id;
              return (
                <Pressable
                  focusable={true}
                  onFocus={() => setFocusedGenre(g.id)}
                  onBlur={() => setFocusedGenre((prev) => (prev === g.id ? null : prev))}
                  style={[
                    styles.genreChip,
                    active && styles.genreChipActive,
                    isFocused && styles.genreChipFocused,
                  ]}
                  onPress={() => setSelectedGenre(g.id)}>
                  <Text style={[styles.genreChipText, (active || isFocused) && styles.genreChipTextActive]}>
                    {g.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* MODE A ONLY: Continue Watching, Hero Spotlight, and Curated Carousels */}
        {isDefaultAll && (
          <>
            {/* 1. Continue Watching Section */}
            {continueWatchingList.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="play-circle" size={18} color="#e50914" />
                    <Text style={styles.sectionTitle}>Continue Watching</Text>
                  </View>
                </View>

                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={continueWatchingList}
                  renderItem={({ item }) => <ContinueWatchingCard item={item} />}
                  keyExtractor={continueWatchingKeyExtractor}
                  initialNumToRender={3}
                  maxToRenderPerBatch={3}
                  windowSize={3}
                  removeClippedSubviews
                />
              </View>
            )}

            {/* 2. Hero Spotlight Banner with Autoplay Trailer */}
            {featuredItem && (
              <View style={styles.heroBannerContainer}>
                <TrailerPlayer
                  title={cleanMovieTitle(featuredItem.title)}
                  year={featuredItem.year}
                  posterUrl={featuredItem.posterUrl}
                  backdropUrl={featuredItem.backdropUrl || featuredItem.posterUrl}
                  height={isTV ? 260 : 230}
                  width={CONTENT_WIDTH - (HORIZONTAL_PADDING * 2)}
                  borderRadius={12}
                  isActive={true}
                  autoPlayDelay={1500}
                  showSoundToggle={true}>
                  <Pressable
                    focusable={true}
                    onFocus={() => setFocusedHero(true)}
                    onBlur={() => setFocusedHero(false)}
                    style={[styles.heroBannerTouch, focusedHero && styles.heroBannerFocused]}
                    onPress={() =>
                      router.push({
                        pathname: '/details',
                        params: {
                          provider: featuredItem.id.provider,
                          id: featuredItem.id.value,
                          title: cleanMovieTitle(featuredItem.title),
                          posterUrl: featuredItem.posterUrl || '',
                          mediaType: featuredItem.mediaType,
                        },
                      })
                    }>
                    <View style={styles.heroOverlay}>
                      <View style={styles.heroBadges}>
                        <ProviderBadge provider={featuredItem.id.provider} size="medium" />
                        <View style={styles.heroFeaturedBadge}>
                          <Text style={styles.heroFeaturedText}>SPOTLIGHT</Text>
                        </View>
                        {featuredItem.rating && (
                          <View style={styles.heroRatingBadge}>
                            <Ionicons name="star" size={11} color="#fbbf24" />
                            <Text style={styles.heroRatingText}>{Number(featuredItem.rating).toFixed(1)}</Text>
                          </View>
                        )}
                      </View>

                      <Text numberOfLines={2} style={styles.heroTitle}>
                        {cleanMovieTitle(featuredItem.title)}
                      </Text>

                      <View style={styles.heroActionRow}>
                        <View style={[styles.heroPlayButton, focusedHero && styles.heroPlayButtonFocused]}>
                          <Ionicons name="play" size={17} color={focusedHero ? '#ffffff' : '#000000'} />
                          <Text style={[styles.heroPlayText, focusedHero && styles.heroPlayTextFocused]}>Watch Now</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </TrailerPlayer>
              </View>
            )}

            {/* 3. 4K Ultra HD & IMAX Carousel */}
            {curated4k.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>4K Ultra HD & IMAX Master Prints</Text>
                    <ProviderBadge provider="fourkhdhub" size="small" />
                  </View>
                </View>

                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={curated4k}
                  renderItem={({ item }) => (
                    <MovieCard
                      item={item}
                      width={isTV ? 150 : 115}
                      height={isTV ? 222 : 170}
                    />
                  )}
                  keyExtractor={keyExtractor}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  removeClippedSubviews
                />
              </View>
            )}

            {/* 4. Bollywood & Dual Audio Carousel */}
            {curatedBollywood.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Bollywood & Hindi Dubbed</Text>
                    <ProviderBadge provider="hdhub4u" size="small" />
                  </View>
                </View>

                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={curatedBollywood}
                  renderItem={({ item }) => (
                    <MovieCard
                      item={item}
                      width={isTV ? 150 : 115}
                      height={isTV ? 222 : 170}
                    />
                  )}
                  keyExtractor={keyExtractor}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={3}
                  removeClippedSubviews
                />
              </View>
            )}
          </>
        )}

        {/* Section Title for the Infinite Grid */}
        <View style={styles.gridHeaderRow}>
          <View style={styles.gridHeaderLeft}>
            <Ionicons
              name={
                selectedCategory === 'series'
                  ? 'tv-outline'
                  : selectedCategory === '4k'
                  ? 'diamond-outline'
                  : 'film-outline'
              }
              size={18}
              color="#e50914"
            />
            <Text style={styles.gridHeaderTitle}>
              {selectedCategory === 'all'
                ? 'EXPLORE ALL RELEASES'
                : `${CATEGORIES.find((c) => c.id === selectedCategory)?.label.toUpperCase()} CATALOG`}
            </Text>
          </View>
          <Text style={styles.gridHeaderCount}>{catalogItems.length} Titles Loaded</Text>
        </View>
      </View>
    );
  }, [
    selectedCategory,
    selectedGenre,
    continueWatchingList,
    featuredItem,
    curated4k,
    curatedBollywood,
    catalogItems.length,
    focusedCat,
    focusedGenre,
    focusedHero,
    continueWatchingKeyExtractor,
    keyExtractor,
    router,
  ]);

  // Footer Component for Infinite Scroll Loading Spinner
  const renderFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#e50914" />
          <Text style={styles.footerLoaderText}>Loading more movies & series...</Text>
        </View>
      );
    }
    if (!hasMore && catalogItems.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>You have reached the end of the catalog</Text>
        </View>
      );
    }
    return undefined;
  }, [loadingMore, hasMore, catalogItems.length]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="film" size={26} color="#e50914" />
          <Text style={styles.brandTitle}>
            CINE<Text style={styles.brandAccent}>BOX</Text>
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            focusable={true}
            onFocus={() => setFocusedSearch(true)}
            onBlur={() => setFocusedSearch(false)}
            style={[styles.searchButton, focusedSearch && styles.searchButtonFocused]}
            onPress={() => router.push('/(tabs)/search')}>
            <Ionicons name="search" size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {/* Main Infinite Scroll Virtualized Grid */}
      {loading ? (
        <View style={styles.mainLoaderContainer}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loaderText}>Aggregating HDHub4u & 4KHDHub...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          key={`grid_${NUM_COLUMNS}`}
          data={catalogItems}
          keyExtractor={keyExtractor}
          renderItem={renderGridItem}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e50914"
              colors={['#e50914']}
            />
          }
        />
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
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandAccent: {
    color: '#e50914',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#181824',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  searchButtonFocused: {
    backgroundColor: '#e50914',
    borderColor: '#ffffff',
    transform: [{ scale: 1.15 }],
  },
  headerContainer: {
    paddingBottom: 8,
  },
  categoriesSection: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  genresSection: {
    paddingBottom: 10,
  },
  pillsScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222232',
  },
  categoryPillActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  categoryPillFocused: {
    borderColor: '#ffffff',
    borderWidth: 2.5,
    backgroundColor: '#e50914',
    transform: [{ scale: 1.12 }],
    shadowColor: '#e50914',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  categoryPillText: {
    color: '#94a3b8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  genreChip: {
    backgroundColor: '#12121a',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1d1d2b',
  },
  genreChipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  genreChipFocused: {
    borderColor: '#ffffff',
    borderWidth: 2.5,
    backgroundColor: '#1d4ed8',
    transform: [{ scale: 1.15 }],
    shadowColor: '#3b82f6',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  genreChipText: {
    color: '#717182',
    fontSize: 11.5,
    fontWeight: '600',
  },
  genreChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 60,
  },
  columnWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    justifyContent: 'flex-start',
    gap: CARD_SPACING,
    marginBottom: 12,
  },
  section: {
    marginTop: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  heroBannerContainer: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 6,
    marginBottom: 18,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#14141e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroBannerTouch: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    borderWidth: 3,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  heroBannerFocused: {
    borderColor: '#e50914',
    transform: [{ scale: 1.02 }],
    shadowColor: '#e50914',
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 12,
  },
  heroOverlay: {
    padding: 16,
    backgroundColor: 'rgba(10, 10, 15, 0.78)',
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroFeaturedBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroFeaturedText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heroRatingText: {
    color: '#fbbf24',
    fontSize: 10.5,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    lineHeight: 22,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    gap: 6,
  },
  heroPlayButtonFocused: {
    backgroundColor: '#e50914',
  },
  heroPlayText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  heroPlayTextFocused: {
    color: '#ffffff',
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  gridHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridHeaderTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gridHeaderCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  mainLoaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#777788',
    fontSize: 12,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  footerEnd: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerEndText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
