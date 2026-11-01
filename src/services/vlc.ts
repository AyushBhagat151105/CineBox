import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { ProviderId } from '@/types';
import { useAppStore } from '@/store';
import { sanitizeStreamUrl } from '@/utils';
import { aggregator } from '@/providers';
import { adService } from './ads';

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

    // Reconcile and finish prior session if user launches another media
    if (this.activeSession) {
      console.log('[VLC] 🔄 Closing prior session before launching new media');
      await this.handlePlaybackReturn();
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
    } else if (Platform.OS === 'ios') {
      return this.launchIosPlayer(streamUrl, title);
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
   * Launch external player on iOS via URL Schemes (VLC, Outplayer, Infuse)
   */
  private async launchIosPlayer(streamUrl: string, title: string): Promise<boolean> {
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
        console.log('[VLC] 🍎 Launching VLC for iOS (x-callback)');
        await Linking.openURL(vlcCallbackUri);
        return true;
      }

      if (await Linking.canOpenURL(vlcDirectUri)) {
        console.log('[VLC] 🍎 Launching VLC for iOS (direct scheme)');
        await Linking.openURL(vlcDirectUri);
        return true;
      }

      if (await Linking.canOpenURL(outplayerUri)) {
        console.log('[VLC] 🍎 Launching Outplayer for iOS');
        await Linking.openURL(outplayerUri);
        return true;
      }

      if (await Linking.canOpenURL(infuseUri)) {
        console.log('[VLC] 🍎 Launching Infuse for iOS');
        await Linking.openURL(infuseUri);
        return true;
      }
    } catch (checkErr) {
      console.warn('[VLC] ⚠️ iOS URL scheme probe failed:', checkErr);
    }

    return new Promise((resolve) => {
      Alert.alert(
        'VLC for iOS Recommended',
        'VLC for Mobile (Free on App Store) is recommended for smooth 4K HDR playback with multi-audio & subtitles.',
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

  private async launchAndroidIntent(
    streamUrl: string,
    title: string,
    resumeSeconds: number,
    headers: Record<string, string>,
    forceChooser: boolean
  ): Promise<boolean> {
    let cleanUrl = sanitizeStreamUrl(streamUrl);
    const resumePositionMs = Math.max(0, Math.floor(resumeSeconds * 1000));
    const userAgent = headers['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

    // If local file:// URI, convert to content:// via FileProvider to avoid FileUriExposedException
    if (cleanUrl.startsWith('file://')) {
      try {
        const contentUri = await FileSystem.getContentUriAsync(cleanUrl);
        if (contentUri) {
          cleanUrl = contentUri;
          console.log(`[VLC] 📂 Resolved file URI to Content URI: ${cleanUrl}`);
        }
      } catch (e: any) {
        console.warn('[VLC] ⚠️ Could not convert file URI to Content URI:', e?.message);
      }
    }

    // Intent parameters for VLC for Android and universal video players (MX Player, Just Player)
    // flags: FLAG_ACTIVITY_CLEAR_TOP (0x04000000) | FLAG_ACTIVITY_SINGLE_TOP (0x20000000)
    // For content:// URIs: also include FLAG_GRANT_READ_URI_PERMISSION (0x00000001) | FLAG_GRANT_PREFIX_URI_PERMISSION (0x00000080)
    const isContentUri = cleanUrl.startsWith('content://');
    const flags = isContentUri ? 0x24000081 : 0x24000000;

    const intentParams: IntentLauncher.IntentLauncherParams = {
      data: cleanUrl,
      type: 'video/*',
      flags,
      extra: {
        title,
        itemTitle: title,
        item_title: title,
        'android.intent.extra.TITLE': title,
        position: resumePositionMs,
        from_start: resumeSeconds <= 0,
        return_result: true, // Requests exit position & duration in result extra
        extra_headers: ['User-Agent', userAgent],
        headers: ['User-Agent', userAgent],
      },
    };

    if (!forceChooser) {
      intentParams.packageName = 'org.videolan.vlc';
      intentParams.className = 'org.videolan.vlc.StartActivity';
    }

    console.log(`[VLC] 🚀 Launching Android Intent:`, {
      action: 'android.intent.action.VIEW',
      packageName: intentParams.packageName || '(System Default Chooser)',
      streamUrl: cleanUrl.slice(0, 100) + (cleanUrl.length > 100 ? '...' : ''),
      title,
      resumePositionMs,
      from_start: resumeSeconds <= 0,
      flags: `0x${flags.toString(16)} (${isContentUri ? 'GRANT_READ_URI | CLEAR_TOP | SINGLE_TOP' : 'CLEAR_TOP | SINGLE_TOP'})`,
    });

    try {
      const result = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', intentParams);
      console.log(`[VLC] ✅ Player closed. Result code: ${result.resultCode}, extra:`, result.extra);
      await this.handlePlaybackReturn(result.extra);
      return true;
    } catch (err: any) {
      const errMsg = err?.message || '';
      console.warn(`[VLC] ⚠️ Direct launch of ${intentParams.packageName} failed (${errMsg})`);

      // If expo-intent-launcher has a pending activity lock (user switched apps without pressing back inside VLC):
      // Launch via Linking intent to bypass the pendingPromise lock
      const isActivityLock =
        errMsg.includes('ActivityAlreadyStarted') ||
        errMsg.includes('already in progress') ||
        errMsg.includes('Another activity');

      if (isActivityLock) {
        console.log('[VLC] 🔄 Resolving activity lock via Direct Intent/Linking fallback...');
        try {
          const intentUri = `intent://${cleanUrl.replace(/^https?:\/\//, '')}#Intent;scheme=${cleanUrl.startsWith('https') ? 'https' : 'http'};package=org.videolan.vlc;type=video/*;i.position=${resumePositionMs};S.title=${encodeURIComponent(title)};end`;
          const canOpen = await Linking.canOpenURL(intentUri);
          if (canOpen) {
            await Linking.openURL(intentUri);
            return true;
          }
          await Linking.openURL(cleanUrl);
          return true;
        } catch (linkingErr: any) {
          console.warn('[VLC] ⚠️ Direct Intent Linking fallback failed:', linkingErr?.message);
        }
      }

      // If targeting VLC directly failed because package not found, prompt user with fallback dialog
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

      // Series Auto-Advance: If episode completed (≥90%), check if next episode exists before advancing
      if (isCompleted && options.season !== undefined && options.episode !== undefined) {
        console.log(
          `[VLC] 🏆 Episode completed (${finalPosition}s / ${duration}s) for S${options.season}:E${options.episode}. Marking watched.`
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

        // 2. Safely verify if a next episode actually exists in the catalog before advancing Continue Watching
        try {
          const releases = await aggregator.getAllReleases([
            { provider: options.provider, id: options.mediaId },
          ]);

          const nextEpNum = options.episode + 1;
          const hasNextEp = releases.some(
            (r) => r.episode === nextEpNum && (r.season === undefined || r.season === options.season)
          );

          if (hasNextEp) {
            console.log(
              `[VLC] 🎯 Verified next episode exists: S${options.season}:E${nextEpNum}. Queuing in Continue Watching.`
            );
            await useAppStore.getState().saveProgress({
              mediaId: options.mediaId,
              title: options.title,
              provider: options.provider,
              posterUrl: options.posterUrl,
              backdropUrl: options.backdropUrl,
              season: options.season,
              episode: nextEpNum,
              positionSeconds: 0,
              durationSeconds: duration,
            });
          } else {
            // Check if next season exists (e.g. S(season + 1):E1)
            const nextSeasonNum = options.season + 1;
            const hasNextSeason = releases.some(
              (r) => r.season === nextSeasonNum && (r.episode === 1 || r.episode === undefined)
            );

            if (hasNextSeason) {
              console.log(
                `[VLC] 🎯 Season finale completed! Verified next season exists: S${nextSeasonNum}:E1. Queuing in Continue Watching.`
              );
              await useAppStore.getState().saveProgress({
                mediaId: options.mediaId,
                title: options.title,
                provider: options.provider,
                posterUrl: options.posterUrl,
                backdropUrl: options.backdropUrl,
                season: nextSeasonNum,
                episode: 1,
                positionSeconds: 0,
                durationSeconds: duration,
              });
            } else {
              console.log(
                `[VLC] 🏁 Series/Season finale reached for S${options.season}:E${options.episode}. No next episode exists in catalog.`
              );
            }
          }
        } catch (catalogErr: any) {
          console.warn('[VLC] ⚠️ Could not verify next episode from catalog:', catalogErr?.message);
        }
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
