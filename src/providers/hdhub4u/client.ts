import axios from 'axios';
import { parse } from 'node-html-parser';
import { MediaProvider } from '../base';
import {
  CatalogItem,
  MediaDetails,
  MediaType,
  PlaybackSource,
  Release,
} from '../../types/models';
import { getActiveHDHub4uDomain } from './domain';
import { resolveShortenerUrl } from './resolver';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class HDHub4uProvider implements MediaProvider {
  id = 'hdhub4u' as const;
  name = 'HDHub4u';
  supportsSearch = true;
  supportsBollywood = true;

  private client = axios.create({
    headers: { 'User-Agent': BROWSER_UA },
    timeout: 10000,
  });

  async search(query: string): Promise<CatalogItem[]> {
    const domain = await getActiveHDHub4uDomain();
    const searchUrl = `${domain}/?s=${encodeURIComponent(query)}`;

    try {
      const res = await this.client.get(searchUrl);
      const root = parse(res.data);
      const items: CatalogItem[] = [];
      const seenUrls = new Set<string>();

      // HDHub4u posts are enclosed in <a> with nx-poster / thumb images or post items
      const links = root.querySelectorAll('a[href]');
      for (const el of links) {
        const href = el.getAttribute('href');
        if (!href) continue;

        if (
          href.includes('category') ||
          href.includes('tag') ||
          href.includes('page/') ||
          href === '/' ||
          href === '#'
        ) {
          continue;
        }

        const img = el.querySelector('img');
        if (!img) continue;

        const postUrl = href.startsWith('http') ? href : `${domain}${href}`;
        if (seenUrls.has(postUrl)) continue;

        let rawTitle =
          img.getAttribute('alt') ||
          img.getAttribute('title') ||
          el.getAttribute('title') ||
          el.text.trim() ||
          '';

        if (!rawTitle) continue;

        if (!href.includes('-movie') && !href.includes('/drive-') && !href.includes('season')) {
          continue;
        }

        seenUrls.add(postUrl);

        const posterUrl = img.getAttribute('src') || img.getAttribute('data-src');

        const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/);
        const year = yearMatch ? yearMatch[1] : undefined;

        const isSeries = /season|s\d+|series|episodes/i.test(rawTitle);

        items.push({
          id: {
            provider: 'hdhub4u',
            value: postUrl,
          },
          title: cleanMovieTitle(rawTitle),
          mediaType: isSeries ? 'series' : 'movie',
          year,
          posterUrl,
          availableProviders: ['hdhub4u'],
        });
      }

      return items;
    } catch (err) {
      console.warn('HDHub4u search error:', err);
      return [];
    }
  }

  async details(postUrl: string): Promise<MediaDetails> {
    const res = await this.client.get(postUrl);
    const root = parse(res.data);

    const rawTitle =
      root.querySelector('h1.entry-title')?.text?.trim() ||
      root.querySelector('h1')?.text?.trim() ||
      root.querySelector('title')?.text?.trim() ||
      '';
    const title = cleanMovieTitle(rawTitle);

    const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : undefined;

    const posterUrl =
      root.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      root.querySelector('.entry-content img, .post-thumbnail img, img.nx-poster')?.getAttribute('src');

    const paragraphs = root.querySelectorAll('.entry-content p');
    let description = root.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    if (!description && paragraphs.length > 0) {
      for (const p of paragraphs) {
        if (p.text.length > 60) {
          description = p.text.trim();
          break;
        }
      }
    }

    const isSeries = /season|s\d+|series|episodes/i.test(rawTitle);

    return {
      id: {
        provider: 'hdhub4u',
        value: postUrl,
      },
      title,
      mediaType: isSeries ? 'series' : 'movie',
      year,
      posterUrl,
      description,
      genres: ['Bollywood', 'Regional', 'Hindi Dubbed'],
      dubs: [],
      seasons: [],
    };
  }

  async releases(postUrl: string): Promise<Release[]> {
    const res = await this.client.get(postUrl);
    const root = parse(res.data);
    const releases: Release[] = [];

    const links = root.querySelectorAll('a[href]');
    for (const el of links) {
      const href = el.getAttribute('href');
      if (!href) continue;

      const text = el.text.trim() || el.getAttribute('title') || '';
      const parent = el.parentNode;
      const parentText = parent ? parent.text.trim() : '';
      const combined = `${parentText} ${text}`;

      const isShortener =
        href.includes('hubcloud') ||
        href.includes('hubdrive') ||
        href.includes('greenmotors') ||
        href.includes('technical-now') ||
        href.includes('pixeldrain') ||
        href.includes('gamerxyt');

      const resMatch = combined.match(/\b(4K|2160p|1080p|720p|480p|HEVC)\b/i);

      if (resMatch || isShortener) {
        let quality = '1080p';
        let resolution = 1080;

        if (/4k|2160p/i.test(combined)) {
          quality = '4K UHD';
          resolution = 2160;
        } else if (/1080p/i.test(combined)) {
          quality = '1080p FHD';
          resolution = 1080;
        } else if (/720p/i.test(combined)) {
          quality = '720p HD';
          resolution = 720;
        } else if (/480p/i.test(combined)) {
          quality = '480p';
          resolution = 480;
        }

        const sizeMatch = combined.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB))/i);
        const sizeStr = sizeMatch ? sizeMatch[1] : undefined;

        releases.push({
          provider: 'hdhub4u',
          filename: cleanMovieTitle(el.text.trim() || 'HDHub4u Stream'),
          quality,
          resolution,
          size: sizeStr,
          mirrors: [
            {
              label: `HDHub4u (${quality})`,
              resolverUrl: href,
              directFile: false,
            },
          ],
        });
      }
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
      provider: 'hdhub4u',
      url,
      sourceLabel: `HDHub4u · ${label}`,
      title: release.filename,
      headers: {
        'User-Agent': BROWSER_UA,
      },
    };
  }
}

function cleanMovieTitle(title: string): string {
  return title
    .replace(/\b(Download|Full Movie|Watch Online|Hindi Dubbed|Dual Audio|HDRip|BluRay|ESub|x264|HEVC)\b/gi, '')
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
