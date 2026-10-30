import { useFonts } from 'expo-font';
import { DarkTheme, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '@/store';
import { THEME } from '@/constants';
import { RewardedAdModal, UpdateModal } from '@/components';
import { updaterService, UpdateInfo } from '@/services/updater';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const loadStorage = useAppStore((s) => s.loadStorage);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    loadStorage();
    if (loaded) {
      SplashScreen.hideAsync();
      // Silently check for GitHub OTA updates on app mount
      updaterService.checkForUpdates().then((info) => {
        if (info) setUpdateInfo(info);
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Pure dark cinematic theme
  const CustomDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0a0a0c',
      card: '#121216',
      text: '#ffffff',
      border: '#202028',
      primary: '#e50914', // Cinematic Red
    },
  };

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#121216' },
          headerTintColor: '#ffffff',
          contentStyle: { backgroundColor: '#0a0a0c' },
          animation: 'fade_from_bottom',
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="details"
          options={{
            title: 'Details',
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="privacy"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      <RewardedAdModal />
      <UpdateModal
        updateInfo={updateInfo}
        visible={!!updateInfo}
        onClose={() => setUpdateInfo(null)}
      />
    </>
  );
}
