import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogItem } from '../types/models';
import { ProviderBadge } from './ProviderBadge';
import { Ionicons } from '@expo/vector-icons';
import { cleanMovieTitle, cleanDisplayTitle } from '../utils/title';

interface MovieCardProps {
  item: CatalogItem;
  width?: number;
  height?: number;
  showProviders?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_WIDTH = (SCREEN_WIDTH - 48) / 3;
const DEFAULT_HEIGHT = DEFAULT_WIDTH * 1.5;

export const MovieCard: React.FC<MovieCardProps> = ({
  item,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  showProviders = true,
}) => {
  const router = useRouter();

  const cleanedTitle = cleanDisplayTitle(item.title);

  const handlePress = () => {
    router.push({
      pathname: '/details',
      params: {
        provider: item.id.provider,
        id: item.id.value,
        title: cleanedTitle,
        year: item.year || '',
        posterUrl: item.posterUrl || '',
        mediaType: item.mediaType,
      },
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={[styles.container, { width }]}>
      <View style={[styles.posterContainer, { height }]}>
        {item.posterUrl ? (
          <Image
            source={{ uri: item.posterUrl }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fallbackPoster}>
            <Ionicons name="film-outline" size={32} color="#555566" />
          </View>
        )}

        {item.rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color="#fbbf24" />
            <Text style={styles.ratingText}>{Number(item.rating).toFixed(1)}</Text>
          </View>
        )}

        {item.mediaType === 'series' && (
          <View style={styles.seriesBadge}>
            <Text style={styles.seriesText}>SERIES</Text>
          </View>
        )}
      </View>

      <Text numberOfLines={1} style={styles.title}>
        {cleanedTitle}
      </Text>

      <View style={styles.metaRow}>
        {item.year ? <Text style={styles.year}>{item.year}</Text> : null}
        {showProviders && item.availableProviders && item.availableProviders.length > 0 && (
          <View style={styles.providersRow}>
            {item.availableProviders.slice(0, 2).map((prov) => (
              <ProviderBadge key={prov} provider={prov} size="small" />
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    marginBottom: 16,
  },
  posterContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#16161e',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  fallbackPoster: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14141c',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  ratingText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  seriesBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  seriesText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  title: {
    color: '#f0f0f5',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  year: {
    color: '#8e8e9e',
    fontSize: 11,
    fontWeight: '500',
  },
  providersRow: {
    flexDirection: 'row',
    gap: 4,
  },
});
