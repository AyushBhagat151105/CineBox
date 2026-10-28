import { MediaProvider } from './base';
import { HDHub4uProvider } from './hdhub4u/client';
import { FourKHdHubProvider } from './fourkhdhub/client';
import { MovieBoxProvider } from './moviebox/client';
import {
  CatalogItem,
  MediaDetails,
  PlaybackSource,
  ProviderId,
  Release,
} from '../types/models';
import axios from 'axios';

export class AggregatorService {
  private providers: Map<ProviderId, MediaProvider> = new Map();

  constructor() {
    const hdhub = new HDHub4uProvider();
    const fourk = new FourKHdHubProvider();
    const mb = new MovieBoxProvider();

    this.providers.set(hdhub.id, hdhub);
    this.providers.set(fourk.id, fourk);
    this.providers.set(mb.id, mb);
  }

  getProvider(id: ProviderId): MediaProvider | undefined {
    return this.providers.get(id);
  }

  // 1. Federated Search across all providers concurrently
  async searchAll(query: string): Promise<CatalogItem[]> {
    const searchPromises = Array.from(this.providers.values()).map(async (p) => {
      try {
        return await p.search(query);
      } catch (err) {
        console.warn(`[Aggregator] Provider ${p.name} search failed:`, err);
        return [];
      }
    });

    const results = await Promise.all(searchPromises);
    const flat = results.flat();

    return this.deduplicateCatalog(flat);
  }

  // 2. Fetch all releases across providers for a given title
  async getAllReleases(
    items: { provider: ProviderId; id: string }[],
    season = 0,
    episode = 0
  ): Promise<Release[]> {
    const releasePromises = items.map(async ({ provider, id }) => {
      const p = this.providers.get(provider);
      if (!p) return [];
      try {
        return await p.releases(id, season, episode);
      } catch (err) {
        console.warn(`[Aggregator] Failed getting releases for ${provider}:`, err);
        return [];
      }
    });

    const results = await Promise.allSettled(releasePromises);
    const allReleases: Release[] = [];

    for (const res of results) {
      if (res.status === 'fulfilled') {
        allReleases.push(...res.value);
      }
    }

    // Sort: 4K UHD (2160p) -> 1080p -> 720p -> 480p
    return allReleases.sort((a, b) => b.resolution - a.resolution);
  }

  // 3. Pre-flight Probe: Verify stream URL responds with 200 or 206 and is NOT an HTML webpage
  async probeStream(url: string, headers?: Record<string, string>): Promise<boolean> {
    try {
      const res = await axios.head(url, {
        headers: headers || { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      const cType = (res.headers['content-type'] || '').toLowerCase();
      if (cType.includes('text/html')) {
        return false;
      }
      return res.status >= 200 && res.status < 400;
    } catch {
      // If HEAD fails, try ranged GET (bytes=0-0)
      try {
        const getRes = await axios.get(url, {
          headers: {
            ...(headers || {}),
            Range: 'bytes=0-0',
          },
          timeout: 5000,
          validateStatus: (status) => status >= 200 && status < 400,
        });
        const cType = (getRes.headers['content-type'] || '').toLowerCase();
        if (cType.includes('text/html')) {
          return false;
        }
        return getRes.status >= 200 && getRes.status < 400;
      } catch {
        return false;
      }
    }
  }

  // 4. Resolve Stream with Seamless Auto-Fallback
  async resolveWithFallback(releases: Release[]): Promise<PlaybackSource> {
    const errors: string[] = [];

    for (const release of releases) {
      const provider = this.providers.get(release.provider);
      if (!provider) continue;

      try {
        const source = await provider.resolveStream(release);
        if (source && source.url) {
          // Pre-flight probe check
          const isHealthy = await this.probeStream(source.url, source.headers);
          if (isHealthy) {
            return source;
          }

          // If preflight failed, check if this is an already-verified direct media stream URL.
          // Mobile Axios can throw network/timeout errors on large presigned URLs even when
          // the native ExoPlayer engine can stream them perfectly.
          const isKnownDirectStream =
            source.url.includes('cloudflarestorage.com') ||
            source.url.includes('pixeldrain.com') ||
            source.url.includes('hbplay') ||
            /\.(mkv|mp4|m3u8|webm)/i.test(source.url);

          if (isKnownDirectStream) {
            return source;
          } else {
            errors.push(`${release.filename} failed preflight check`);
          }
        }
      } catch (err: any) {
        errors.push(`${release.filename}: ${err?.message || 'resolution failed'}`);
        // Seamlessly continue to the next mirror
        continue;
      }
    }

    throw new Error(`Unable to play stream: ${errors.join(', ')}`);
  }

  private deduplicateCatalog(items: CatalogItem[]): CatalogItem[] {
    const map = new Map<string, CatalogItem>();

    for (const item of items) {
      const normalizedKey = this.normalizeTitleKey(item.title, item.year);
      const existing = map.get(normalizedKey);

      if (existing) {
        // Merge providers
        if (!existing.availableProviders.includes(item.id.provider)) {
          existing.availableProviders.push(item.id.provider);
        }
        if (!existing.posterUrl && item.posterUrl) {
          existing.posterUrl = item.posterUrl;
        }
        if (!existing.description && item.description) {
          existing.description = item.description;
        }
        if (!existing.rating && item.rating) {
          existing.rating = item.rating;
        }
      } else {
        map.set(normalizedKey, {
          ...item,
          availableProviders: [item.id.provider],
        });
      }
    }

    return Array.from(map.values());
  }

  private normalizeTitleKey(title: string, year?: string): string {
    const clean = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return year ? `${clean}_${year}` : clean;
  }
}

export const aggregator = new AggregatorService();
