import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { cleanMovieTitle } from '@/utils';

const STORAGE_KEY = '@cinebox_trailers';
const memoryCache = new Map<string, string>();
let isStorageLoaded = false;

class TrailerService {
  private client = axios.create({
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 7000,
  });

  private async loadStorage() {
    if (isStorageLoaded) return;
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const parsed = JSON.parse(json);
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') {
            memoryCache.set(k, v);
          }
        }
      }
      isStorageLoaded = true;
    } catch {
      isStorageLoaded = true;
    }
  }

  private async persistCache() {
    try {
      const obj: Record<string, string> = {};
      memoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore write errors
    }
  }

  private getCacheKey(title: string, year?: string): string {
    const clean = title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    return year ? `${clean}_${year}` : clean;
  }

  /**
   * Resolves official YouTube Trailer video ID with smart persistent caching.
   */
  async getTrailerVideoId(title: string, year?: string): Promise<string | null> {
    if (!title || typeof title !== 'string') return null;
    await this.loadStorage();

    const cleanTitle = cleanMovieTitle(title);
    const cacheKey = this.getCacheKey(cleanTitle, year);

    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey) || null;
    }

    const query = `${cleanTitle} ${year || ''} official trailer`.trim();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    try {
      const res = await this.client.get(searchUrl);
      const html = res.data;

      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      let match;
      const candidates: string[] = [];
      while ((match = regex.exec(html)) !== null) {
        candidates.push(match[1]);
        if (candidates.length >= 3) break;
      }

      const videoId = candidates[0] || null;
      if (videoId) {
        memoryCache.set(cacheKey, videoId);
        this.persistCache();
      }
      return videoId;
    } catch (err: any) {
      console.warn(`[TrailerService] Failed resolving trailer for "${title}":`, err?.message);
      return null;
    }
  }
}

export const trailerService = new TrailerService();
