import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { ArrowDownCircle, Sparkles, X, CheckCircle, RefreshCw } from 'lucide-react-native';
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
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!updateInfo || !visible) return null;

  const handleUpdate = async () => {
    setDownloading(true);
    setProgress(0);

    const success = await updaterService.downloadAndInstall(updateInfo, (p) => {
      setProgress(p);
    });

    if (success) {
      onClose();
    }
    setDownloading(false);
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
          <View style={styles.iconCircle}>
            <ArrowDownCircle size={32} color="#e50914" />
          </View>

          {!downloading && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#8a8a9a" />
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Update Available</Text>
          <View style={styles.versionBadge}>
            <Sparkles size={12} color="#f5c518" />
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

          {/* Progress or Actions */}
          {downloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Downloading update... {progressPercent}%
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate}>
                <ArrowDownCircle size={18} color="#ffffff" />
                <Text style={styles.updateBtnText}>Update Now</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.laterBtn} onPress={onClose}>
                <Text style={styles.laterBtnText}>Remind Me Later</Text>
              </TouchableOpacity>
            </>
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
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
  updateBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  laterBtn: {
    paddingVertical: 8,
  },
  laterBtnText: {
    color: '#707080',
    fontSize: 12,
    fontWeight: '500',
  },
});
