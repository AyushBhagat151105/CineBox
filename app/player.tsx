import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProviderId } from '@/types';
import { useAppStore } from '@/store';
import { vlcService } from '@/services';
import { cleanDisplayTitle } from '@/utils';

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    title?: string;
    streamUrl?: string;
    mediaId?: string;
    provider?: ProviderId;
    posterUrl?: string;
    resumeSeconds?: string;
  }>();

  const preferredPlayer = useAppStore((s) => s.preferredPlayer);

  useEffect(() => {
    let mounted = true;

    async function launchPlayer() {
      if (!params.streamUrl) {
        return;
      }

      const resumeSec = params.resumeSeconds ? parseInt(params.resumeSeconds, 10) : 0;
      const title = cleanDisplayTitle(params.title || 'Video Player');

      await vlcService.launch({
        streamUrl: params.streamUrl,
        title,
        mediaId: params.mediaId || 'unknown',
        provider: (params.provider as ProviderId) || 'hdhub4u',
        posterUrl: params.posterUrl,
        resumeSeconds: resumeSec,
        forceChooser: preferredPlayer === 'chooser',
      });

      if (mounted) {
        router.back();
      }
    }

    launchPlayer();

    return () => {
      mounted = false;
    };
  }, [params.streamUrl]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#e50914" />
      <Text style={styles.title}>
        Opening {cleanDisplayTitle(params.title || 'media')} in {preferredPlayer === 'chooser' ? 'Player' : 'VLC'}...
      </Text>
      <Text style={styles.subtitle}>Native hardware-accelerated playback</Text>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={18} color="#ffffff" />
        <Text style={styles.backButtonText}>Cancel & Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1c1c28',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
