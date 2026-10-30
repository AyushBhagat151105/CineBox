import AsyncStorage from '@react-native-async-storage/async-storage';

export const ADS_STORAGE_KEY = '@cinebox_ad_unlocked_until';

// Compile-time VIP flag: If EXPO_PUBLIC_ENABLE_ADS is 'false', ads are completely disabled
export const ADS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ADS !== 'false';
export const MONETAG_ZONE_ID = process.env.EXPO_PUBLIC_MONETAG_ZONE_ID || '12155691';
export const MONETAG_DIRECT_URL =
  process.env.EXPO_PUBLIC_MONETAG_DIRECT_URL || 'https://uplcm.com/4/12155691';

export interface AdPromptRequest {
  title: string;
  onSuccess: () => void | Promise<void>;
  onCancel?: () => void;
}

type AdRequestListener = (request: AdPromptRequest | null) => void;

class AdService {
  private listeners: Set<AdRequestListener> = new Set();
  private currentRequest: AdPromptRequest | null = null;

  /**
   * Returns true if user has VIP status (EXPO_PUBLIC_ENABLE_ADS=false).
   * For public ad-enabled builds, an ad is required every single time a video is played.
   */
  async isAdUnlocked(): Promise<boolean> {
    if (!ADS_ENABLED) {
      console.log('[Ads] 👑 VIP Build detected: All ads permanently bypassed');
      return true;
    }

    // Public builds: require an ad every single time a video is played (no 4-hour window)
    return false;
  }

  /**
   * Helper to check VIP status
   */
  isVip(): boolean {
    return !ADS_ENABLED;
  }

  /**
   * Legacy compatibility method
   */
  async getRemainingUnlockMinutes(): Promise<number> {
    if (!ADS_ENABLED) return 999999;
    return 0;
  }

  /**
   * Clear active unlock pass (for testing or debugging)
   */
  async resetAdUnlock(): Promise<void> {
    await AsyncStorage.removeItem(ADS_STORAGE_KEY);
    console.log('[Ads] 🔄 Reset ad unlock state');
  }

  /**
   * Intercepts media playback. If an ad is required, displays the RewardedAdModal.
   * If user is VIP, executes proceedAction() immediately.
   */
  async ensureUnlockedOrPrompt(
    title: string,
    proceedAction: () => void | Promise<void>,
    onCancel?: () => void
  ): Promise<boolean> {
    const isUnlocked = await this.isAdUnlocked();
    if (isUnlocked) {
      await proceedAction();
      return true;
    }

    console.log(`[Ads] 📢 Ad required before playing "${title}". Prompting RewardedAdModal...`);
    this.showModal({
      title,
      onSuccess: async () => {
        this.dismissModal();
        await proceedAction();
      },
      onCancel: () => {
        this.dismissModal();
        if (onCancel) onCancel();
      },
    });

    return false;
  }

  subscribe(listener: AdRequestListener): () => void {
    this.listeners.add(listener);
    if (this.currentRequest) {
      listener(this.currentRequest);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private showModal(request: AdPromptRequest) {
    this.currentRequest = request;
    for (const listener of this.listeners) {
      listener(request);
    }
  }

  private dismissModal() {
    this.currentRequest = null;
    for (const listener of this.listeners) {
      listener(null);
    }
  }
}

export const adService = new AdService();
