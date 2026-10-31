# 🛡️ Privacy Policy

**Effective Date:** October 31, 2026

**CineBox** ("we", "our", or "the Application") is an open-source, client-side media search aggregator and playback client engineered with an unwavering commitment to user privacy and data sovereignty.

This Privacy Policy explains what information is handled when you use CineBox on your Android device.

---

## 1. 🔒 The Core Principle: Zero Telemetry & Zero Data Collection

* **No User Accounts**: CineBox does not require registration, login, email addresses, phone numbers, or passwords. You can use 100% of the app anonymously.
* **No Telemetry SDKs**: CineBox contains **no tracking libraries**, **no Google Firebase Analytics**, **no Crashlytics**, **no Facebook SDKs**, and **no advertising device identifier (IDFA/GAID) trackers**.
* **Zero Server Logging**: We do not maintain or operate backend logging servers. We do not track what you search, what you watch, how long you stream, or your geographic location.

---

## 2. 💾 Local On-Device Storage

All application state is saved strictly on your local device within the application’s private sandbox using `@react-native-async-storage/async-storage`:

| Data Stored Locally | Purpose | Shared With Us? |
| :--- | :--- | :---: |
| **Watch History & Progress** | Resumes playback from where you left off | ❌ **Never** (Local only) |
| **Favorites / Bookmarks** | Saves movies and series you have bookmarked | ❌ **Never** (Local only) |
| **Preferred Player Selection** | Remembers your preference (`VLC` vs `Chooser`) | ❌ **Never** (Local only) |
| **Skip Seconds Offset** | Remembers double-tap skip intervals | ❌ **Never** (Local only) |

*You can erase all stored data at any time by clearing the application's storage in Android Settings or uninstalling the app.*

---

## 3. 🌐 Network Communications & Third Parties

### A. Direct Media Sourcing
When you search for media or play a video, your device sends HTTP/HTTPS requests directly from your device to third-party search gateways and content delivery networks (CDNs).
* We do not proxy, intercept, log, or record these requests.
* Your IP address and network headers are transmitted directly to the external third-party host serving the file, subject to that host's independent privacy policy.

### B. Third-Party Sponsor Intermissions (Chrome Custom Tabs)
When an ad intermission is initiated in public builds:
* Offers are opened in a sandboxed Android **Chrome Custom Tab** via `expo-web-browser`.
* CineBox itself does not read, access, or store cookies, browsing history, or credentials from your web browser.
* Any cookies or tracking technologies set on sponsor websites are managed entirely by your system browser and the respective advertising network (e.g., Monetag).

### C. External Player Handoff (VLC for Android)
When launching media playback:
* CineBox crafts an explicit Android Intent (`android.intent.action.VIEW`) containing the direct streaming URL and title, passing it to **VLC for Android** (`org.videolan.vlc`).
* Playback occurs inside the separate VLC application process. CineBox only observes its own foreground/background lifecycle state to calculate elapsed time when you return to the app.

---

## 4. 👶 Children's Privacy

CineBox does not knowingly collect, solicit, or store personal information from children under the age of 13. The application operates entirely without account creation or remote data transmission.

---

## 5. 🔄 Updates & Changes to This Policy

We may periodically update this Privacy Policy to reflect modifications in software architecture or legal requirements. Any revisions will be documented in this repository with an updated effective date.

---

## 6. 📬 Contact & Open Source Auditing

Because CineBox is 100% open source under the MIT License, our code is completely transparent and publicly auditable. You can inspect the entire codebase, network calls, and storage mechanisms directly on GitHub:

* **Source Code Repository**: [https://github.com/AyushBhagat151105/CineBox](https://github.com/AyushBhagat151105/CineBox)
* **Report Security & Privacy Issues**: [GitHub Issues](https://github.com/AyushBhagat151105/CineBox/issues)
