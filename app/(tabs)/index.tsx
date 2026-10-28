import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '../../src/providers/aggregator';
import { CatalogItem } from '../../src/types/models';
import { MovieCard } from '../../src/components/MovieCard';
import { ContinueWatchingCard } from '../../src/components/ContinueWatchingCard';
import { ProviderBadge } from '../../src/components/ProviderBadge';
import { useAppStore } from '../../src/store/useAppStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const watchHistory = useAppStore((s) => s.watchHistory);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredItem, setFeaturedItem] = useState<CatalogItem | null>(null);
  const [bollywoodItems, setBollywoodItems] = useState<CatalogItem[]>([]);
  const [fourkItems, setFourkItems] = useState<CatalogItem[]>([]);
  const [trendingItems, setTrendingItems] = useState<CatalogItem[]>([]);

  const fetchContent = useCallback(async () => {
    try {
      const hdhub = aggregator.getProvider('hdhub4u');
      const fourk = aggregator.getProvider('fourkhdhub');
      const mb = aggregator.getProvider('moviebox');

      const [bollyRes, fourkRes, mbRes] = await Promise.allSettled([
        hdhub ? hdhub.search('2024') : Promise.resolve([]),
        fourk ? fourk.search('4k') : Promise.resolve([]),
        mb ? mb.search('action') : Promise.resolve([]),
      ]);

      const bolly = bollyRes.status === 'fulfilled' ? bollyRes.value : [];
      const f4k = fourkRes.status === 'fulfilled' ? fourkRes.value : [];
      const mbData = mbRes.status === 'fulfilled' ? mbRes.value : [];

      setBollywoodItems(bolly);
      setFourkItems(f4k);
      setTrendingItems(mbData);

      // Select high quality featured item
      if (f4k.length > 0 && f4k[0].posterUrl) {
        setFeaturedItem(f4k[0]);
      } else if (bolly.length > 0) {
        setFeaturedItem(bolly[0]);
      } else if (mbData.length > 0) {
        setFeaturedItem(mbData[0]);
      }
    } catch (err) {
      console.warn('Failed loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchContent();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="film" size={26} color="#e50914" />
          <Text style={styles.brandTitle}>CINE<Text style={styles.brandAccent}>BOX</Text></Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.7}>
            <Ionicons name="search" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e50914"
            colors={['#e50914']}
          />
        }>
        {/* Continue Watching Section */}
        {watchHistory.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="play-circle" size={18} color="#e50914" />
                <Text style={styles.sectionTitle}>Continue Watching</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}>
              {watchHistory.map((item) => (
                <ContinueWatchingCard key={item.mediaId} item={item} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Hero Featured Banner */}
        {featuredItem && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.heroBanner}
            onPress={() =>
              router.push({
                pathname: '/details',
                params: {
                  provider: featuredItem.id.provider,
                  id: featuredItem.id.value,
                  title: featuredItem.title,
                  posterUrl: featuredItem.posterUrl || '',
                  mediaType: featuredItem.mediaType,
                },
              })
            }>
            {featuredItem.posterUrl ? (
              <Image
                source={{ uri: featuredItem.posterUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : null}

            <View style={styles.heroOverlay}>
              <View style={styles.heroBadges}>
                <ProviderBadge provider={featuredItem.id.provider} size="medium" />
                <View style={styles.heroFeaturedBadge}>
                  <Text style={styles.heroFeaturedText}>FEATURED</Text>
                </View>
              </View>

              <Text numberOfLines={2} style={styles.heroTitle}>
                {featuredItem.title}
              </Text>

              <View style={styles.heroActionRow}>
                <View style={styles.heroPlayButton}>
                  <Ionicons name="play" size={18} color="#000000" />
                  <Text style={styles.heroPlayText}>Watch Now</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.loaderText}>Aggregating HDHub4u, 4KHDHub & MovieBox...</Text>
          </View>
        ) : (
          <>
            {/* Bollywood & Dual Audio (HDHub4u) */}
            {bollywoodItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>Bollywood & Hindi Dubbed</Text>
                    <ProviderBadge provider="hdhub4u" size="small" />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}>
                  {bollywoodItems.map((item) => (
                    <MovieCard key={`${item.id.provider}_${item.id.value}`} item={item} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 4K UHD Master Quality (4KHDHub) */}
            {fourkItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>4K Ultra HD & Remux</Text>
                    <ProviderBadge provider="fourkhdhub" size="small" />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}>
                  {fourkItems.map((item) => (
                    <MovieCard key={`${item.id.provider}_${item.id.value}`} item={item} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Global Hits & Series (MovieBox) */}
            {trendingItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>MovieBox Worldwide Hits</Text>
                    <ProviderBadge provider="moviebox" size="small" />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}>
                  {trendingItems.map((item) => (
                    <MovieCard key={`${item.id.provider}_${item.id.value}`} item={item} />
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroBanner: {
    width: SCREEN_WIDTH - 24,
    height: 240,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 20,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#141420',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  heroFeaturedBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroFeaturedText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  heroPlayText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
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
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  loaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#7a7a8c',
    fontSize: 13,
  },
});
