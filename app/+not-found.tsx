import React from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Not Found',
          headerStyle: { backgroundColor: '#121216' },
          headerTintColor: '#ffffff',
        }}
      />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Return to Home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0a0a0c',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#e50914',
    borderRadius: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});
