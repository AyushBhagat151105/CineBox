import axios from 'axios';
import { parse } from 'node-html-parser';
import { decodeBase64 } from '../../utils/base64';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ROT13 cipher decryption (matching hubcloud.rs)
function rot13(str: string): string {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

// Unpacks obfuscated GreenMotors/TechnicalNow wrappers into plain HubCloud URLs
export function unpackGreenMotors(html: string): string | null {
  const needle = "s('o',";
  const altNeedle = 's("o",';

  let payload: string | null = null;
  const idx = html.indexOf(needle);
  const altIdx = html.indexOf(altNeedle);

  const startPos = idx !== -1 ? idx + needle.length : (altIdx !== -1 ? altIdx + altNeedle.length : -1);
  if (startPos !== -1) {
    const slice = html.slice(startPos).trim();
    const quote = slice[0];
    if (quote === "'" || quote === '"') {
      const end = slice.indexOf(quote, 1);
      if (end !== -1) {
        payload = slice.slice(1, end);
      }
    }
  }

  if (!payload) {
    const regex = /s\(\s*['"]o['"]\s*,\s*['"]([^'"]+)['"]\s*\)/;
    const match = html.match(regex);
    if (match) payload = match[1];
  }

  if (!payload) return null;

  try {
    const rotated = rot13(payload);
    const decoded = decodeBase64(rotated);
    return decoded.startsWith('http') ? decoded : null;
  } catch {
    return null;
  }
}

export async function resolveHubCloudStream(
  hubcloudUrl: string
): Promise<{ url: string; label: string; headers?: Record<string, string> }> {
  const client = axios.create({
    headers: {
      'User-Agent': BROWSER_UA,
      Referer: 'https://hubcloud.club/',
    },
    timeout: 9000,
  });

  // Step 1: Request the HubCloud drive link
  const step1Res = await client.get(hubcloudUrl);
  const root1 = parse(step1Res.data);

  // Find the download button redirect link
  let redirectUrl = root1.querySelector(
    'a#download, a.btn-primary, a.btn-success, a.btn[href*="/download/"], a[href*="/download/"], a[href*="gamerxyt.com"], a[href*="hubcloud.php"]'
  )?.getAttribute('href');

  if (!redirectUrl) {
    // Check if step 1 itself contains pixeldrain direct link
    const directMatch = step1Res.data.match(/https?:\/\/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/);
    if (directMatch) {
      return {
        url: `https://pixeldrain.com/api/file/${directMatch[1]}`,
        label: 'PixelDrain Direct',
      };
    }
    throw new Error('HubCloud step 1 redirect not found');
  }

  if (!redirectUrl.startsWith('http')) {
    const base = new URL(hubcloudUrl);
    redirectUrl = new URL(redirectUrl, base.origin).toString();
  }

  // Step 2: Request the final resolver page
  const step2Res = await client.get(redirectUrl);
  const root2 = parse(step2Res.data);

  // Look for PixelDrain link (Fastest, seekable stream host)
  const pixelDrainMatch = step2Res.data.match(/https?:\/\/pixeldrain\.com\/(?:u|api\/file)\/([a-zA-Z0-9]+)/);
  if (pixelDrainMatch) {
    return {
      url: `https://pixeldrain.com/api/file/${pixelDrainMatch[1]}`,
      label: 'PixelDrain Fast Stream',
    };
  }

  // Look for Direct Fast Server mirrors
  const allLinks = root2.querySelectorAll('a');
  for (const a of allLinks) {
    const text = a.text;
    const href = a.getAttribute('href');
    if (!href) continue;

    if (
      text.includes('Fast Cloud') ||
      text.includes('Direct Download') ||
      text.includes('FDM') ||
      href.includes('drive.google') ||
      href.includes('cf.workers')
    ) {
      return {
        url: href,
        label: 'Direct Fast Server',
      };
    }
  }

  // Fallback to any valid download link on step 2
  for (const a of allLinks) {
    const href = a.getAttribute('href');
    if (href && href.startsWith('http') && a.classList.contains('btn')) {
      return {
        url: href,
        label: 'Fast Cloud Mirror',
      };
    }
  }

  throw new Error('No playable stream mirrors found on HubCloud');
}

export async function resolveShortenerUrl(
  shortenerUrl: string
): Promise<{ url: string; label: string }> {
  let targetUrl = shortenerUrl;

  if (
    shortenerUrl.includes('greenmotors') ||
    shortenerUrl.includes('greenmountmotors') ||
    shortenerUrl.includes('technical-now')
  ) {
    const res = await axios.get(shortenerUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      timeout: 7000,
    });
    const unpacked = unpackGreenMotors(res.data);
    if (unpacked) {
      targetUrl = unpacked;
    }
  }

  if (targetUrl.includes('hubcloud') || targetUrl.includes('hubdrive')) {
    return resolveHubCloudStream(targetUrl);
  }

  if (targetUrl.includes('pixeldrain.com')) {
    const id = targetUrl.split('/').pop()?.split('?')[0];
    if (id) {
      return {
        url: `https://pixeldrain.com/api/file/${id}`,
        label: 'PixelDrain',
      };
    }
  }

  return {
    url: targetUrl,
    label: 'Direct Link',
  };
}
