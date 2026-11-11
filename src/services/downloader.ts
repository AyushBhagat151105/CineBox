import { Platform, Alert, PermissionsAndroid, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '@/store';
import { vlcService } from './vlc';
import { DownloadItem, DownloadStatus, ProviderId, Release } from '@/types';
import { cleanDisplayTitle } from '@/utils';
import { aggregator } from '@/providers/aggregator';

const { NativePlayerLauncher } = NativeModules;

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const sdkVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (sdkVersion >= 33) {
      const permissions: any[] = [
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      ];
      if ((PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS) {
        permissions.push((PermissionsAndroid.PERMISSIONS as any).POST_NOTIFICATIONS);
      }
      const result = await PermissionsAndroid.requestMultiple(permissions);
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
  downloadUrl?: string;
  posterUrl?: string;
  headers?: Record<string, string>;
  sizeBytes?: number;
  quality?: string;
  season?: number;
  episode?: number;
}

export interface EnqueueSeasonEpisode {
  episodeNumber: number;
  title?: string;
  release: Release;
}

export interface EnqueueSeasonParams {
  mediaId: string;
  title: string;
  provider: ProviderId;
  seasonNumber: number;
  episodes: EnqueueSeasonEpisode[];
  posterUrl?: string;
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
  private progressThrottles: Map<string, { lastTime: number; lastBytes: number; lastNotifTime?: number }> = new Map();
  private maxConcurrent: number = 1;
  private isProcessingQueue: boolean = false;
  private baseDir: string = Platform.OS === 'android'
    ? ANDROID_PUBLIC_DOWNLOADS_DIR
    : `${FileSystem.documentDirectory}downloads/`;
  private postersDir: string = `${FileSystem.documentDirectory}downloads/posters/`;

  constructor() {
    this.ensureDirectories().then(() => {
      this.migrateLegacyDownloads().catch(() => {});
      this.recoverPendingDownloads().catch(() => {});
    });
  }

  /**
   * Ensure directory structure exists
   */
  async ensureDirectories() {
    try {
      if (Platform.OS === 'android' && NativePlayerLauncher?.ensureDirectory) {
        await NativePlayerLauncher.ensureDirectory(this.baseDir);
      } else {
        const baseInfo = await FileSystem.getInfoAsync(this.baseDir);
        if (!baseInfo.exists) {
          await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
        }
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
   * Recover any interrupted downloads on startup into queued state and process queue
   */
  async recoverPendingDownloads() {
    try {
      const downloads = useAppStore.getState().downloads;
      let hasChanges = false;
      for (const item of downloads) {
        if (item.status === 'downloading') {
          useAppStore.getState().updateDownload(item.id, {
            status: 'queued',
            downloadSpeed: undefined,
            estimatedTimeLeft: undefined,
          });
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await useAppStore.getState().persistDownloads();
      }
      this.processQueue();
    } catch (e) {
      console.warn('[Downloader] recoverPendingDownloads error:', e);
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
   * Initiate background download (immediately if queue empty, or queued sequentially)
   */
  async startDownload(params: StartDownloadParams): Promise<DownloadItem> {
    await requestStoragePermission();
    await this.ensureDirectories();

    const {
      mediaId,
      title,
      provider,
      release,
      downloadUrl = '',
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

    const localPoster = await this.cachePosterLocally(mediaId, posterUrl);

    const shouldQueue = this.activeDownloads.size >= this.maxConcurrent;

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
      status: shouldQueue ? 'queued' : 'downloading',
      bytesWritten: 0,
      totalBytes: sizeBytes,
      progressPercent: 0,
      downloadUrl,
      headers,
      createdAt: Date.now(),
      release,
    };

    await useAppStore.getState().addDownload(initialItem);

    if (shouldQueue) {
      console.log(`[Downloader] ⏳ Queued download "${filename}" (waiting in line)`);
    } else {
      this.executeDownload(id);
    }

    return initialItem;
  }

  /**
   * Bulk queue all episodes of a TV Series season step-by-step
   */
  async enqueueSeason(params: EnqueueSeasonParams): Promise<number> {
    await requestStoragePermission();
    await this.ensureDirectories();

    const {
      mediaId,
      title,
      provider,
      seasonNumber,
      episodes,
      posterUrl,
    } = params;

    if (!episodes || episodes.length === 0) return 0;

    console.log(`[Downloader] 📦 Enqueuing Season ${seasonNumber} for "${title}" (${episodes.length} episodes)`);

    const localPoster = await this.cachePosterLocally(mediaId, posterUrl);
    const cleanName = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const existingDownloads = useAppStore.getState().downloads;

    let queuedCount = 0;
    const baseTimestamp = Date.now();

    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];

      // Skip already completed episodes
      const alreadyDone = existingDownloads.some(
        (d) =>
          d.mediaId === mediaId &&
          d.season === seasonNumber &&
          d.episode === ep.episodeNumber &&
          d.status === 'completed'
      );
      if (alreadyDone) {
        console.log(`[Downloader] ⏭️ Skipping S${seasonNumber}E${ep.episodeNumber} - already downloaded`);
        continue;
      }

      // Skip already queued or active episodes
      const alreadyPending = existingDownloads.some(
        (d) =>
          d.mediaId === mediaId &&
          d.season === seasonNumber &&
          d.episode === ep.episodeNumber &&
          (d.status === 'queued' || d.status === 'downloading')
      );
      if (alreadyPending) {
        console.log(`[Downloader] ⏭️ Skipping S${seasonNumber}E${ep.episodeNumber} - already queued`);
        continue;
      }

      const quality = ep.release.quality || '1080p';
      const id = `${provider}_${mediaId}_${seasonNumber}_${ep.episodeNumber}_${baseTimestamp + i}`;
      const epSuffix = `_S${seasonNumber}E${ep.episodeNumber}`;
      const filename = `${cleanName}${epSuffix}_${quality}_${baseTimestamp + i}.mp4`;
      const destinationUri = `${this.baseDir}${filename}`;
      const sizeBytes = ep.release.sizeBytes || 0;

      const item: DownloadItem = {
        id,
        mediaId,
        provider,
        title,
        releaseName: ep.release.releaseName || ep.release.filename,
        quality,
        sizeFormatted: ep.release.size || (sizeBytes > 0 ? formatBytes(sizeBytes) : undefined),
        season: seasonNumber,
        episode: ep.episodeNumber,
        fileUri: destinationUri,
        localPosterUri: localPoster,
        posterUrl,
        status: 'queued',
        bytesWritten: 0,
        totalBytes: sizeBytes,
        progressPercent: 0,
        downloadUrl: '',
        headers: {},
        createdAt: baseTimestamp + i,
        release: ep.release,
      };

      await useAppStore.getState().addDownload(item);
      queuedCount++;
    }

    console.log(`[Downloader] 📋 Successfully queued ${queuedCount} episodes for Season ${seasonNumber}. Starting step-by-step queue...`);
    this.processQueue();
    return queuedCount;
  }

  /**
   * Sequential Queue Processor: downloads items one-by-one step-by-step
   */
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      if (this.activeDownloads.size >= this.maxConcurrent) {
        return;
      }

      const downloads = useAppStore.getState().downloads;
      const queuedItems = downloads
        .filter((d) => d.status === 'queued')
        .sort((a, b) => a.createdAt - b.createdAt);

      if (queuedItems.length === 0) {
        // Queue is empty and nothing is downloading -> release CPU wake lock
        if (this.activeDownloads.size === 0) {
          NativePlayerLauncher?.releaseWakeLock?.();
          NativePlayerLauncher?.cancelNotification?.(1001);
        }
        return;
      }

      const nextItem = queuedItems[0];
      await this.executeDownload(nextItem.id);
    } catch (e: any) {
      console.warn('[Downloader] ⚠️ processQueue error:', e?.message);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute single download with JIT stream resolution, live notification, and background wakelock
   */
  private async executeDownload(id: string) {
    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;

    await requestStoragePermission();
    await this.ensureDirectories();

    // Acquire CPU WakeLock so Android does not sleep the download in background
    NativePlayerLauncher?.acquireWakeLock?.();

    let downloadUrl = item.downloadUrl;
    let headers = item.headers || {};

    // Just-In-Time Link Resolution right when transitioning to downloading
    if (!downloadUrl && item.release) {
      try {
        console.log(`[Downloader] 🔍 JIT resolving stream link for "${item.title}" S${item.season}E${item.episode}`);
        useAppStore.getState().updateDownload(id, {
          status: 'downloading',
          error: undefined,
        });

        // Show live preparation notification
        const epLabel = item.season !== undefined && item.episode !== undefined
          ? ` S${item.season < 10 ? '0' : ''}${item.season}E${item.episode < 10 ? '0' : ''}${item.episode}`
          : '';
        NativePlayerLauncher?.updateDownloadNotification?.(
          1001,
          `Preparing ${cleanDisplayTitle(item.title)}${epLabel}`,
          'Resolving mirror...',
          0,
          100,
          true
        );

        const source = await aggregator.resolveWithFallback([item.release]);
        downloadUrl = source.url;
        headers = source.headers || {};

        useAppStore.getState().updateDownload(id, {
          downloadUrl,
          headers,
        });
      } catch (err: any) {
        console.error(`[Downloader] ❌ Failed resolving mirror for queued item:`, err?.message);
        useAppStore.getState().updateDownload(id, {
          status: 'failed',
          error: err?.message || 'Failed resolving mirror',
        });
        await useAppStore.getState().persistDownloads();
        // Continue to next queued item so one dead link does not block the entire season
        this.processQueue();
        return;
      }
    }

    if (!downloadUrl) {
      useAppStore.getState().updateDownload(id, {
        status: 'failed',
        error: 'No download URL available',
      });
      await useAppStore.getState().persistDownloads();
      this.processQueue();
      return;
    }

    useAppStore.getState().updateDownload(id, {
      status: 'downloading',
      error: undefined,
    });

    console.log(`[Downloader] 🚀 Active download starting for: "${item.title}" -> ${downloadUrl.slice(0, 80)}...`);

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      item.fileUri,
      { headers },
      (progressData) => {
        this.handleProgress(id, progressData.totalBytesWritten, progressData.totalBytesExpectedToWrite);
      },
      item.resumeData
    );

    this.activeDownloads.set(id, downloadResumable);
    this.progressThrottles.set(id, { lastTime: Date.now(), lastBytes: item.bytesWritten || 0, lastNotifTime: 0 });

    downloadResumable
      .downloadAsync()
      .then(async (result) => {
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);

        if (result && result.uri) {
          console.log(`[Downloader] ✅ Download completed successfully: ${result.uri}`);

          // Register completed media file with Android MediaStore and File Manager
          if (NativePlayerLauncher?.scanMediaFile) {
            NativePlayerLauncher.scanMediaFile(result.uri, 'video/mp4').catch(() => {});
          }

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
            resumeData: undefined,
          });
          await useAppStore.getState().persistDownloads();

          // Live Notification: Show completed notification
          NativePlayerLauncher?.cancelNotification?.(1001);
          const epLabel = item.season !== undefined && item.episode !== undefined
            ? ` S${item.season < 10 ? '0' : ''}${item.season}E${item.episode < 10 ? '0' : ''}${item.episode}`
            : '';
          const notifTitle = 'Download Complete';
          const notifContent = `${cleanDisplayTitle(item.title)}${epLabel} is ready offline.`;
          // Deterministic notification ID based on item ID hash to prevent episode notification collisions
          let idHash = 0;
          for (let i = 0; i < id.length; i++) {
            idHash = ((idHash << 5) - idHash + id.charCodeAt(i)) | 0;
          }
          const completeNotifId = 2000 + (Math.abs(idHash) % 10000);
          NativePlayerLauncher?.showDownloadCompleteNotification?.(completeNotifId, notifTitle, notifContent);
        } else {
          console.warn(`[Downloader] ⚠️ Download finished with empty result`);
          useAppStore.getState().updateDownload(id, {
            status: 'failed',
            error: 'Empty download result',
          });
          await useAppStore.getState().persistDownloads();
        }

        // Advance to next queued item!
        this.processQueue();
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

        // Continue to next queued item
        this.processQueue();
      });
  }

  /**
   * Throttled progress handler: updates UI store every 400ms and system notification every 1000ms
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

    const lastNotif = stats?.lastNotifTime || 0;
    this.progressThrottles.set(id, { lastTime: now, lastBytes: bytesWritten, lastNotifTime: lastNotif });

    useAppStore.getState().updateDownload(id, {
      bytesWritten,
      totalBytes: totalExpected > 0 ? totalExpected : bytesWritten,
      progressPercent: percent,
      downloadSpeed: speedStr,
      estimatedTimeLeft: timeLeftStr,
      status: 'downloading',
    });

    // Update Live System Notification every ~1000ms
    if (now - lastNotif >= 1000 || percent === 100) {
      this.progressThrottles.set(id, { lastTime: now, lastBytes: bytesWritten, lastNotifTime: now });
      const item = useAppStore.getState().downloads.find((d) => d.id === id);
      if (item) {
        const epLabel = item.season !== undefined && item.episode !== undefined
          ? ` S${item.season < 10 ? '0' : ''}${item.season}E${item.episode < 10 ? '0' : ''}${item.episode}`
          : '';
        const notifTitle = `Downloading ${cleanDisplayTitle(item.title)}${epLabel}`;
        const queueCount = useAppStore.getState().downloads.filter((d) => d.status === 'queued').length;
        const queueSuffix = queueCount > 0 ? ` (+${queueCount} queued)` : '';
        const notifContent = `${percent}% • ${speedStr || 'Downloading'} • ${timeLeftStr || 'calculating'}${queueSuffix}`;

        NativePlayerLauncher?.updateDownloadNotification?.(1001, notifTitle, notifContent, percent, 100, false);
      }
    }
  }

  /**
   * Pause an active download
   */
  async pauseDownload(id: string) {
    const resumable = this.activeDownloads.get(id);
    let capturedResumeData: string | undefined;
    if (resumable) {
      try {
        const pauseState = await resumable.pauseAsync();
        if (pauseState && pauseState.resumeData) {
          capturedResumeData = pauseState.resumeData;
        }
        this.activeDownloads.delete(id);
        this.progressThrottles.delete(id);
      } catch (err: any) {
        console.warn(`[Downloader] ⚠️ Pause error:`, err?.message);
      }
    }
    NativePlayerLauncher?.cancelNotification?.(1001);
    const prevItem = useAppStore.getState().downloads.find((d) => d.id === id);
    useAppStore.getState().updateDownload(id, {
      status: 'paused',
      resumeData: capturedResumeData || prevItem?.resumeData,
      downloadSpeed: undefined,
      estimatedTimeLeft: undefined,
    });
    await useAppStore.getState().persistDownloads();

    // Trigger next item in queue
    this.processQueue();
  }

  /**
   * Resume a paused or failed download
   */
  async resumeDownload(id: string) {
    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;

    console.log(`[Downloader] 🔄 Resuming download for "${item.title}"`);

    // If slots are full, place back into queue
    if (this.activeDownloads.size >= this.maxConcurrent) {
      useAppStore.getState().updateDownload(id, {
        status: 'queued',
        error: undefined,
      });
      await useAppStore.getState().persistDownloads();
      return;
    }

    await this.executeDownload(id);
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
    NativePlayerLauncher?.cancelNotification?.(1001);

    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (item?.fileUri) {
      if (NativePlayerLauncher?.deleteFilePermanently) {
        NativePlayerLauncher.deleteFilePermanently(item.fileUri).catch(() => {});
      } else {
        FileSystem.deleteAsync(item.fileUri, { idempotent: true }).catch(() => {});
      }
    }

    if (item?.localPosterUri) {
      FileSystem.deleteAsync(item.localPosterUri, { idempotent: true }).catch(() => {});
    }

    await useAppStore.getState().removeDownload(id);

    // Trigger next item in queue
    this.processQueue();
  }

  /**
   * Delete completed downloaded file from storage permanently,
   * removing from disk and clearing the Android MediaStore database
   */
  async deleteDownloadedFile(id: string) {
    const item = useAppStore.getState().downloads.find((d) => d.id === id);
    if (!item) return;

    try {
      if (item.fileUri) {
        if (NativePlayerLauncher?.deleteFilePermanently) {
          const deleted = await NativePlayerLauncher.deleteFilePermanently(item.fileUri);
          console.log(`[Downloader] 🗑️ Native permanent delete result: ${deleted} (${item.fileUri})`);
        } else {
          await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
        }
      }
    } catch (err: any) {
      console.warn(`[Downloader] ⚠️ File deletion error:`, err?.message);
      try {
        await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
      } catch {}
    }

    if (item.localPosterUri) {
      FileSystem.deleteAsync(item.localPosterUri, { idempotent: true }).catch(() => {});
    }

    await useAppStore.getState().removeDownload(id);

    // Trigger next item in queue if any pending
    this.processQueue();
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
        headers: item.headers,
        forceChooser: preferredPlayer === 'chooser',
      });
    } catch (err: any) {
      console.error(`[Downloader] ❌ Failed to play offline file:`, err?.message);
      Alert.alert('Playback Error', err?.message || 'Could not launch offline video player');
      return false;
    }
  }
}

export const downloaderService = new DownloaderService();
