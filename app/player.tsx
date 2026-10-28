import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { NavigationBar, setVisibilityAsync } from 'expo-navigation-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/useAppStore';
import { usePlayerStore } from '../src/store/usePlayerStore';
import { aggregator } from '../src/providers/aggregator';
import { ProviderId, Release } from '../src/types/models';
import { QualityBadge } from '../src/components/QualityBadge';
import { cleanDisplayTitle } from '../src/utils/title';

// Language code to human-friendly display label mapping
const LANGUAGE_MAP: Record<string, string> = {
  hin: 'Hindi',
  hi: 'Hindi',
  eng: 'English',
  en: 'English',
  tam: 'Tamil',
  ta: 'Tamil',
  tel: 'Telugu',
  te: 'Telugu',
  kan: 'Kannada',
  kn: 'Kannada',
  mal: 'Malayalam',
  ml: 'Malayalam',
  ben: 'Bengali',
  bn: 'Bengali',
  mar: 'Marathi',
  mr: 'Marathi',
  guj: 'Gujarati',
  gu: 'Gujarati',
  pan: 'Punjabi',
  pa: 'Punjabi',
  kor: 'Korean',
  ko: 'Korean',
  jpn: 'Japanese',
  ja: 'Japanese',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ger: 'German',
  deu: 'German',
  de: 'German',
  ita: 'Italian',
  it: 'Italian',
  rus: 'Russian',
  ru: 'Russian',
  chi: 'Chinese',
  zho: 'Chinese',
  zh: 'Chinese',
  und: 'Default / Multi-Audio',
};

function formatTrackMeta(track: any, index: number, type: 'audio' | 'subtitle') {
  const langKey = (track.language || '').toLowerCase().trim();
  const rawLabel = (track.label || track.name || '').trim();

  let friendly = LANGUAGE_MAP[langKey] || rawLabel;
  if (!friendly || friendly === 'und') {
    friendly = rawLabel || `${type === 'audio' ? 'Audio Track' : 'Subtitle'} ${index + 1}`;
  }

  const badges: string[] = [];
  if (track.isDefault) badges.push('DEFAULT');
  if (rawLabel.toLowerCase().includes('5.1')) badges.push('5.1 SURROUND');
  if (rawLabel.toLowerCase().includes('atmos')) badges.push('ATMOS');
  if (rawLabel.toLowerCase().includes('commentary')) badges.push('COMMENTARY');

  return {
    title: friendly,
    badge: badges.length > 0 ? badges.join(' • ') : undefined,
  };
}

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
  const skipSecondsSetting = useAppStore((s) => s.skipSeconds);
  const availableReleases = usePlayerStore((s) => s.availableReleases);
  const activeSource = usePlayerStore((s) => s.activeSource);

  const [currentUrl, setCurrentUrl] = useState(params.streamUrl);
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'loading' | 'readyToPlay' | 'error'>('loading');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio / Subtitle / Mirror Bottom Sheet
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeSheetTab, setActiveSheetTab] = useState<'audio' | 'subtitles' | 'mirrors'>('audio');
  const [isResolvingSwitch, setIsResolvingSwitch] = useState<string | null>(null);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
  const [availableSubtitles, setAvailableSubtitles] = useState<any[]>([]);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);

  // Scrubbing & Seeking State: decoupled for smooth 60fps interaction without snapping back to 0
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  // Gesture Controls: Brightness (0.1 - 1.0) and Volume (0.0 - 1.0)
  const [brightness, setBrightness] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [activeHud, setActiveHud] = useState<'brightness' | 'volume' | null>(null);
  const [hudValue, setHudValue] = useState(100);

  // Double-tap seek animations
  const [doubleTapSide, setDoubleTapSide] = useState<'left' | 'right' | null>(null);
  const doubleTapFade = useRef(new Animated.Value(0)).current;

  // Track tried URLs to avoid re-looping on broken mirrors
  const triedUrls = useRef<Set<string>>(new Set([params.streamUrl]));
  const failoverLock = useRef(false);

  const videoViewRef = useRef<any>(null);
  const initialSeekDone = useRef(false);
  const controlsTimeout = useRef<any>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const hudTimeout = useRef<any>(null);
  const singleTapTimer = useRef<any>(null);
  const scrubberTrackWidth = useRef<number>(0);
  const dragStartTime = useRef<number>(0);

  // Mutable refs to prevent stale closures inside PanResponders
  const skipSeconds = skipSecondsSetting || 10;
  const skipSecondsRef = useRef(skipSeconds);
  skipSecondsRef.current = skipSeconds;

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const isScrubbingRef = useRef(false);
  const scrubPositionRef = useRef(0);
  const seekLockoutUntil = useRef(0);
  const lastSaveTimeRef = useRef(0);

  const scrubberLayout = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 0 });

  // Initialize expo-video player with optimized buffering and fast seeking
  const player = useVideoPlayer(
    {
      uri: currentUrl,
      headers: activeSource?.headers,
    },
    (p) => {
      p.loop = false;
      p.timeUpdateEventInterval = 0.25;
      try {
        p.seekTolerance = { toleranceBefore: 1.0, toleranceAfter: 1.0 };
        p.bufferOptions = {
          preferredForwardBufferDuration: 30,
          minBufferForPlayback: 2,
        };
      } catch {}
      p.play();
    }
  );

  const playerRef = useRef(player);
  playerRef.current = player;

  // Android True Immersive Fullscreen Mode via expo-navigation-bar
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        setVisibilityAsync('hidden');
      } catch {}
    }
    return () => {
      if (Platform.OS === 'android') {
        try {
          setVisibilityAsync('visible');
        } catch {}
      }
    };
  }, []);

  // Auto-hide controls after 3.5 seconds
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
      // Re-hide Android navigation bar when controls fade
      if (Platform.OS === 'android') {
        try {
          setVisibilityAsync('hidden');
        } catch {}
      }
    }, 3500);
  }, []);

  const showHudIndicator = (type: 'brightness' | 'volume', val: number) => {
    setActiveHud(type);
    setHudValue(Math.round(val * 100));
    if (hudTimeout.current) clearTimeout(hudTimeout.current);
    hudTimeout.current = setTimeout(() => {
      setActiveHud(null);
    }, 1500);
  };

  // Orientation tracking
  useEffect(() => {
    let sub: ScreenOrientation.Subscription | null = null;
    async function initOrientation() {
      try {
        const o = await ScreenOrientation.getOrientationAsync();
        setIsLandscape(
          o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
            o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
        );
        sub = ScreenOrientation.addOrientationChangeListener((evt) => {
          const cur = evt.orientationInfo.orientation;
          setIsLandscape(
            cur === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
              cur === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
          );
        });
      } catch {}
    }
    initOrientation();
    resetControlsTimeout();

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      if (sub) ScreenOrientation.removeOrientationChangeListener(sub);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (hudTimeout.current) clearTimeout(hudTimeout.current);
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    };
  }, [resetControlsTimeout]);

  // Listen to player status, tracks, timeUpdate, and playing changes
  useEffect(() => {
    if (!player) return;

    const sourceSub = player.addListener('sourceLoad', (payload: any) => {
      const dur = payload?.duration || player.duration || 0;
      if (dur > 0) {
        setDuration(dur);
        durationRef.current = dur;
      }
    });

    const statusSub = player.addListener('statusChange', (payload: any) => {
      const status = payload?.status || player.status;
      setPlayerStatus(status);
      const dur = player.duration || 0;
      if (dur > 0 && durationRef.current !== dur) {
        setDuration(dur);
        durationRef.current = dur;
      }
      if (status === 'error') {
        triggerSilentFailover();
      } else if (status === 'readyToPlay') {
        setErrorMessage(null);
      }
    });

    const playingSub = player.addListener('playingChange', (payload: any) => {
      const playing = payload?.isPlaying ?? player.playing;
      setIsPlaying(playing);
    });

    const timeSub = player.addListener('timeUpdate', (evt: any) => {
      const now = Date.now();
      const dur = player.duration || 0;
      if (dur > 0 && durationRef.current !== dur) {
        setDuration(dur);
        durationRef.current = dur;
      }
      if (!isScrubbingRef.current && now > seekLockoutUntil.current) {
        if (typeof evt?.currentTime === 'number') {
          setCurrentTime(evt.currentTime);
        }
      }
    });

    const audioSub = player.addListener('availableAudioTracksChange', (payload: any) => {
      const tracks = payload?.availableAudioTracks || player.availableAudioTracks || [];
      if (tracks.length > 0) setAvailableAudioTracks(tracks);
    });

    const subtitleSub = player.addListener('availableSubtitleTracksChange', (payload: any) => {
      const subs = payload?.availableSubtitleTracks || player.availableSubtitleTracks || [];
      if (subs.length > 0) setAvailableSubtitles(subs);
    });

    return () => {
      sourceSub?.remove?.();
      statusSub?.remove?.();
      playingSub?.remove?.();
      timeSub?.remove?.();
      audioSub?.remove?.();
      subtitleSub?.remove?.();
    };
  }, [player]);

  // Periodic progress saving & initial resume
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      try {
        const now = Date.now();
        const dur = player.duration || 0;
        const cur = player.currentTime || 0;

        if (dur > 0 && durationRef.current !== dur) {
          setDuration(dur);
          durationRef.current = dur;
        }

        // Resume position on initial load
        if (!initialSeekDone.current && dur > 0) {
          const resumeSec = params.resumeSeconds ? parseInt(params.resumeSeconds, 10) : 0;
          if (resumeSec > 0 && resumeSec < dur - 10) {
            player.currentTime = resumeSec;
            setCurrentTime(resumeSec);
          }
          initialSeekDone.current = true;
        }

        // Throttled Save Progress: only save to AsyncStorage at most once every 8 seconds!
        if (params.mediaId && cur > 5 && dur > 0 && now - lastSaveTimeRef.current > 8000) {
          lastSaveTimeRef.current = now;
          saveProgress({
            mediaId: params.mediaId,
            provider: params.provider || 'moviebox',
            title: params.title || 'Unknown Title',
            posterUrl: params.posterUrl,
            positionSeconds: Math.floor(cur),
            durationSeconds: Math.floor(dur),
          });
        }
      } catch {}
    }, 500);

    return () => clearInterval(interval);
  }, [player, params, saveProgress]);

  // Silent Failover: Automatically switch to next available release mirror
  const triggerSilentFailover = async () => {
    if (failoverLock.current) return;
    failoverLock.current = true;

    try {
      const nextCandidates = availableReleases.filter(
        (r) => !triedUrls.current.has(r.filename)
      );

      if (nextCandidates.length > 0) {
        const candidate = nextCandidates[0];
        triedUrls.current.add(candidate.filename);

        const source = await aggregator.resolveWithFallback([candidate]);
        if (source && source.url && !triedUrls.current.has(source.url)) {
          triedUrls.current.add(source.url);
          if (player) {
            await player.replaceAsync({
              uri: source.url,
              headers: source.headers,
            });
            player.play();
          }
          setCurrentUrl(source.url);
          setErrorMessage(null);
          failoverLock.current = false;
          return;
        }
      }
    } catch {}

    failoverLock.current = false;
    setErrorMessage('All stream mirrors unreachable. Tap Quality to select another source.');
  };

  // Find Next Episode from available releases
  const nextEpisodeRelease = useMemo(() => {
    if (availableReleases.length === 0) return null;
    const curMatch = params.title?.match(/\b(?:E|EP|Episode)[\s.:_-]*(\d+)\b/i);
    const curEp = curMatch ? parseInt(curMatch[1], 10) : null;
    if (curEp === null) return null;

    return availableReleases.find(
      (r) => r.episode !== undefined && r.episode === curEp + 1
    );
  }, [availableReleases, params.title]);

  const handlePlayNextEpisode = async (rel: Release) => {
    setIsResolvingSwitch(rel.filename);
    try {
      const source = await aggregator.resolveWithFallback([rel]);
      if (player) {
        await player.replaceAsync({
          uri: source.url,
          headers: source.headers,
        });
        player.play();
      }
      setCurrentUrl(source.url);
      initialSeekDone.current = false;
      setErrorMessage(null);
    } catch (err: any) {
      Alert.alert('Next Episode Failed', err.message || 'Could not load next episode stream');
    } finally {
      setIsResolvingSwitch(null);
    }
  };

  // Double-tap seek trigger
  const triggerDoubleTapAnimation = (side: 'left' | 'right') => {
    setDoubleTapSide(side);
    doubleTapFade.setValue(1);
    Animated.timing(doubleTapFade, {
      toValue: 0,
      duration: 650,
      useNativeDriver: true,
    }).start(() => setDoubleTapSide(null));
  };

  // Native Skip helper using seekBy or currentTime fallback
  const performSkip = (direction: 'forward' | 'backward') => {
    const p = playerRef.current;
    if (!p) return;
    const dur = durationRef.current || p.duration || 0;
    const cur = p.currentTime || 0;
    const sec = skipSecondsRef.current || 10;
    const delta = direction === 'forward' ? sec : -sec;
    const target = Math.max(0, Math.min(dur > 0 ? dur : Infinity, cur + delta));

    seekLockoutUntil.current = Date.now() + 850;
    setCurrentTime(target);

    try {
      if (typeof (p as any).seekBy === 'function') {
        (p as any).seekBy(delta);
      } else {
        p.currentTime = target;
      }
    } catch {
      p.currentTime = target;
    }

    triggerDoubleTapAnimation(direction === 'forward' ? 'right' : 'left');
    resetControlsTimeout();
  };

  // Screen Gesture Responder (Brightness left, Volume right, Tap/Double-tap)
  const gestureResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12,
      onPanResponderGrant: (evt) => {
        const now = Date.now();
        const x = evt.nativeEvent.pageX;
        const windowWidth = Dimensions.get('window').width;

        // Double Tap check (within 320ms and within 120px)
        if (now - lastTapRef.current.time < 320 && Math.abs(x - lastTapRef.current.x) < 120) {
          if (singleTapTimer.current) {
            clearTimeout(singleTapTimer.current);
            singleTapTimer.current = null;
          }
          lastTapRef.current = { time: 0, x: 0 };

          if (x < windowWidth * 0.42) {
            performSkip('backward');
          } else if (x > windowWidth * 0.58) {
            performSkip('forward');
          } else {
            togglePlayPause();
          }
          return;
        }

        lastTapRef.current = { time: now, x };
      },
      onPanResponderMove: (_, g) => {
        const windowWidth = Dimensions.get('window').width;
        const startX = g.x0;
        const delta = -g.dy / 280;

        if (startX < windowWidth * 0.5) {
          // Left side: Brightness
          setBrightness((prev) => {
            const next = Math.max(0.12, Math.min(1.0, prev + delta * 0.04));
            showHudIndicator('brightness', next);
            return next;
          });
        } else {
          // Right side: Volume
          setVolume((prev) => {
            const next = Math.max(0.0, Math.min(1.0, prev + delta * 0.04));
            if (playerRef.current) playerRef.current.volume = next;
            showHudIndicator('volume', next);
            return next;
          });
        }
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8) {
          if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
          singleTapTimer.current = setTimeout(() => {
            setShowControls((prev) => {
              const next = !prev;
              if (next) resetControlsTimeout();
              return next;
            });
          }, 280);
        }
      },
    })
  ).current;

  // Toggle Play / Pause
  const togglePlayPause = () => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) {
      p.pause();
      setIsPlaying(false);
      setShowControls(true);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    } else {
      p.play();
      setIsPlaying(true);
      resetControlsTimeout();
    }
  };

  const toggleRotation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsLandscape(true);
      }
      resetControlsTimeout();
    } catch {}
  };

  // Dedicated Scrubber PanResponder: Smooth 60fps tracking using dx delta
  const scrubberResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const dur = durationRef.current;
        if (dur <= 0) return;
        isScrubbingRef.current = true;
        setIsScrubbing(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);

        const width = scrubberTrackWidth.current || Dimensions.get('window').width - 150;
        const touchX = Math.max(0, Math.min(width, evt.nativeEvent.locationX));
        const initialTime = (touchX / width) * dur;

        dragStartTime.current = initialTime;
        scrubPositionRef.current = initialTime;
        setScrubPosition(initialTime);
      },
      onPanResponderMove: (_, g) => {
        const dur = durationRef.current;
        if (dur <= 0) return;
        const width = scrubberTrackWidth.current || Dimensions.get('window').width - 150;
        const deltaSec = (g.dx / width) * dur;
        const target = Math.max(0, Math.min(dur, dragStartTime.current + deltaSec));

        scrubPositionRef.current = target;
        setScrubPosition(target);
      },
      onPanResponderRelease: () => {
        const dur = durationRef.current;
        const p = playerRef.current;
        const target = scrubPositionRef.current;

        if (dur > 0 && p && target >= 0) {
          seekLockoutUntil.current = Date.now() + 1000;
          try {
            p.currentTime = target;
          } catch {}
          setCurrentTime(target);
        }

        setTimeout(() => {
          isScrubbingRef.current = false;
          setIsScrubbing(false);
          resetControlsTimeout();
        }, 250);
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
        setIsScrubbing(false);
        resetControlsTimeout();
      },
    })
  ).current;

  const formatTime = (secs: number) => {
    const total = Math.floor(Math.max(0, secs));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectAudioTrack = (track: any) => {
    try {
      if (player && (player as any).audioTrack !== undefined) {
        (player as any).audioTrack = track;
      }
      setSelectedAudioTrackId(track.id || track.language || track.label);
    } catch {}
  };

  const handleSelectSubtitleTrack = (track: any | null) => {
    try {
      if (player && (player as any).subtitleTrack !== undefined) {
        (player as any).subtitleTrack = track;
      }
      setSelectedSubtitleId(track ? (track.id || track.language || track.label) : null);
    } catch {}
  };

  const handleSwitchRelease = async (rel: Release) => {
    setIsResolvingSwitch(rel.filename);
    try {
      const source = await aggregator.resolveWithFallback([rel]);
      const savePos = currentTime;
      if (player) {
        await player.replaceAsync({
          uri: source.url,
          headers: source.headers,
        });
        player.play();
        if (savePos > 0) {
          setTimeout(() => {
            if (player) player.currentTime = savePos;
          }, 350);
        }
      }
      setCurrentUrl(source.url);
      setErrorMessage(null);
      setSheetVisible(false);
    } catch (err: any) {
      Alert.alert('Switch Failed', err.message || 'Could not resolve selected mirror');
    } finally {
      setIsResolvingSwitch(null);
    }
  };

  const displayTime = isScrubbing ? scrubPosition : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <NavigationBar hidden />

      {/* 1. Video Player Surface */}
      <View style={StyleSheet.absoluteFill}>
        <VideoView
          ref={videoViewRef}
          player={player}
          style={styles.videoView}
          nativeControls={false}
          contentFit="contain"
          surfaceType="textureView"
          allowsPictureInPicture
          startsPictureInPictureAutomatically
        />
      </View>

      {/* 2. Brightness Dimmer Overlay */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#000000',
            opacity: (1 - brightness) * 0.85,
          },
        ]}
      />

      {/* 3. Screen Gesture Responder Layer */}
      <View style={StyleSheet.absoluteFill} {...gestureResponder.panHandlers}>
        {/* Double-tap Ripple HUD Left */}
        {doubleTapSide === 'left' && (
          <Animated.View style={[styles.doubleTapPill, styles.doubleTapLeft, { opacity: doubleTapFade }]}>
            <Ionicons name="play-back" size={24} color="#ffffff" />
            <Text style={styles.doubleTapText}>-{skipSeconds}s</Text>
          </Animated.View>
        )}

        {/* Double-tap Ripple HUD Right */}
        {doubleTapSide === 'right' && (
          <Animated.View style={[styles.doubleTapPill, styles.doubleTapRight, { opacity: doubleTapFade }]}>
            <Ionicons name="play-forward" size={24} color="#ffffff" />
            <Text style={styles.doubleTapText}>+{skipSeconds}s</Text>
          </Animated.View>
        )}

        {/* Minimalist Floating HUD Indicator (Brightness / Volume) */}
        {activeHud && (
          <View style={styles.hudPill}>
            <Ionicons
              name={activeHud === 'brightness' ? 'sunny' : volume === 0 ? 'volume-mute' : 'volume-high'}
              size={18}
              color="#ffffff"
            />
            <View style={styles.hudTrack}>
              <View style={[styles.hudFill, { width: `${hudValue}%` }]} />
            </View>
            <Text style={styles.hudLabel}>{hudValue}%</Text>
          </View>
        )}
      </View>

      {/* 4. Minimalist Cinema Controls Overlay */}
      {showControls && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Top Header Bar */}
          <View
            style={[
              styles.topBar,
              { paddingTop: Math.max(insets.top, 14), paddingBottom: 12 },
            ]}
            pointerEvents="box-none">
            <TouchableOpacity
              onPress={async () => {
                await ScreenOrientation.unlockAsync().catch(() => {});
                router.back();
              }}
              style={styles.iconCircle}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.titleWrap}>
              <Text numberOfLines={1} style={styles.headerTitle}>
                {cleanDisplayTitle(params.title)}
              </Text>
            </View>

            <View style={styles.topActions} pointerEvents="box-none">
              {/* Audio & Subtitle Selector Button */}
              <TouchableOpacity
                onPress={() => {
                  setActiveSheetTab('audio');
                  setSheetVisible(true);
                }}
                style={styles.iconCircle}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chatbox-ellipses-outline" size={19} color="#ffffff" />
              </TouchableOpacity>

              {/* Quality & Mirror Selector Button */}
              <TouchableOpacity
                onPress={() => {
                  setActiveSheetTab('mirrors');
                  setSheetVisible(true);
                }}
                style={styles.iconCircle}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="options-outline" size={19} color="#ffffff" />
              </TouchableOpacity>

              {/* Orientation Button */}
              <TouchableOpacity
                onPress={toggleRotation}
                style={styles.iconCircle}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={isLandscape ? 'phone-portrait-outline' : 'phone-landscape-outline'}
                  size={19}
                  color="#ffffff"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Center Playback Controls */}
          <View style={styles.centerControls} pointerEvents="box-none">
            {/* Quick Skip Backward */}
            <TouchableOpacity
              onPress={() => performSkip('backward')}
              style={styles.centerSkipBtn}
              activeOpacity={0.75}>
              <Ionicons name="play-back" size={24} color="#ffffff" />
              <Text style={styles.centerSkipText}>-{skipSeconds}s</Text>
            </TouchableOpacity>

            {/* Hero Play / Pause Button */}
            <TouchableOpacity
              onPress={togglePlayPause}
              style={styles.heroPlayBtn}
              activeOpacity={0.8}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color="#ffffff"
                style={{ marginLeft: isPlaying ? 0 : 3 }}
              />
            </TouchableOpacity>

            {/* Quick Skip Forward */}
            <TouchableOpacity
              onPress={() => performSkip('forward')}
              style={styles.centerSkipBtn}
              activeOpacity={0.75}>
              <Ionicons name="play-forward" size={24} color="#ffffff" />
              <Text style={styles.centerSkipText}>+{skipSeconds}s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Bar: Timeline Scrubber & Times */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
            pointerEvents="box-none">
            <View style={styles.bottomTimelineRow}>
              <Text style={styles.timestampText}>{formatTime(displayTime)}</Text>

              {/* Dedicated Touch Scrubber */}
              <View
                style={styles.scrubberTouchArea}
                onLayout={(e) => {
                  scrubberTrackWidth.current = e.nativeEvent.layout.width;
                }}
                {...scrubberResponder.panHandlers}>
                <View style={styles.scrubberTrack} pointerEvents="none">
                  <View
                    style={[styles.scrubberFill, { width: `${progressPercent}%` }]}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      styles.scrubberThumb,
                      { left: `${Math.max(0, Math.min(99, progressPercent))}%` },
                      isScrubbing && styles.scrubberThumbActive,
                    ]}
                    pointerEvents="none"
                  />
                </View>
              </View>

              <Text style={styles.timestampText}>{formatTime(duration)}</Text>

              {/* Next Episode Button if available */}
              {nextEpisodeRelease && (
                <TouchableOpacity
                  onPress={() => handlePlayNextEpisode(nextEpisodeRelease)}
                  style={styles.nextEpPill}
                  activeOpacity={0.8}>
                  <Ionicons name="play-skip-forward" size={12} color="#ffffff" />
                  <Text style={styles.nextEpPillText}>Next</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 5. Minimalist Buffering Spinner */}
      {playerStatus === 'loading' && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#e50914" />
        </View>
      )}

      {/* 6. Playback Error State */}
      {playerStatus === 'error' && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={44} color="#e50914" />
          <Text style={styles.errorTitle}>Stream Connection Failed</Text>
          <Text style={styles.errorSubtitle}>
            {errorMessage || 'Connecting to alternate mirror...'}
          </Text>
          <TouchableOpacity
            style={styles.switchMirrorBtn}
            onPress={() => {
              setActiveSheetTab('mirrors');
              setSheetVisible(true);
            }}>
            <Ionicons name="options-outline" size={16} color="#ffffff" />
            <Text style={styles.switchMirrorBtnText}>Choose Another Mirror</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 7. Apple TV / Netflix Grade Audio, Subtitle & Quality Bottom Sheet */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSheetVisible(false)}
          />

          <View style={styles.modalSheet}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Segmented Tab Header with Item Count Badges */}
            <View style={styles.sheetTabs}>
              <TouchableOpacity
                onPress={() => setActiveSheetTab('audio')}
                style={[styles.sheetTab, activeSheetTab === 'audio' && styles.sheetTabActive]}>
                <Ionicons
                  name="volume-high-outline"
                  size={15}
                  color={activeSheetTab === 'audio' ? '#e50914' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.sheetTabText,
                    activeSheetTab === 'audio' && styles.sheetTabTextActive,
                  ]}>
                  Audio {availableAudioTracks.length > 0 ? `(${availableAudioTracks.length})` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSheetTab('subtitles')}
                style={[styles.sheetTab, activeSheetTab === 'subtitles' && styles.sheetTabActive]}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={15}
                  color={activeSheetTab === 'subtitles' ? '#e50914' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.sheetTabText,
                    activeSheetTab === 'subtitles' && styles.sheetTabTextActive,
                  ]}>
                  Subtitles {availableSubtitles.length > 0 ? `(${availableSubtitles.length})` : ''}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveSheetTab('mirrors')}
                style={[styles.sheetTab, activeSheetTab === 'mirrors' && styles.sheetTabActive]}>
                <Ionicons
                  name="film-outline"
                  size={15}
                  color={activeSheetTab === 'mirrors' ? '#e50914' : '#9ca3af'}
                />
                <Text
                  style={[
                    styles.sheetTabText,
                    activeSheetTab === 'mirrors' && styles.sheetTabTextActive,
                  ]}>
                  Mirrors ({availableReleases.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {/* Tab 1: Audio Dubs */}
              {activeSheetTab === 'audio' && (
                <View style={styles.tabSection}>
                  {availableAudioTracks.length > 0 ? (
                    availableAudioTracks.map((track, i) => {
                      const { title, badge } = formatTrackMeta(track, i, 'audio');
                      const isSelected = selectedAudioTrackId === (track.id || track.language || track.label);
                      return (
                        <TouchableOpacity
                          key={track.id || i}
                          style={[styles.sheetRow, isSelected && styles.sheetRowActive]}
                          onPress={() => handleSelectAudioTrack(track)}>
                          <View style={styles.rowLeft}>
                            <View style={[styles.trackIconWrap, isSelected && styles.trackIconWrapActive]}>
                              <Ionicons
                                name="volume-medium"
                                size={16}
                                color={isSelected ? '#e50914' : '#9ca3af'}
                              />
                            </View>
                            <View style={styles.trackInfoWrap}>
                              <Text style={[styles.rowTitle, isSelected && styles.rowTitleActive]}>
                                {title}
                              </Text>
                              {badge && <Text style={styles.trackBadgeText}>{badge}</Text>}
                            </View>
                          </View>
                          {isSelected ? (
                            <View style={styles.checkPill}>
                              <Ionicons name="checkmark" size={14} color="#e50914" />
                            </View>
                          ) : (
                            <View style={styles.uncheckPill} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={styles.emptyContainer}>
                      <View style={styles.emptyIconCircle}>
                        <Ionicons name="volume-high" size={24} color="#e50914" />
                      </View>
                      <Text style={styles.emptyHeading}>Container Multi-Audio Stream</Text>
                      <Text style={styles.emptyDescription}>
                        This release streams high-quality embedded multi-audio (Hindi / English / Original Dub). To select a specific single-language encode, switch to an alternate mirror below.
                      </Text>
                      <TouchableOpacity
                        style={styles.emptyActionBtn}
                        onPress={() => setActiveSheetTab('mirrors')}>
                        <Ionicons name="swap-horizontal" size={14} color="#ffffff" />
                        <Text style={styles.emptyActionText}>View Alternative Dub Mirrors</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Tab 2: Subtitles */}
              {activeSheetTab === 'subtitles' && (
                <View style={styles.tabSection}>
                  {/* Off Option */}
                  <TouchableOpacity
                    style={[styles.sheetRow, selectedSubtitleId === null && styles.sheetRowActive]}
                    onPress={() => handleSelectSubtitleTrack(null)}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.trackIconWrap, selectedSubtitleId === null && styles.trackIconWrapActive]}>
                        <Ionicons
                          name="close-circle-outline"
                          size={16}
                          color={selectedSubtitleId === null ? '#e50914' : '#9ca3af'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.rowTitle,
                          selectedSubtitleId === null && styles.rowTitleActive,
                        ]}>
                        Off (Disabled)
                      </Text>
                    </View>
                    {selectedSubtitleId === null ? (
                      <View style={styles.checkPill}>
                        <Ionicons name="checkmark" size={14} color="#e50914" />
                      </View>
                    ) : (
                      <View style={styles.uncheckPill} />
                    )}
                  </TouchableOpacity>

                  {availableSubtitles.map((sub, i) => {
                    const { title, badge } = formatTrackMeta(sub, i, 'subtitle');
                    const isSelected = selectedSubtitleId === (sub.id || sub.language || sub.label);
                    return (
                      <TouchableOpacity
                        key={sub.id || i}
                        style={[styles.sheetRow, isSelected && styles.sheetRowActive]}
                        onPress={() => handleSelectSubtitleTrack(sub)}>
                        <View style={styles.rowLeft}>
                          <View style={[styles.trackIconWrap, isSelected && styles.trackIconWrapActive]}>
                            <Ionicons
                              name="chatbubble-outline"
                              size={16}
                              color={isSelected ? '#e50914' : '#9ca3af'}
                            />
                          </View>
                          <View style={styles.trackInfoWrap}>
                            <Text style={[styles.rowTitle, isSelected && styles.rowTitleActive]}>
                              {title}
                            </Text>
                            {badge && <Text style={styles.trackBadgeText}>{badge}</Text>}
                          </View>
                        </View>
                        {isSelected ? (
                          <View style={styles.checkPill}>
                            <Ionicons name="checkmark" size={14} color="#e50914" />
                          </View>
                        ) : (
                          <View style={styles.uncheckPill} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Tab 3: Stream Mirrors */}
              {activeSheetTab === 'mirrors' && (
                <View style={styles.tabSection}>
                  {availableReleases.map((rel, i) => {
                    const isResolving = isResolvingSwitch === rel.filename;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={styles.sheetRow}
                        disabled={isResolvingSwitch !== null}
                        onPress={() => handleSwitchRelease(rel)}>
                        <View style={styles.rowLeft}>
                          <QualityBadge quality={rel.quality} />
                          <Text numberOfLines={1} style={styles.rowTitle}>
                            {rel.filename}
                          </Text>
                        </View>
                        {isResolving ? (
                          <ActivityIndicator size="small" color="#e50914" />
                        ) : (
                          <Ionicons name="chevron-forward" size={16} color="#4b5563" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Close Sheet Button */}
            <TouchableOpacity
              onPress={() => setSheetVisible(false)}
              style={styles.sheetCloseBtn}
              activeOpacity={0.7}>
              <Text style={styles.sheetCloseBtnText}>Done</Text>
            </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerControls: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    zIndex: 5,
  },
  heroPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#e50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  centerSkipBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  centerSkipText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 10,
  },
  bottomTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timestampText: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
  },
  scrubberTouchArea: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 2,
    position: 'relative',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: '#e50914',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    marginLeft: -7,
  },
  scrubberThumbActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    top: -7,
    backgroundColor: '#ff2e3e',
  },
  nextEpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e50914',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  nextEpPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  doubleTapPill: {
    position: 'absolute',
    top: '42%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  doubleTapLeft: {
    left: '12%',
  },
  doubleTapRight: {
    right: '12%',
  },
  doubleTapText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  hudPill: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 20, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hudTrack: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  hudFill: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  hudLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 32,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 15, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    zIndex: 20,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  errorSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  switchMirrorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e50914',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  switchMirrorBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#12121a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1e1e2c',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '55%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2e2e3e',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTabs: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1c1c28',
  },
  sheetTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sheetTabActive: {
    backgroundColor: '#1a1a24',
  },
  sheetTabText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  sheetContent: {
    paddingBottom: 10,
  },
  tabSection: {
    gap: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161622',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f1f2e',
  },
  sheetRowActive: {
    borderColor: '#e50914',
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  trackIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIconWrapActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
  },
  trackInfoWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '600',
  },
  rowTitleActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  trackBadgeText: {
    color: '#e50914',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uncheckPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#2e2e3e',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyHeading: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyDescription: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1f1f2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    marginTop: 12,
    backgroundColor: '#1c1c28',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
