import { Alert, Linking, NativeModules, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { PreferredPlayer, ProviderId } from '@/types';
import { useAppStore } from '@/store';
import { sanitizeStreamUrl } from '@/utils';
import { adService } from './ads';

const { NativePlayerLauncher } = NativeModules;

export interface VlcPlaybackOptions {
  streamUrl: string;
  title: string;
  mediaId: string;
  provider: ProviderId;
  releaseName?: string;
  posterUrl?: string;
  backdropUrl?: string;
  season?: number;
  episode?: number;
  resumeSeconds?: number;
  durationSeconds?: number;
  headers?: Record<string, string>;
  forceChooser?: boolean;
  targetPlayer?: PreferredPlayer;
}

class VlcService {
  /**
   * Launch external player following the MovieBox-TUI model:
   * Clean, uncoupled Android ACTION_VIEW intent.
   * Hands the video stream link directly to Android / VLC.
   */
  async launch(options: VlcPlaybackOptions): Promise<boolean> {
    const isUnlocked = await adService.isAdUnlocked();
    if (!isUnlocked) {
      return new Promise<boolean>((resolve) => {
        adService.ensureUnlockedOrPrompt(
          options.title,
          async () => {
            const launched = await this.executeLaunch(options);
            resolve(launched);
          },
          () => resolve(false)
        );
      });
    }

    return this.executeLaunch(options);
  }

  private async executeLaunch(options: VlcPlaybackOptions): Promise<boolean> {
    const streamUrl = sanitizeStreamUrl(options.streamUrl);

    if (!streamUrl) {
      Alert.alert('Error', 'Stream URL is missing or unreachable');
      return false;
    }

    // Immediately record in history as "Last Played"
    try {
      await useAppStore.getState().saveProgress({
        mediaId: options.mediaId,
        title: options.title,
        provider: options.provider,
        posterUrl: options.posterUrl,
        backdropUrl: options.backdropUrl,
        releaseName: options.releaseName,
        season: options.season,
        episode: options.episode,
        positionSeconds: 0,
        durationSeconds: 0,
        completed: false,
      });
      console.log(`[Player] 📝 Recorded "${options.title}" in Last Played`);
    } catch (saveErr: any) {
      console.warn('[Player] ⚠️ Could not save watch history:', saveErr?.message);
    }

    if (Platform.OS === 'android') {
      return this.launchAndroidIntent(streamUrl, options);
    } else if (Platform.OS === 'ios') {
      return this.launchIosPlayer(streamUrl);
    } else {
      // Web fallback: open URL directly
      try {
        await Linking.openURL(streamUrl);
        return true;
      } catch (err: any) {
        Alert.alert('Unable to Open Player', err?.message || 'Failed opening media URL');
        return false;
      }
    }
  }

  /**
   * Android Intent Launch (Exact MovieBox-TUI pattern):
   * Fires android.intent.action.VIEW with data: url, type: "video/*", FLAG_ACTIVITY_NEW_TASK.
   * Dispatches directly to native external players (VLC, MX Player, Just Player).
   * Fire-and-forget: never locks activity result promises, never falls back to browser/Chrome download.
   */
  private async launchAndroidIntent(
    streamUrl: string,
    options: VlcPlaybackOptions
  ): Promise<boolean> {
    let cleanUrl = sanitizeStreamUrl(streamUrl);

    // If local file:// URI, convert to content:// via FileProvider to avoid FileUriExposedException
    if (cleanUrl.startsWith('file://')) {
      try {
        const contentUri = await FileSystem.getContentUriAsync(cleanUrl);
        if (contentUri) {
          cleanUrl = contentUri;
          console.log(`[Player] 📂 Resolved file URI to Content URI: ${cleanUrl}`);
        }
      } catch (e: any) {
        console.warn('[Player] ⚠️ Could not convert file URI to Content URI:', e?.message);
      }
    }

    const storePreferred = useAppStore.getState().preferredPlayer;
    const targetPlayer = options.targetPlayer || storePreferred;
    const forceChooser = !!options.forceChooser || targetPlayer === 'ask' || targetPlayer === 'chooser';

    console.log(`[Player] 🚀 Launching Android Intent (MovieBox-TUI pattern): ${cleanUrl} (player: ${targetPlayer}, forceChooser: ${forceChooser})`);

    // 1. Primary: NativePlayerLauncher (unlocked fire-and-forget Intent.ACTION_VIEW with video/*)
    if (NativePlayerLauncher) {
      try {
        if (typeof NativePlayerLauncher.playVideoWithTarget === 'function') {
          await NativePlayerLauncher.playVideoWithTarget(
            cleanUrl,
            options.title,
            null, // Subtitles location
            options.headers || null,
            forceChooser,
            targetPlayer
          );
        } else if (typeof NativePlayerLauncher.playVideo === 'function') {
          await NativePlayerLauncher.playVideo(
            cleanUrl,
            options.title,
            null, // Subtitles location
            options.headers || null,
            forceChooser
          );
        }
        console.log('[Player] ✅ Dispatched via NativePlayerLauncher successfully');
        return true;
      } catch (nativeErr: any) {
        console.warn('[Player] ⚠️ NativePlayerLauncher threw error:', nativeErr?.message);
        Alert.alert(
          'No Video Player Found',
          'Please install VLC, MX Player, or Just Player from the Google Play Store.'
        );
        return false;
      }
    }

    // 2. Secondary fallback (ExpoIntentLauncher if running in Expo Go without native build)
    const isContentUri = cleanUrl.startsWith('content://');
    const flags = isContentUri ? 0x10000001 : 0x10000000;

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: cleanUrl,
        type: 'video/*',
        flags,
      });
      return true;
    } catch (err: any) {
      console.warn('[Player] ⚠️ IntentLauncher failed:', err?.message);
      Alert.alert(
        'Playback Failed',
        'Could not launch a video player. Please ensure VLC or another video player is installed.'
      );
      return false;
    }
  }

  /**
   * Launch external player on iOS via URL Schemes (VLC, Outplayer, Infuse)
   */
  private async launchIosPlayer(streamUrl: string): Promise<boolean> {
    const cleanUrl = sanitizeStreamUrl(streamUrl);
    const encodedUrl = encodeURIComponent(cleanUrl);

    // 1. VLC for iOS (x-callback and direct)
    const vlcCallbackUri = `vlc-x-callback://x-callback-url/stream?url=${encodedUrl}`;
    const vlcDirectUri = `vlc://${cleanUrl.replace(/^https?:\/\//, '')}`;

    // 2. Outplayer for iOS
    const outplayerUri = `outplayer://${cleanUrl.replace(/^https?:\/\//, '')}`;

    // 3. Infuse for iOS
    const infuseUri = `infuse://x-callback-url/play?url=${encodedUrl}`;

    try {
      if (await Linking.canOpenURL(vlcCallbackUri)) {
        await Linking.openURL(vlcCallbackUri);
        return true;
      }

      if (await Linking.canOpenURL(vlcDirectUri)) {
        await Linking.openURL(vlcDirectUri);
        return true;
      }

      if (await Linking.canOpenURL(outplayerUri)) {
        await Linking.openURL(outplayerUri);
        return true;
      }

      if (await Linking.canOpenURL(infuseUri)) {
        await Linking.openURL(infuseUri);
        return true;
      }
    } catch (checkErr) {
      console.warn('[Player] ⚠️ iOS URL scheme probe failed:', checkErr);
    }

    return new Promise((resolve) => {
      Alert.alert(
        'VLC for iOS Recommended',
        'VLC for Mobile (Free on App Store) is recommended for smooth playback with multi-audio & subtitles.',
        [
          {
            text: 'Get VLC (Free)',
            style: 'default',
            onPress: async () => {
              try {
                await Linking.openURL('https://apps.apple.com/app/vlc-for-mobile/id650377962');
              } catch {}
              resolve(false);
            },
          },
          {
            text: 'Open in Safari',
            style: 'default',
            onPress: async () => {
              try {
                await Linking.openURL(cleanUrl);
                resolve(true);
              } catch {
                resolve(false);
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
        ]
      );
    });
  }
}

export const vlcService = new VlcService();
