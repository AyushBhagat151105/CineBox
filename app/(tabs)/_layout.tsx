import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TVSidebar } from '@/components';

export default function TabLayout() {
  const { width } = Dimensions.get('window');
  const isTV = Platform.isTV || width > 800;

  return (
    <View style={styles.rootContainer}>
      {isTV && <TVSidebar />}
      <View style={styles.contentArea}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#e50914',
            tabBarInactiveTintColor: '#8a8a9e',
            tabBarStyle: isTV
              ? { display: 'none' }
              : {
                  backgroundColor: '#0d0d12',
                  borderTopColor: '#1a1a24',
                  borderTopWidth: 1,
                  height: Platform.OS === 'ios' ? 88 : 64,
                  paddingBottom: Platform.OS === 'ios' ? 28 : 10,
                  paddingTop: 8,
                },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
          }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'film' : 'film-outline'}
              size={size}
              color={focused ? '#e50914' : '#8a8a9e'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size}
              color={focused ? '#e50914' : '#8a8a9e'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'bookmark' : 'bookmark-outline'}
              size={size}
              color={focused ? '#e50914' : '#8a8a9e'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: 'Downloads',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'download' : 'download-outline'}
              size={size}
              color={focused ? '#e50914' : '#8a8a9e'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={size}
              color={focused ? '#e50914' : '#8a8a9e'}
            />
          ),
        }}
      />
    </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0a0a0f',
  },
  contentArea: {
    flex: 1,
  },
});
