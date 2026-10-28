import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/useAppStore';
import { usePlayerStore } from '../src/store/usePlayerStore';
import { ProviderId, Release } from '../src/types/models';
import { QualityBadge } from '../src/components/QualityBadge';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    title: string;
    streamUrl: string;
    mediaId: string;
    provider: ProviderId;
    posterUrl?: string;
    resumeSeconds?: string;
  }>();

  const { saveProgress } = useAppStore();
  const { availableReleases } = usePlayerStore();

  const [currentUrl, setCurrentUrl] = useState(params.streamUrl);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);

  const controlsTimeout = useRef<any>(null);
  const initialSeekDone = useRef(false);

  // Initialize expo-video player
  const player = useVideoPlayer(currentUrl, (p) => {
    p.loop = false;
    p.play();
  });

  // Handle play/pause, time updates, and audio tracks
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      try {
        setIsPlaying(player.playing);
        const cur = player.currentTime || 0;
        const dur = player.duration || 0;
        setCurrentTime(cur);
        setDuration(dur);

        // Resume position on initial load
        if (!initialSeekDone.current && dur > 0) {
          const resumeSec = params.resumeSeconds ? parseInt(params.resumeSeconds, 10) : 0;
          if (resumeSec > 0 && resumeSec < dur - 10) {
            player.currentTime = resumeSec;
          }
          initialSeekDone.current = true;
        }

        // Save progress to AppStore
        if (params.mediaId && cur > 5 && dur > 0) {
          saveProgress({
            mediaId: params.mediaId,
            provider: params.provider || 'moviebox',
            title: params.title || 'Unknown Title',
            posterUrl: params.posterUrl,
            positionSeconds: Math.floor(cur),
            durationSeconds: Math.floor(dur),
          });
        }

        // Fetch container audio tracks
        if (player.availableAudioTracks && player.availableAudioTracks.length > 0) {
          setAvailableAudioTracks(player.availableAudioTracks);
        }
      } catch (err) {
        // Ignored
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player, params]);

  const resetControlsTimeout = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setControlsVisible(true);
    controlsTimeout.current = setTimeout(() => {
      setControlsVisible(false);
    }, 4000);
  };

  const toggleControls = () => {
    if (controlsVisible) {
      setControlsVisible(false);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      resetControlsTimeout();
    }
  };

  const handlePlayPause = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
    resetControlsTimeout();
  };

  const seekRelative = (seconds: number) => {
    if (!player) return;
    player.seekBy(seconds);
    resetControlsTimeout();
  };

  const handleSelectAudioTrack = (track: any) => {
    try {
      if (player && player.audioTrack !== undefined) {
        player.audioTrack = track;
      }
      setSelectedAudioTrackId(track.id || track.language || track.label);
    } catch (err) {
      console.warn('Failed selecting audio track:', err);
    }
    setAudioModalVisible(false);
  };

  const handleSwitchRelease = (rel: Release) => {
    const mirror = rel.mirrors[0];
    if (mirror && mirror.resolverUrl) {
      setCurrentUrl(mirror.resolverUrl);
      initialSeekDone.current = false;
      setAudioModalVisible(false);
    }
  };

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hrs > 0) {
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <TouchableOpacity
        activeOpacity={1}
        onPress={toggleControls}
        style={styles.videoTouchable}>
        <VideoView
          player={player}
          style={styles.videoView}
          nativeControls={false}
          contentFit="contain"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
          fullscreenOptions={{ enable: true }}
        />

        {/* Overlay Controls */}
        {controlsVisible && (
          <View style={styles.controlsOverlay}>
            {/* Top Bar */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.iconButton}>
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>

              <Text numberOfLines={1} style={styles.headerTitle}>
                {params.title}
              </Text>

              <View style={styles.topRightActions}>
                {/* Audio Tracks / Quality Switcher */}
                <TouchableOpacity
                  onPress={() => setAudioModalVisible(true)}
                  style={styles.iconButton}>
                  <Ionicons name="options-outline" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Controls (Skip -10s, Play/Pause, Skip +10s) */}
            <View style={styles.centerControls}>
              <TouchableOpacity
                onPress={() => seekRelative(-10)}
                style={styles.skipButton}>
                <Ionicons name="play-back" size={28} color="#ffffff" />
                <Text style={styles.skipText}>10s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlePlayPause}
                style={styles.playPauseButton}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color="#ffffff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekRelative(10)}
                style={styles.skipButton}>
                <Ionicons name="play-forward" size={28} color="#ffffff" />
                <Text style={styles.skipText}>10s</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Scrubber & Time Bar */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Audio Track & Quality Switcher Modal */}
      <Modal
        visible={audioModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAudioModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Audio Tracks & Streams</Text>
              <TouchableOpacity onPress={() => setAudioModalVisible(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Native Container Audio Tracks */}
              <Text style={styles.modalSectionTitle}>EMBEDDED AUDIO TRACKS</Text>
              {availableAudioTracks.length > 0 ? (
                availableAudioTracks.map((track, i) => {
                  const label = track.label || track.language || `Track ${i + 1}`;
                  const isSelected = selectedAudioTrackId === (track.id || track.language || label);

                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                      onPress={() => handleSelectAudioTrack(track)}>
                      <Ionicons
                        name="volume-high"
                        size={18}
                        color={isSelected ? '#e50914' : '#888899'}
                      />
                      <Text
                        style={[
                          styles.modalItemText,
                          isSelected && styles.modalItemTextSelected,
                        ]}>
                        {label}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#e50914" />
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>
                    Standard / Dual Audio (Auto-detected by player)
                  </Text>
                </View>
              )}

              {/* Alternative Quality Releases & Mirrors */}
              {availableReleases.length > 0 && (
                <>
                  <Text style={[styles.modalSectionTitle, { marginTop: 16 }]}>
                    SWITCH QUALITY / SOURCE
                  </Text>
                  {availableReleases.map((rel, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.modalItem}
                      onPress={() => handleSwitchRelease(rel)}>
                      <QualityBadge quality={rel.quality} />
                      <Text numberOfLines={1} style={styles.modalReleaseName}>
                        {rel.filename}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoTouchable: {
    flex: 1,
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  playPauseButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#dddddd',
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    width: '100%',
    height: 12,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: '#222232',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  modalScroll: {
    paddingBottom: 20,
  },
  modalSectionTitle: {
    color: '#777788',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#181824',
    marginBottom: 8,
    gap: 10,
  },
  modalItemSelected: {
    borderColor: '#e50914',
    borderWidth: 1,
  },
  modalItemText: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '600',
  },
  modalItemTextSelected: {
    color: '#e50914',
    fontWeight: '700',
  },
  modalReleaseName: {
    flex: 1,
    color: '#cccccc',
    fontSize: 12,
  },
  modalEmpty: {
    paddingVertical: 12,
  },
  modalEmptyText: {
    color: '#666677',
    fontSize: 12,
    fontStyle: 'italic',
  },
});
