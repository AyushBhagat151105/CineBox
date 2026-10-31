import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import axios from 'axios';

export const GITHUB_REPO = 'AyushBhagat151105/CineBox';

export interface UpdateInfo {
  version: string;
  tagName: string;
  releaseNotes: string;
  downloadUrl: string;
  apkSizeMb?: number;
  apkSizeBytes?: number;
}

export type UpdateProgressListener = (progress: number) => void;

class UpdaterService {
  private currentVersion: string = Constants.expoConfig?.version || '1.0.0';

  /**
   * Compares two semantic version strings (e.g. "1.0.1" > "1.0.0")
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const cleanLatest = latest.replace(/^v/, '').trim();
    const cleanCurrent = current.replace(/^v/, '').trim();

    const [lMajor = 0, lMinor = 0, lPatch = 0] = cleanLatest.split('.').map(Number);
    const [cMajor = 0, cMinor = 0, cPatch = 0] = cleanCurrent.split('.').map(Number);

    if (lMajor > cMajor) return true;
    if (lMajor < cMajor) return false;
    if (lMinor > cMinor) return true;
    if (lMinor < cMinor) return false;
    return lPatch > cPatch;
  }

  /**
   * Queries GitHub Releases for the latest version
   */
  async checkForUpdates(): Promise<UpdateInfo | null> {
    if (Platform.OS !== 'android') return null;

    try {
      console.log(`[Updater] 🔍 Checking GitHub for updates (current: v${this.currentVersion})...`);
      const res = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        timeout: 6000,
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'CineBox-App',
        },
      });

      const release = res.data;
      const tagName = release.tag_name || '';
      const isNewer = this.isNewerVersion(tagName, this.currentVersion);

      if (!isNewer) {
        console.log(`[Updater] ✅ Already running latest version (v${this.currentVersion})`);
        return null;
      }

      // Find APK asset
      const apkAsset = release.assets?.find(
        (a: any) => a.name?.endsWith('.apk') && !a.name?.toLowerCase().includes('debug')
      );

      if (!apkAsset) {
        console.warn(`[Updater] ⚠️ Release ${tagName} found but no APK asset attached`);
        return null;
      }

      const updateInfo: UpdateInfo = {
        version: tagName.replace(/^v/, ''),
        tagName,
        releaseNotes: release.body || 'Performance improvements and bug fixes.',
        downloadUrl: apkAsset.browser_download_url,
        apkSizeMb: apkAsset.size ? Math.round((apkAsset.size / (1024 * 1024)) * 10) / 10 : undefined,
        apkSizeBytes: apkAsset.size,
      };

      console.log(`[Updater] 🚀 New update found: v${updateInfo.version} (${updateInfo.apkSizeMb || '?'} MB)`);
      return updateInfo;
    } catch (err: any) {
      console.warn('[Updater] Check failed:', err?.message || err);
      return null;
    }
  }

  /**
   * Local file path for downloaded APK
   */
  getApkPath(version: string): string {
    return `${FileSystem.cacheDirectory}CineBox-${version}.apk`;
  }

  /**
   * Checks if an APK for the specified version has already been fully downloaded
   */
  async isApkAlreadyDownloaded(version: string, expectedSizeBytes?: number): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const destinationUri = this.getApkPath(version);
      const info = await FileSystem.getInfoAsync(destinationUri);
      if (!info.exists || info.isDirectory) return false;

      if (expectedSizeBytes && expectedSizeBytes > 0) {
        return info.size === expectedSizeBytes || Math.abs(info.size - expectedSizeBytes) < 2048;
      }
      return (info.size ?? 0) > 10 * 1024 * 1024; // > 10MB sanity check
    } catch {
      return false;
    }
  }

  /**
   * Downloads APK with progress reporting (skips if already downloaded)
   */
  async downloadApk(
    updateInfo: UpdateInfo,
    onProgress?: UpdateProgressListener
  ): Promise<string> {
    const destinationUri = this.getApkPath(updateInfo.version);

    const alreadyDownloaded = await this.isApkAlreadyDownloaded(
      updateInfo.version,
      updateInfo.apkSizeBytes
    );
    if (alreadyDownloaded) {
      console.log(`[Updater] ⚡ Cached APK found at ${destinationUri}, skipping re-download!`);
      onProgress?.(1);
      return destinationUri;
    }

    console.log(`[Updater] 📥 Downloading APK from: ${updateInfo.downloadUrl}`);
    const downloadResumable = FileSystem.createDownloadResumable(
      updateInfo.downloadUrl,
      destinationUri,
      {},
      (downloadProgress) => {
        const total = downloadProgress.totalBytesExpectedToWrite;
        const written = downloadProgress.totalBytesWritten;
        if (total > 0 && onProgress) {
          onProgress(Math.min(1, written / total));
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    if (!downloadResult || !downloadResult.uri) {
      throw new Error('APK download incomplete');
    }

    console.log(`[Updater] 📦 Downloaded APK to: ${downloadResult.uri}`);
    return downloadResult.uri;
  }

  /**
   * Dispatches Intent to open the Android Package Installer for the specified version
   */
  async launchInstaller(version: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const fileUri = this.getApkPath(version);
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) {
      throw new Error('APK file not found on device');
    }

    // Convert file URI to Android content URI using FileProvider
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    console.log(`[Updater] 🚀 Launching Android Package Installer for: ${contentUri}`);

    // FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456)
    const flags = 0x10000001;

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags,
      });
      return true;
    } catch (viewErr: any) {
      console.warn('[Updater] VIEW intent failed, trying INSTALL_PACKAGE fallback:', viewErr?.message);
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
          data: contentUri,
          flags,
        });
        return true;
      } catch (fallbackErr: any) {
        console.error('[Updater] Failed to launch installer:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  /**
   * Opens Android Settings page for "Install unknown apps"
   */
  async openInstallPermissionSettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
        { data: 'package:com.ayushbhagat.cinebox' }
      );
    } catch (e) {
      console.warn('[Updater] Could not open unknown sources settings:', e);
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.APPLICATION_DETAILS_SETTINGS',
          { data: 'package:com.ayushbhagat.cinebox' }
        );
      } catch (err) {
        console.error('[Updater] Could not open application details:', err);
      }
    }
  }

  /**
   * Downloads and launches Android Package Installer
   */
  async downloadAndInstall(
    updateInfo: UpdateInfo,
    onProgress?: UpdateProgressListener
  ): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      await this.downloadApk(updateInfo, onProgress);
      return await this.launchInstaller(updateInfo.version);
    } catch (err: any) {
      console.error('[Updater] Download & install error:', err);
      Alert.alert(
        'Update Failed',
        `Unable to install update: ${err?.message || 'Unknown error'}. You can download the APK directly from GitHub.`
      );
      return false;
    }
  }
}

export const updaterService = new UpdaterService();
