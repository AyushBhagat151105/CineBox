import React, { useEffect, useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Sparkles, Play, ShieldCheck, X, CheckCircle2, ExternalLink, ShieldAlert, TriangleAlert } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { adService, AdPromptRequest, MONETAG_DIRECT_URL } from '@/services/ads';

const { width } = Dimensions.get('window');

const COUNTDOWN_SECONDS = 25;

export const RewardedAdModal: React.FC = () => {
  const [request, setRequest] = useState<AdPromptRequest | null>(null);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isCompleted, setIsCompleted] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unsubscribe = adService.subscribe((req) => {
      setRequest(req);
      if (!req) {
        setIsPlayingAd(false);
        setCountdown(COUNTDOWN_SECONDS);
        setIsCompleted(false);
        progressAnim.setValue(0);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

    return unsubscribe;
  }, []);

  const openSponsorOffer = async () => {
    if (!MONETAG_DIRECT_URL) return;
    try {
      await WebBrowser.openBrowserAsync(MONETAG_DIRECT_URL, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        toolbarColor: '#0a0a0f',
        controlsColor: '#e50914',
      });
    } catch (err) {
      console.warn('[Ads] WebBrowser launch failed:', err);
    }
  };

  const startAdPlayback = () => {
    setIsPlayingAd(true);
    setCountdown(COUNTDOWN_SECONDS);
    setIsCompleted(false);
    progressAnim.setValue(0);

    // 1. Immediately launch sponsor offer in Chrome Custom Tab
    openSponsorOffer();

    // 2. Animate progress bar smoothly over COUNTDOWN_SECONDS
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: COUNTDOWN_SECONDS * 1000,
      useNativeDriver: false,
    }).start();

    // 3. Tick countdown timer
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleClaimReward = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (request) {
      await request.onSuccess();
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (request?.onCancel) {
      request.onCancel();
    }
  };

  if (!request) return null;

  return (
    <Modal
      visible={!!request}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        {!isPlayingAd ? (
          // 1. Introduction Card
          <View style={styles.card}>
            {/* Header Icon */}
            <View style={styles.iconCircle}>
              <Sparkles size={32} color="#f5c518" />
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={handleCancel}>
              <X size={20} color="#8a8a9a" />
            </TouchableOpacity>

            <Text style={styles.title}>Unlock Video Playback</Text>
            <Text style={styles.mediaTitle} numberOfLines={1}>
              {request.title}
            </Text>

            <Text style={styles.description}>
              Watch 1 short sponsor clip to support high-speed 10Gbps streaming servers and unlock instant 4K playback.
            </Text>

            {/* Perks Row */}
            <View style={styles.perksContainer}>
              <View style={styles.perkItem}>
                <Play size={14} color="#e50914" />
                <Text style={styles.perkText}>Instant Unlock</Text>
              </View>
              <View style={styles.perkItem}>
                <ShieldCheck size={15} color="#46d369" />
                <Text style={styles.perkText}>10Gbps 4K Stream</Text>
              </View>
            </View>

            {/* Safety & Responsibility Advisory */}
            <View style={styles.safetyBox}>
              <TriangleAlert size={16} color="#f59e0b" style={{ marginTop: 2 }} />
              <View style={styles.safetyTextWrap}>
                <Text style={styles.safetyHeader}>Safety & User Responsibility</Text>
                <Text style={styles.safetyText}>
                  Ads are provided by external sponsors. You do <Text style={styles.boldText}>NOT</Text> need to download anything, install APKs, or grant browser permissions. Simply view the page until the timer finishes.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.watchBtn} onPress={startAdPlayback}>
              <Play size={18} color="#ffffff" fill="#ffffff" />
              <Text style={styles.watchBtnText}>Watch Sponsor Clip (25s)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // 2. Sponsor Ad Experience
          <View style={styles.adContainer}>
            {/* Ad Top Bar */}
            <View style={styles.adHeader}>
              <View style={styles.sponsorBadge}>
                <Text style={styles.sponsorText}>SPONSOR OFFER</Text>
              </View>

              {!isCompleted ? (
                <View style={styles.timerBadge}>
                  <Text style={styles.timerText}>Reward in: {countdown}s</Text>
                </View>
              ) : (
                <View style={[styles.timerBadge, { backgroundColor: '#46d369', borderColor: '#46d369' }]}>
                  <Text style={[styles.timerText, { color: '#000000', fontWeight: 'bold' }]}>
                    Reward Ready!
                  </Text>
                </View>
              )}
            </View>

            {/* Viewport */}
            <View style={styles.adViewport}>
              {!isCompleted ? (
                <View style={styles.adActiveCard}>
                  <View style={styles.radarPulse}>
                    <ExternalLink size={36} color="#e50914" />
                  </View>
                  <Text style={styles.adActiveTitle}>Sponsor Offer In Progress</Text>
                  <Text style={styles.adActiveSub}>
                    Viewing sponsor offer. Your stream will be unlocked as soon as the countdown completes.
                  </Text>
                  <Text style={styles.adActiveCounter}>{countdown}s</Text>

                  <TouchableOpacity style={styles.reopenBtn} onPress={openSponsorOffer}>
                    <ExternalLink size={16} color="#ffffff" />
                    <Text style={styles.reopenBtnText}>Open Sponsor Offer</Text>
                  </TouchableOpacity>

                  <View style={styles.activeSafetyBox}>
                    <ShieldAlert size={14} color="#f59e0b" />
                    <Text style={styles.activeSafetyText}>
                      Do NOT download any APKs or accept browser permissions. Simply wait for the countdown to unlock playback.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.adActiveCard}>
                  <View
                    style={[
                      styles.radarPulse,
                      {
                        backgroundColor: 'rgba(70, 211, 105, 0.15)',
                        borderColor: 'rgba(70, 211, 105, 0.3)',
                      },
                    ]}>
                    <CheckCircle2 size={44} color="#46d369" />
                  </View>
                  <Text style={[styles.adActiveTitle, { color: '#ffffff' }]}>Playback Unlocked!</Text>
                  <Text style={styles.adActiveSub}>
                    Thank you for supporting CineBox streaming servers.
                  </Text>
                </View>
              )}
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Completion Claim Button */}
            <View style={styles.adFooter}>
              {isCompleted ? (
                <TouchableOpacity style={styles.claimBtn} onPress={handleClaimReward}>
                  <Play size={20} color="#000000" fill="#000000" />
                  <Text style={styles.claimBtnText}>Start Video Stream</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.waitText}>Please wait for countdown to finish to start playback</Text>
              )}
            </View>
          </View>
        )}
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
    backgroundColor: 'rgba(245, 197, 24, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.25)',
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
    marginBottom: 4,
  },
  mediaTitle: {
    fontSize: 13,
    color: '#e50914',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: '#a0a0b0',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
  },
  perksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    width: '100%',
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  perkText: {
    fontSize: 11,
    color: '#e0e0e8',
    fontWeight: '500',
  },
  safetyBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  safetyTextWrap: {
    flex: 1,
    gap: 3,
  },
  safetyHeader: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  safetyText: {
    color: '#c0c0d0',
    fontSize: 11,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '800',
    color: '#ffffff',
  },
  watchBtn: {
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
  watchBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#707080',
    fontSize: 12,
    fontWeight: '500',
  },
  adContainer: {
    width: Math.min(width - 32, 420),
    minHeight: 440,
    backgroundColor: '#0e0e14',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#20202c',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 25,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#14141e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e28',
  },
  sponsorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
  },
  sponsorText: {
    color: '#a0a0b0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e50914',
  },
  timerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  adViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  adActiveCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  radarPulse: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  adActiveTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  adActiveSub: {
    fontSize: 13,
    color: '#8e8e9e',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 280,
  },
  adActiveCounter: {
    fontSize: 42,
    fontWeight: '900',
    color: '#f5c518',
    marginBottom: 20,
    letterSpacing: 1,
  },
  reopenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f1f2e',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e42',
  },
  reopenBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  activeSafetyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 18,
    maxWidth: 320,
  },
  activeSafetyText: {
    flex: 1,
    color: '#e2caa0',
    fontSize: 11,
    lineHeight: 15,
  },
  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: '#202028',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#e50914',
  },
  adFooter: {
    padding: 18,
    backgroundColor: '#14141e',
    alignItems: 'center',
  },
  claimBtn: {
    width: '100%',
    backgroundColor: '#46d369',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#46d369',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  claimBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  waitText: {
    color: '#707080',
    fontSize: 12,
    textAlign: 'center',
  },
});
