import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { aggregator } from '@/providers';
import { CatalogItem, MediaType, ProviderId } from '@/types';
import { MovieCard } from '@/components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 48) / 3;

type FilterProvider = 'all' | ProviderId;

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<FilterProvider>('all');
  const [selectedType, setSelectedType] = useState<'all' | MediaType>('all');
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
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={18} color="#888899" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Provider Filter Chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedProvider === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedProvider('all')}>
            <Text style={[styles.filterText, selectedProvider === 'all' && styles.filterTextActive]}>
              All Sources
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedProvider === 'hdhub4u' && styles.filterChipActiveHdhub,
            ]}
            onPress={() => setSelectedProvider('hdhub4u')}>
            <Text
              style={[
                styles.filterText,
                selectedProvider === 'hdhub4u' && styles.filterTextHdhub,
              ]}>
              HDHub4u (Bollywood)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedProvider === 'fourkhdhub' && styles.filterChipActive4k,
            ]}
            onPress={() => setSelectedProvider('fourkhdhub')}>
            <Text
              style={[
                styles.filterText,
                selectedProvider === 'fourkhdhub' && styles.filterText4k,
              ]}>
              4KHDHub (2160p)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedProvider === 'moviebox' && styles.filterChipActiveMb,
            ]}
            onPress={() => setSelectedProvider('moviebox')}>
            <Text
              style={[
                styles.filterText,
                selectedProvider === 'moviebox' && styles.filterTextMb,
              ]}>
              MovieBox (Global)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.centerText}>Searching providers simultaneously...</Text>
        </View>
      ) : filteredResults.length > 0 ? (
        <FlatList
          data={filteredResults}
          keyExtractor={(item, index) => `${item.id.provider}_${item.id.value}_${index}`}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <MovieCard item={item} width={COLUMN_WIDTH} height={COLUMN_WIDTH * 1.5} />
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
  filterText: {
    color: '#8e8e9e',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000000',
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
