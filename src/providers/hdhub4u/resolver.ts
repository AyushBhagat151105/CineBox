import axios from 'axios';
import { parse } from 'node-html-parser';
import { decodeBase64 } from '../../utils/base64';
import { sanitizeStreamUrl } from '../../utils/url';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ROT13 cipher decryption (matching hubcloud.rs in MovieBox-Tui)
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

// 4-step GreenMotors payload decoder (base64 -> base64 -> rot13 -> base64 -> JSON -> base64(o))
export function decodeGreenmotorsPayload(payload: string): string | null {
  try {
    const s1 = decodeBase64(payload);
    const s2 = decodeBase64(s1);
    const s3 = rot13(s2);
    const s4 = decodeBase64(s3);
    const json = JSON.parse(s4);
    if (json && json.o) {
      const target = decodeBase64(json.o);
      return target.startsWith('http') ? target : null;
    }
    return null;
  } catch {
    return null;
  }
}

// Extracts the obfuscated argument from s('o', '<payload>')
export function extractGreenmotorsPayload(html: string): string | null {
  const needle = "s('o',";
  const altNeedle = 's("o",';

  let idx = html.indexOf(needle);
  let needleLen = needle.length;
  if (idx === -1) {
    idx = html.indexOf(altNeedle);
    needleLen = altNeedle.length;
  }
  if (idx === -1) {
    const regex = /s\(\s*['"]o['"]\s*,\s*['"]([^'"]+)['"]\s*\)/;
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  const startPos = idx + needleLen;
  const slice = html.slice(startPos).trim();
  const quote = slice[0];
  if (quote === "'" || quote === '"') {
    const end = slice.indexOf(quote, 1);
    if (end !== -1) {
      return slice.slice(1, end);
    }
  }

  return null;
}

export async function resolveHubCloudStream(
  hubcloudUrl: string
): Promise<{ url: string; label: string; headers?: Record<string, string> }> {
  console.log(`[HubCloud] 🌐 Step 1: Requesting HubCloud drive link: ${hubcloudUrl}`);

  const client = axios.create({
    headers: {
      'User-Agent': BROWSER_UA,
    },
    timeout: 10000,
  });

  // Step 1: Request the HubCloud drive link
  const step1Res = await client.get(hubcloudUrl);
  const root1 = parse(step1Res.data);

  // Find the download button redirect link
  let redirectUrl = root1.querySelector(
    'a#download, a.btn-primary, a.btn-success, a.btn[href*="/download/"], a[href*="gamerxyt.com"], a[href*="hubcloud.php"]'
  )?.getAttribute('href');

  if (!redirectUrl) {
    // Check if step 1 itself contains pixeldrain direct link
    const directMatch = step1Res.data.match(/https?:\/\/pixeldrain\.(?:com|dev)\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/);
    if (directMatch) {
      console.log(`[HubCloud] 🎯 Step 1 direct match: PixelDrain link found: ${directMatch[0]}`);
      return {
        url: `https://pixeldrain.dev/api/file/${directMatch[1]}?download`,
        label: 'PixelDrain Direct',
      };
    }
    console.warn(`[HubCloud] ❌ Step 1 failed: Download redirect link missing on ${hubcloudUrl}`);
    throw new Error('HubCloud redirect link missing');
  }

  if (!redirectUrl.startsWith('http')) {
    const base = new URL(hubcloudUrl);
    redirectUrl = new URL(redirectUrl, base.origin).toString();
  }

  console.log(`[HubCloud] 🔘 Step 1 redirect button link resolved: ${redirectUrl}`);

  // Step 2: Request the final resolver page (e.g. gamerxyt.com/hubcloud.php)
  console.log(`[HubCloud] 🌐 Step 2: Fetching final stream resolver page: ${redirectUrl}`);
  const step2Res = await client.get(redirectUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
    },
  });
  const root2 = parse(step2Res.data);
  const allLinks = root2.querySelectorAll('a');
  console.log(`[HubCloud] 🔎 Step 2: Found ${allLinks.length} total anchor links to scan for stream candidates`);

  // Priority 1: Direct media file (.mkv, .mp4, .webm) or Cloudflare Worker stream
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (
      href.startsWith('http') &&
      (href.includes('workers.dev') || href.includes('.mkv') || href.includes('.mp4') || href.includes('.webm')) &&
      !href.includes('google-index.workers.dev')
    ) {
      const cleanUrl = sanitizeStreamUrl(href);
      const label = a.text.trim() || 'Direct Video Stream';
      console.log(`[HubCloud] 🎯 Priority 1 MATCH! Cloudflare Worker / Direct Media Stream: ${cleanUrl} [${label}]`);
      return {
        url: cleanUrl,
        label,
      };
    }
  }

  // Priority 2: Unpack hbplay.pages.dev/?u=<base64> (Direct Cloudflare R2 Stream)
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (href.includes('pages.dev') && href.includes('?u=')) {
      try {
        const uParam = new URL(href).searchParams.get('u');
        if (uParam) {
          const decoded = decodeBase64(uParam);
          if (decoded.startsWith('http')) {
            const cleanUrl = sanitizeStreamUrl(decoded);
            console.log(`[HubCloud] 🎯 Priority 2 MATCH! Unpacked Cloudflare R2 stream: ${cleanUrl}`);
            return {
              url: cleanUrl,
              label: 'Cloudflare Fast Stream',
            };
          }
        }
      } catch {}
    }
  }

  // Priority 3: Direct Cloudflare R2 / S3 storage link (.mkv / .mp4 presigned URL)
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (href.includes('cloudflarestorage.com') || href.includes('.r2.dev')) {
      const cleanUrl = sanitizeStreamUrl(href);
      console.log(`[HubCloud] 🎯 Priority 3 MATCH! Direct Cloudflare R2 Storage URL: ${cleanUrl}`);
      return {
        url: cleanUrl,
        label: 'Cloudflare Fast Stream',
      };
    }
  }

  // Priority 4: 10Gbps Server / Pixel HubCloud / FSL Server
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    const text = a.text.toLowerCase();
    if (
      (href.includes('pixel.hubcloud.') ||
      text.includes('10gbps') ||
      text.includes('fsl server') ||
      text.includes('watch online')) &&
      !href.includes('hubcloud.ist/tg/')
    ) {
      console.log(`[HubCloud] 🔄 Priority 4: Probing 10Gbps Server link: ${href}`);
      try {
        const destRes = await client.get(href, {
          maxRedirects: 5,
          timeout: 4000,
        });
        const finalUrl = destRes.request?.res?.responseUrl || destRes.config?.url || '';
        // Check if final URL has ?link=https://...
        const linkMatch = finalUrl.match(/[?&]link=(https?:\/\/[^&]+)/);
        if (linkMatch) {
          const directUrl = sanitizeStreamUrl(decodeURIComponent(linkMatch[1]));
          console.log(`[HubCloud] 🎯 Priority 4 MATCH! Unwrapped direct CDN link from redirect: ${directUrl}`);
          return {
            url: directUrl,
            label: '10Gbps Fast Stream',
          };
        }
        if (
          finalUrl.includes('googleusercontent.com') ||
          finalUrl.includes('cloudflarestorage.com') ||
          finalUrl.includes('.mkv') ||
          finalUrl.includes('.mp4')
        ) {
          const cleanFinal = sanitizeStreamUrl(finalUrl);
          console.log(`[HubCloud] 🎯 Priority 4 MATCH! Final destination CDN URL: ${cleanFinal}`);
          return {
            url: cleanFinal,
            label: '10Gbps Fast Stream',
          };
        }
      } catch (e: any) {
        console.warn(`[HubCloud] ⚠️ Priority 4 probe failed on ${href}: ${e.message}`);
      }
    }
  }

  // Priority 5: PixelDrain API Direct Stream (with expiration check & anti-scraper script extraction)
  const pixelIdMatches = new Set<string>();

  // 5a. Match from all a tags
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    const m = href.match(/pixeldrain\.(?:com|dev)\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/);
    if (m) pixelIdMatches.add(m[1]);
  }

  // 5b. Match from <script> tags or raw HTML (e.g. var pxl = "https://pixeldrain.dev/u/ENbe9c4d")
  const scriptRegex = /https?:\/\/pixeldrain\.(?:com|dev)\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/g;
  let scriptMatch;
  while ((scriptMatch = scriptRegex.exec(step2Res.data)) !== null) {
    pixelIdMatches.add(scriptMatch[1]);
  }

  console.log(`[HubCloud] 🔎 Priority 5: Found ${pixelIdMatches.size} PixelDrain candidate IDs:`, Array.from(pixelIdMatches));

  for (const fileId of pixelIdMatches) {
    console.log(`[HubCloud] 🔎 Priority 5: Testing PixelDrain file availability for ID: ${fileId}`);
    // Try pixeldrain.dev first then pixeldrain.com
    const hosts = ['https://pixeldrain.dev', 'https://pixeldrain.com'];
    for (const host of hosts) {
      try {
        const probe = await axios.get(`${host}/api/file/${fileId}/info`, {
          timeout: 4000,
          validateStatus: (s) => s === 200,
        });
        if (probe.status === 200 && probe.data?.success !== false) {
          const directUrl = `${host}/api/file/${fileId}?download`;
          console.log(`[HubCloud] 🎯 Priority 5 MATCH! PixelDrain file verified active: ${directUrl}`);
          return {
            url: directUrl,
            label: 'PixelDrain Fast Stream',
          };
        }
      } catch {}
    }
    console.warn(`[HubCloud] ⚠️ Priority 5: PixelDrain file ${fileId} expired (404), skipping...`);
  }

  console.warn(`[HubCloud] ❌ All 5 priority stream matchers failed on ${redirectUrl}`);
  throw new Error('No playable stream mirrors found on HubCloud');
}

export async function resolveShortenerUrl(
  shortenerUrl: string
): Promise<{ url: string; label: string }> {
  console.log(`[Resolver] 🔗 Resolving shortener / mirror URL: ${shortenerUrl}`);
  let targetUrl = shortenerUrl;

  // 1. Unpack GreenMotors / GreenMountMotors / TechnicalNow wrappers (with resilient ISP fallback)
  if (
    targetUrl.includes('greenmotors.') ||
    targetUrl.includes('greenmountmotors.') ||
    targetUrl.includes('technical-now.')
  ) {
    const domainsToTry = [targetUrl];
    if (targetUrl.includes('greenmotors.club')) {
      domainsToTry.push(targetUrl.replace('greenmotors.club', 'greenmotors.cc'));
    } else if (targetUrl.includes('greenmotors.cc')) {
      domainsToTry.push(targetUrl.replace('greenmotors.cc', 'greenmotors.club'));
    }

    console.log(`[Resolver] 🧩 Detected GreenMotors wrapper. Candidate domains to try:`, domainsToTry);

    let unpackedUrl: string | null = null;
    for (const urlToFetch of domainsToTry) {
      try {
        console.log(`[Resolver] 📥 Requesting GreenMotors page: ${urlToFetch}`);
        const res = await axios.get(urlToFetch, {
          headers: { 'User-Agent': BROWSER_UA },
          timeout: 8000,
        });
        const payload = extractGreenmotorsPayload(res.data);
        if (payload) {
          unpackedUrl = decodeGreenmotorsPayload(payload);
          if (unpackedUrl) {
            console.log(`[Resolver] 🔓 GreenMotors successfully unpacked to: ${unpackedUrl}`);
            targetUrl = unpackedUrl;
            break;
          }
        }
      } catch (err: any) {
        console.warn(`[Resolver] ⚠️ GreenMotors attempt on ${urlToFetch} failed:`, err?.message);
      }
    }

    if (!unpackedUrl) {
      console.error(`[Resolver] ❌ Failed to unpack GreenMotors shortener: ${targetUrl}`);
      throw new Error(`Failed to unpack GreenMotors shortener: ${targetUrl}`);
    }
  }

  // 2. Unpack HBLinks Archives (e.g. https://hblinks.lol/archives/12345)
  if (targetUrl.includes('hblinks.') || (targetUrl.includes('/archives/') && !targetUrl.includes('hdhub4u'))) {
    console.log(`[Resolver] 📦 Unpacking HBLinks archive page: ${targetUrl}`);
    try {
      const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 15000,
      });
      const root = parse(res.data);
      const hubLink = root.querySelectorAll('a').find((a) => {
        const h = a.getAttribute('href') || '';
        return (h.includes('hubcloud.') || h.includes('hubdrive.')) && (h.includes('/drive/') || h.includes('/file/'));
      })?.getAttribute('href');

      if (hubLink) {
        console.log(`[Resolver] 🔓 HBLinks archive unpacked to: ${hubLink}`);
        targetUrl = hubLink;
      }
    } catch (err) {
      console.warn('[Resolver] ⚠️ HBLinks unpack failed:', err);
    }
  }

  // 3. Resolve HubDrive (extracts inner HubCloud drive link)
  if (targetUrl.includes('hubdrive.')) {
    console.log(`[Resolver] 🚗 Extracting inner HubCloud drive link from HubDrive: ${targetUrl}`);
    try {
      const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 10000,
      });

      // Reject dead files and 404 pages on HubDrive
      if (res.data.includes('File not found') || res.data.includes('cannot be found')) {
        console.warn(`[Resolver] ❌ HubDrive reports "File not found": ${targetUrl}`);
        throw new Error('HubDrive file dead (404)');
      }

      const root = parse(res.data);
      let hcLink = root.querySelectorAll('a').find((a) => {
        const h = a.getAttribute('href') || '';
        return (h.includes('hubcloud.') || h.includes('/drive/')) && !h.includes('logout');
      })?.getAttribute('href');

      if (hcLink) {
        if (!hcLink.startsWith('http')) {
          const base = new URL(targetUrl);
          hcLink = new URL(hcLink, base.origin).toString();
        }
        console.log(`[Resolver] 🔓 HubDrive unpacked to HubCloud: ${hcLink}`);
        targetUrl = hcLink;
      } else {
        console.warn(`[Resolver] ❌ HubDrive page did not contain a valid HubCloud link: ${targetUrl}`);
        throw new Error('HubDrive inner HubCloud link not found');
      }
    } catch (err: any) {
      console.warn('[Resolver] ⚠️ HubDrive resolve failed:', err?.message);
      throw err;
    }
  }

  // 4. Resolve HubCloud drive stream
  if (targetUrl.includes('hubcloud.')) {
    console.log(`[Resolver] 🎯 Handing HubCloud drive URL to HubCloud resolver: ${targetUrl}`);
    return resolveHubCloudStream(targetUrl);
  }

  // 5. Direct PixelDrain resolution
  if (targetUrl.includes('pixeldrain.')) {
    const id = targetUrl.split('/').pop()?.split('?')[0];
    if (id) {
      console.log(`[Resolver] 🎯 Direct PixelDrain URL detected for ID: ${id}`);
      return {
        url: `https://pixeldrain.dev/api/file/${id}?download`,
        label: 'PixelDrain Direct',
      };
    }
  }

  // Guard: NEVER return raw shorteners, hubdrive pages, or redirectors as direct video streams
  if (
    targetUrl.includes('hubdrive.') ||
    targetUrl.includes('greenmotors.') ||
    targetUrl.includes('greenmountmotors.') ||
    targetUrl.includes('cryptonewz.') ||
    targetUrl.includes('technical-now.') ||
    targetUrl.includes('/drive/') ||
    targetUrl.includes('/file/')
  ) {
    console.error(`[Resolver] ❌ Intermediate webpage URL cannot be streamed directly: ${targetUrl}`);
    throw new Error(`Intermediate webpage URL cannot be streamed directly: ${targetUrl}`);
  }

  const cleanUrl = sanitizeStreamUrl(targetUrl);
  console.log(`[Resolver] 🎯 Handing direct URL: ${cleanUrl}`);
  return {
    url: cleanUrl,
    label: 'Direct Link',
  };
}
