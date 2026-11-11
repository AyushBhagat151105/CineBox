import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { updaterService, UpdateInfo } from '@/services/updater';

const { width } = Dimensions.get('window');

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  visible: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateInfo,
  visible,
  onClose,
}) => {
  const [status, setStatus] = useState<'idle' | 'downloading' | 'ready'>('idle');
  const [progress, setProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [focusedBtn, setFocusedBtn] = useState<string | null>(null);

  useEffect(() => {
    if (!updateInfo || !visible) return;

    let isMounted = true;
    updaterService
      .isApkAlreadyDownloaded(updateInfo.version, updateInfo.apkSizeBytes)
      .then((downloaded) => {
        if (isMounted) {
          if (downloaded) {
            setStatus('ready');
            setProgress(1);
          } else {
            setStatus('idle');
            setProgress(0);
          }
        }
      })
      .catch(() => {
        if (isMounted) setStatus('idle');
      });

    return () => {
      isMounted = false;
    };
  }, [updateInfo, visible]);

  if (!updateInfo || !visible) return null;

  const handleStartDownload = async () => {
    setStatus('downloading');
    setProgress(0);

    try {
      await updaterService.downloadApk(updateInfo, (p) => {
        setProgress(p);
      });

      // Download completed
      setStatus('ready');
      setProgress(1);

      // Automatically launch the installer
      try {
        await updaterService.launchInstaller(updateInfo.version);
      } catch (launchErr: any) {
        console.warn('[UpdateModal] Initial launch suppressed:', launchErr?.message);
      }
    } catch (err: any) {
      console.error('[UpdateModal] Download failed:', err);
      setStatus('idle');
      Alert.alert(
        'Download Failed',
        err?.message || 'Could not complete download. Check your internet connection.'
      );
    }
  };

  const handleLaunchInstaller = async () => {
    setIsLaunching(true);
    try {
      await updaterService.launchInstaller(updateInfo.version);
    } catch (err: any) {
      console.error('[UpdateModal] Manual launch error:', err);
      Alert.alert(
        'Installer Could Not Open',
        'Android blocked the installer or required explicit permission. Tap "Allow Unknown Apps" below to grant permission.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => updaterService.openInstallPermissionSettings(),
          },
        ]
      );
    } finally {
      setIsLaunching(false);
    }
  };

  const handleOpenSettings = async () => {
    await updaterService.openInstallPermissionSettings();
  };

  const progressPercent = Math.round(progress * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconCircle,
              status === 'ready' && styles.iconCircleSuccess,
            ]}>
            {status === 'ready' ? (
              <Ionicons name="checkmark-circle" size={32} color="#46d369" />
            ) : (
              <Ionicons name="arrow-down-circle" size={32} color="#e50914" />
            )}
          </View>

          {status !== 'downloading' && (
            <Pressable
              focusable={true}
              onFocus={() => setFocusedBtn('close')}
              onBlur={() => setFocusedBtn(null)}
              style={[styles.closeBtn, focusedBtn === 'close' && styles.closeBtnFocused]}
              onPress={onClose}>
              <Ionicons name="close" size={20} color={focusedBtn === 'close' ? '#ffffff' : '#8a8a9a'} />
            </Pressable>
          )}

          <Text style={styles.title}>
            {status === 'ready' ? 'Ready to Install' : 'Update Available'}
          </Text>

          <View style={styles.versionBadge}>
            <Ionicons name="sparkles" size={12} color="#f5c518" />
            <Text style={styles.versionText}>v{updateInfo.version}</Text>
            {updateInfo.apkSizeMb && (
              <Text style={styles.sizeText}>• {updateInfo.apkSizeMb} MB</Text>
            )}
          </View>

          {/* Release Notes */}
          <Text style={styles.changelogHeader}>WHAT'S NEW</Text>
          <ScrollView style={styles.changelogBox} showsVerticalScrollIndicator={false}>
            <Text style={styles.changelogText}>{updateInfo.releaseNotes}</Text>
          </ScrollView>

          {/* Dynamic Content based on State */}
          {status === 'downloading' ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Downloading update... {progressPercent}%
              </Text>
            </View>
          ) : status === 'ready' ? (
            <View style={styles.actionContainer}>
              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onFocus={() => setFocusedBtn('install')}
                onBlur={() => setFocusedBtn(null)}
                style={[styles.installBtn, focusedBtn === 'install' && styles.btnFocused]}
                onPress={handleLaunchInstaller}
                disabled={isLaunching}>
                {isLaunching ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                    <Text style={styles.updateBtnText}>Install Now</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                focusable={true}
                onFocus={() => setFocusedBtn('permission')}
                onBlur={() => setFocusedBtn(null)}
                style={[styles.permissionBtn, focusedBtn === 'permission' && styles.btnFocused]}
                onPress={handleOpenSettings}>
                <Ionicons name="settings-outline" size={14} color="#8a8a9a" />
                <Text style={styles.permissionBtnText}>Allow Unknown Apps (Settings)</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onFocus={() => setFocusedBtn('close_bottom')}
                onBlur={() => setFocusedBtn(null)}
                style={[styles.laterBtn, focusedBtn === 'close_bottom' && styles.laterBtnFocused]}
                onPress={onClose}>
                <Text style={[styles.laterBtnText, focusedBtn === 'close_bottom' && { color: '#ffffff' }]}>
                  Done / Close
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.actionContainer}>
              <Pressable
                focusable={true}
                hasTVPreferredFocus={true}
                onFocus={() => setFocusedBtn('update')}
                onBlur={() => setFocusedBtn(null)}
                style={[styles.updateBtn, focusedBtn === 'update' && styles.btnFocused]}
                onPress={handleStartDownload}>
                <Ionicons name="arrow-down-circle" size={18} color="#ffffff" />
                <Text style={styles.updateBtnText}>Update Now</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onFocus={() => setFocusedBtn('later')}
                onBlur={() => setFocusedBtn(null)}
                style={[styles.laterBtn, focusedBtn === 'later' && styles.laterBtnFocused]}
                onPress={onClose}>
                <Text style={[styles.laterBtnText, focusedBtn === 'later' && { color: '#ffffff' }]}>
                  Remind Me Later
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 8, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: Math.min(width - 40, 380),
    backgroundColor: '#121218',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222230',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  iconCircleSuccess: {
    backgroundColor: 'rgba(70, 211, 105, 0.12)',
    borderColor: 'rgba(70, 211, 105, 0.3)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  closeBtnFocused: {
    borderColor: '#ffffff',
    backgroundColor: '#e50914',
    transform: [{ scale: 1.15 }],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 197, 24, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f5c518',
  },
  sizeText: {
    fontSize: 12,
    color: '#a0a0b0',
  },
  changelogHeader: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  changelogBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  changelogText: {
    fontSize: 12,
    color: '#c0c0d0',
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#202028',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#a0a0b0',
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  updateBtn: {
    width: '100%',
    backgroundColor: '#e50914',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  installBtn: {
    width: '100%',
    backgroundColor: '#2e7d32', // Emerald / Green for install
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  updateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 6,
  },
  permissionBtnText: {
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '500',
  },
  laterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  laterBtnText: {
    color: '#707080',
    fontSize: 12,
    fontWeight: '500',
  },
  laterBtnFocused: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  btnFocused: {
    borderColor: '#ffffff',
    borderWidth: 2.5,
    transform: [{ scale: 1.04 }],
    shadowColor: '#ffffff',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
});
