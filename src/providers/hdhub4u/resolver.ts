import axios from 'axios';
import { parse } from 'node-html-parser';
import { decodeBase64 } from '../../utils/base64';

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
  const client = axios.create({
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://hubcloud.club/',
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
      return {
        url: `https://pixeldrain.com/api/file/${directMatch[1]}?download`,
        label: 'PixelDrain Direct',
      };
    }
    throw new Error('HubCloud redirect link missing');
  }

  if (!redirectUrl.startsWith('http')) {
    const base = new URL(hubcloudUrl);
    redirectUrl = new URL(redirectUrl, base.origin).toString();
  }

  // Step 2: Request the final resolver page (e.g. gamerxyt.com/hubcloud.php)
  const step2Res = await client.get(redirectUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: hubcloudUrl,
    },
  });
  const root2 = parse(step2Res.data);
  const allLinks = root2.querySelectorAll('a');

  // Priority 1: Unpack hbplay.pages.dev/?u=<base64> (Direct Cloudflare R2 Stream)
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (href.includes('pages.dev') && href.includes('?u=')) {
      try {
        const uParam = new URL(href).searchParams.get('u');
        if (uParam) {
          const decoded = decodeBase64(uParam);
          if (decoded.startsWith('http')) {
            return {
              url: decoded,
              label: 'Cloudflare Fast Stream',
            };
          }
        }
      } catch {}
    }
  }

  // Priority 2: Direct Cloudflare R2 / S3 storage link (.mkv / .mp4 presigned URL)
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (href.includes('cloudflarestorage.com') || href.includes('.r2.dev')) {
      return {
        url: href,
        label: 'Cloudflare Fast Stream',
      };
    }
  }

  // Priority 3: PixelDrain API Direct Stream
  const pixelMatch = step2Res.data.match(/https?:\/\/pixeldrain\.(?:com|dev)\/(?:u|api\/file)\/([a-zA-Z0-9_-]+)/);
  if (pixelMatch) {
    return {
      url: `https://pixeldrain.com/api/file/${pixelMatch[1]}?download`,
      label: 'PixelDrain Stream',
    };
  }

  // Priority 4: Look for any direct media file (.mkv, .mp4, .webm)
  for (const a of allLinks) {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('http') && (href.includes('.mkv') || href.includes('.mp4') || href.includes('.webm'))) {
      return {
        url: href,
        label: a.text.trim() || 'Direct Video Stream',
      };
    }
  }

  throw new Error('No playable stream mirrors found on HubCloud');
}

export async function resolveShortenerUrl(
  shortenerUrl: string
): Promise<{ url: string; label: string }> {
  let targetUrl = shortenerUrl;

  // 1. Unpack GreenMotors / GreenMountMotors / TechnicalNow wrappers
  if (
    targetUrl.includes('greenmotors.') ||
    targetUrl.includes('greenmountmotors.') ||
    targetUrl.includes('technical-now.')
  ) {
    try {
      const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 8000,
      });
      const payload = extractGreenmotorsPayload(res.data);
      if (payload) {
        const unpacked = decodeGreenmotorsPayload(payload);
        if (unpacked) {
          targetUrl = unpacked;
        }
      }
    } catch (err) {
      console.warn('GreenMotors unpack failed:', err);
    }
  }

  // 2. Unpack HBLinks Archives (e.g. https://hblinks.lol/archives/12345)
  if (targetUrl.includes('hblinks.') || (targetUrl.includes('/archives/') && !targetUrl.includes('hdhub4u'))) {
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
        targetUrl = hubLink;
      }
    } catch (err) {
      console.warn('HBLinks unpack failed:', err);
    }
  }

  // 3. Resolve HubDrive (extracts inner HubCloud drive link)
  if (targetUrl.includes('hubdrive.')) {
    try {
      const res = await axios.get(targetUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        timeout: 15000,
      });
      const root = parse(res.data);
      const hcLink = root.querySelectorAll('a').find((a) => {
        const h = a.getAttribute('href') || '';
        return h.includes('hubcloud.') && h.includes('/drive/');
      })?.getAttribute('href');

      if (hcLink) {
        targetUrl = hcLink;
      }
    } catch (err) {
      console.warn('HubDrive unpack failed:', err);
    }
  }

  // 4. Resolve HubCloud drive stream
  if (targetUrl.includes('hubcloud.')) {
    return resolveHubCloudStream(targetUrl);
  }

  // 5. Direct PixelDrain resolution
  if (targetUrl.includes('pixeldrain.')) {
    const id = targetUrl.split('/').pop()?.split('?')[0];
    if (id) {
      return {
        url: `https://pixeldrain.com/api/file/${id}?download`,
        label: 'PixelDrain Direct',
      };
    }
  }

  return {
    url: targetUrl,
    label: 'Direct Link',
  };
}
