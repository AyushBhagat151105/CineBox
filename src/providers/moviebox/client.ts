import axios from 'axios';
import { MediaProvider } from '../base';
import {
  CatalogItem,
  MediaDetails,
  MediaType,
  PlaybackSource,
  Release,
} from '@/types';
import { buildSignedHeaders } from './crypto';

const HOST_POOL = [
  'https://api6.aoneroom.com',
  'https://api5.aoneroom.com',
  'https://api4.aoneroom.com',
  'https://api4sg.aoneroom.com',
  'https://api3.aoneroom.com',
  'https://api6sg.aoneroom.com',
  'https://api.inmoviebox.com',
];

export class MovieBoxProvider implements MediaProvider {
  id = 'moviebox' as const;
  name = 'MovieBox';
  supportsSearch = true;
  supportsBollywood = false;

  private authToken: string | null = null;
  private activeHostIndex = 0;

  private async request(method: 'GET' | 'POST', path: string, data?: any): Promise<any> {
    if (!this.authToken && path !== '/wefeed-mobile-bff/user-api/visitor-login') {
      await this.ensureSession();
    }

    const bodyStr = data ? JSON.stringify(data) : undefined;

    for (let i = 0; i < HOST_POOL.length; i++) {
      const hostIndex = (this.activeHostIndex + i) % HOST_POOL.length;
      const host = HOST_POOL[hostIndex];
      const url = `${host}${path}`;

      const headers = buildSignedHeaders(method, url, bodyStr, this.authToken || undefined);

      try {
        const res = await axios({
          method,
          url,
          data: bodyStr,
          headers,
          timeout: 8000,
        });

        this.activeHostIndex = hostIndex;
        const json = res.data;
        return json.data !== undefined ? json.data : json;
      } catch (err: any) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          this.authToken = null; // Re-login on auth failure
        }
        continue;
      }
    }

    throw new Error('All MovieBox hosts exhausted');
  }

  private async ensureSession(): Promise<string> {
    if (this.authToken) return this.authToken;

    try {
      const data = await this.request('POST', '/wefeed-mobile-bff/user-api/visitor-login', {});
      if (data?.token) {
        this.authToken = data.token;
        return this.authToken!;
      }
    } catch (err) {
      console.warn('MovieBox visitor login failed:', err);
    }
    return '';
  }

  async search(query: string, page = 1): Promise<CatalogItem[]> {
    try {
      const data = await this.request('POST', '/wefeed-mobile-bff/subject-api/search/v2', {
        keyword: query,
        page,
        perPage: 15,
        subjectType: 0,
      });

      const items: any[] =
        data?.results?.[0]?.subjects ||
        data?.items ||
        data?.list ||
        (Array.isArray(data) ? data : []);
      return items.map((item) => ({
        id: {
          provider: 'moviebox',
          value: (item.subjectId || item.id || '').toString(),
        },
        title: item.title || item.name || '',
        mediaType: item.subjectType === 2 || item.stype === 2 ? 'series' : 'movie',
        year: (item.releaseYear || item.year || '').toString(),
        posterUrl: item.cover?.url || item.coverUrl || item.posterUrl,
        rating: item.imdbRatingValue || item.imdbRate || item.rating,
        description: item.description || item.intro,
        availableProviders: ['moviebox'],
      }));
    } catch (err) {
      console.warn('MovieBox search failed:', err);
      return [];
    }
  }

  async details(subjectId: string): Promise<MediaDetails> {
    const data = await this.request('GET', `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`);

    const isSeries = data.subjectType === 2 || data.stype === 2;
    const dubs: any[] = data.dubs || [];

    return {
      id: {
        provider: 'moviebox',
        value: subjectId,
      },
      title: data.title || data.name || '',
      mediaType: isSeries ? 'series' : 'movie',
      year: (data.releaseYear || data.year || '').toString(),
      description: data.description || data.intro,
      imdbRating: data.imdbRatingValue || data.imdbRate,
      duration: data.duration,
      genres: data.genres || ['Action', 'Drama'],
      posterUrl: data.cover?.url || data.coverUrl,
      backdropUrl: data.background?.url || data.backdropUrl,
      dubs: dubs.map((d: any) => ({
        subjectId: (d.subjectId || '').toString(),
        language: d.language || d.lanName || 'Original',
        label: d.title || d.label || d.language || 'Original',
      })),
      seasons: [],
    };
  }

  async releases(subjectId: string, season = 0, episode = 0): Promise<Release[]> {
    const path =
      season === 0 && episode === 0
        ? `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${subjectId}`
        : `/wefeed-mobile-bff/subject-api/play-info/v2?subjectId=${subjectId}&se=${season}&ep=${episode}`;

    try {
      const data = await this.request('GET', path);
      const streams: any[] = data?.streams || data?.list || (Array.isArray(data) ? data : []);
      const releases: Release[] = [];

      for (const s of streams) {
        const streamUrl = s.url || s.playUrl;
        if (!streamUrl) continue;

        const resStr = (s.resolution || s.quality || '1080p').toString();
        let resolution = 1080;
        if (/4k|2160/i.test(resStr)) resolution = 2160;
        else if (/720/i.test(resStr)) resolution = 720;
        else if (/480/i.test(resStr)) resolution = 480;

        releases.push({
          provider: 'moviebox',
          filename: `MovieBox ${resStr} Stream`,
          quality: resStr,
          resolution,
          mirrors: [
            {
              label: `MovieBox Direct (${resStr})`,
              resolverUrl: streamUrl,
              directFile: true,
            },
          ],
        });
      }

      return releases.sort((a, b) => b.resolution - a.resolution);
    } catch (err) {
      console.warn('MovieBox stream fetch failed:', err);
      return [];
    }
  }

  async resolveStream(release: Release): Promise<PlaybackSource> {
    const mirror = release.mirrors[0];
    if (!mirror) throw new Error('No mirror available');

    return {
      provider: 'moviebox',
      url: mirror.resolverUrl,
      sourceLabel: mirror.label,
      title: release.filename,
    };
  }
}
