import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store';
import { MovieCard } from '@/components';
import { CatalogItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 3;

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const favorites = useAppStore((s) => s.favorites);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');

  const catalogItems: CatalogItem[] = favorites
    .filter((f) => filter === 'all' || f.mediaType === filter)
    .map((f) => ({
      id: {
        provider: f.provider,
        value: f.mediaId,
      },
      title: f.title,
      mediaType: f.mediaType,
      year: f.year,
      posterUrl: f.posterUrl,
      availableProviders: [f.provider],
    }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Watchlist</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{favorites.length}</Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tab, filter === 'all' && styles.tabActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.tabText, filter === 'all' && styles.tabTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filter === 'movie' && styles.tabActive]}
            onPress={() => setFilter('movie')}>
            <Text style={[styles.tabText, filter === 'movie' && styles.tabTextActive]}>
              Movies
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, filter === 'series' && styles.tabActive]}
            onPress={() => setFilter('series')}>
            <Text style={[styles.tabText, filter === 'series' && styles.tabTextActive]}>
              Series
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {catalogItems.length > 0 ? (
        <FlatList
          data={catalogItems}
          keyExtractor={(item) => `${item.id.provider}_${item.id.value}`}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <MovieCard item={item} width={COLUMN_WIDTH} height={COLUMN_WIDTH * 1.5} />
          )}
        />
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="bookmark-outline" size={54} color="#333344" />
          <Text style={styles.emptyTitle}>Your watchlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Save movies & shows by tapping the bookmark icon on any title
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
    gap: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: '#e50914',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#161620',
  },
  tabActive: {
    backgroundColor: '#262638',
  },
  tabText: {
    color: '#777788',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#777788',
    fontSize: 13,
    textAlign: 'center',
  },
});
