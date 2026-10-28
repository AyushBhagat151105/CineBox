import axios from 'axios';
import { parse } from 'node-html-parser';
import { MediaProvider } from '../base';
import {
  CatalogItem,
  MediaDetails,
  PlaybackSource,
  Release,
} from '../../types/models';
import { resolveShortenerUrl } from '../hdhub4u/resolver';
import { parseSeasonEpisode } from '../../utils/seasonEpisode';

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

  async search(query: string): Promise<CatalogItem[]> {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(query)}`;

    try {
      const res = await this.client.get(searchUrl);
      const root = parse(res.data);
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
        const isSeries = href.includes('-series-');

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

    const elements = root.querySelectorAll('.download-item, .episode-download-item, a[href*="hubcloud"]');
    for (const el of elements) {
      const link = el.tagName === 'A' ? el : el.querySelector('a[href]');
      const href = link?.getAttribute('href');
      if (!href) continue;

      const fileTitle =
        el.querySelector('.file-title, .episode-file-title')?.text?.trim() ||
        link?.text?.trim() ||
        '4KHDHub Release';

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

      const { season, episode } = parseSeasonEpisode(fileTitle);

      releases.push({
        provider: 'fourkhdhub',
        filename: fileTitle,
        quality,
        resolution,
        season,
        episode,
        size: sizeText || undefined,
        mirrors: [
          {
            label: `4KHDHub (${quality})`,
            resolverUrl: href,
            directFile: false,
          },
        ],
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
    const mirror = release.mirrors[0];
    if (!mirror) {
      throw new Error('No mirror available on release');
    }

    const { url, label } = await resolveShortenerUrl(mirror.resolverUrl);

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
}
