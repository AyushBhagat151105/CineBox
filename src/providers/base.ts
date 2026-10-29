import { CatalogItem, MediaDetails, Release, PlaybackSource, ProviderId } from '@/types';

export interface MediaProvider {
  id: ProviderId;
  name: string;
  supportsSearch: boolean;
  supportsBollywood: boolean;

  search(query: string, page?: number): Promise<CatalogItem[]>;
  details(id: string): Promise<MediaDetails>;
  releases(id: string, season?: number, episode?: number): Promise<Release[]>;
  resolveStream(mirror: Release): Promise<PlaybackSource>;
}
