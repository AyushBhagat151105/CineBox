# CineBox Native VLC Player Migration & Watch History Plan

## 1. Executive Summary & Objective
- **Goal**: Completely replace the internal video player (`expo-video` in `app/player.tsx`) with the external native **VLC for Android** player (`org.videolan.vlc`) via Android Intents.
- **Why**: 
  - Standard Android ExoPlayer cannot decode high-end audio codecs (e.g., **DTS-HD MA 5.1**, Dolby TrueHD, AC3) commonly present in 4K UHD BluRay releases like *Game of Thrones S1E10*, causing timeline freezing or silent playback.
  - VLC for Android bundles its own self-contained FFmpeg decoders, hardware acceleration, gesture controls (volume, brightness, seek), multi-audio track switching (Hindi, Tamil, Telugu, English), and subtitle rendering.
  - Eliminates ~700 lines of complex player logic, custom PanResponders, and `replaceAsync` warnings.
  - Preserves lightweight APK size (~25 MB) and keeps Gradle build times instant by avoiding LibVLC C++ compilation.
- **Core Requirement**: Maintain complete **Resume** and **Continue Watching** support across the CineBox home dashboard and media details views.

---

## 2. Architecture & Data Flow

```
                      +-----------------------------+
                      | User Taps "Play" or         |
                      | "Continue Watching" Card    |
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      | Aggregator Resolves Stream  |
                      | (Google CDN / Cloudflare)   |
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      | Intent Bridge (vlc.ts)      |
                      | 1. Record session start     |
                      | 2. Look up saved resumeSec  |
                      | 3. Launch Android Intent:   |
                      |    - Package: org.videolan  |
                      |    - Action: ACTION_VIEW    |
                      |    - Data: streamUrl        |
                      |    - Extra: position (ms)   |
                      |    - Extra: title           |
                      +--------------+--------------+
                                     |
                      +--------------v--------------+
                      | VLC for Android Plays Video |
                      | (Hardware 4K / DTS-HD MA)   |
                      +--------------+--------------+
                                     | (User presses Back)
                      +--------------v--------------+
                      | Return to CineBox           |
                      | 1. AppState triggers Active |
                      | 2. Calculate watched time   |
                      | 3. Update useAppStore       |
                      | 4. Update Continue Watching |
                      +-----------------------------+
```

---

## 3. Step-by-Step Implementation Roadmap

### Phase 1: Dependencies & Android Permissions
1. **Install Intent Launcher**:
   - `bun add expo-intent-launcher`
   - Official Expo package, pure Kotlin wrapper, 0 native compilation overhead.
2. **Android Manifest Queries** (`android/app/src/main/AndroidManifest.xml`):
   - Add `<queries>` declaration so Android 11+ (API 30+) allows querying and targeting `org.videolan.vlc`:
     ```xml
     <queries>
         <package android:name="org.videolan.vlc" />
         <intent>
             <action android:name="android.intent.action.VIEW" />
             <data android:mimeType="video/*" />
         </intent>
     </queries>
     ```

### Phase 2: Native VLC Bridge Service (`src/services/vlc.ts`)
Create a robust VLC launcher service:
- **`launchVlc(options: VlcLaunchOptions)`**:
  - `streamUrl`: Direct video URL.
  - `title`: Clean movie or episode title.
  - `mediaId`, `provider`: For tracking in `useAppStore`.
  - `posterUrl`: Artwork.
  - `season`, `episode`: TV series metadata.
  - `resumeSeconds`: Saved playback position.
- **Intent Configuration**:
  ```typescript
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: streamUrl,
    type: 'video/*',
    packageName: 'org.videolan.vlc',
    extra: {
      title,
      position: resumeSeconds * 1000, // milliseconds
      from_start: resumeSeconds <= 0,
      extra_headers: ['User-Agent', BROWSER_UA],
    },
  });
  ```
- **Fallback / App Store Prompt**:
  - If VLC is not installed (`resolveActivity` returns null or `startActivityAsync` rejects):
    - Present alert: *"VLC for Android is required for 4K & multi-audio playback"*.
    - Button 1: *"Install from Play Store"* -> `market://details?id=org.videolan.vlc`.
    - Button 2: *"Open with Other App"* -> Fires generic Android Chooser (`video/*` without `packageName`).

### Phase 3: Watch History & Resume Reconciliation
- In `src/services/vlc.ts`, track the active session:
  - On launch: save `{ mediaId, season, episode, startTime: Date.now(), initialResume: resumeSeconds }`.
  - Listen to `AppState.addEventListener('change', (state) => { ... })`:
    - When state transitions from `background` -> `active`:
      - Compute `elapsedSec = Math.round((Date.now() - session.startTime) / 1000)`.
      - If `elapsedSec > 15`:
        - New position: `session.initialResume + elapsedSec`.
        - Save to `useAppStore.saveProgress({ mediaId, season, episode, positionSeconds: newPos, durationSeconds: ... })`.
        - Mark completed if over 90% or > 80 mins.

### Phase 4: Removing Internal Player & Updating UI
1. **Remove `app/player.tsx`**:
   - Retire the old `expo-video` player screen.
2. **Update `app/details.tsx`**:
   - Tapping "Play 4K UHD" / "Resume from XXm" immediately calls `vlcService.launch(...)`.
   - Show a subtle loading spinner on the button while the stream resolves, then launches VLC directly.
   - Upon return from VLC, the Details page updates immediately to show "Resume (XX%)" or "Watched ✓".
3. **Update `src/components/ContinueWatchingCard.tsx`**:
   - Tapping the card resolves the stream and launches VLC directly at `item.positionSeconds`.
   - Add options to "Restart from Beginning" or "Remove from History".
4. **Update `app/settings.tsx`**:
   - Replace old player gesture settings with:
     - Preferred Video Engine: "VLC for Android (Recommended)" / "System Chooser".
     - Auto-mark watched threshold.

---

## 4. Verification & Testing Checklist
- [ ] Test *Game of Thrones S1E10* 1080p DTS-HD MA: verify audio plays without stuttering in VLC.
- [ ] Test *Reacher* S01E03 4K: verify 4K HDR playback and subtitle tracks.
- [ ] Verify timeline resume: watch 2 minutes in VLC, exit back to CineBox, confirm progress shows ~2m on Home screen.
- [ ] Verify "Start from Beginning" vs "Resume" buttons.
- [ ] Verify clean TypeScript build (`npx tsc --noEmit`).
