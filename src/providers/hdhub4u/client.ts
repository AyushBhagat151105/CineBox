import axios from 'axios';
import { parse } from 'node-html-parser';
import {
  CatalogItem,
  MediaDetails,
  PlaybackSource,
  Release
} from '@/types';
import { cleanDisplayTitle, cleanMovieTitle } from '@/utils';
import { MediaProvider } from '../base';
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

  async search(query: string, page = 1): Promise<CatalogItem[]> {
    const domain = await getActiveHDHub4uDomain();

    // 1. First try HDHub4u's official Pingora fast search API with pagination
    try {
      const pingoraUrl = `https://search.pingora.fyi/collections/post/documents/search?q=${encodeURIComponent(
        query
      )}&page=${page}&limit=24&query_by=post_title,category,stars,director,imdb_id&query_by_weights=4,2,2,2,4&sort_by=sort_by_date:desc`;

      const pRes = await this.client.get(pingoraUrl, {
        headers: { Referer: 'https://hdhub4u.fast/' },
        timeout: 5000,
      });

      const hits = pRes.data?.hits || [];
      if (hits.length > 0) {
        return hits.map((h: any) => {
          const doc = h.document;
          const rawTitle = doc.post_title || '';
          let postUrl = doc.permalink || '';
          try {
            const parsed = new URL(postUrl);
            postUrl = `${domain}${parsed.pathname}`;
          } catch {
            if (postUrl.startsWith('/')) postUrl = `${domain}${postUrl}`;
          }

          const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/);
          const year = yearMatch ? yearMatch[1] : undefined;
          const isSeries = /season|s\d+|series|episodes/i.test(rawTitle);

          return {
            id: {
              provider: 'hdhub4u',
              value: postUrl,
            },
            title: cleanMovieTitle(rawTitle),
            mediaType: isSeries ? 'series' : 'movie',
            year,
            posterUrl: doc.post_thumbnail,
            rating: doc.imdb_rating ? String(doc.imdb_rating) : undefined,
            availableProviders: ['hdhub4u'],
          };
        });
      }
    } catch {
      // Fallback to domain search
    }

    const searchUrl =
      page > 1
        ? `${domain}/page/${page}/?s=${encodeURIComponent(query)}`
        : `${domain}/?s=${encodeURIComponent(query)}`;

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

  private async normalizePostUrl(postUrl: string): Promise<string> {
    const domain = await getActiveHDHub4uDomain();
    try {
      const parsed = new URL(postUrl);
      return `${domain}${parsed.pathname}`;
    } catch {
      return postUrl.startsWith('/') ? `${domain}${postUrl}` : postUrl;
    }
  }

  async details(postUrl: string): Promise<MediaDetails> {
    const targetUrl = await this.normalizePostUrl(postUrl);
    const res = await this.client.get(targetUrl);
    const root = parse(res.data);

    const rawTitle =
      root.querySelector('h1.page-title')?.text?.trim() ||
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
    const targetUrl = await this.normalizePostUrl(postUrl);
    const res = await this.client.get(targetUrl);
    const root = parse(res.data);
    const releases: Release[] = [];

    const rawTitle =
      root.querySelector('h1.page-title')?.text?.trim() ||
      root.querySelector('h1.entry-title')?.text?.trim() ||
      root.querySelector('h1')?.text?.trim() ||
      'HDHub4u Stream';
    const fallbackTitle = cleanDisplayTitle(rawTitle);

    const postSeasonMatch = rawTitle.match(/season\s*(\d+)/i) || postUrl.match(/season-(\d+)/i);
    const defaultSeason = postSeasonMatch ? parseInt(postSeasonMatch[1], 10) : undefined;

    const entry = root.querySelector('.entry-content') || root;
    const blocks = entry.querySelectorAll('h2, h3, h4, h5, p');

    let currentEpisode: number | undefined;
    let activeSeason: number | undefined = defaultSeason;
    let activeQuality = '1080p FHD';
    let activeResolution = 1080;

    for (const el of blocks) {
      const text = el.text.trim();

      // Check if this block defines a Season
      const seasonHeadingMatch = text.match(/\b(?:Season|S)[\s.:_-]*(\d+)\b/i);
      if (seasonHeadingMatch && !text.includes('Pack') && text.length < 50) {
        activeSeason = parseInt(seasonHeadingMatch[1], 10);
      }

      // Check if this block defines quality for following episodes (e.g. ": Single Episode 720p 10Bit HEVC :")
      const qualityHeadingMatch = text.match(/\b(480p|720p|1080p|2160p|4k)\b/i);
      if (qualityHeadingMatch && text.length < 60 && !el.querySelector('a[href]')) {
        const q = qualityHeadingMatch[1].toLowerCase();
        if (q.includes('480')) { activeQuality = '480p'; activeResolution = 480; }
        else if (q.includes('720')) { activeQuality = '720p HD'; activeResolution = 720; }
        else if (q.includes('1080')) { activeQuality = '1080p FHD'; activeResolution = 1080; }
        else if (q.includes('2160') || q.includes('4k')) { activeQuality = '4K UHD'; activeResolution = 2160; }
      }

      // Check for download links in this block
      const links = el.querySelectorAll('a[href]');
      const dlLinks = links.filter((l) => {
        const href = l.getAttribute('href') || '';
        return (
          href.includes('hubcloud.') ||
          href.includes('hubdrive.') ||
          href.includes('greenmotors.') ||
          href.includes('greenmountmotors.') ||
          href.includes('technical-now.') ||
          href.includes('pixeldrain.') ||
          href.includes('hblinks.') ||
          (href.includes('/archives/') && !href.includes('hdhub4u'))
        );
      });

      if (dlLinks.length === 0) {
        // Check if this block is an Episode heading without links (e.g. "Episode 1")
        const epHeadingMatch = text.match(/\b(?:EPiSODE|Episode|Ep|E)[\s.:_-]*(\d{1,4})\b/i);
        if (epHeadingMatch && text.length < 50) {
          currentEpisode = parseInt(epHeadingMatch[1], 10);
        }
        continue;
      }

      // Filter out ZIP / RAR / 7Z / PACK archives - Video players cannot stream zipped files
      const isArchiveOrPack =
        /\b(?:zip|rar|7z|tar|pack|packs|batch|complete)\b/i.test(text) ||
        /\.(?:zip|rar|7z|tar)(?:\?|$)/i.test(text) ||
        dlLinks.some((l) => /\/packs\//i.test(l.getAttribute('href') || ''));

      if (isArchiveOrPack) {
        continue;
      }

      // Check if block or links specify an episode (e.g. "E01 - Drive", "EPiSODE 1 | WATCH", "Ep 02")
      const blockEpMatch = text.match(/\b(?:EPiSODE|Episode|Ep|E)[\s.:_-]*(\d{1,4})\b/i);
      if (blockEpMatch) {
        currentEpisode = parseInt(blockEpMatch[1], 10);
      } else {
        for (const l of dlLinks) {
          const lText = `${l.text} ${l.getAttribute('href') || ''}`;
          const lEpMatch = lText.match(/\b(?:EPiSODE|Episode|Ep|E)[\s.:_-]*(\d{1,4})\b/i);
          if (lEpMatch) {
            currentEpisode = parseInt(lEpMatch[1], 10);
            break;
          }
        }
      }

      // On TV series, skip any release that could not be matched to an episode (prevents unplayable season packs)
      if ((defaultSeason !== undefined || activeSeason !== undefined) && currentEpisode === undefined) {
        continue;
      }

      // Parse size if present
      const sizeMatch = text.match(/(\d+(?:\.\d+)?\s*(?:GB|MB|GiB|MiB))/i);
      const sizeStr = sizeMatch ? sizeMatch[1] : undefined;
      let sizeInMB: number | undefined;
      if (sizeStr) {
        const num = parseFloat(sizeStr);
        if (/GB|GiB/i.test(sizeStr)) sizeInMB = num * 1024;
        else if (/MB|MiB/i.test(sizeStr)) sizeInMB = num;
      }

      // Determine quality strictly from link anchor text or short heading block
      const targetText = (text.length < 160 ? text : dlLinks.map((l) => l.text).join(' ')).toLowerCase();

      let quality = activeQuality;
      let resolution = activeResolution;

      if (/\b(?:480p|360p)\b/.test(targetText)) {
        quality = '480p';
        resolution = 480;
      } else if (/\b720p\b/.test(targetText)) {
        quality = '720p HD';
        resolution = 720;
      } else if (/\b1080p\b/.test(targetText)) {
        quality = '1080p FHD';
        resolution = 1080;
      } else if (/\b(?:4k|2160p|uhd)\b/.test(targetText) && (!sizeInMB || sizeInMB >= 1500)) {
        quality = '4K UHD';
        resolution = 2160;
      } else if (sizeInMB !== undefined) {
        // Fallback quality based on physical file size
        if (sizeInMB < 600) {
          quality = '480p';
          resolution = 480;
        } else if (sizeInMB < 1800) {
          quality = '720p HD';
          resolution = 720;
        } else if (sizeInMB < 6000) {
          quality = '1080p FHD';
          resolution = 1080;
        } else {
          quality = '4K UHD';
          resolution = 2160;
        }
      }

      let filename: string;
      if (currentEpisode !== undefined) {
        const epStr = `E${currentEpisode < 10 ? '0' + currentEpisode : currentEpisode}`;
        filename = `${fallbackTitle} · ${epStr} (${quality}${sizeStr ? ` [${sizeStr}]` : ''})`;
      } else {
        const cleanedBlock = cleanDisplayTitle(text.replace(/drive|instant|watch|download/gi, '').trim());
        filename = cleanedBlock ? `${fallbackTitle} · ${cleanedBlock} (${quality})` : `${fallbackTitle} (${quality})`;
      }

      const mirrors = dlLinks
        .map((l) => ({
          label: l.text.trim() || `Mirror (${quality})`,
          resolverUrl: l.getAttribute('href')!,
          directFile: false,
        }))
        .filter((m) => !/\.(?:zip|rar|7z|tar)(?:\?|$)/i.test(m.resolverUrl) && !/\/packs\//i.test(m.resolverUrl));

      if (mirrors.length === 0) continue;

      releases.push({
        provider: 'hdhub4u',
        filename,
        quality,
        resolution,
        season: activeSeason,
        episode: currentEpisode,
        size: sizeStr,
        mirrors,
      });
    }

    // Deduplicate by filename and resolver URL
    const seen = new Set<string>();
    const unique = releases.filter((r) => {
      const key = `${r.filename}_${r.mirrors[0]?.resolverUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => b.resolution - a.resolution);
  }

  async resolveStream(release: Release): Promise<PlaybackSource> {
    if (!release.mirrors || release.mirrors.length === 0) {
      console.warn(`[HDHub4u] ❌ No mirror available on release: "${release.filename}"`);
      throw new Error('No mirror available on release');
    }

    console.log(`[HDHub4u] 🔍 Resolving stream for "${release.filename}" across ${release.mirrors.length} mirror(s)...`);

    let lastError: any = null;
    for (let i = 0; i < release.mirrors.length; i++) {
      const mirror = release.mirrors[i];
      console.log(`[HDHub4u] 🔄 Mirror [${i + 1}/${release.mirrors.length}]: Resolving ${mirror.resolverUrl}`);
      try {
        const { url, label } = await resolveShortenerUrl(mirror.resolverUrl);
        if (url) {
          console.log(`[HDHub4u] ✅ Mirror [${i + 1}/${release.mirrors.length}] resolved successfully: ${url} (${label})`);
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
      } catch (err: any) {
        console.warn(`[HDHub4u] ⚠️ Mirror [${i + 1}/${release.mirrors.length}] failed:`, err?.message);
        lastError = err;
      }
    }

    console.error(`[HDHub4u] ❌ All ${release.mirrors.length} mirror(s) failed for "${release.filename}"`);
    throw lastError || new Error('Could not resolve any mirror for release');
  }
}
