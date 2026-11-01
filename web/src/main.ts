import './style.css';

// Movie Database for Live Stream Resolver Simulator
interface MovieMirror {
  title: string;
  year: number;
  rating: string;
  mirrors: {
    name: string;
    quality: string;
    specs: string;
    ping: string;
  }[];
}

const MOVIES: Record<string, MovieMirror> = {
  'dune': {
    title: 'Dune: Part Two',
    year: 2024,
    rating: '8.6/10',
    mirrors: [
      { name: 'HubCloud Enterprise R2', quality: '4K HDR10', specs: 'HEVC · 38.4 Mbps · Dolby Atmos 7.1', ping: '18ms' },
      { name: 'PixelDrain Direct CDN', quality: '1080p Remux', specs: 'AVC · 14.2 Mbps · DTS-HD MA 5.1', ping: '32ms' },
      { name: 'MovieBox Stream Fast', quality: '720p Mobile', specs: 'AAC 2.0 · 4.8 Mbps · Dual Audio', ping: '14ms' },
    ],
  },
  'interstellar': {
    title: 'Interstellar',
    year: 2014,
    rating: '8.7/10',
    mirrors: [
      { name: 'HubCloud Master Mirror', quality: '4K IMAX HDR', specs: 'HEVC 10-bit · 42.1 Mbps · DTS-HD 5.1', ping: '22ms' },
      { name: 'PixelDrain Fast Cache', quality: '1080p BluRay', specs: 'AVC · 12.8 Mbps · Dolby Digital Plus', ping: '36ms' },
    ],
  },
  'oppenheimer': {
    title: 'Oppenheimer',
    year: 2023,
    rating: '8.9/10',
    mirrors: [
      { name: 'Cloudflare Edge CDN', quality: '4K UHD HDR', specs: 'HEVC · 35.0 Mbps · DTS-HD MA 5.1', ping: '19ms' },
      { name: 'HubCloud High-Speed', quality: '1080p FHD', specs: 'AVC · 11.4 Mbps · 6-Channel Audio', ping: '28ms' },
    ],
  },
};

// FAQ Data
interface FAQItem {
  question: string;
  shortAnswer: string;
  details: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'How do I install CineBox on Amazon Fire TV Stick?',
    shortAnswer: 'Sideload the universal APK via Downloader app or ADB.',
    details: 'Because CineBox bundles both 32-bit (armeabi-v7a) and 64-bit (arm64-v8a) binaries into a single universal APK under 65MB, it installs natively on Fire TV Stick Lite, 4K Max, and Cube without needing separate architectures.',
  },
  {
    question: 'Why does CineBox use native VLC for Android instead of an internal player?',
    shortAnswer: 'VLC direct intent bypasses WebView audio and video limits.',
    details: 'By dispatching video streams directly to org.videolan.vlc with custom intent extras, CineBox achieves true zero-transcoding 4K HDR10 playback, uncompressed Dolby Atmos passthrough, and direct multi-track subtitle switching with hardware acceleration.',
  },
  {
    question: 'How do in-app updates work without the Google Play Store?',
    shortAnswer: 'OTA updates query GitHub Releases directly on application launch.',
    details: 'When a new release is published, the in-app OTA service downloads the binary, checks cache integrity to prevent duplicate downloads, and triggers the Android Package Installer via REQUEST_INSTALL_PACKAGES with zero ad spam.',
  },
  {
    question: 'Is CineBox free and open source?',
    shortAnswer: 'Dual-licensed under Apache 2.0 and MIT. Pure open source.',
    details: 'There are no paid tiers, no mandatory accounts, no telemetry tracking, and no hidden subscriptions. The entire codebase is hosted publicly on GitHub.',
  },
  {
    question: 'Does CineBox support low-spec 1GB RAM TV sticks?',
    shortAnswer: 'Leanback mode suppresses background views on 1GB sticks.',
    details: 'On television devices, heavy YouTube iframes and background animations are automatically suppressed, keeping idle memory footprint under 90MB on budget 1GB streaming sticks.',
  },
  {
    question: 'What is CineBox\'s copyright and DMCA content policy?',
    shortAnswer: 'CineBox does not host, upload, or transmit any media content.',
    details: 'CineBox operates exclusively as a client-side search crawler and metadata indexing interface. Zero video streams are stored on our servers. All indexed links point to public third-party services, and DMCA takedown requests must be directed to the third-party hosts originating the files.',
  },
];

const appEl = document.querySelector<HTMLDivElement>('#app')!;

appEl.innerHTML = `
  <main>
    <!-- Hero: 100dvh Full Screen with Cinematic Video Background -->
    <section class="hero-section">
      <div class="hero-bg-video-wrap">
        <video autoplay muted loop playsinline poster="/assets/europa-cinema-auditorium-february-2025.jpg" class="hero-bg-video">
          <source src="/assets/countdown-leader-technicolor-corporation.mp4" type="video/mp4" />
        </video>
        <div class="hero-bg-scrim"></div>
      </div>

      <div class="wrap hero-inner">
        <div class="hero-brand" data-rise style="--i: 0;">
          <img src="/assets/cinebox-icon.png" width="36" height="36" alt="CineBox Logo" />
          <span class="hero-brand-name">CineBox</span>
          <span class="hero-brand-ver">v2.0.0</span>
        </div>

        <div class="hero-statement-container">
          <h1 class="hero-headline" data-rise style="--i: 1;">
            STREAM CINEMA<br />UNCHAINED
          </h1>

          <div class="hero-subrow" data-rise style="--i: 2;">
            <div class="hero-lead-box">
              <p class="hero-lead-text">
                Open-source 4K HDR streaming with hardware-accelerated VLC playback on Android, Android TV, and FireStick. No transcoding, zero telemetry, pure cinema.
              </p>
            </div>
            <div class="hero-cta-box">
              <a href="#download" class="button-primary">
                <span>Download Universal APK (65 MB)</span>
              </a>
              <a href="https://github.com/AyushBhagat151105/CineBox" target="_blank" rel="noopener" class="hero-secondary-link">
                Inspect Source on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 1: Intro — Lead line over four columns -->
    <section id="intro" class="intro-section">
      <div class="wrap">
        <p class="intro-lead" data-reveal>
          Built for film purists who refuse to trade visual fidelity for algorithmic convenience. No transcoding artifacts, zero subscription walls, and complete hardware control.
        </p>

        <div class="intro-columns">
          <div class="intro-column" data-reveal>
            <p><strong>Native VLC core.</strong> Dispatches video buffers straight to VLC for Android via OS Intent architecture, unlocking hardware 4K HDR10, DTS-HD 7.1, and Dolby Atmos audio.</p>
          </div>
          <div class="intro-column" data-reveal>
            <p><strong>Dual-mode interface.</strong> A touch-native mobile player that automatically shifts into a 10-foot Leanback experience with remote D-Pad focus when launched on TV.</p>
          </div>
          <div class="intro-column" data-reveal>
            <p><strong>Active preflight probes.</strong> Multi-source scraping across distributed mirrors, GreenMotors 4-step cipher unpacking, and instant range verification before playback.</p>
          </div>
          <div class="intro-column" data-reveal>
            <p><strong>Universal multi-ABI.</strong> Single 65MB APK bundling 32-bit and 64-bit binaries to run smoothly from 1GB FireStick Lite to flagship Android devices.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Archival Cinema Imagery Strip -->
    <section class="photo-strip-section wrap" aria-label="Archival Cinema Collection">
      <div class="photo-strip-grid">
        <figure class="photo-cell" data-reveal>
          <img src="/assets/europa-cinema-auditorium-february-2025.jpg" width="1920" height="1280" alt="Europa Cinema Auditorium grand theatre hall" loading="lazy" />
        </figure>
        <figure class="photo-cell" data-reveal>
          <img src="/assets/neon-sign-of-the-regal-cinema-in.jpg" width="1200" height="1200" alt="Regal cinema neon marquee sign at dusk" loading="lazy" />
        </figure>
        <figure class="photo-cell" data-reveal>
          <img src="/assets/1920-s-bing-home-35mm-projector-3.jpg" width="1024" height="682" alt="Vintage 1920s 35mm film projector mechanical reel" loading="lazy" />
        </figure>
      </div>
    </section>

    <!-- Section 2: Showcase — Headline you can type -->
    <section id="showcase" class="showcase-section wrap">
      <div class="showcase-header" data-reveal>
        <h2 class="showcase-heading">Live Preflight Resolver</h2>
        <p class="showcase-caption">Type any movie title to see CineBox resolve mirrors in real time.</p>
      </div>

      <div class="type-headline-wrap" data-reveal>
        <input
          type="text"
          id="search-input"
          class="type-headline-input"
          value="Dune: Part Two"
          placeholder="Type a movie..."
          data-ui
          aria-label="Search movie title"
        />
      </div>

      <div class="preset-buttons" data-reveal>
        <button class="preset-btn active" data-query="dune">Dune: Part Two</button>
        <button class="preset-btn" data-query="interstellar">Interstellar</button>
        <button class="preset-btn" data-query="oppenheimer">Oppenheimer</button>
      </div>

      <!-- Interface Fragment (data-ui) -->
      <div id="resolver-output" class="stream-resolver-card" data-ui data-reveal>
        <div class="stream-card-header">
          <div class="stream-movie-meta">
            <h3 id="movie-title">Dune: Part Two (2024)</h3>
            <div id="movie-sub" class="stream-movie-sub">IMDb 8.6/10 · Direct CDN Range Validated</div>
          </div>
          <span class="stream-status-badge">ACTIVE MIRRORS: 3</span>
        </div>

        <div id="mirrors-container" class="mirror-list">
          <!-- Mirrors populated dynamically -->
        </div>
      </div>
    </section>

    <!-- Section 3: Features — Fixed Output, Live Controls -->
    <section id="features" class="features-section">
      <div class="wrap features-split">
        <!-- Sticky Simulator Display -->
        <div class="features-sticky-col" data-reveal>
          <div class="tv-stage" data-ui>
            <img src="/assets/8-mm-kodak-safety-film-reel-06.jpg" width="1920" height="1280" alt="Film reel backdrop" class="tv-backdrop-img" loading="lazy" />
            <div class="tv-stage-header">
              <span class="tv-logo-tag">CINEBOX LEANBACK</span>
              <span id="tv-mode-indicator" class="tv-mode-badge">10-FOOT TV MODE</span>
            </div>

            <div class="tv-content-preview">
              <h3 id="tv-preview-title" class="tv-movie-title">Blade Runner 2049</h3>
              <div class="tv-tags-row">
                <span id="tv-audio-badge" class="tv-tag">Dolby Atmos 7.1</span>
                <span class="tv-tag">4K HDR10</span>
                <span class="tv-tag">HEVC 10-Bit</span>
              </div>
              <div class="tv-focus-elements">
                <button class="tv-pill is-focused" data-focus-idx="0">Watch in VLC</button>
                <button class="tv-pill" data-focus-idx="1">4K Stream</button>
                <button class="tv-pill" data-focus-idx="2">1080p Mirror</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Capability Blocks with Live Controls -->
        <div class="features-controls-col">
          <div class="capability-block" data-reveal>
            <h2>Remote D-Pad Focus Traversal</h2>
            <p>Android TV remotes require crisp, instant visual feedback. CineBox enforces 2.5px white glowing borders and 1.12x scale enlargement across all focusable elements.</p>

            <div class="dpad-container" data-ui>
              <button class="dpad-btn" id="dpad-up" aria-label="D-Pad Up">▲</button>
              <div class="dpad-row">
                <button class="dpad-btn" id="dpad-left" aria-label="D-Pad Left">◀</button>
                <button class="dpad-btn" id="dpad-ok" aria-label="D-Pad OK">OK</button>
                <button class="dpad-btn" id="dpad-right" aria-label="D-Pad Right">▶</button>
              </div>
              <button class="dpad-btn" id="dpad-down" aria-label="D-Pad Down">▼</button>
            </div>
          </div>

          <div class="capability-block" data-reveal>
            <h2>Adaptive Viewport Engine</h2>
            <p>Toggle between phone touch navigation and 10-foot television Leanback mode with left sidebar navigation.</p>

            <div class="segmented-choice" data-ui>
              <button class="choice-btn active" id="btn-mode-tv">10-Foot TV Leanback</button>
              <button class="choice-btn" id="btn-mode-mobile">Mobile Handheld Touch</button>
            </div>
          </div>

          <div class="capability-block" data-reveal>
            <h2>Hardware Audio Passthrough</h2>
            <p>Stream directly to your AVR or soundbar with bitstream passthrough for lossless theater audio formats.</p>

            <div class="segmented-choice" data-ui>
              <button class="choice-btn active" data-audio="Dolby Atmos 7.1">Dolby Atmos 7.1</button>
              <button class="choice-btn" data-audio="DTS-HD MA 5.1">DTS-HD MA 5.1</button>
              <button class="choice-btn" data-audio="Hindi Dual Audio">Hindi Dubbed</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: How It Works — One card, four fields -->
    <section id="pipeline" class="pipeline-section wrap">
      <div class="pipeline-header" data-reveal>
        <h2 class="pipeline-heading">The Stream Pipeline</h2>
        <p class="pipeline-caption">Four stages from search query to hardware-accelerated playback.</p>
      </div>

      <div class="pipeline-strip">
        <div class="pipeline-card" data-ui data-reveal>
          <span class="pipeline-step-badge">STAGE 1</span>
          <div class="pipeline-visual-mock">
            <div class="pipeline-mock-line">GET /api/search?q=movie</div>
            <div class="pipeline-mock-line pipeline-mock-highlight">OK: 3 mirrors indexed</div>
          </div>
          <div class="pipeline-clause">
            First, the indexer queries.
            <span>Multi-provider parallel scrape queries MovieBox, 4KHDHub, and HDHub4u mirrors.</span>
          </div>
        </div>

        <div class="pipeline-card" data-ui data-reveal>
          <span class="pipeline-step-badge">STAGE 2</span>
          <div class="pipeline-visual-mock">
            <div class="pipeline-mock-line">GreenMotors cipher</div>
            <div class="pipeline-mock-line pipeline-mock-highlight">OK: AES key extracted</div>
          </div>
          <div class="pipeline-clause">
            Then, the cipher unpacks.
            <span>Automated 4-step AES decryption unpacks hidden redirect manifests and tokens.</span>
          </div>
        </div>

        <div class="pipeline-card" data-ui data-reveal>
          <span class="pipeline-step-badge">STAGE 3</span>
          <div class="pipeline-visual-mock">
            <div class="pipeline-mock-line">HEAD bytes=0-0</div>
            <div class="pipeline-mock-line pipeline-mock-highlight">OK: HTTP 206 Partial OK</div>
          </div>
          <div class="pipeline-clause">
            Next, preflight range probes.
            <span>Active byte-range validation probes verify stream health and discard dead links.</span>
          </div>
        </div>

        <div class="pipeline-card" data-ui data-reveal>
          <span class="pipeline-step-badge">STAGE 4</span>
          <div class="pipeline-visual-mock">
            <div class="pipeline-mock-line">Intent: org.videolan.vlc</div>
            <div class="pipeline-mock-line pipeline-mock-highlight">OK: HW acceleration 4K</div>
          </div>
          <div class="pipeline-clause">
            Finally, native VLC launches.
            <span>Direct OS intent dispatch executes hardware 4K HDR10 playback with zero transcoding.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 5: FAQ — Question index, one large answer -->
    <section id="faq" class="faq-section">
      <div class="wrap faq-layout">
        <div class="faq-index-col" data-reveal>
          <h2 class="faq-section-title">Frequently Asked Questions</h2>
          <div id="faq-index-list">
            <!-- FAQ items rendered dynamically -->
          </div>
        </div>

        <div class="faq-answer-col" data-reveal>
          <div class="faq-sticky-pane">
            <div id="faq-answer-text" class="faq-active-answer">
              Sideload the universal APK via Downloader app or ADB.
            </div>
            <div id="faq-details-text" class="faq-active-details">
              Because CineBox bundles both 32-bit (armeabi-v7a) and 64-bit (arm64-v8a) binaries into a single universal APK under 65MB, it installs natively on Fire TV Stick Lite, 4K Max, and Cube without needing separate architectures.
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 6: CTA — First step, already open -->
    <section id="download" class="cta-section wrap">
      <div class="cta-grid">
        <div class="cta-left-col" data-reveal>
          <h2 class="cta-heading">INSTALL CINEBOX</h2>
          <p class="cta-subtext">Free, open source, and built for both TV and mobile. Choose your preferred build below.</p>
        </div>

        <div class="cta-right-col" data-reveal>
          <div class="cta-console-card" data-ui>
            <div class="cta-downloads-row">
              <div class="cta-download-box">
                <div>
                  <div class="cta-box-title">Universal Release v2.0.0</div>
                  <div class="cta-box-desc">Multi-ABI (32-bit & 64-bit) with in-app OTA updater included. (65 MB)</div>
                </div>
                <a href="https://github.com/AyushBhagat151105/CineBox/releases/download/v2.0.0/CineBox-v2.0.0.apk" class="cta-box-btn">
                  <span>Download Universal APK</span>
                </a>
              </div>

              <div class="cta-download-box">
                <div>
                  <div class="cta-box-title">Android TV & FireStick</div>
                  <div class="cta-box-desc">10-foot Leanback interface with remote D-Pad navigation. (65 MB)</div>
                </div>
                <a href="https://github.com/AyushBhagat151105/CineBox/releases/tag/v2.0.0" class="cta-box-btn">
                  <span>View GitHub Release</span>
                </a>
              </div>
            </div>

            <div class="cta-terminal-snippet">
              <code>adb install CineBox-v2.0.0.apk</code>
              <button id="copy-btn" class="copy-btn">Copy Command</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- Section 7: Footer — Designed tiles -->
  <footer class="site-footer">
    <div class="wrap footer-board">
      <div class="footer-tile tile-wordmark" data-reveal>
        <div class="footer-brand-title">CINEBOX</div>
        <div class="footer-legal-tag">Dual licensed under Apache 2.0 and MIT. Pure open source.</div>
      </div>

      <div class="footer-tile tile-cta" data-reveal>
        <div class="tile-cta-title">CONTRIBUTE ON GITHUB</div>
        <a href="https://github.com/AyushBhagat151105/CineBox" target="_blank" rel="noopener" style="font-weight: 800; text-decoration: underline; margin-top: 1rem;">
          View Repository →
        </a>
      </div>

      <div class="footer-tile tile-nav" data-reveal>
        <div class="credits-title">Resources & Legal</div>
        <ul class="footer-nav-list">
          <li><a href="https://github.com/AyushBhagat151105/CineBox/releases" target="_blank" rel="noopener">Releases & Changelog</a></li>
          <li><a href="https://github.com/AyushBhagat151105/CineBox/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">Contributing Guide</a></li>
          <li><a href="https://github.com/AyushBhagat151105/CineBox/issues" target="_blank" rel="noopener">Report Issue</a></li>
          <li><a href="https://play.google.com/store/apps/details?id=org.videolan.vlc" target="_blank" rel="noopener">Get VLC for Android</a></li>
          <li><a href="/dmca.html">DMCA & Copyright Notice</a></li>
          <li><a href="/legal.html">Non-Hosting Terms</a></li>
          <li><a href="/privacy.html">Privacy Policy</a></li>
        </ul>
      </div>

      <div id="disclaimer" class="footer-tile tile-disclaimer" data-reveal>
        <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div class="credits-title">DMCA & Copyright Non-Hosting Policy</div>
          <div style="font-size: var(--step-small);">
            <a href="/dmca.html" style="color: var(--muted); text-decoration: underline; margin-right: 1rem;">Full DMCA Notice →</a>
            <a href="/legal.html" style="color: var(--muted); text-decoration: underline; margin-right: 1rem;">Legal Terms →</a>
            <a href="/privacy.html" style="color: var(--muted); text-decoration: underline;">Privacy Policy →</a>
          </div>
        </div>
        <p class="credits-text">
          CineBox is an open-source software application engineered strictly as a client-side search crawler and metadata indexing interface. CineBox does not host, upload, store, stream, or broadcast any video files, media content, or copyrighted digital works on any central servers or network infrastructure. All media links and metadata resolved by the software are scraped from publicly available, unaffiliated third-party services on the internet. Playback is handled exclusively via third-party media players (such as VideoLAN VLC) through direct client-to-CDN connections. CineBox neither condones nor promotes unauthorized distribution of copyrighted material. All DMCA inquiries or content removal requests must be addressed directly to the third-party web hosts and servers originating the content.
        </p>
      </div>
    </div>
  </footer>
`;

// Ensure video plays
document.querySelectorAll('video').forEach(v => {
  v.play().catch(() => {});
});

// Scroll-linked Entrance Animations via IntersectionObserver
const revealElements = document.querySelectorAll<HTMLElement>('[data-reveal]');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px 50px 0px' });

  revealElements.forEach(el => observer.observe(el));
} else {
  revealElements.forEach(el => el.classList.add('is-in'));
}

// ---------- Interactive Search Resolver Simulator ----------
const searchInput = document.querySelector<HTMLInputElement>('#search-input')!;
const movieTitleEl = document.querySelector<HTMLElement>('#movie-title')!;
const movieSubEl = document.querySelector<HTMLElement>('#movie-sub')!;
const mirrorsContainer = document.querySelector<HTMLElement>('#mirrors-container')!;
const presetButtons = document.querySelectorAll<HTMLButtonElement>('.preset-btn');

function updateSearch(query: string) {
  const cleanQuery = query.toLowerCase().trim();
  let found = MOVIES['dune'];
  if (cleanQuery.includes('interstellar')) found = MOVIES['interstellar'];
  if (cleanQuery.includes('oppenheimer')) found = MOVIES['oppenheimer'];

  movieTitleEl.textContent = `${found.title} (${found.year})`;
  movieSubEl.textContent = `IMDb ${found.rating} · Direct CDN Range Validated`;

  mirrorsContainer.innerHTML = found.mirrors.map(m => `
    <div class="mirror-row">
      <div class="mirror-info">
        <span class="quality-tag">${m.quality}</span>
        <div>
          <div class="mirror-name">${m.name}</div>
          <div class="mirror-specs">${m.specs}</div>
        </div>
      </div>
      <div class="mirror-actions">
        <span class="mirror-ping-text">${m.ping}</span>
        <button class="mirror-action-btn" onclick="alert('Stream Intent verified! Directing to VLC.')">Launch in VLC</button>
      </div>
    </div>
  `).join('');
}

updateSearch('dune');

searchInput.addEventListener('input', (e) => {
  updateSearch((e.target as HTMLInputElement).value);
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const q = btn.getAttribute('data-query') || 'dune';
    searchInput.value = btn.textContent || '';
    updateSearch(q);
  });
});

// ---------- D-Pad Remote Simulation ----------
let currentFocusIdx = 0;
const focusablePills = document.querySelectorAll<HTMLButtonElement>('.tv-pill');

function setFocus(idx: number) {
  focusablePills.forEach(p => p.classList.remove('is-focused'));
  currentFocusIdx = (idx + focusablePills.length) % focusablePills.length;
  focusablePills[currentFocusIdx].classList.add('is-focused');
}

document.querySelector('#dpad-left')?.addEventListener('click', () => setFocus(currentFocusIdx - 1));
document.querySelector('#dpad-right')?.addEventListener('click', () => setFocus(currentFocusIdx + 1));
document.querySelector('#dpad-up')?.addEventListener('click', () => setFocus(currentFocusIdx - 1));
document.querySelector('#dpad-down')?.addEventListener('click', () => setFocus(currentFocusIdx + 1));
document.querySelector('#dpad-ok')?.addEventListener('click', () => {
  alert(`Activated: ${focusablePills[currentFocusIdx].textContent}`);
});

// Arrow Key Navigation Listener for D-Pad
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
    setFocus(currentFocusIdx - 1);
  } else if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
    setFocus(currentFocusIdx + 1);
  }
});

// Mode Toggle
const btnModeTv = document.querySelector<HTMLButtonElement>('#btn-mode-tv')!;
const btnModeMobile = document.querySelector<HTMLButtonElement>('#btn-mode-mobile')!;
const tvModeIndicator = document.querySelector<HTMLElement>('#tv-mode-indicator')!;

btnModeTv.addEventListener('click', () => {
  btnModeTv.classList.add('active');
  btnModeMobile.classList.remove('active');
  tvModeIndicator.textContent = '10-FOOT TV MODE';
});

btnModeMobile.addEventListener('click', () => {
  btnModeMobile.classList.add('active');
  btnModeTv.classList.remove('active');
  tvModeIndicator.textContent = 'MOBILE TOUCH MODE';
});

// Audio Track Choice
const audioButtons = document.querySelectorAll<HTMLButtonElement>('[data-audio]');
const tvAudioBadge = document.querySelector<HTMLElement>('#tv-audio-badge')!;

audioButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    audioButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tvAudioBadge.textContent = btn.getAttribute('data-audio') || 'Dolby Atmos 7.1';
  });
});

// ---------- FAQ Interactive Index ----------
const faqListContainer = document.querySelector<HTMLElement>('#faq-index-list')!;
const faqAnswerText = document.querySelector<HTMLElement>('#faq-answer-text')!;
const faqDetailsText = document.querySelector<HTMLElement>('#faq-details-text')!;

faqListContainer.innerHTML = FAQS.map((faq, i) => `
  <button class="faq-item-button ${i === 0 ? 'active' : ''}" data-faq-idx="${i}">
    <span class="faq-dot"></span>
    <span class="faq-button-text">${faq.question}</span>
  </button>
`).join('');

const faqButtons = document.querySelectorAll<HTMLButtonElement>('.faq-item-button');
faqButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    faqButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const idx = parseInt(btn.getAttribute('data-faq-idx') || '0', 10);
    const item = FAQS[idx];
    faqAnswerText.textContent = item.shortAnswer;
    faqDetailsText.textContent = item.details;
  });
});

// Copy Terminal Command & Dynamic GitHub Releases Sync
let latestAdbCommand = 'adb install CineBox-v2.0.0.apk';

const copyBtn = document.querySelector<HTMLButtonElement>('#copy-btn')!;
copyBtn.addEventListener('click', () => {
  function showCopied() {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Command'; }, 2000);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(latestAdbCommand)
      .then(() => showCopied())
      .catch(() => {
        fallbackCopy();
      });
  } else {
    fallbackCopy();
  }
  function fallbackCopy() {
    const el = document.createElement('textarea');
    el.value = latestAdbCommand;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(el);
    showCopied();
  }
});

// Automatically sync latest release info from GitHub API
async function syncLatestRelease() {
  try {
    const res = await fetch('https://api.github.com/repos/AyushBhagat151105/CineBox/releases/latest');
    if (!res.ok) return;
    const data = await res.json();
    const tag = data.tag_name || 'v2.0.0';
    const apkAsset = data.assets?.find((a: any) => a.name?.endsWith('.apk'));
    const apkUrl = apkAsset?.browser_download_url || `https://github.com/AyushBhagat151105/CineBox/releases/download/${tag}/CineBox-${tag}.apk`;
    const apkName = apkAsset?.name || `CineBox-${tag}.apk`;
    const releaseUrl = data.html_url || `https://github.com/AyushBhagat151105/CineBox/releases/tag/${tag}`;
    const sizeMb = apkAsset?.size ? `${Math.round(apkAsset.size / (1024 * 1024))} MB` : '65 MB';

    // 1. Update Hero version badge & download button
    const verBadge = document.querySelector<HTMLElement>('.hero-brand-ver');
    if (verBadge) verBadge.textContent = tag;

    const heroBtnSpan = document.querySelector<HTMLElement>('.hero-cta-box .button-primary span');
    if (heroBtnSpan) heroBtnSpan.textContent = `Download Universal APK (${sizeMb})`;

    // 2. Update CTA boxes
    const ctaTitle = document.querySelector<HTMLElement>('.cta-box-title');
    if (ctaTitle) ctaTitle.textContent = `Universal Release ${tag}`;

    const ctaApkBtn = document.querySelector<HTMLAnchorElement>('a.cta-box-btn[href*=".apk"]');
    if (ctaApkBtn) ctaApkBtn.href = apkUrl;

    const ctaTagBtn = document.querySelector<HTMLAnchorElement>('a.cta-box-btn[href*="/releases/tag/"]');
    if (ctaTagBtn) ctaTagBtn.href = releaseUrl;

    // 3. Update ADB Command Snippet
    latestAdbCommand = `adb install ${apkName}`;
    const codeSnippet = document.querySelector<HTMLElement>('.cta-terminal-snippet code');
    if (codeSnippet) codeSnippet.textContent = latestAdbCommand;
  } catch (err) {
    console.debug('[CineBox Web] GitHub releases sync fallback:', err);
  }
}

syncLatestRelease();
