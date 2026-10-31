import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import YoutubePlayer, {
  PLAYER_STATES,
  YoutubeIframeRef,
} from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { trailerService } from '@/services';

export interface TrailerPlayerRef {
  openFullscreen: () => void;
  toggleSound: () => void;
  hasTrailer: boolean;
}

export interface TrailerPlayerProps {
  title: string;
  year?: string;
  posterUrl?: string;
  backdropUrl?: string;
  height?: number;
  width?: number;
  borderRadius?: number;
  isActive?: boolean;
  autoPlayDelay?: number;
  showSoundToggle?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTVDevice = Platform.isTV || SCREEN_WIDTH > 800;

export const TrailerPlayer = forwardRef<TrailerPlayerRef, TrailerPlayerProps>(
  (
    {
      title,
      year,
      posterUrl,
      backdropUrl,
      height = 240,
      width = SCREEN_WIDTH,
      borderRadius = 0,
      isActive = true,
      autoPlayDelay = 800,
      showSoundToggle = true,
      style,
      children,
    },
    ref
  ) => {
    const [videoId, setVideoId] = useState<string | null>(null);
    const [isTrailerReady, setIsTrailerReady] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [showFullModal, setShowFullModal] = useState(false);
    const [hasError, setHasError] = useState(false);

    const playerRef = useRef<YoutubeIframeRef | null>(null);
    const timerRef = useRef<any>(null);
    const imageSource = backdropUrl || posterUrl;

    // 1. Resolve trailer video ID (bypassed on TV to guarantee 60fps performance on FireStick)
    useEffect(() => {
      if (isTVDevice) return;
      let isCancelled = false;
      setVideoId(null);
      setIsTrailerReady(false);
      setIsPlaying(false);
      setHasError(false);

      trailerService.getTrailerVideoId(title, year).then((id) => {
        if (!isCancelled && id) {
          setVideoId(id);
        }
      });

      return () => {
        isCancelled = true;
      };
    }, [title, year]);

    // 2. Delayed Autoplay trigger
    useEffect(() => {
      if (timerRef.current) clearTimeout(timerRef.current);

      if (isActive && videoId && !hasError) {
        timerRef.current = setTimeout(() => {
          setIsPlaying(true);
        }, autoPlayDelay);
      } else {
        setIsPlaying(false);
      }

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [isActive, videoId, hasError, autoPlayDelay]);

    // 3. YouTube State Changes & Ready handler
    const handleReady = useCallback(() => {
      if (isActive && !hasError) {
        setIsPlaying(true);
      }
    }, [isActive, hasError]);

    const handleStateChange = useCallback((state: PLAYER_STATES) => {
      if (state === PLAYER_STATES.PLAYING) {
        setIsTrailerReady(true);
        setIsPlaying(true);
      } else if (state === PLAYER_STATES.ENDED) {
        // Loop back to start
        playerRef.current?.seekTo(0, true);
        setIsPlaying(true);
      }
    }, []);

    const handleError = useCallback(() => {
      setHasError(true);
      setIsPlaying(false);
      setIsTrailerReady(false);
    }, []);

    const toggleSound = useCallback((e?: any) => {
      e?.stopPropagation?.();
      setIsMuted((prev) => !prev);
    }, []);

    const openFullscreen = useCallback((e?: any) => {
      e?.stopPropagation?.();
      setShowFullModal(true);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        openFullscreen,
        toggleSound,
        hasTrailer: Boolean(videoId && !hasError),
      }),
      [openFullscreen, toggleSound, videoId, hasError]
    );

    return (
      <View style={[styles.container, { width, height, borderRadius }, style]}>
        {/* Background Poster Image (shown before trailer starts or on error) */}
        {imageSource && (
          <Image
            source={{ uri: imageSource }}
            style={[
              styles.backdropImage,
              isTrailerReady && isPlaying ? styles.hiddenImage : styles.visibleImage,
            ]}
            resizeMode="cover"
          />
        )}

        {/* Embedded YouTube Player (Only active on mobile devices, skipped on TV to prevent 1GB RAM starvation) */}
        {!isTVDevice && videoId && !hasError && (
          <View
            style={[
              styles.videoContainer,
              isTrailerReady && isPlaying ? styles.showVideo : styles.hideVideo,
            ]}>
            <YoutubePlayer
              ref={playerRef}
              height={height}
              width={width}
              play={isActive && isPlaying}
              videoId={videoId}
              mute={isMuted}
              forceAndroidAutoplay={true}
              onReady={handleReady}
              onChangeState={handleStateChange}
              onError={handleError}
              initialPlayerParams={{
                controls: false,
                rel: false,
                loop: true,
                preventFullScreen: true,
              }}
              webViewProps={{
                androidLayerType: 'hardware',
                mediaPlaybackRequiresUserAction: false,
                allowsInlineMediaPlayback: true,
                scrollEnabled: false,
              }}
            />
          </View>
        )}

        {/* Children Content Overlay (e.g. Hero title or screen content) */}
        {children}

        {/* Bottom HUD Controls (Netflix/Apple TV+ style: clean bottom-aligned, no top status bar collision) */}
        {!isTVDevice && videoId && !hasError && showSoundToggle && (
          <View style={styles.bottomControls} pointerEvents="box-none">
            {/* Trailer Playing Indicator Pill (Bottom Left) */}
            {isTrailerReady && isPlaying ? (
              <View style={styles.trailerIndicator}>
                <View style={styles.livePulseDot} />
                <Text style={styles.trailerIndicatorText}>OFFICIAL TRAILER</Text>
              </View>
            ) : (
              <View />
            )}

            {/* Audio Toggle & Fullscreen Expand Buttons (Bottom Right) */}
            <View style={styles.actionsRight} pointerEvents="box-none">
              {/* Fullscreen Expand Button */}
              <TouchableOpacity
                style={styles.controlCircle}
                onPress={openFullscreen}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="expand" size={14} color="#ffffff" />
              </TouchableOpacity>

              {/* Mute / Unmute Toggle Button */}
              <TouchableOpacity
                style={[styles.controlCircle, !isMuted && styles.controlCircleActive]}
                onPress={toggleSound}
                activeOpacity={0.75}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-high'}
                  size={16}
                  color={isMuted ? '#ffffff' : '#10b981'}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Fullscreen Cinematic Trailer Modal */}
        <Modal
          visible={showFullModal}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowFullModal(false)}>
          <View style={styles.fullscreenModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="film" size={20} color="#e50914" />
                <Text numberOfLines={1} style={styles.modalTitle}>
                  {title} — Official Trailer
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowFullModal(false)}
                activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalPlayerContainer}>
              {videoId ? (
                <YoutubePlayer
                  height={Dimensions.get('window').width * 0.5625}
                  width={Dimensions.get('window').width}
                  play={showFullModal}
                  videoId={videoId}
                  mute={false}
                  initialPlayerParams={{
                    controls: true,
                    rel: false,
                  }}
                />
              ) : (
                <ActivityIndicator size="large" color="#e50914" />
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a0a12',
  },
  backdropImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  visibleImage: {
    opacity: 1,
  },
  hiddenImage: {
    opacity: 0,
  },
  videoContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 1.18 }],
  },
  showVideo: {
    opacity: 1,
  },
  hideVideo: {
    opacity: 0,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  trailerIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e50914',
  },
  trailerIndicatorText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleActive: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  modalHeader: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPlayerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
