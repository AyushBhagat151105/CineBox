# 📝 Changelog

All notable changes to the **CineBox** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- **Background Download Manager**: Resumable file downloads with pause/resume support and `FileProvider` local playback in VLC.
- **Multi-Server Provider Expansion**: Additional anime and international movie scrapers.

---

## [v1.1.1] - 2026-10-31

### 🚀 Highlights
- **In-App Package Installer Fix**:
  - **Permission Declaration**: Added `<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>` and Android 11+ `<queries>` package archive filters to prevent Android OS (API 26-35) from silently dropping installer intents.
  - **Persistent Installation Modal**: Fixed premature modal auto-dismissal; replaced with an interactive **"Ready to Install"** state with direct installation retry.
  - **Permission Settings Shortcut**: Added a one-tap shortcut to open Android's **"Install unknown apps"** settings (`android.settings.MANAGE_UNKNOWN_APP_SOURCES`) if installation is blocked.
  - **Local APK Caching**: Added file verification to avoid redundant 65MB re-downloads when an APK was already fetched.

---

## [v1.1.0] - 2026-10-31

### 🚀 Highlights
- **Android TV & Amazon FireStick Support**:
  - **Leanback Launcher Integration**: Added Android TV Leanback launcher intent filter with custom 16:9 widescreen TV banner (`tv_banner.png`).
  - **Universal Multi-ABI Build**: Added 32-bit `armeabi-v7a` alongside 64-bit `arm64-v8a` to ensure single universal APK runs seamlessly on budget TV sticks (Fire TV Stick Lite) and modern phones/TVs.
  - **10-Foot Leanback UI**: Replaced unreachable bottom navigation on TV with a vertical left sidebar (`TVSidebar`) featuring balanced top/bottom D-Pad raycast candidates and auto-focus.
  - **Widescreen Poster Aspect Ratio**: Fixed vertically distorted movie cards across 5 widescreen columns by enforcing a strict 2:3 cinematic poster ratio.
  - **Full Remote D-Pad Navigation & Visual Feedback**: High-contrast glowing focus states (2.5px white border, scale enhancement, glowing shadow) on category pills, genre filters, season tabs, episode chips, and stream release cards.
  - **Low-RAM (1GB) Performance Optimization**: Bypassed heavy YouTube iframe WebView instantiation on TV sticks to prevent memory exhaustion and UI thread freezing.
- **Open Source Licensing & Community Infrastructure**:
  - Dual-licensed project under **Apache 2.0** (`LICENSE-APACHE`) and **MIT** (`LICENSE`).
  - Added structured GitHub Issue templates (`bug_report.md`, `feature_request.md`, `stream_issue.md`, `config.yml`) and `CONTRIBUTING.md`.

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
