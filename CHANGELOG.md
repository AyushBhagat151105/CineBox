# 📝 Changelog

All notable changes to the **CineBox** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- **Background Download Manager**: Resumable file downloads with pause/resume support and `FileProvider` local playback in VLC.
- **Android TV & FireStick Support**: Leanback TV banner, D-Pad focus indicators, and 10-foot UI remote navigation.
- **Multi-Server Provider Expansion**: Additional anime and international movie scrapers.

---

## [v1.0.1] - 2026-10-31

### 🚀 Highlights
- **VLC Native Engine Migration**: Switched from internal React Native video player to **Native VLC for Android** via intent dispatch (`org.videolan.vlc`). Unlocks hardware-accelerated **4K HDR**, **DTS-HD Master Audio 5.1/7.1**, **Dolby Atmos**, and multi-language audio switching.
- **Federated Media Aggregator**: Multi-source parallel indexing across **4KHDHub**, **HDHub4u**, and **MovieBox** with automatic deduplication, GreenMotors 4-step cipher unpacking, and HubCloud/PixelDrain stream resolving.
- **Preflight Stream Validation**: Active HTTP range probing (`bytes=0-0`) and Cloudflare R2 token verification to eliminate dead mirrors before dispatching to VLC.
- **Over-The-Air (OTA) APK Updates**: Automated in-app GitHub Releases checker with background streaming download and native Android package installation.
- **Chrome Custom Tabs Sponsor Flow**: Sandboxed Monetag sponsor intermissions preventing `intent://` redirect crashes and black screens.
- **Permanent VIP Mode**: Added `EXPO_PUBLIC_ENABLE_ADS=false` compile-time flag to permanently bypass all ad modals for private and developer builds.
- **Privacy & Legal Shields**: Added exhaustive safe harbor documentation (`DISCLAIMER.md`, `PRIVACY_POLICY.md`, and in-app privacy UI) establishing non-hosting intermediary protections and zero telemetry.

### 🐛 Fixes & Improvements
- Fixed CI/CD Android build failures in `.github/workflows/release.yml` by resolving pre-installed runner NDK (`$ANDROID_NDK_ROOT`) via dynamic `-PndkVersion`.
- Tracked native `android/` directory in git without build caches or local wrapper bloat.
- Eliminated redundant `package-lock.json` to standardize exclusively on `bun.lock`.
- Added dynamic version resolution in in-app settings via `expo-constants`.

---

## [v1.0.0] - 2026-10-28

### 🌟 Initial Release
- Initial release of CineBox client for Android built on Expo SDK 58 and React Native 0.88.
- Grid-based cinematic catalog UI with search, filtering, and detail screens.
- Local bookmarking and watch progress tracking powered by `@react-native-async-storage/async-storage`.
- Basic media playback and streaming resolution infrastructure.
