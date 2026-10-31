# 🤝 Contributing to CineBox

Thank you for your interest in contributing to **CineBox**! We welcome contributions from developers, designers, and cinema enthusiasts worldwide.

Please take a moment to review this document before submitting issues, feature requests, or pull requests.

---

## 📜 Code of Conduct & Core Values

1. **User Privacy is Paramount**: CineBox is strictly zero-telemetry and zero-tracking. We will immediately reject any PR that introduces remote analytics, user tracking, device profiling, or telemetry SDKs.
2. **Client-Side Sourcing**: CineBox is an open-source client-side indexer. We do not host or operate centralized streaming backends or media servers.
3. **Respectful Collaboration**: Treat everyone with courtesy and constructive feedback.

---

## 🛠️ Development Setup

### Prerequisites
- **[Bun](https://bun.sh/)** (v1.2+) - Primary runtime and package manager.
- **Node.js** (v20+)
- **Android Studio & Android SDK** (API 34+, NDK 27.x)
- **OpenJDK 17** (Zulu or Temurin)

### 1. Clone & Install
```bash
git clone https://github.com/AyushBhagat151105/CineBox.git
cd CineBox
bun install
```

### 2. Verify Scrapers & Resolvers
Before touching provider code, ensure existing upstream scrapers and resolvers are functional:
```bash
bun scripts/test_providers.ts
```

### 3. Launch Development Server
```bash
bun start
```
Press `a` to run on a connected Android device or Android Virtual Device (AVD).

### 4. Build a Local Release APK
```bash
bun run build:apk
```

---

## 🛰️ Contributing to Media Providers

All media scrapers and resolvers reside in `src/providers/`:
- `src/providers/hdhub4u/` — Dynamic gateway routing and HTML parsing.
- `src/providers/fourkhdhub/` — 4K UHD Remux and high-bitrate stream extraction.
- `src/providers/moviebox/` — Cryptographic HMAC-signed API indexer.
- `src/providers/aggregator.ts` — Federated concurrent search, deduplication, and preflight probing.

### Rules for Provider Contributions:
1. **Always Implement Preflight Probing**: New streaming resolvers must validate direct video headers or range requests (`bytes=0-0`) to prevent dead links.
2. **Handle Domain Drift**: Domains change frequently; never hardcode fragile single-domain endpoints without fallback routing.
3. **Test thoroughly**: Run `bun scripts/test_providers.ts` and verify that streams resolve to valid direct media files before opening a PR.

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(scope): ...` — A new user-facing feature or enhancement.
- `fix(scope): ...` — A bug fix.
- `docs(scope): ...` — Documentation updates or additions.
- `refactor(scope): ...` — Code refactoring without behavioral changes.
- `perf(scope): ...` — Performance improvements.
- `chore(scope): ...` — Build scripts, dependencies, or configuration changes.

Examples:
- `feat(downloader): add background download manager with resumable tasks`
- `fix(hdhub4u): update fallback domain gateway regex`
- `docs(readme): add contributing and license documentation`

---

## 🚀 Submitting a Pull Request

1. **Fork the Repository** to your own GitHub account.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
3. **Run Linting & Tests**:
   Ensure TypeScript compiles without errors:
   ```bash
   bun x tsc --noEmit
   bun scripts/test_providers.ts
   ```
4. **Commit Your Changes**: Follow conventional commit guidelines.
5. **Push and Open a PR**:
   - Provide a clear explanation of what was changed and why.
   - Mention any related issue numbers (e.g., `Fixes #12`).
   - If UI changes were made, attach screenshots or a screen recording.

---

## 🐛 Reporting Issues

- **Bugs**: Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template. Provide device details, Android version, steps to reproduce, and logs if available.
- **Broken Streams / Scrapers**: Use the [Stream Issue](.github/ISSUE_TEMPLATE/stream_issue.md) template with the title of the movie/show, selected provider, and error behavior.
- **Feature Requests**: Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template to explain the motivation and use case.

---

## ⚖️ License & Dual-Licensing

By contributing to CineBox, you agree that your contributions will be licensed under both the [MIT License](LICENSE) and the [Apache License 2.0](LICENSE-APACHE).
