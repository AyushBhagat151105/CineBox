# 🎬 CineBox

> Native modern mobile streaming client reverse-engineered from [MovieBox-Tui](https://github.com/ayushbhagat/MovieBox-Tui), built with **Expo SDK 58**, **React Native 0.88**, **expo-video**, and **Zustand**.

---

## ✨ Features & Architecture

### 1. 🔄 Multi-Source Federated Aggregator
- **HDHub4u Integration**: Live anti-DMCA gateway router probing (`https://hdhub4u.fast/` -> `https://h4.suncdn.org/host/` -> active `hdhub4u.cl` domain). Sourcing Bollywood, Hindi Dubbed, and Regional Indian titles with HubCloud & PixelDrain stream resolvers.
- **4KHDHub Integration**: Scrapes `https://4khdhub.one/` for 4K UHD (2160p), Remux, Dolby Vision (DV), and HDR10 HEVC content.
- **MovieBox API Integration**: Full TypeScript cryptographic port of MovieBox HMAC-MD5 request signing (`x-client-token`, `x-tr-signature`, `x-client-info`, and host rotation across 7 API endpoints).
- **Federated Deduplication & Auto-Failover**: Queries all providers in parallel, merges results into deduplicated movie cards, runs preflight stream probes (`bytes=0-0`), and falls back to backup mirrors automatically if a primary stream fails.

### 2. 🎧 Dual Audio Track & Dubbing Switching
- **Container Audio Track Switching**: Natively switches embedded MKV/MP4/HLS audio tracks (Hindi, English, Original, Commentary) via `expo-video`'s audio track selection.
- **Provider-Level Dub Switching**: Detects MovieBox alternate dubbed `subject_id`s, allowing instant switching between language feeds while preserving the playback timestamp.

### 3. 📱 Screens & UI
- **Home (`app/(tabs)/index.tsx`)**: Hero banner, Continue Watching carousel with progress bar, Bollywood & Hindi Dubbed deck, 4K UHD deck, and Worldwide Trending.
- **Search (`app/(tabs)/search.tsx`)**: Real-time debounced federated search with provider filter chips (`All`, `HDHub4u`, `4KHDHub`, `MovieBox`).
- **Watchlist (`app/(tabs)/favorites.tsx`)**: Saved movies and TV series backed by `@react-native-async-storage/async-storage`.
- **Media Details (`app/details.tsx`)**: Rich metadata, IMDB ratings, synopsis, dub tracks picker, and full quality release list sorted from 4K UHD down to 480p.
- **Player (`app/player.tsx`)**: Fullscreen native video player with gesture controls, skip 10s, scrubber, audio track switcher modal, and progress tracking sidecar (matching MovieBox-Tui's MPV lua tracking).
- **Settings (`app/(tabs)/settings.tsx`)**: Live gateway health status, active routing domain display, playback configuration, and cache clearing.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
bun install
# or
npm install
```

### 2. Verify Federated Media Engine
```bash
bun scripts/test_providers.ts
```

### 3. Start Expo Development Server
```bash
npx expo start
```
Scan the QR code with **Expo Go** on Android/iOS or press `a` for Android emulator, `i` for iOS simulator.
