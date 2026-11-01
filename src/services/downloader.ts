import { Platform, Alert, PermissionsAndroid } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '@/store';
import { vlcService } from './vlc';
import { DownloadItem, DownloadStatus, ProviderId, Release } from '@/types';
import { cleanDisplayTitle } from '@/utils';

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (sdkVersion >= 33) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      ]);
      return result[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
      return (
        result[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED ||
        result[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
  } catch (err: any) {
    console.warn('[Downloader] ⚠️ Permission request error:', err?.message);
    return true;
  }
}

export interface StartDownloadParams {
  mediaId: string;
  title: string;
  provider: ProviderId;
  release: Release;
  downloadUrl: string;
  posterUrl?: string;
  headers?: Record<string, string>;
  sizeBytes?: number;
  quality?: string;
  season?: number;
  episode?: number;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

export function formatTimeLeft(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s left`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m left`;
}

export const ANDROID_PUBLIC_DOWNLOADS_DIR = 'file:///storage/emulated/0/Download/CineBox/';

class DownloaderService {
  private activeDownloads: Map<string, FileSystem.DownloadResumable> = new Map();
  private progressThrottles: Map<string, { lastTime: number; lastBytes: number }> = new Map();
  private baseDir: string = Platform.OS === 'android'
    ? ANDROID_PUBLIC_DOWNLOADS_DIR
    : `${FileSystem.documentDirectory}downloads/`;
  private postersDir: string = `${FileSystem.documentDirectory}downloads/posters/`;

  constructor() {
    this.ensureDirectories().then(() => {
      this.migrateLegacyDownloads().catch(() => {});
    });
  }

  /**
   * Ensure directory structure exists
   */
  async ensureDirectories() {
    try {
      const baseInfo = await FileSystem.getInfoAsync(this.baseDir);
      if (!baseInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
      }
      const postersInfo = await FileSystem.getInfoAsync(this.postersDir);
      if (!postersInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.postersDir, { intermediates: true });
      }
    } catch (err: any) {
      console.warn('[Downloader] ⚠️ Failed ensuring download dirs:', err?.message);
    }
  }

  /**
   * Automatically migrate any legacy downloads from internal app sandbox to public Download/CineBox folder
   */
  async migrateLegacyDownloads() {
    if (Platform.OS !== 'android') return;
    try {
      await this.ensureDirectories();
      const downloads = useAppStore.getState().downloads;
      let hasUpdates = false;

      for (const item of downloads) {
        if (!item.fileUri) continue;
        const isInternal = item.fileUri.includes('/data/user/0/') || item.fileUri.includes('/files/downloads/');
        if (isInternal) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(item.fileUri);
            if (!fileInfo.exists) continue;

            const fileName = item.fileUri.split('/').pop() || 'video.mp4';
            const publicPath = `${ANDROID_PUBLIC_DOWNLOADS_DIR}${decodeURIComponent(fileName)}`;

            console.log(`[Downloader] 🚚 Silently migrating legacy file "${item.title}" to public storage: ${publicPath}`);
            const publicCheck = await FileSystem.getInfoAsync(publicPath);
            if (!publicCheck.exists) {
              await FileSystem.copyAsync({ from: item.fileUri, to: publicPath });
            }
            // Delete old internal copy to free up storage space
            await FileSystem.deleteAsync(item.fileUri, { idempotent: true });

            useAppStore.getState().updateDownload(item.id, { fileUri: publicPath });
            hasUpdates = true;
          } catch (itemErr: any) {
            console.warn(`[Downloader] ⚠️ Failed migrating item ${item.id}:`, itemErr?.message);
          }
        }
      }

      if (hasUpdates) {
        await useAppStore.getState().persistDownloads();
        console.log('[Downloader] ✅ Legacy downloads successfully migrated to public Download folder');
      }
    } catch (err: any) {
      console.warn('[Downloader] ⚠️ Migration routine error:', err?.message);
    }
  }

  /**
   * Get available free disk space on device in bytes
   */
  async getFreeDiskSpace(): Promise<number> {
    try {
      return await FileSystem.getFreeDiskStorageAsync();
    } catch (err: any) {
      console.warn('[Downloader] Failed checking free space:', err?.message);
      return 10 * 1024 * 1024 * 1024; // Fallback 10GB assumed
    }
  }

  /**
   * Cache poster thumbnail locally for offline viewing
   */
  async cachePosterLocally(mediaId: string, remotePosterUrl?: string): Promise<string | undefined> {
    if (!remotePosterUrl) return undefined;
    try {
      await this.ensureDirectories();
      const safeId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const localPosterUri = `${this.postersDir}${safeId}.jpg`;

      const info = await FileSystem.getInfoAsync(localPosterUri);
      if (info.exists && (info.size ?? 0) > 1000) {
        return localPosterUri;
      }

      const result = await FileSystem.downloadAsync(remotePosterUrl, localPosterUri);
      return result.uri;
    } catch (err: any) {
      console.warn('[Downloader] ⚠️ Failed caching poster locally:', err?.message);
      return remotePosterUrl;
    }
  }

  /**
   * Initiate background resumable download
   */
  async startDownload(params: StartDownloadParams): Promise<DownloadItem> {
    await requestStoragePermission();
    await this.ensureDirectories();

    const {
      mediaId,
      title,
      provider,
      release,
      downloadUrl,
      posterUrl,
      headers = {},
      sizeBytes = release.sizeBytes || 0,
      quality = release.quality || '1080p',
      season = release.season,
      episode = release.episode,
    } = params;

    const id = `${provider}_${mediaId}_${season ?? 0}_${episode ?? 0}_${Date.now()}`;
    const cleanName = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const epSuffix = season !== undefined && episode !== undefined ? `_S${season}E${episode}` : '';
    const filename = `${cleanName}${epSuffix}_${quality}_${Date.now()}.mp4`;
    const destinationUri = `${this.baseDir}${filename}`;

    console.log(`[Downloader] 🚀 Starting download "${filename}" from URL: ${downloadUrl.slice(0, 80)}...`);

    // Cache poster locally in parallel
    const localPoster = await this.cachePosterLocally(mediaId, posterUrl);

    const initialItem: DownloadItem = {
      id,
      mediaId,
      provider,
      title,
      releaseName: release.releaseName || release.filename,
      quality,
      sizeFormatted: release.size || (sizeBytes > 0 ? formatBytes(sizeBytes) : undefined),
      season,
      episode,
      fileUri: destinationUri,
      localPosterUri: localPoster,
      posterUrl,
      status: 'downloading',
      bytesWritten: 0,
      totalBytes: sizeBytes,
      progressPercent: 0,
      downloadUrl,
      headers,
      createdAt: Date.now(),
    };

    await useAppStore.getState().addDownload(initialItem);

    // Create resumable download instance
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destinationUri,
      { headers },
      (progressData) => {
        this.handleProgress(id, progressData.totalBytesWritten, progressData.totalBytesExpectedToWrite);
      }
    );

    this.activeDownloads.set(id, downloadResumable);
    this.progressThrottles.set(id, { lastTime: Date.now(), lastBytes: 0 });

    // Execute download asynchronously
    downloadResumable
      .downloadAsync()
      .then(async (result) => {
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);

        if (result && result.uri) {
          console.log(`[Downloader] ✅ Download completed successfully: ${result.uri}`);
          const fileInfo = await FileSystem.getInfoAsync(result.uri);
          const finalSize = fileInfo.exists ? fileInfo.size : 0;

          useAppStore.getState().updateDownload(id, {
            status: 'completed',
            progressPercent: 100,
            bytesWritten: finalSize,
            totalBytes: finalSize,
            downloadSpeed: undefined,
            estimatedTimeLeft: undefined,
            completedAt: Date.now(),
          });
          await useAppStore.getState().persistDownloads();
        } else {
          console.warn(`[Downloader] ⚠️ Download finished with empty result`);
          useAppStore.getState().updateDownload(id, {
            status: 'failed',
            error: 'Empty download result',
          });
          await useAppStore.getState().persistDownloads();
        }
      })
      .catch(async (err: any) => {
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);
        const errMsg = err?.message || 'Download interrupted';
        console.error(`[Downloader] ❌ Download failed:`, errMsg);

        useAppStore.getState().updateDownload(id, {
          status: 'failed',
          error: errMsg,
          downloadSpeed: undefined,
          estimatedTimeLeft: undefined,
        });
        await useAppStore.getState().persistDownloads();
      });

    return initialItem;
  }

  /**
   * Throttled progress handler to prevent UI lag while maintaining accurate speed and ETA
   */
  private handleProgress(id: string, bytesWritten: number, totalExpected: number) {
    const now = Date.now();
    const stats = this.progressThrottles.get(id);

    // Throttle UI store updates to once every 400ms
    if (stats && now - stats.lastTime < 400 && bytesWritten < totalExpected) {
      return;
    }

    const timeDiffSec = stats ? (now - stats.lastTime) / 1000 : 1;
    const bytesDiff = stats ? bytesWritten - stats.lastBytes : 0;
    const speedBytesPerSec = timeDiffSec > 0 ? Math.max(0, bytesDiff / timeDiffSec) : 0;
    const speedStr = speedBytesPerSec > 0 ? `${formatBytes(speedBytesPerSec)}/s` : '';

    const remainingBytes = totalExpected > bytesWritten ? totalExpected - bytesWritten : 0;
    const estSec = speedBytesPerSec > 0 ? remainingBytes / speedBytesPerSec : 0;
    const timeLeftStr = formatTimeLeft(estSec);

    const percent = totalExpected > 0 ? Math.min(100, Math.floor((bytesWritten / totalExpected) * 100)) : 0;

    this.progressThrottles.set(id, { lastTime: now, lastBytes: bytesWritten });

    useAppStore.getState().updateDownload(id, {
      bytesWritten,
      totalBytes: totalExpected > 0 ? totalExpected : bytesWritten,
      progressPercent: percent,
      downloadSpeed: speedStr,
      estimatedTimeLeft: timeLeftStr,
      status: 'downloading',
    });
  }

  /**
   * Pause an active download
   */
  async pauseDownload(id: string) {
    const resumable = this.activeDownloads.get(id);
    if (resumable) {
      try {
        await resumable.pauseAsync();
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);
      } catch (err: any) {
        console.warn(`[Downloader] ⚠️ Pause error:`, err?.message);
      }
    }
    useAppStore.getState().updateDownload(id, {
      status: 'paused',
      downloadSpeed: undefined,
      estimatedTimeLeft: undefined,
    });
    await useAppStore.getState().persistDownloads();
  }

  /**
   * Resume a paused or failed download
   */
  async resumeDownload(id: string) {
    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;

    console.log(`[Downloader] 🔄 Resuming download for "${item.title}"`);
    useAppStore.getState().updateDownload(id, {
      status: 'downloading',
      error: undefined,
    });

    const resumable = FileSystem.createDownloadResumable(
      item.downloadUrl,
      item.fileUri,
      { headers: item.headers },
      (progressData) => {
        this.handleProgress(id, progressData.totalBytesWritten, progressData.totalBytesExpectedToWrite);
      }
    );

    this.activeDownloads.set(id, resumable);
    this.progressThrottles.set(id, { lastTime: Date.now(), lastBytes: item.bytesWritten || 0 });

    resumable
      .downloadAsync()
      .then(async (result) => {
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);

        if (result && result.uri) {
          const fileInfo = await FileSystem.getInfoAsync(result.uri);
          const finalSize = fileInfo.exists ? fileInfo.size : 0;
          useAppStore.getState().updateDownload(id, {
            status: 'completed',
            progressPercent: 100,
            bytesWritten: finalSize,
            totalBytes: finalSize,
            downloadSpeed: undefined,
            estimatedTimeLeft: undefined,
            completedAt: Date.now(),
          });
          await useAppStore.getState().persistDownloads();
        }
      })
      .catch(async (err: any) => {
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);
        useAppStore.getState().updateDownload(id, {
          status: 'failed',
          error: err?.message || 'Download interrupted',
          downloadSpeed: undefined,
          estimatedTimeLeft: undefined,
        });
        await useAppStore.getState().persistDownloads();
      });
  }

  /**
   * Cancel and discard a download
   */
  async cancelDownload(id: string) {
    const resumable = this.activeDownloads.get(id);
    if (resumable) {
      try {
        await resumable.cancelAsync();
      } catch {}
      this.activeDownloads.delete(id);
      this.progressThrottles.delete(id);
    }

    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (item?.fileUri) {
      FileSystem.deleteAsync(item.fileUri, { idempotent: true }).catch(() => {});
    }

    await useAppStore.getState().removeDownload(id);
  }

  /**
   * Delete completed downloaded file from storage
   */
  async deleteDownloadedFile(id: string) {
    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;

    try {
      if (item.fileUri) {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
        console.log(`[Downloader] 🗑️ Deleted file from disk: ${item.fileUri}`);
      }
    } catch (err: any) {
      console.warn(`[Downloader] ⚠️ File deletion error:`, err?.message);
    }

    await useAppStore.getState().removeDownload(id);
  }

  /**
   * Launch offline media playback via native VLC
   */
  async playOffline(item: DownloadItem, resumeSeconds?: number): Promise<boolean> {
    try {
      let playableUri = item.fileUri;

      // Verify file exists on disk
      const fileInfo = await FileSystem.getInfoAsync(playableUri);
      if (!fileInfo.exists) {
        Alert.alert(
          'File Not Found',
          'The downloaded video file is no longer on disk. It may have been moved or cleared.'
        );
        useAppStore.getState().updateDownload(item.id, { status: 'failed', error: 'File deleted on disk' });
        await useAppStore.getState().persistDownloads();
        return false;
      }

      // On Android, convert to content:// URI via FileProvider so Android never throws FileUriExposedException
      if (Platform.OS === 'android') {
        try {
          const contentUri = await FileSystem.getContentUriAsync(playableUri);
          if (contentUri) {
            playableUri = contentUri;
            console.log(`[Downloader] 📂 Resolved Android Content URI: ${playableUri}`);
          }
        } catch (contentErr: any) {
          console.warn('[Downloader] ⚠️ Could not get Content URI, proceeding with URI:', contentErr?.message);
        }
      }

      const savedProgress = useAppStore.getState().getProgress(item.mediaId, item.season, item.episode);
      const startPosition = resumeSeconds !== undefined ? resumeSeconds : (savedProgress?.positionSeconds || 0);

      console.log(`[Downloader] 🎬 Launching Offline Playback for "${item.title}": ${playableUri} (resume: ${startPosition}s)`);
      const preferredPlayer = useAppStore.getState().preferredPlayer;

      return await vlcService.launch({
        streamUrl: playableUri,
        title: cleanDisplayTitle(item.title),
        mediaId: item.mediaId,
        provider: item.provider,
        posterUrl: item.localPosterUri || item.posterUrl || '',
        releaseName: item.releaseName,
        season: item.season,
        episode: item.episode,
        resumeSeconds: startPosition,
        forceChooser: preferredPlayer === 'chooser',
      });
    } catch (err: any) {
      console.error(`[Downloader] ❌ Offline playback launch failed:`, err?.message);
      Alert.alert('Playback Failed', err?.message || 'Could not launch media player');
      return false;
    }
  }
}

export const downloaderService = new DownloaderService();
