import { SvgProps } from 'react-native-svg';

export type ProviderId = 'hdhub4u' | 'fourkhdhub' | 'moviebox' | 'addons' | 'bdix';

export interface ProviderMediaId {
  provider: ProviderId;
  value: string;
}

export type MediaType = 'movie' | 'series';

export interface CatalogItem {
  id: ProviderMediaId;
  title: string;
  mediaType: MediaType;
  year?: string;
  posterUrl?: string;
  seasonCount?: number;
  rating?: string;
  description?: string;
  availableProviders: ProviderId[];
}

export interface AudioTrackOption {
  subjectId: string;
  language: string;
  label: string;
}

export interface SubtitleOption {
  name: string;
  url: string;
  language?: string;
}

export interface SourceMirror {
  label: string;
  resolverUrl: string;
  headers?: Record<string, string>;
  directFile?: boolean;
}

export interface Release {
  provider: ProviderId;
  filename: string;
  releaseName?: string;
  quality: string; // '4K' | '1080p' | '720p' | '480p' | 'HEVC'
  resolution: number; // 2160, 1080, 720, 480
  size?: string;
  sizeBytes?: number;
  season?: number;
  episode?: number;
  audioLanguage?: string;
  mirrors: SourceMirror[];
  resourceId?: string;
}

export interface Episode {
  season: number;
  number: number;
  title?: string;
  overview?: string;
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface MediaDetails {
  id: ProviderMediaId;
  title: string;
  mediaType: MediaType;
  year?: string;
  description?: string;
  tagline?: string;
  imdbRating?: string;
  director?: string;
  stars?: string;
  duration?: string;
  genres?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  dubs?: AudioTrackOption[];
  seasons?: Season[];
}

export interface PlaybackSource {
  provider: ProviderId;
  url: string;
  headers?: Record<string, string>;
  subtitle?: string;
  sourceLabel: string;
  title: string;
}

export interface WatchHistoryItem {
  mediaId: string;
  provider: ProviderId;
  title: string;
  posterUrl?: string;
  positionSeconds: number;
  progressSeconds?: number;
  durationSeconds: number;
  releaseName?: string;
  season?: number;
  episode?: number;
  timestamp: number;
  completed?: boolean;
}

export interface FavoriteItem {
  mediaId: string;
  provider: ProviderId;
  title: string;
  posterUrl?: string;
  year?: string;
  mediaType: MediaType;
  addedAt: number;
}
