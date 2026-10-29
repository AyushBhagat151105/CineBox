import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { ProviderId } from '@/types';
import { useAppStore } from '@/store';
import { sanitizeStreamUrl } from '@/utils';

export interface VlcPlaybackOptions {
  streamUrl: string;
  title: string;
  mediaId: string;
  provider: ProviderId;
  releaseName?: string;
  posterUrl?: string;
  season?: number;
  episode?: number;
  resumeSeconds?: number;
  durationSeconds?: number;
  headers?: Record<string, string>;
  forceChooser?: boolean;
}

interface ActiveVlcSession {
  options: VlcPlaybackOptions;
  startTime: number;
  initialResume: number;
}

class VlcService {
  private activeSession: ActiveVlcSession | null = null;
  private appStateSubscription: any = null;

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && this.activeSession) {
          this.handlePlaybackReturn();
        }
      }
    );
  }

  /**
   * Launch external VLC player with hardware acceleration and resume timestamp
   */
  async launch(options: VlcPlaybackOptions): Promise<boolean> {
    const {
      title,
      resumeSeconds = 0,
      headers = {},
      forceChooser = false,
    } = options;
    const streamUrl = sanitizeStreamUrl(options.streamUrl);

    if (!streamUrl) {
      Alert.alert('Error', 'Stream URL is missing or unreachable');
      return false;
    }

    // Record session for automatic resume tracking
    this.activeSession = {
      options: { ...options, streamUrl },
      startTime: Date.now(),
      initialResume: resumeSeconds,
    };

    // Immediately save initial session so it appears at top of Continue Watching
    await useAppStore.getState().saveProgress({
      mediaId: options.mediaId,
      title: options.title,
      provider: options.provider,
      posterUrl: options.posterUrl,
      releaseName: options.releaseName,
      season: options.season,
      episode: options.episode,
      positionSeconds: resumeSeconds,
      durationSeconds: options.durationSeconds || 7200, // Default 2 hours if unknown
    });

    if (Platform.OS === 'android') {
      return this.launchAndroidIntent(streamUrl, title, resumeSeconds, headers, forceChooser);
    } else {
      // iOS / Web fallback: open URL directly
      try {
        const canOpen = await Linking.canOpenURL(`vlc://${streamUrl}`);
        if (canOpen) {
          await Linking.openURL(`vlc://${streamUrl}`);
          return true;
        }
        await Linking.openURL(streamUrl);
        return true;
      } catch (err: any) {
        Alert.alert('Unable to Open Player', err?.message || 'Failed opening media URL');
        return false;
      }
    }
  }

  private async launchAndroidIntent(
    streamUrl: string,
    title: string,
    resumeSeconds: number,
    headers: Record<string, string>,
    forceChooser: boolean
  ): Promise<boolean> {
    const cleanUrl = sanitizeStreamUrl(streamUrl);
    const resumePositionMs = Math.max(0, Math.floor(resumeSeconds * 1000));
    const userAgent = headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

    // Intent parameters for VLC for Android and universal video players (MX Player, Just Player)
    const intentParams: IntentLauncher.IntentLauncherParams = {
      data: cleanUrl,
      type: 'video/*',
      extra: {
        title,
        itemTitle: title,
        position: resumePositionMs,
        from_start: resumeSeconds <= 0,
        extra_headers: ['User-Agent', userAgent],
        headers: ['User-Agent', userAgent],
      },
    };

    if (!forceChooser) {
      intentParams.packageName = 'org.videolan.vlc';
    }

    console.log(`[VLC] 🚀 Launching Android Intent:`, {
      action: 'android.intent.action.VIEW',
      packageName: intentParams.packageName || '(System Default Chooser)',
      streamUrl: cleanUrl.slice(0, 100) + (cleanUrl.length > 100 ? '...' : ''),
      title,
      resumePositionMs,
      from_start: resumeSeconds <= 0,
    });

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', intentParams);
      console.log(`[VLC] ✅ Successfully dispatched Intent to ${intentParams.packageName || 'System Chooser'}`);
      return true;
    } catch (err: any) {
      console.warn(`[VLC] ⚠️ Direct launch of ${intentParams.packageName} failed (${err?.message}), falling back to chooser...`);
      // If targeting VLC directly failed, prompt user to install or use system chooser
      return this.handleLaunchFallback(streamUrl, title, resumeSeconds, headers);
    }
  }

  private async handleLaunchFallback(
    streamUrl: string,
    title: string,
    resumeSeconds: number,
    headers: Record<string, string>
  ): Promise<boolean> {
    const cleanUrl = sanitizeStreamUrl(streamUrl);
    return new Promise((resolve) => {
      Alert.alert(
        'VLC for Android Recommended',
        'VLC is required for smooth 4K UHD, HDR, and DTS multi-audio playback. Would you like to install VLC or use another video player?',
        [
          {
            text: 'Install VLC',
            style: 'default',
            onPress: async () => {
              try {
                await Linking.openURL('market://details?id=org.videolan.vlc');
              } catch {
                await Linking.openURL('https://play.google.com/store/apps/details?id=org.videolan.vlc');
              }
              resolve(false);
            },
          },
          {
            text: 'Open with Other App',
            style: 'default',
            onPress: async () => {
              try {
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                  data: cleanUrl,
                  type: 'video/*',
                  extra: {
                    title,
                    position: Math.max(0, Math.floor(resumeSeconds * 1000)),
                  },
                });
                resolve(true);
              } catch (innerErr: any) {
                Alert.alert('Playback Failed', 'No compatible video player found on device.');
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

  /**
   * Called when user finishes watching and returns to CineBox
   */
  private async handlePlaybackReturn() {
    if (!this.activeSession) return;

    const { options, startTime, initialResume } = this.activeSession;
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`[VLC] 🔄 Returned from player session. Elapsed watch time: ${elapsedSec}s (initial resume: ${initialResume}s)`);

    // Only update progress if user actually spent more than 15 seconds in the player
    if (elapsedSec >= 15) {
      const newPosition = initialResume + elapsedSec;
      const duration = options.durationSeconds && options.durationSeconds > 0
        ? options.durationSeconds
        : Math.max(newPosition, 7200);

      console.log(`[VLC] 💾 Saving watch progress: ${newPosition}s / ${duration}s for "${options.title}"`);
      await useAppStore.getState().saveProgress({
        mediaId: options.mediaId,
        title: options.title,
        provider: options.provider,
        posterUrl: options.posterUrl,
        releaseName: options.releaseName,
        season: options.season,
        episode: options.episode,
        positionSeconds: Math.min(newPosition, duration),
        durationSeconds: duration,
      });
    }

    this.activeSession = null;
  }
}

export const vlcService = new VlcService();
