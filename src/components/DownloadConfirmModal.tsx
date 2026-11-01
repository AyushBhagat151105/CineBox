import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatBytes } from '@/services/downloader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DownloadConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  releaseName: string;
  quality?: string;
  sizeFormatted?: string;
  sizeBytes?: number;
  season?: number;
  episode?: number;
  posterUrl?: string;
  freeSpaceBytes?: number;
  isStarting?: boolean;
}

export const DownloadConfirmModal: React.FC<DownloadConfirmModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  releaseName,
  quality = '1080p',
  sizeFormatted,
  sizeBytes = 0,
  season,
  episode,
  posterUrl,
  freeSpaceBytes = 10 * 1024 * 1024 * 1024,
  isStarting = false,
}) => {
  const [focusedBtn, setFocusedBtn] = useState<'confirm' | 'cancel' | null>(null);

  if (!visible) return null;

  const hasEnoughSpace = sizeBytes > 0 ? freeSpaceBytes > sizeBytes : true;
  const freeSpaceText = formatBytes(freeSpaceBytes);
  const displaySize = sizeFormatted || (sizeBytes > 0 ? formatBytes(sizeBytes) : 'Dynamic size');

  const spaceRemainingAfter =
    sizeBytes > 0 && freeSpaceBytes > sizeBytes
      ? formatBytes(freeSpaceBytes - sizeBytes)
      : freeSpaceText;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="download" size={20} color="#e50914" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Download Confirmation</Text>
                <Text style={styles.headerSubtitle}>Offline Video Storage</Text>
              </View>
            </View>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              disabled={isStarting}
              style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8a8a9e" />
            </Pressable>
          </View>

          {/* Media Info Section */}
          <View style={styles.mediaRow}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.poster} />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Ionicons name="film-outline" size={24} color="#555566" />
              </View>
            )}
            <View style={styles.mediaDetails}>
              <Text numberOfLines={2} style={styles.mediaTitle}>
                {title}
              </Text>
              <View style={styles.tagsRow}>
                {season !== undefined && episode !== undefined ? (
                  <View style={styles.tagBadge}>
                    <Text style={styles.tagBadgeText}>
                      S{season} E{episode}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.qualityBadge}>
                  <Text style={styles.qualityBadgeText}>{quality.toUpperCase()}</Text>
                </View>
                <View style={styles.sizeBadge}>
                  <Ionicons name="hardware-chip-outline" size={12} color="#10b981" />
                  <Text style={styles.sizeBadgeText}>{displaySize}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.filenameText}>
                {releaseName}
              </Text>
            </View>
          </View>

          {/* Storage Information & Permission Advisory */}
          <View style={styles.storageBox}>
            <View style={styles.storageHeaderRow}>
              <View style={styles.storageLabelRow}>
                <Ionicons name="server-outline" size={15} color="#94a3b8" />
                <Text style={styles.storageLabel}>Device Storage</Text>
              </View>
              <Text style={styles.storageValue}>
                {freeSpaceText} <Text style={styles.storageSubValue}>free</Text>
              </Text>
            </View>

            {/* Storage Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: sizeBytes > 0 && freeSpaceBytes > 0
                      ? `${Math.min(100, Math.max(8, (sizeBytes / freeSpaceBytes) * 100))}%`
                      : '15%',
                  },
                ]}
              />
            </View>

            <View style={styles.storageFooterRow}>
              <Text style={styles.storageFooterText}>
                Estimated space after download: <Text style={styles.storageHighlight}>{spaceRemainingAfter}</Text>
              </Text>
            </View>

            {!hasEnoughSpace && (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={15} color="#ef4444" />
                <Text style={styles.warningText}>
                  Insufficient device storage space to complete this download.
                </Text>
              </View>
            )}
          </View>

          {/* Permission Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#3b82f6" />
            <Text style={styles.noticeText}>
              CineBox will save this media to your device storage for offline playback in VLC without an internet connection.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              focusable={true}
              onFocus={() => setFocusedBtn('cancel')}
              onBlur={() => setFocusedBtn((prev) => (prev === 'cancel' ? null : prev))}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
                focusedBtn === 'cancel' && styles.buttonFocused,
              ]}
              disabled={isStarting}
              onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>

            <Pressable
              focusable={true}
              hasTVPreferredFocus={true}
              onFocus={() => setFocusedBtn('confirm')}
              onBlur={() => setFocusedBtn((prev) => (prev === 'confirm' ? null : prev))}
              style={({ pressed }) => [
                styles.confirmButton,
                !hasEnoughSpace && styles.buttonDisabled,
                pressed && styles.confirmButtonPressed,
                focusedBtn === 'confirm' && styles.buttonFocused,
              ]}
              disabled={!hasEnoughSpace || isStarting}
              onPress={onConfirm}>
              {isStarting ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.confirmButtonText}>Preparing...</Text>
                </View>
              ) : (
                <View style={styles.btnLoadingRow}>
                  <Ionicons name="download-outline" size={16} color="#ffffff" />
                  <Text style={styles.confirmButtonText}>Allow & Download</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 36, 440),
    backgroundColor: '#12121c',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222234',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#8a8a9e',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: '#181826',
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#181826',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#242438',
    marginBottom: 16,
  },
  poster: {
    width: 54,
    height: 76,
    borderRadius: 8,
    backgroundColor: '#202030',
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaDetails: {
    flex: 1,
    gap: 4,
  },
  mediaTitle: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  tagBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e50914',
  },
  tagBadgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  qualityBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  qualityBadgeText: {
    color: '#93c5fd',
    fontSize: 10.5,
    fontWeight: '800',
  },
  sizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  sizeBadgeText: {
    color: '#10b981',
    fontSize: 10.5,
    fontWeight: '700',
  },
  filenameText: {
    color: '#717182',
    fontSize: 11,
  },
  storageBox: {
    backgroundColor: '#161622',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222232',
    marginBottom: 12,
    gap: 8,
  },
  storageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storageLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  storageValue: {
    color: '#f8fafc',
    fontSize: 12.5,
    fontWeight: '700',
  },
  storageSubValue: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '400',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#242436',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  storageFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  storageFooterText: {
    color: '#8a8a9e',
    fontSize: 11,
  },
  storageHighlight: {
    color: '#10b981',
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  warningText: {
    color: '#fca5a5',
    fontSize: 11.5,
    flex: 1,
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  noticeText: {
    color: '#8a8a9e',
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1a1a28',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: '#252538',
  },
  cancelButtonText: {
    color: '#cbd5e1',
    fontSize: 13.5,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonPressed: {
    backgroundColor: '#b80710',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
    backgroundColor: '#3f3f50',
  },
  buttonFocused: {
    borderColor: '#ffffff',
    borderWidth: 2,
    transform: [{ scale: 1.04 }],
    elevation: 8,
  },
});
