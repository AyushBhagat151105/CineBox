import axios from 'axios';
import { parse } from 'node-html-parser';
import { MediaProvider } from '../base';
import {
  CatalogItem,
  MediaDetails,
  PlaybackSource,
  Release,
} from '@/types';
import { resolveShortenerUrl } from '../hdhub4u/resolver';
import { parseSeasonEpisode } from '@/utils';

const DEFAULT_BASE_URL = 'https://4khdhub.one';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class FourKHdHubProvider implements MediaProvider {
  id = 'fourkhdhub' as const;
  name = '4KHDHub';
  supportsSearch = true;
  supportsBollywood = false;

  private baseUrl = DEFAULT_BASE_URL;
  private client = axios.create({
    headers: { 'User-Agent': BROWSER_UA },
    timeout: 10000,
  });

  private parseMovieCards(root: any): CatalogItem[] {
    const items: CatalogItem[] = [];
    const cards = root.querySelectorAll('a.movie-card');
    for (const el of cards) {
      const href = el.getAttribute('href');
      if (!href) continue;

      const postUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      const title = el.querySelector('.movie-card-title')?.text?.trim();
      if (!title) continue;

      const metaText = el.querySelector('.movie-card-meta')?.text?.trim() || '';
      const yearMatch = metaText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : undefined;

      const posterUrl = el.querySelector('img')?.getAttribute('src');
      const isSeries = href.includes('-series-') || /season|series/i.test(title);

      items.push({
        id: {
          provider: 'fourkhdhub',
          value: postUrl,
        },
        title,
        mediaType: isSeries ? 'series' : 'movie',
        year,
        posterUrl,
        availableProviders: ['fourkhdhub'],
      });
    }
    return items;
  }

  async browse(page = 1): Promise<CatalogItem[]> {
    const url = page > 1 ? `${this.baseUrl}/?pagex=${page}` : `${this.baseUrl}/`;
    try {
      const res = await this.client.get(url);
      const root = parse(res.data);
      return this.parseMovieCards(root);
    } catch (err) {
      console.warn(`4KHDHub browse (page ${page}) error:`, err);
      return [];
    }
  }

  async search(query: string, page = 1): Promise<CatalogItem[]> {
    const searchUrl =
      page > 1
        ? `${this.baseUrl}/?s=${encodeURIComponent(query)}&pagex=${page}`
        : `${this.baseUrl}/?s=${encodeURIComponent(query)}`;

    try {
      const res = await this.client.get(searchUrl);
      const root = parse(res.data);
      return this.parseMovieCards(root);
    } catch (err) {
      console.warn('4KHDHub search error:', err);
      return [];
    }
  }

  async details(postUrl: string): Promise<MediaDetails> {
    const res = await this.client.get(postUrl);
    const root = parse(res.data);

    const title =
      root.querySelector('h1')?.text?.trim() ||
      root.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      '';

    const description =
      root.querySelector('.content-section p.mt-4')?.text?.trim() ||
      root.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    const posterUrl =
      root.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      root.querySelector('.poster-container img, .movie-poster img')?.getAttribute('src');

    const yearMatch = title.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : undefined;
    const isSeries = postUrl.includes('-series-');

    return {
      id: {
        provider: 'fourkhdhub',
        value: postUrl,
      },
      title,
      mediaType: isSeries ? 'series' : 'movie',
      year,
      posterUrl,
      description,
      genres: ['4K UHD', 'Hollywood'],
      dubs: [],
      seasons: [],
    };
  }

  async releases(postUrl: string): Promise<Release[]> {
    const res = await this.client.get(postUrl);
    const root = parse(res.data);
    const releases: Release[] = [];

    const isSeriesPost =
      postUrl.includes('-series-') ||
      /season|series/i.test(root.querySelector('h1')?.text || '');
    const epElements = root.querySelectorAll('.episode-download-item');
    const hasEpisodes = epElements.length > 0;

    // On TV series posts where individual episodes exist, NEVER query .download-item (which are full season zip/rar packs)
    const elements = hasEpisodes
      ? epElements
      : root.querySelectorAll('.download-item, a[href*="hubcloud"]');

    for (const el of elements) {
      const fileTitle =
        el.querySelector('.file-title, .episode-file-title')?.text?.trim() ||
        (el.tagName === 'A' ? el.text.trim() : '') ||
        '4KHDHub Release';

      const fullContextText = `${el.text} ${fileTitle}`;

      // AVOID ALL ZIP / RAR / 7Z / PACK ARCHIVES - Video players cannot stream zipped files
      if (
        /\b(?:zip|rar|7z|tar|pack|packs|batch)\b/i.test(fileTitle) ||
        /\b(?:zip|rar|7z|tar|pack|packs|batch)\b/i.test(fullContextText) ||
        /\.(?:zip|rar|7z|tar)(?:\?|$)/i.test(fileTitle)
      ) {
        continue;
      }

      // Collect all mirrors inside this item (HubCloud, HubDrive, etc.)
      const links = el.tagName === 'A' ? [el] : Array.from(el.querySelectorAll('a[href]'));
      const validMirrors = [];

      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        if (/\.(?:zip|rar|7z|tar)(?:\?|$)/i.test(href) || /\/packs\//i.test(href)) continue;

        const linkLabel = link.text.trim() || 'Direct Mirror';
        validMirrors.push({
          label: linkLabel,
          resolverUrl: href,
          directFile: false,
        });
      }

      if (validMirrors.length === 0) continue;

      const sizeText = el.querySelector('.badge-size, .badge')?.text?.trim() || '';

      let quality = '1080p FHD';
      let resolution = 1080;

      if (/\b(?:4k|2160p|uhd)\b/i.test(fileTitle)) {
        quality = '4K UHD';
        resolution = 2160;
      } else if (/\b1080p\b/i.test(fileTitle)) {
        quality = '1080p FHD';
        resolution = 1080;
      } else if (/\b720p\b/i.test(fileTitle)) {
        quality = '720p HD';
        resolution = 720;
      } else if (/\b480p\b/i.test(fileTitle)) {
        quality = '480p';
        resolution = 480;
      }

      const { season, episode } = parseSeasonEpisode(fullContextText);

      // On TV series posts, skip any release that has no episode number (full season packs / zip archives)
      if ((isSeriesPost || hasEpisodes) && episode === undefined) {
        continue;
      }

      releases.push({
        provider: 'fourkhdhub',
        filename: fileTitle,
        quality,
        resolution,
        season,
        episode,
        size: sizeText || undefined,
        mirrors: validMirrors,
      });
    }

    const seen = new Set<string>();
    const unique = releases.filter((r) => {
      const url = r.mirrors[0]?.resolverUrl;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });

    return unique.sort((a, b) => b.resolution - a.resolution);
  }

  async resolveStream(release: Release): Promise<PlaybackSource> {
    if (!release.mirrors || release.mirrors.length === 0) {
      console.warn(`[4KHDHub] ❌ No mirrors available on release: "${release.filename}"`);
      throw new Error('No mirror available on release');
    }

    console.log(`[4KHDHub] 🔍 Resolving stream for "${release.filename}" across ${release.mirrors.length} mirror(s)...`);

    let lastError: any = null;
    for (let i = 0; i < release.mirrors.length; i++) {
      const mirror = release.mirrors[i];
      console.log(`[4KHDHub] 🔄 Mirror [${i + 1}/${release.mirrors.length}]: Resolving ${mirror.resolverUrl}`);
      try {
        const { url, label } = await resolveShortenerUrl(mirror.resolverUrl);
        if (url) {
          if (/\.(?:zip|rar|7z|tar)(?:\?|$)/i.test(url)) {
            console.warn(`[4KHDHub] ⚠️ Mirror resolved to a zip/rar file: ${url}, rejecting...`);
            continue;
          }

          console.log(`[4KHDHub] ✅ Mirror [${i + 1}/${release.mirrors.length}] resolved successfully: ${url} (${label})`);
          return {
            provider: 'fourkhdhub',
            url,
            sourceLabel: `4KHDHub · ${label}`,
            title: release.filename,
            headers: {
              'User-Agent': BROWSER_UA,
            },
          };
        }
      } catch (err: any) {
        console.warn(`[4KHDHub] ⚠️ Mirror [${i + 1}/${release.mirrors.length}] failed:`, err?.message);
        lastError = err;
      }
    }

    console.error(`[4KHDHub] ❌ All ${release.mirrors.length} mirror(s) failed for "${release.filename}"`);
    throw lastError || new Error('Failed resolving 4KHDHub mirrors');
  }
}
