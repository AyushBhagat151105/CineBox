# 🎬 Native VLC Player Integration & Watch History Engine

CineBox relies on an external native intent handoff architecture to **VLC for Android** (`org.videolan.vlc`).

---

## 💡 Why External VLC vs Embedded Video Player?

| Feature | Embedded ExoPlayer / React Native Player | External VLC for Android Intent |
| :--- | :--- | :--- |
| **Audio Codecs** | Stutters or silent on **DTS-HD MA 5.1**, Dolby TrueHD, AC3 | **Flawless hardware decoding** via bundled FFmpeg |
| **High Bitrate 4K HDR** | High CPU overhead, frame skipping on low-tier chips | **Hardware accelerated** via MediaCodec / OpenMAX |
| **Multi-Language Tracks** | Unreliable container switching | Native track picker (Hindi, English, Tamil, Telugu) |
| **Subtitles** | Basic SRT only | Embedded PGS, ASS/SSA stylized, external subtitle search |
| **App Bundle Size** | Adds ~30-50 MB if LibVLC is bundled | **Zero MB overhead** (keeps CineBox APK ~25 MB) |
| **Gesture Controls** | Custom JS PanResponder (battery heavy) | Native C++ vertical swipes (Brightness / Volume) |

---

## 📡 Intent Protocol Specification (`src/services/vlc.ts`)

When a user taps "Play" or resumes a stream, CineBox crafts an explicit Android Intent via `expo-intent-launcher`:

```typescript
await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
  data: streamUrl,
  type: 'video/*',
  packageName: 'org.videolan.vlc',
  extra: {
    title: mediaTitle,
    position: resumeSeconds * 1000, // Milliseconds offset
    from_start: resumeSeconds <= 0,
    extra_headers: ['User-Agent', BROWSER_USER_AGENT],
  },
});
```

### Android Manifest Permissions & Queries
To ensure Android 11+ (API 30+) allows querying and communicating with the VLC package, `android/app/src/main/AndroidManifest.xml` specifies:

```xml
<queries>
    <package android:name="org.videolan.vlc" />
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:mimeType="video/*" />
    </intent>
</queries>
```

---

## ⏱️ Watch History Reconciliation (Lifecycle Sidecar)

Because an external player operates in a separate process, CineBox tracks watch progress through React Native's `AppState` lifecycle:

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Details as CineBox Details Screen
    participant VLCService as vlc.ts Bridge
    participant Android as Android OS Intent
    participant VLC as VLC for Android
    participant Store as Zustand AppStore

    User->>Details: Tap "Play" / "Resume"
    Details->>VLCService: launchVlc(mediaId, streamUrl, resumeSeconds)
    VLCService->>VLCService: Record Session (startTime: Date.now(), initialResume: resumeSeconds)
    VLCService->>Android: startActivityAsync(ACTION_VIEW, org.videolan.vlc, position: resumeSeconds * 1000)
    Android->>VLC: Launch External Player
    Note over Details,VLCService: CineBox AppState transitions to "background"
    
    User->>VLC: Watch movie / episode in 4K HDR & DTS-HD
    User->>VLC: Tap Back Button to exit
    
    VLC-->>Android: Player Closes
    Android-->>Details: Bring CineBox to Foreground
    Note over Details,VLCService: CineBox AppState transitions to "active"
    
    VLCService->>VLCService: Calculate elapsed = (Date.now() - startTime) / 1000
    VLCService->>Store: saveProgress(mediaId, newPosition: initialResume + elapsed)
    Store-->>Details: Re-render UI ("Resume from XXm" / "Watched ✓")
```

### Automatic Completion Detection
- If total watched duration exceeds **90%** of total runtime or reaches the conclusion, the media is automatically flagged as `Watched ✓` in user history.
- The Home screen's **"Continue Watching"** carousel immediately reflects the new progress bar and remaining minutes.

---

## 🛡️ Fallback: System Chooser

If VLC for Android is not installed on the user's device:
1. CineBox presents a dialog prompting the user to install VLC from the Google Play Store (`market://details?id=org.videolan.vlc`).
2. If the user prefers another player (e.g. MX Player, MPV, Just Player), they can choose **"System Chooser"** in Settings or from the fallback dialog to fire an unconstrained `video/*` intent.
