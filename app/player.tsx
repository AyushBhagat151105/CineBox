import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/useAppStore';
import { usePlayerStore } from '../src/store/usePlayerStore';
import { aggregator } from '../src/providers/aggregator';
import { ProviderId, Release } from '../src/types/models';
import { QualityBadge } from '../src/components/QualityBadge';
import { cleanDisplayTitle } from '../src/utils/title';

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

  const saveProgress = useAppStore((s) => s.saveProgress);
  const availableReleases = usePlayerStore((s) => s.availableReleases);
  const activeSource = usePlayerStore((s) => s.activeSource);

  const [currentUrl, setCurrentUrl] = useState(params.streamUrl);
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'loading' | 'readyToPlay' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioModalVisible, setAudioModalVisible] = useState(false);
  const [isResolvingSwitch, setIsResolvingSwitch] = useState<string | null>(null);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  const videoViewRef = useRef<any>(null);
  const initialSeekDone = useRef(false);

  // Initialize expo-video player with native ExoPlayer backend
  const player = useVideoPlayer(
    {
      uri: currentUrl,
      headers: activeSource?.headers,
    },
    (p) => {
      p.loop = false;
      p.play();
    }
  );

  // Orientation tracking and reset on unmount
  useEffect(() => {
    let sub: ScreenOrientation.Subscription | null = null;

    async function checkInitialOrientation() {
      try {
        const o = await ScreenOrientation.getOrientationAsync();
        const land =
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        setIsLandscape(land);

        sub = ScreenOrientation.addOrientationChangeListener((evt) => {
          const cur = evt.orientationInfo.orientation;
          const isLand =
            cur === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
            cur === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
          setIsLandscape(isLand);
        });
      } catch {
        // Ignored
      }
    }

    checkInitialOrientation();

    return () => {
      // Revert orientation lock when leaving player
      ScreenOrientation.unlockAsync().catch(() => {});
      if (sub) {
        ScreenOrientation.removeOrientationChangeListener(sub);
      }
    };
  }, []);

  // Track player events
  useEffect(() => {
    if (!player) return;

    const statusSub = player.addListener('statusChange', (payload: any) => {
      const status = payload?.status || player.status;
      setPlayerStatus(status);
      if (status === 'error') {
        setErrorMessage(payload?.error?.message || 'Failed playing stream mirror');
      } else if (status === 'readyToPlay') {
        setErrorMessage(null);
      }
    });

    const audioSub = player.addListener('availableAudioTracksChange', (payload: any) => {
      const tracks = payload?.availableAudioTracks || player.availableAudioTracks || [];
      if (tracks.length > 0) {
        setAvailableAudioTracks(tracks);
      }
    });

    return () => {
      statusSub?.remove?.();
      audioSub?.remove?.();
    };
  }, [player]);

  // Periodic progress saving & audio tracks detection
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      try {
        const cur = player.currentTime || 0;
        const dur = player.duration || 0;

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

        if (player.availableAudioTracks && player.availableAudioTracks.length > 0) {
          setAvailableAudioTracks(player.availableAudioTracks);
        }
      } catch {
        // Ignored
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player, params, saveProgress]);

  // Manual rotation toggle: Vertical (Portrait) <-> Horizontal (Landscape)
  const toggleRotation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsLandscape(true);
      }
    } catch (err) {
      console.warn('Rotation toggle failed:', err);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (videoViewRef.current) {
        if (!isFullscreen) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          setIsLandscape(true);
          await videoViewRef.current.enterFullscreen();
          setIsFullscreen(true);
        } else {
          await videoViewRef.current.exitFullscreen();
          setIsFullscreen(false);
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          setIsLandscape(false);
        }
      }
    } catch (err) {
      console.warn('Toggle fullscreen failed:', err);
    }
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

  const handleSwitchRelease = async (rel: Release) => {
    setIsResolvingSwitch(rel.filename);
    try {
      const source = await aggregator.resolveWithFallback([rel]);
      if (player) {
        player.replace({
          uri: source.url,
          headers: source.headers,
        });
        player.play();
      }
      setCurrentUrl(source.url);
      initialSeekDone.current = false;
      setErrorMessage(null);
      setAudioModalVisible(false);
    } catch (err: any) {
      Alert.alert('Switch Failed', err.message || 'Could not resolve selected release mirror');
    } finally {
      setIsResolvingSwitch(null);
    }
  };

  const cleanedTitle = cleanDisplayTitle(params.title || 'Video Player');

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* 1. Native Video Player with ExoPlayer Controls Enabled */}
      <View style={StyleSheet.absoluteFillObject}>
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.videoView}
          nativeControls={true}
          contentFit="contain"
          surfaceType="textureView"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
          fullscreenOptions={{
            enable: true,
            orientation: 'landscape',
          }}
          onFullscreenEnter={async () => {
            setIsFullscreen(true);
            setIsLandscape(true);
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
          }}
          onFullscreenExit={async () => {
            setIsFullscreen(false);
            setIsLandscape(false);
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
          }}
        />
      </View>

      {/* 2. Floating Top Header Bar */}
      <View
        style={[
          styles.topBar,
          { paddingTop: Math.max(insets.top, 14), paddingBottom: 10 },
        ]}
        pointerEvents="box-none">
        <TouchableOpacity
          onPress={async () => {
            await ScreenOrientation.unlockAsync().catch(() => {});
            router.back();
          }}
          style={styles.iconButton}
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Text numberOfLines={1} style={styles.headerTitle}>
          {cleanedTitle}
        </Text>

        <View style={styles.topRightActions} pointerEvents="box-none">
          {/* Rotate Vertical / Horizontal Button */}
          <TouchableOpacity
            onPress={toggleRotation}
            style={styles.rotateButton}
            activeOpacity={0.75}>
            <Ionicons
              name={isLandscape ? 'phone-portrait-outline' : 'phone-landscape-outline'}
              size={16}
              color="#ffffff"
            />
            <Text style={styles.rotateText}>
              {isLandscape ? 'Vertical' : 'Horizontal'}
            </Text>
          </TouchableOpacity>

          {/* Fullscreen Button */}
          <TouchableOpacity
            onPress={handleToggleFullscreen}
            style={styles.iconButton}
            activeOpacity={0.7}>
            <Ionicons
              name={isFullscreen ? 'contract' : 'expand'}
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* Quality & Audio Switcher Modal */}
          <TouchableOpacity
            onPress={() => setAudioModalVisible(true)}
            style={styles.iconButton}
            activeOpacity={0.7}>
            <Ionicons name="options-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. Buffering Indicator */}
      {playerStatus === 'loading' && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loadingText}>Buffering stream...</Text>
        </View>
      )}

      {/* 4. Playback Error Overlay */}
      {playerStatus === 'error' && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={48} color="#e50914" />
          <Text style={styles.errorTitle}>Stream Playback Error</Text>
          <Text style={styles.errorSubtitle}>
            {errorMessage || 'Cannot play stream from current mirror.'}
          </Text>
          <TouchableOpacity
            style={styles.switchStreamBtn}
            onPress={() => setAudioModalVisible(true)}>
            <Ionicons name="options-outline" size={18} color="#ffffff" />
            <Text style={styles.switchStreamText}>Switch Source / Quality</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 5. Audio Track & Quality Switcher Modal */}
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
                  const label = track.label || track.language || `Audio Track ${i + 1}`;
                  const isSelected = selectedAudioTrackId === (track.id || track.language || label);

                  return (
                    <TouchableOpacity
                      key={track.id || i}
                      style={[
                        styles.modalItem,
                        isSelected && styles.modalItemSelected,
                      ]}
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
                    SWITCH QUALITY / MIRROR
                  </Text>
                  {availableReleases.map((rel, i) => {
                    const isResolving = isResolvingSwitch === rel.filename;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.modalItem}
                        disabled={isResolvingSwitch !== null}
                        onPress={() => handleSwitchRelease(rel)}>
                        <QualityBadge quality={rel.quality} />
                        <Text numberOfLines={1} style={styles.modalReleaseName}>
                          {rel.filename}
                        </Text>
                        {isResolving && (
                          <ActivityIndicator size="small" color="#e50914" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
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
  videoView: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  rotateText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
    zIndex: 20,
    elevation: 20,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  errorSubtitle: {
    color: '#8e8e9e',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  switchStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  switchStreamText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#161622',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#242436',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalScroll: {
    padding: 16,
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
    backgroundColor: '#1f1f2e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  modalItemSelected: {
    borderColor: '#e50914',
    borderWidth: 1,
  },
  modalItemText: {
    flex: 1,
    color: '#d1d1db',
    fontSize: 13,
    fontWeight: '600',
  },
  modalItemTextSelected: {
    color: '#ffffff',
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
