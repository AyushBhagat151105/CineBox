import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteItem, WatchHistoryItem } from '@/types';

export type PreferredPlayer = 'vlc' | 'chooser';

interface AppState {
  watchHistory: WatchHistoryItem[];
  favorites: FavoriteItem[];
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
}

export const useAppStore = create<AppState>((set, get) => ({
  watchHistory: [],
  favorites: [],
  preferredQuality: 'Auto',
  preferredLanguage: 'Hindi',
  preferredPlayer: 'vlc',
  skipSeconds: 10,
  isLoaded: false,

  loadStorage: async () => {
    try {
      const [historyJson, favsJson, skipStr, playerStr] = await Promise.all([
        AsyncStorage.getItem('@cinebox_history'),
        AsyncStorage.getItem('@cinebox_favorites'),
        AsyncStorage.getItem('@cinebox_skip_seconds'),
        AsyncStorage.getItem('@cinebox_preferred_player'),
      ]);

      set({
        watchHistory: historyJson ? JSON.parse(historyJson) : [],
        favorites: favsJson ? JSON.parse(favsJson) : [],
        skipSeconds: skipStr ? parseInt(skipStr, 10) : 10,
        preferredPlayer: (playerStr as PreferredPlayer) || 'vlc',
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
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

    const isDone = item.durationSeconds > 0 && item.positionSeconds / item.durationSeconds >= 0.9;

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

    let newFavs: FavoriteItem[];
    if (exists) {
      newFavs = current.filter((f) => f.mediaId !== item.mediaId);
    } else {
      newFavs = [{ ...item, addedAt: Date.now() }, ...current];
    }

    set({ favorites: newFavs });
    await AsyncStorage.setItem('@cinebox_favorites', JSON.stringify(newFavs));
  },

  isFavorite: (mediaId: string) => {
    return get().favorites.some((f) => f.mediaId === mediaId);
  },

  clearHistory: async () => {
    set({ watchHistory: [] });
    await AsyncStorage.removeItem('@cinebox_history');
  },
}));
