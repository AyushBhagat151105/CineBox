---
name: 🛰️ Provider or Stream Issue
about: Report a broken stream, dead resolver, or scraper indexing failure
title: '[STREAM]: '
labels: ['provider-issue', 'triage']
assignees: ''
---

### 🎬 Media Title
- **Title & Year:** [e.g. Oppenheimer (2023), Dune: Part Two (2024)]
- **Content Type:** [ ] Movie  [ ] TV Series  [ ] Anime

### 🛰️ Affected Provider(s)
- [ ] HDHub4u
- [ ] 4KHDHub (2160p UHD)
- [ ] MovieBox API
- [ ] All Providers

### 🔍 Nature of Failure
- [ ] Search returns no results despite being available on upstream site
- [ ] Release list shows candidates, but all fail to resolve
- [ ] Stream hangs on loading spinner / 403 Forbidden
- [ ] VLC opens and immediately exits or reports invalid media format
- [ ] Audio track is missing or out of sync

### 📋 Error Message or Behavior
What does the app display when attempting to play or resolve this title?

### 🌐 Network Environment
- **VPN / DNS Active?** [e.g. Cloudflare 1.1.1.1, AdGuard, NextDNS, None]
- **Geographic Region / Country:** [e.g. India, United States, Europe]

### 📝 Additional Context
Any further details, logs from `bun scripts/test_providers.ts`, or direct link to upstream page if known.
