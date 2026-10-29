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
  backdropUrl?: string;
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
  private isHandlingReturn = false;

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && this.activeSession && !this.isHandlingReturn) {
          // Allow startActivityAsync promise to resolve first with exact intent extras (400ms buffer)
          setTimeout(() => {
            if (this.activeSession && !this.isHandlingReturn) {
              console.log('[VLC] 🔄 AppState active reconciliation (player closed or switched)');
              this.handlePlaybackReturn();
            }
          }, 400);
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
      backdropUrl: options.backdropUrl,
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
        return_result: true, // Requests exit position & duration in result extra
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
      const result = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', intentParams);
      console.log(`[VLC] ✅ Player closed. Result code: ${result.resultCode}, extra:`, result.extra);
      await this.handlePlaybackReturn(result.extra);
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
                const result = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                  data: cleanUrl,
                  type: 'video/*',
                  extra: {
                    title,
                    position: Math.max(0, Math.floor(resumeSeconds * 1000)),
                    return_result: true,
                  },
                });
                await this.handlePlaybackReturn(result.extra);
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
   * Called when user finishes watching and returns to CineBox.
   * Extracts exact position and duration returned by VLC (extra_position)
   * or MX Player / Just Player (position, duration), falling back to elapsed time if needed.
   */
  private async handlePlaybackReturn(resultExtra?: Record<string, any>) {
    if (!this.activeSession || this.isHandlingReturn) return;
    this.isHandlingReturn = true;

    try {
      const { options, startTime, initialResume } = this.activeSession;
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      let exactPositionSec: number | null = null;
      let exactDurationSec: number | null = null;

      if (resultExtra) {
        // VLC uses extra_position & extra_duration (long ms)
        // MX Player & Just Player use position & duration (int ms)
        const rawPos = resultExtra.extra_position ?? resultExtra.position;
        const rawDur = resultExtra.extra_duration ?? resultExtra.duration;

        if (rawPos !== undefined && rawPos !== null) {
          const numPos = Number(rawPos);
          if (!isNaN(numPos) && numPos > 0) {
            exactPositionSec = Math.round(numPos / 1000);
          }
        }

        if (rawDur !== undefined && rawDur !== null) {
          const numDur = Number(rawDur);
          if (!isNaN(numDur) && numDur > 0) {
            exactDurationSec = Math.round(numDur / 1000);
          }
        }
      }

      const duration =
        exactDurationSec && exactDurationSec > 0
          ? exactDurationSec
          : options.durationSeconds && options.durationSeconds > 0
          ? options.durationSeconds
          : 7200;

      let finalPosition: number;
      if (exactPositionSec !== null) {
        console.log(`[VLC] 🎯 Exact position received from player extra: ${exactPositionSec}s / ${duration}s`);
        finalPosition = exactPositionSec;
      } else {
        // Fallback to wall-clock if intent did not carry extra position
        if (elapsedSec < 10) {
          console.log(`[VLC] ⏱️ Quick return (${elapsedSec}s). Keeping position at ${initialResume}s`);
          finalPosition = initialResume;
        } else {
          finalPosition = Math.min(initialResume + elapsedSec, duration);
          console.log(`[VLC] ⏱️ Wall-clock fallback position: ${finalPosition}s / ${duration}s (elapsed: ${elapsedSec}s)`);
        }
      }

      const isCompleted = duration > 0 && finalPosition / duration >= 0.9;

      // Series Auto-Advance: If episode completed (≥90%), advance to the next episode
      if (isCompleted && options.season !== undefined && options.episode !== undefined) {
        const nextEp = options.episode + 1;
        console.log(
          `[VLC] 🏆 Episode completed (${finalPosition}s / ${duration}s). Auto-advancing Continue Watching to S${options.season}:E${nextEp}`
        );

        // 1. Mark current episode as completed in history
        await useAppStore.getState().saveProgress({
          mediaId: options.mediaId,
          title: options.title,
          provider: options.provider,
          posterUrl: options.posterUrl,
          backdropUrl: options.backdropUrl,
          releaseName: options.releaseName,
          season: options.season,
          episode: options.episode,
          positionSeconds: duration,
          durationSeconds: duration,
        });

        // 2. Add next episode to Continue Watching at 0s so user can resume seamlessly
        await useAppStore.getState().saveProgress({
          mediaId: options.mediaId,
          title: options.title,
          provider: options.provider,
          posterUrl: options.posterUrl,
          backdropUrl: options.backdropUrl,
          season: options.season,
          episode: nextEp,
          positionSeconds: 0,
          durationSeconds: duration,
        });
      } else if (finalPosition > 10 || isCompleted) {
        console.log(`[VLC] 💾 Saving watch progress: ${finalPosition}s / ${duration}s for "${options.title}"`);
        await useAppStore.getState().saveProgress({
          mediaId: options.mediaId,
          title: options.title,
          provider: options.provider,
          posterUrl: options.posterUrl,
          backdropUrl: options.backdropUrl,
          releaseName: options.releaseName,
          season: options.season,
          episode: options.episode,
          positionSeconds: Math.min(finalPosition, duration),
          durationSeconds: duration,
        });
      }
    } catch (err: any) {
      console.warn(`[VLC] ⚠️ Error saving playback progress:`, err?.message);
    } finally {
      this.activeSession = null;
      this.isHandlingReturn = false;
    }
  }
}

export const vlcService = new VlcService();
