import CryptoJS from 'crypto-js';

const SECRET_HEX = 'efa891974eecd3148df63aa611602defd101259ba521022c57ae0566bd8e';
const SECRET_WORD_ARRAY = CryptoJS.enc.Hex.parse(SECRET_HEX);

const USER_AGENT =
  'com.community.oneroom/50020120 (Linux; U; Android 13; en_US; 23078RKD5C; Build/TQ2A.230405.003; Cronet/135.0.7012.3)';

const CLIENT_INFO = JSON.stringify({
  package_name: 'com.community.oneroom',
  version_name: '4.0.01.0813.03',
  version_code: 50020120,
  os: 'android',
  os_version: '13',
  install_ch: 'ps',
  device_id: '8a9b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
  install_store: 'ps',
  gaid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  brand: 'Redmi',
  model: '23078RKD5C',
  system_language: 'en',
  net: 'NETWORK_WIFI',
  region: 'US',
  timezone: 'America/New_York',
  sp_code: '40401',
  'X-Play-Mode': '2',
});

export function generateXClientToken(ts: number): string {
  const tsStr = ts.toString();
  const reversedTs = tsStr.split('').reverse().join('');
  const hashVal = CryptoJS.MD5(reversedTs).toString(CryptoJS.enc.Hex);
  return `${tsStr},${hashVal}`;
}

export function buildCanonicalString(
  method: string,
  accept: string,
  contentType: string,
  urlStr: string,
  body: string | undefined,
  timestampMs: number
): string {
  let canonicalUrl = urlStr;
  try {
    const parsed = new URL(urlStr);
    const searchParams = Array.from(parsed.searchParams.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const sortedQuery = searchParams.map(([k, v]) => `${k}=${v}`).join('&');
    canonicalUrl = sortedQuery ? `${parsed.pathname}?${sortedQuery}` : parsed.pathname;
  } catch {
    // fallback
  }

  let bodyLength = '';
  let bodyHash = '';
  if (body) {
    bodyLength = body.length.toString();
    bodyHash = CryptoJS.MD5(body.slice(0, 102400)).toString(CryptoJS.enc.Hex);
  }

  return `${method.toUpperCase()}\n${accept}\n${contentType}\n${bodyLength}\n${timestampMs}\n${bodyHash}\n${canonicalUrl}`;
}

export function generateXTrSignature(
  method: string,
  accept: string,
  contentType: string,
  urlStr: string,
  body: string | undefined,
  timestampMs: number
): string {
  const canonical = buildCanonicalString(method, accept, contentType, urlStr, body, timestampMs);
  const hmac = CryptoJS.HmacMD5(canonical, SECRET_WORD_ARRAY);
  const sigB64 = CryptoJS.enc.Base64.stringify(hmac);
  return `${timestampMs}|2|${sigB64}`;
}

export function buildSignedHeaders(
  method: string,
  urlStr: string,
  body?: string,
  authToken?: string
): Record<string, string> {
  const ts = Date.now();
  const accept = 'application/json';
  const contentType = 'application/json';

  const clientToken = generateXClientToken(ts);
  const signature = generateXTrSignature(method, accept, contentType, urlStr, body, ts);

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: accept,
    'Content-Type': contentType,
    'x-client-token': clientToken,
    'x-tr-signature': signature,
    'x-client-info': CLIENT_INFO,
    'x-client-status': '0',
    'x-forwarded-for': '103.151.46.25',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  return headers;
}
