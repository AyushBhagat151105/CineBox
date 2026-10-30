# 💎 Monetization Architecture & VIP Mode

CineBox integrates a privacy-focused rewarded sponsor model using **Monetag Direct SmartLinks** while preserving a permanently ad-free **VIP Mode** for developers and local builds.

---

## 🎯 Monetization Strategy

1. **Why Monetag?**
   - Mainstream ad networks (Google AdMob, Meta Audience Network) ban scraper/streaming clients and withhold publisher balances.
   - Monetag officially supports sideloaded Android APKs, has no minimum audience thresholds, and supports weekly payouts starting at $5 (PayPal, Skrill) or $100 (Crypto USDT TRC-20).
2. **Per-Video Rewarded Ad Model**:
   - Every time a user initiates video playback on a public release build, a 25-second rewarded sponsor intermission is requested.
   - Watching the sponsor offer directly supports high-speed 10Gbps streaming servers.

---

## 🛡️ Overcoming Mobile Intent Scheme Bugs (`intent://`)

### The Problem
Monetag Direct Links employ client-side JavaScript redirect chains designed to force external mobile browsers open using Android intent URLs:
```
intent://uplcm.com/4/12155691?intnt_r=true#Intent;scheme=https;package=com.android.chrome;end
```
Standard embedded WebViews (e.g. `react-native-webview`) delegate unhandled URL schemes to React Native's `Linking.openURL()`. `Linking.openURL` rejects `#Intent;` syntax, throwing `WARN Can't open url: intent://...` and freezing on an empty black screen.

### The Solution: Native Chrome Custom Tabs
Instead of rendering inside an unstable WebView, CineBox triggers **Chrome Custom Tabs** using `expo-web-browser`:
```typescript
await WebBrowser.openBrowserAsync(MONETAG_DIRECT_URL, {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  toolbarColor: '#0a0a0f',
  controlsColor: '#e50914',
});
```
- **Benefits**: Native Chrome cookie handling, full JavaScript/pop-up compliance, zero intent crashes, and accurate impression attribution in the Monetag dashboard.
- **In-App Card**: CineBox simultaneously displays an animated sponsor status card with a 25-second countdown timer and an "Open Sponsor Offer" re-trigger button.

---

## ⚠️ User Responsibility & Security Advisories

Because third-party sponsor networks dynamically serve third-party advertiser landing pages, CineBox incorporates clear security warnings in `RewardedAdModal.tsx`:
- **Warning Box in Prompt**: *"Safety & User Responsibility: Ads are provided by external sponsors. You do NOT need to download anything, install APKs, or grant browser permissions. Simply view the page until the timer finishes."*
- **Active Card Reminder**: Prominently cautions users not to grant notification permissions or install unknown APKs from ad landing pages.

---

## 👑 Compile-Time VIP Mode (Permanent Ad Bypass)

For creators, developers, and supporters, CineBox includes a compile-time VIP switch:

```bash
# In your local .env file:
EXPO_PUBLIC_ENABLE_ADS=false
```

When `EXPO_PUBLIC_ENABLE_ADS=false`:
- `ADS_ENABLED` evaluates to `false`.
- `adService.isAdUnlocked()` immediately returns `true`.
- The `RewardedAdModal` is completely bypassed, and videos launch instantly in VLC.
- Settings shows the **👑 Creator VIP Mode (Ad-Free Developer Build)** status badge.

In CI/CD release builds (`.github/workflows/release.yml`), `EXPO_PUBLIC_ENABLE_ADS: 'true'` is injected to compile the public ad-supported release.
