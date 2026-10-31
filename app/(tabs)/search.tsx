import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '@/providers';
import { CatalogItem, MediaType, ProviderId } from '@/types';
import { MovieCard } from '@/components';

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

type FilterProvider = 'all' | ProviderId;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<FilterProvider>('all');
  const [selectedType, setSelectedType] = useState<'all' | MediaType>('all');
  const [focusedChip, setFocusedChip] = useState<string | null>(null);
  const debounceTimer = useRef<any>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await aggregator.searchAll(searchQuery.trim());
      setResults(data);
    } catch (err) {
      console.warn('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 450);
  };

  const filteredResults = results.filter((item) => {
    const providerMatches =
      selectedProvider === 'all' ||
      item.id.provider === selectedProvider ||
      item.availableProviders?.includes(selectedProvider as ProviderId);

    const typeMatches = selectedType === 'all' || item.mediaType === selectedType;

    return providerMatches && typeMatches;
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#888899" />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search movies, Bollywood, 4K UHD, series..."
            placeholderTextColor="#666677"
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(query)}
          />
          {query.length > 0 && (
            <Pressable onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={18} color="#888899" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Provider Filter Chips */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          data={[
            { id: 'all', label: 'All Sources', activeStyle: styles.filterChipActive, textActive: styles.filterTextActive },
            { id: 'hdhub4u', label: 'HDHub4u (Bollywood)', activeStyle: styles.filterChipActiveHdhub, textActive: styles.filterTextHdhub },
            { id: 'fourkhdhub', label: '4KHDHub (2160p)', activeStyle: styles.filterChipActive4k, textActive: styles.filterText4k },
          ]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const active = selectedProvider === item.id;
            const isFocused = focusedChip === item.id;

            return (
              <Pressable
                focusable={true}
                onFocus={() => setFocusedChip(item.id)}
                onBlur={() => setFocusedChip((prev) => (prev === item.id ? null : prev))}
                style={[
                  styles.filterChip,
                  active && item.activeStyle,
                  isFocused && styles.filterChipFocused,
                ]}
                onPress={() => setSelectedProvider(item.id as FilterProvider)}>
                <Text
                  style={[
                    styles.filterText,
                    active && item.textActive,
                    isFocused && styles.filterTextFocused,
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.centerText}>Searching providers simultaneously...</Text>
        </View>
      ) : filteredResults.length > 0 ? (
        <FlatList
          key={`search-grid-${NUM_COLUMNS}`}
          data={filteredResults}
          keyExtractor={(item, index) => `${item.id.provider}_${item.id.value}_${index}`}
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
      ) : query.length > 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="film-outline" size={48} color="#444455" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>Try searching by movie title, actor, or year</Text>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="search" size={48} color="#2b2b3a" />
          <Text style={styles.emptyTitle}>Federated Search</Text>
          <Text style={styles.emptySubtitle}>
            Search across HDHub4u, 4KHDHub, and MovieBox in one query
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
    paddingVertical: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161622',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: '#242436',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#161622',
    paddingBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#161620',
    borderWidth: 1,
    borderColor: '#222230',
  },
  filterChipActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  filterChipActiveHdhub: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  filterChipActive4k: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  filterChipActiveMb: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  filterChipFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    backgroundColor: '#e50914',
    transform: [{ scale: 1.1 }],
    elevation: 6,
  },
  filterText: {
    color: '#8e8e9e',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000000',
  },
  filterTextFocused: {
    color: '#ffffff',
    fontWeight: '800',
  },
  filterTextHdhub: {
    color: '#10b981',
  },
  filterText4k: {
    color: '#f59e0b',
  },
  filterTextMb: {
    color: '#ef4444',
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
    gap: 10,
  },
  centerText: {
    color: '#8e8e9e',
    fontSize: 13,
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
