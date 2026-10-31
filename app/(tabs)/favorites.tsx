import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store';
import { MovieCard } from '@/components';
import { CatalogItem } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTV = Platform.isTV || SCREEN_WIDTH > 800;
const TV_SIDEBAR_WIDTH = isTV ? 76 : 0;
const CONTENT_WIDTH = SCREEN_WIDTH - TV_SIDEBAR_WIDTH;
const NUM_COLUMNS = isTV ? 5 : 3;
const CARD_SPACING = isTV ? 14 : 8;
const HORIZONTAL_PADDING = isTV ? 20 : 16;
const CARD_WIDTH = Math.floor(
  (CONTENT_WIDTH - (HORIZONTAL_PADDING * 2) - (CARD_SPACING * (NUM_COLUMNS - 1))) / NUM_COLUMNS
);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.48);

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const favorites = useAppStore((s) => s.favorites);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [focusedTab, setFocusedTab] = useState<string | null>(null);

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
          <Pressable
            focusable={true}
            onFocus={() => setFocusedTab('all')}
            onBlur={() => setFocusedTab((prev) => (prev === 'all' ? null : prev))}
            style={[
              styles.tab,
              filter === 'all' && styles.tabActive,
              focusedTab === 'all' && styles.tabFocused,
            ]}
            onPress={() => setFilter('all')}>
            <Text
              style={[
                styles.tabText,
                filter === 'all' && styles.tabTextActive,
                focusedTab === 'all' && styles.tabTextFocused,
              ]}>
              All
            </Text>
          </Pressable>
          <Pressable
            focusable={true}
            onFocus={() => setFocusedTab('movie')}
            onBlur={() => setFocusedTab((prev) => (prev === 'movie' ? null : prev))}
            style={[
              styles.tab,
              filter === 'movie' && styles.tabActive,
              focusedTab === 'movie' && styles.tabFocused,
            ]}
            onPress={() => setFilter('movie')}>
            <Text
              style={[
                styles.tabText,
                filter === 'movie' && styles.tabTextActive,
                focusedTab === 'movie' && styles.tabTextFocused,
              ]}>
              Movies
            </Text>
          </Pressable>
          <Pressable
            focusable={true}
            onFocus={() => setFocusedTab('series')}
            onBlur={() => setFocusedTab((prev) => (prev === 'series' ? null : prev))}
            style={[
              styles.tab,
              filter === 'series' && styles.tabActive,
              focusedTab === 'series' && styles.tabFocused,
            ]}
            onPress={() => setFilter('series')}>
            <Text
              style={[
                styles.tabText,
                filter === 'series' && styles.tabTextActive,
                focusedTab === 'series' && styles.tabTextFocused,
              ]}>
              Series
            </Text>
          </Pressable>
        </View>
      </View>

      {catalogItems.length > 0 ? (
        <FlatList
          key={`watchlist-grid-${NUM_COLUMNS}`}
          data={catalogItems}
          keyExtractor={(item) => `${item.id.provider}_${item.id.value}`}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          initialNumToRender={NUM_COLUMNS * 2}
          maxToRenderPerBatch={NUM_COLUMNS * 2}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <MovieCard item={item} width={CARD_WIDTH} height={CARD_HEIGHT} />
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
    paddingHorizontal: HORIZONTAL_PADDING,
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
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#161620',
    borderWidth: 1.5,
    borderColor: '#242436',
  },
  tabActive: {
    backgroundColor: '#262638',
    borderColor: '#383852',
  },
  tabFocused: {
    borderColor: '#ffffff',
    backgroundColor: '#e50914',
    transform: [{ scale: 1.08 }],
    elevation: 6,
  },
  tabText: {
    color: '#777788',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabTextFocused: {
    color: '#ffffff',
    fontWeight: '800',
  },
  gridContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: CARD_SPACING,
    marginBottom: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#777788',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
