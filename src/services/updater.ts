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
      };

      console.log(`[Updater] 🚀 New update found: v${updateInfo.version} (${updateInfo.apkSizeMb || '?'} MB)`);
      return updateInfo;
    } catch (err: any) {
      console.warn('[Updater] Check failed:', err?.message || err);
      return null;
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
      const destinationUri = `${FileSystem.cacheDirectory}CineBox-${updateInfo.version}.apk`;
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

      // Convert file URI to Android content URI
      const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
      console.log(`[Updater] 🚀 Launching Android Package Installer: ${contentUri}`);

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 0x10000001, // FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK
      });

      return true;
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
