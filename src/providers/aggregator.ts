import { MediaProvider } from './base';
import { HDHub4uProvider } from './hdhub4u/client';
import { FourKHdHubProvider } from './fourkhdhub/client';
import {
  CatalogItem,
  MediaDetails,
  PlaybackSource,
  ProviderId,
  Release,
} from '@/types';
import { sanitizeStreamUrl } from '@/utils';
import axios from 'axios';

export class AggregatorService {
  private providers: Map<ProviderId, MediaProvider> = new Map();

  constructor() {
    const hdhub = new HDHub4uProvider();
    const fourk = new FourKHdHubProvider();

    this.providers.set(hdhub.id, hdhub);
    this.providers.set(fourk.id, fourk);
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

  // 3. Pre-flight Validation: Verify stream URL is playable and reject ad/interstitial pages
  async probeStream(url: string, headers?: Record<string, string>): Promise<boolean> {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.warn(`[Aggregator] ⚠️ Preflight probe rejected invalid or non-HTTP URL: "${url}"`);
      return false;
    }

    const lower = url.toLowerCase();

    // Reject ad redirectors, shortener landing pages, drive web pages, and login gates
    if (
      lower.includes('cryptonewz.online') ||
      lower.includes('snvhost.com') ||
      lower.includes('greenmotors.') ||
      lower.includes('greenmountmotors.') ||
      lower.includes('technical-now.') ||
      lower.includes('login.php') ||
      lower.includes('gamerxyt.com') ||
      lower.includes('hubcloud.php') ||
      lower.includes('hubdrive.') ||
      (lower.includes('hubcloud.') && (lower.includes('/drive/') || lower.includes('/file/')))
    ) {
      console.warn(`[Aggregator] ⚠️ Preflight probe rejected intermediate / shortener landing page: ${url}`);
      return false;
    }

    // Reject HTML/PHP web pages immediately
    if (lower.endsWith('.html') || lower.endsWith('.php')) {
      console.warn(`[Aggregator] ⚠️ Preflight probe rejected HTML/PHP endpoint: ${url}`);
      return false;
    }

    // Verify Cloudflare R2 / S3 storage URLs are active and not returning 403 Forbidden
    if (lower.includes('cloudflarestorage.com') || lower.includes('.r2.dev')) {
      try {
        const probeRes = await axios.head(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            ...(headers || {}),
          },
          timeout: 2500,
          validateStatus: (s) => s >= 200 && s < 400,
        });
        if (probeRes.status >= 200 && probeRes.status < 400) {
          console.log(`[Aggregator] ✅ Preflight probe confirmed R2 stream active (${probeRes.status}): ${url.slice(0, 70)}...`);
          return true;
        }
      } catch (r2Err: any) {
        console.warn(`[Aggregator] ❌ Preflight probe rejected inactive R2 stream (${r2Err.response?.status || r2Err.message}): ${url.slice(0, 70)}...`);
        return false;
      }
    }

    // Direct streams, CDNs, and media file extensions are immediately valid playback URLs
    if (
      lower.includes('workers.dev') ||
      lower.includes('googleusercontent.com') ||
      lower.includes('hbplay') ||
      lower.includes('.mkv') ||
      lower.includes('.mp4') ||
      lower.includes('.webm') ||
      (lower.includes('pixeldrain.') && (lower.includes('api/file') || lower.includes('?download')))
    ) {
      console.log(`[Aggregator] ✅ Preflight probe APPROVED direct media stream URL: ${url}`);
      return true;
    }

    console.log(`[Aggregator] ✅ Preflight probe APPROVED URL: ${url}`);
    return true;
  }

  // 4. Resolve Stream with Seamless Auto-Fallback across candidate releases
  async resolveWithFallback(releases: Release[]): Promise<PlaybackSource> {
    console.log(`[Aggregator] 🎬 Starting stream resolution across ${releases.length} candidate release(s)...`);
    const errors: string[] = [];

    for (let i = 0; i < releases.length; i++) {
      const release = releases[i];
      const provider = this.providers.get(release.provider);
      if (!provider) {
        console.warn(`[Aggregator] ⚠️ [${i + 1}/${releases.length}] Provider ${release.provider} not found`);
        continue;
      }

      console.log(
        `[Aggregator] 🚀 [${i + 1}/${releases.length}] Attempting release candidate: "${release.filename}" (${release.quality}, ${release.provider})`
      );

      try {
        const source = await provider.resolveStream(release);
        if (source && source.url) {
          source.url = sanitizeStreamUrl(source.url);
          console.log(`[Aggregator] 🔍 [${i + 1}/${releases.length}] Obtained resolved source: ${source.url.slice(0, 80)}...`);
          const isHealthy = await this.probeStream(source.url, source.headers);
          if (isHealthy) {
            console.log(`[Aggregator] 🎉 [${i + 1}/${releases.length}] SUCCESS! Playing "${release.filename}" via ${source.sourceLabel || 'Direct Stream'}`);
            return source;
          }
          console.warn(`[Aggregator] ❌ [${i + 1}/${releases.length}] Preflight validation failed for "${release.filename}", trying next candidate...`);
          errors.push(`${release.filename} failed preflight validation`);
        } else {
          console.warn(`[Aggregator] ❌ [${i + 1}/${releases.length}] No source returned for "${release.filename}"`);
          errors.push(`${release.filename} returned empty source`);
        }
      } catch (err: any) {
        console.warn(`[Aggregator] ❌ [${i + 1}/${releases.length}] Resolution error on "${release.filename}":`, err?.message);
        errors.push(`${release.filename}: ${err?.message || 'resolution failed'}`);
        continue;
      }
    }

    console.error(`[Aggregator] 💥 All ${releases.length} candidates failed!`);
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

  // 5. Infinite Scroll Category Browser
  async browseCategory(
    category: 'all' | 'movies' | 'series' | '4k' | 'bollywood' | 'trending',
    page = 1,
    genre?: string
  ): Promise<CatalogItem[]> {
    const hdhub = this.providers.get('hdhub4u') as HDHub4uProvider;
    const fourk = this.providers.get('fourkhdhub') as FourKHdHubProvider;

    const queryTarget = genre && genre !== 'all' ? genre : '2026';
    const promises: Promise<CatalogItem[]>[] = [];

    switch (category) {
      case 'all': {
        if (fourk) promises.push(fourk.browse(page));
        if (hdhub) promises.push(hdhub.search(queryTarget, page));
        break;
      }
      case 'movies': {
        if (fourk) {
          promises.push(
            fourk.browse(page).then((items) => items.filter((i) => i.mediaType === 'movie'))
          );
        }
        if (hdhub) {
          promises.push(
            hdhub
              .search(genre && genre !== 'all' ? genre : 'movie', page)
              .then((items) => items.filter((i) => i.mediaType === 'movie'))
          );
        }
        break;
      }
      case 'series': {
        if (fourk) {
          promises.push(
            fourk.browse(page).then((items) => items.filter((i) => i.mediaType === 'series'))
          );
        }
        if (hdhub) {
          promises.push(
            hdhub
              .search(genre && genre !== 'all' ? `${genre} series` : 'season', page)
              .then((items) => items.filter((i) => i.mediaType === 'series'))
          );
        }
        break;
      }
      case '4k': {
        if (fourk) promises.push(fourk.browse(page));
        if (hdhub) promises.push(hdhub.search('4k', page));
        break;
      }
      case 'bollywood': {
        if (hdhub) {
          promises.push(hdhub.search(genre && genre !== 'all' ? `${genre} hindi` : 'bollywood', page));
          if (page === 1) promises.push(hdhub.search('hindi', page));
        }
        if (fourk) promises.push(fourk.search('hindi', page));
        break;
      }
      case 'trending': {
        if (fourk) promises.push(fourk.browse(page));
        if (hdhub) promises.push(hdhub.search('2026', page));
        break;
      }
    }

    const settled = await Promise.allSettled(promises);
    const combined: CatalogItem[] = [];
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        combined.push(...res.value);
      }
    }

    return this.deduplicateCatalog(combined);
  }
}

export const aggregator = new AggregatorService();
