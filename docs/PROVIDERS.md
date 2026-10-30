# 🛰️ Federated Media Providers & Resolvers

CineBox unifies three distinct content indexing engines into a single, federated search and discovery experience.

---

## 1. 🌐 HDHub4u Gateway (`src/providers/hdhub4u/`)

HDHub4u specializes in Bollywood, South Indian Cinema (Hindi Dubbed, Tamil, Telugu), and Hollywood releases.

### Anti-DMCA Domain Probing
Because upstream mirrors rotate constantly to evade ISP blocks and DMCA notices, CineBox implements an active probing mechanism:
1. CineBox probes `https://hdhub4u.fast/` and extracts the dynamic redirect target via HTTP redirects.
2. If `hdhub4u.fast` is blocked, it queries the fallback bridge: `https://h4.suncdn.org/host/`.
3. The resolved active domain (e.g. `hdhub4u.ms` or `hdhub4u.cl`) is cached in memory for subsequent API searches.

### Stream Resolvers
- **HubCloud (`src/providers/hdhub4u/resolvers/hubcloud.ts`)**: Bypasses intermediate landing pages, decodes obfuscated base64 payloads, and resolves direct high-speed CDN streaming links.
- **PixelDrain (`src/providers/hdhub4u/resolvers/pixeldrain.ts`)**: Resolves direct 10Gbps stream endpoints from PixelDrain file lockers.

---

## 2. 💎 4KHDHub UHD Engine (`src/providers/hdhub4u/4khdhub.ts`)

4KHDHub is dedicated to ultra-high-bitrate 4K UHD (2160p), Remux, Dolby Vision (DV), and HDR10 HEVC releases:
- Scrapes metadata, video resolution indicators, file sizes (ranging from 4 GB up to 45 GB), and embedded audio track tags.
- Identifies DTS-HD MA, Dolby Atmos, and multi-channel 5.1/7.1 audio tracks directly from release titles.

---

## 3. 🔐 MovieBox API & Cryptographic Signing (`src/providers/moviebox/`)

MovieBox provides a clean global catalog with IMDB metadata, actor filmographies, episode structures, and multilingual alternate dubs.

### Cryptographic HMAC-MD5 Request Signing
Every outgoing request to MovieBox API endpoints requires specific authentication headers generated dynamically:

```typescript
// Header Signature Generation
const timestamp = Math.floor(Date.now() / 1000);
const rawToken = `${CLIENT_ID}:${timestamp}:${SECRET_SALT}`;
const clientToken = crypto.createHash('md5').update(rawToken).digest('hex');

const signaturePayload = `${ENDPOINT_PATH}?${queryString}&token=${clientToken}`;
const signature = crypto.createHmac('md5', HMAC_KEY).update(signaturePayload).digest('hex');
```

Headers injected on every outbound call:
- `x-client-token`: Dynamic timestamped MD5 token.
- `x-tr-signature`: HMAC-MD5 endpoint digest.
- `x-client-info`: Client architecture and version fingerprint.
- Host rotation among 7 API endpoints to distribute network load.

---

## ⚡ Stream Preflight Verification

Before presenting a stream to the video player, CineBox runs a lightweight preflight probe (`Range: bytes=0-0`):
- Verifies that the remote server returns HTTP `200 OK` or `206 Partial Content`.
- Verifies `Content-Type` is a valid video container (`video/mp4`, `video/x-matroska`, `application/x-mpegURL`).
- If a mirror fails or returns `404`/`403`, CineBox automatically promotes the next best mirror in the fallback chain.
