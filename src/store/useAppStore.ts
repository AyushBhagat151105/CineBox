import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadItem, DownloadStatus, FavoriteItem, SearchHistoryItem, WatchHistoryItem } from '@/types';
import { cleanMovieTitle } from '@/utils';

export type PreferredPlayer = 'vlc' | 'chooser';

interface AppState {
  watchHistory: WatchHistoryItem[];
  favorites: FavoriteItem[];
  searchHistory: SearchHistoryItem[];
  downloads: DownloadItem[];
  preferredQuality: '4K' | '1080p' | '720p' | 'Auto';
  preferredLanguage: string;
  preferredPlayer: PreferredPlayer;
  skipSeconds: number; // 5, 10, 15, 30
  isLoaded: boolean;

  loadStorage: () => Promise<void>;
  saveProgress: (item: Omit<WatchHistoryItem, 'timestamp'>) => Promise<void>;
  getProgress: (mediaId: string, season?: number, episode?: number) => WatchHistoryItem | undefined;
  removeFromHistory: (mediaId: string, season?: number, episode?: number) => Promise<void>;
  setSkipSeconds: (seconds: number) => Promise<void>;
  setPreferredPlayer: (player: PreferredPlayer) => Promise<void>;
  toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
  isFavorite: (mediaId: string) => boolean;
  clearHistory: () => Promise<void>;
  addSearchQuery: (query: string) => Promise<void>;
  removeSearchQuery: (id: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  addDownload: (item: DownloadItem) => Promise<void>;
  updateDownload: (id: string, updates: Partial<DownloadItem>) => void;
  persistDownloads: () => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  clearCompletedDownloads: () => Promise<void>;
  getDownload: (mediaId: string, season?: number, episode?: number) => DownloadItem | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  watchHistory: [],
  favorites: [],
  searchHistory: [],
  downloads: [],
  preferredQuality: 'Auto',
  preferredLanguage: 'Hindi',
  preferredPlayer: 'vlc',
  skipSeconds: 10,
  isLoaded: false,

  loadStorage: async () => {
    try {
      const [historyJson, favsJson, skipStr, playerStr, searchJson, downloadsJson] = await Promise.all([
        AsyncStorage.getItem('@cinebox_history'),
        AsyncStorage.getItem('@cinebox_favorites'),
        AsyncStorage.getItem('@cinebox_skip_seconds'),
        AsyncStorage.getItem('@cinebox_preferred_player'),
        AsyncStorage.getItem('@cinebox_search_history'),
        AsyncStorage.getItem('@cinebox_downloads'),
      ]);

      let parsedHistory: WatchHistoryItem[] = historyJson ? JSON.parse(historyJson) : [];

      // Clean up any phantom non-existent episodes (such as Reacher S1:E9)
      const sanitizedHistory = parsedHistory.filter((item) => {
        const cleanTitle = cleanMovieTitle(item.title).toLowerCase();
        if (cleanTitle.includes('reacher') && item.season === 1 && item.episode === 9) {
          return false;
        }
        return true;
      });

      if (sanitizedHistory.length !== parsedHistory.length) {
        AsyncStorage.setItem('@cinebox_history', JSON.stringify(sanitizedHistory)).catch(() => {});
      }

      // Parse and sanitize downloads: interrupted downloads become paused
      let parsedDownloads: DownloadItem[] = downloadsJson ? JSON.parse(downloadsJson) : [];
      const sanitizedDownloads = parsedDownloads.map((item) => {
        if (item.status === 'downloading' || item.status === 'queued') {
          return { ...item, status: 'paused' as DownloadStatus };
        }
        return item;
      });

      console.log(`[Store] 📦 loadStorage finished. Loaded ${sanitizedHistory.length} history, ${sanitizedDownloads.length} downloads:`, JSON.stringify(sanitizedDownloads));
      set({
        watchHistory: sanitizedHistory,
        favorites: favsJson ? JSON.parse(favsJson) : [],
        searchHistory: searchJson ? JSON.parse(searchJson) : [],
        downloads: sanitizedDownloads,
        skipSeconds: skipStr ? parseInt(skipStr, 10) : 10,
        preferredPlayer: (playerStr as PreferredPlayer) || 'vlc',
        isLoaded: true,
      });
    } catch (err: any) {
      console.warn('[Store] ⚠️ Failed to load storage:', err?.message);
      set({ isLoaded: true });
    }
  },

  addSearchQuery: async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) return;

    const current = get().searchHistory;
    const filtered = current.filter(
      (item) => item.query.toLowerCase() !== trimmed.toLowerCase()
    );

    const newItem: SearchHistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      query: trimmed,
      timestamp: Date.now(),
    };

    const updated = [newItem, ...filtered].slice(0, 20);
    set({ searchHistory: updated });
    await AsyncStorage.setItem('@cinebox_search_history', JSON.stringify(updated));
  },

  removeSearchQuery: async (id: string) => {
    const updated = get().searchHistory.filter((item) => item.id !== id);
    set({ searchHistory: updated });
    await AsyncStorage.setItem('@cinebox_search_history', JSON.stringify(updated));
  },

  clearSearchHistory: async () => {
    set({ searchHistory: [] });
    await AsyncStorage.removeItem('@cinebox_search_history');
  },

  setSkipSeconds: async (seconds: number) => {
    set({ skipSeconds: seconds });
    await AsyncStorage.setItem('@cinebox_skip_seconds', seconds.toString());
  },

  setPreferredPlayer: async (player: PreferredPlayer) => {
    set({ preferredPlayer: player });
    await AsyncStorage.setItem('@cinebox_preferred_player', player);
  },

  getProgress: (mediaId: string, season?: number, episode?: number) => {
    const history = get().watchHistory;
    if (season !== undefined && episode !== undefined) {
      return history.find(
        (h) => h.mediaId === mediaId && h.season === season && h.episode === episode
      );
    }
    return history.find((h) => h.mediaId === mediaId);
  },

  removeFromHistory: async (mediaId: string, season?: number, episode?: number) => {
    const current = get().watchHistory;
    const filtered = current.filter((h) => {
      if (h.mediaId !== mediaId) return true;
      if (season !== undefined && episode !== undefined) {
        return !(h.season === season && h.episode === episode);
      }
      return false;
    });

    set({ watchHistory: filtered });
    await AsyncStorage.setItem('@cinebox_history', JSON.stringify(filtered));
  },

  saveProgress: async (item) => {
    const current = get().watchHistory;
    // Match either exact episode or the movie
    const filtered = current.filter((h) => {
      if (h.mediaId !== item.mediaId) return true;
      if (item.season !== undefined && item.episode !== undefined) {
        return !(h.season === item.season && h.episode === item.episode);
      }
      return false;
    });

    const isDone =
      item.completed ??
      (item.durationSeconds > 0 && item.positionSeconds / item.durationSeconds >= 0.9);

    const updatedItem: WatchHistoryItem = {
      ...item,
      completed: isDone,
      timestamp: Date.now(),
    };

    const newHistory = [updatedItem, ...filtered].slice(0, 50); // Keep 50 recent items
    set({ watchHistory: newHistory });

    await AsyncStorage.setItem('@cinebox_history', JSON.stringify(newHistory));
  },

  toggleFavorite: async (item) => {
    const current = get().favorites;
    const exists = current.some((f) => f.mediaId === item.mediaId);
    console.log(`[Store] 🔖 toggleFavorite for "${item.mediaId}". Exists: ${exists}, Count before: ${current.length}`);

    let newFavs: FavoriteItem[];
    if (exists) {
      newFavs = current.filter((f) => f.mediaId !== item.mediaId);
    } else {
      newFavs = [{ ...item, addedAt: Date.now() }, ...current];
    }

    set({ favorites: newFavs });
    console.log(`[Store] 🔖 Favorites updated, new count: ${newFavs.length}`);
    await AsyncStorage.setItem('@cinebox_favorites', JSON.stringify(newFavs));
  },

  isFavorite: (mediaId: string) => {
    return get().favorites.some((f) => f.mediaId === mediaId);
  },

  clearHistory: async () => {
    set({ watchHistory: [] });
    await AsyncStorage.removeItem('@cinebox_history');
  },

  addDownload: async (item: DownloadItem) => {
    const current = get().downloads;
    const filtered = current.filter((d) => d.id !== item.id);
    const updated = [item, ...filtered];
    set({ downloads: updated });
    await AsyncStorage.setItem('@cinebox_downloads', JSON.stringify(updated));
  },

  updateDownload: (id: string, updates: Partial<DownloadItem>) => {
    const current = get().downloads;
    const updated = current.map((d) => (d.id === id ? { ...d, ...updates } : d));
    set({ downloads: updated });
  },

  persistDownloads: async () => {
    const current = get().downloads;
    await AsyncStorage.setItem('@cinebox_downloads', JSON.stringify(current));
  },

  removeDownload: async (id: string) => {
    const current = get().downloads;
    const updated = current.filter((d) => d.id !== id);
    set({ downloads: updated });
    await AsyncStorage.setItem('@cinebox_downloads', JSON.stringify(updated));
  },

  clearCompletedDownloads: async () => {
    const current = get().downloads;
    const updated = current.filter((d) => d.status !== 'completed');
    set({ downloads: updated });
    await AsyncStorage.setItem('@cinebox_downloads', JSON.stringify(updated));
  },

  getDownload: (mediaId: string, season?: number, episode?: number) => {
    const downloads = get().downloads;
    if (season !== undefined && episode !== undefined) {
      return downloads.find(
        (d) => d.mediaId === mediaId && d.season === season && d.episode === episode
      );
    }
    return downloads.find((d) => d.mediaId === mediaId);
  },
}));
