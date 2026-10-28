import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteItem, WatchHistoryItem } from '../types/models';

interface AppState {
  watchHistory: WatchHistoryItem[];
  favorites: FavoriteItem[];
  preferredQuality: '4K' | '1080p' | '720p' | 'Auto';
  preferredLanguage: string;
  isLoaded: boolean;

  loadStorage: () => Promise<void>;
  saveProgress: (item: Omit<WatchHistoryItem, 'timestamp'>) => Promise<void>;
  toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
  isFavorite: (mediaId: string) => boolean;
  clearHistory: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  watchHistory: [],
  favorites: [],
  preferredQuality: 'Auto',
  preferredLanguage: 'Hindi',
  isLoaded: false,

  loadStorage: async () => {
    try {
      const [historyJson, favsJson] = await Promise.all([
        AsyncStorage.getItem('@cinebox_history'),
        AsyncStorage.getItem('@cinebox_favorites'),
      ]);

      set({
        watchHistory: historyJson ? JSON.parse(historyJson) : [],
        favorites: favsJson ? JSON.parse(favsJson) : [],
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  saveProgress: async (item) => {
    const current = get().watchHistory;
    const filtered = current.filter((h) => h.mediaId !== item.mediaId);

    const updatedItem: WatchHistoryItem = {
      ...item,
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
