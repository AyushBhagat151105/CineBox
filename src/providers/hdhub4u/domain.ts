import axios from 'axios';
import { decodeBase64 } from '../../utils/base64';

let activeDomain = 'https://hdhub4u.eco';
let lastProbeTime = 0;
const PROBE_TTL = 15 * 60 * 1000; // 15 minutes cache

const FALLBACK_DOMAINS = [
  'https://hdhub4u.eco',
  'https://hdhub4u.ms',
  'https://hdhub4u.guru',
];

const ROUTER_HOSTS = [
  'https://h4.suncdn.org/host/',
  'https://points.topapii.com/host/',
  'https://ml.theapii.org/host/',
  'https://dns.pingora.fyi/v2/host',
  'https://cdn.hub4u.cloud/host/',
];

export async function getActiveHDHub4uDomain(): Promise<string> {
  const now = Date.now();
  if (now - lastProbeTime < PROBE_TTL && activeDomain) {
    return activeDomain;
  }

  const d = new Date();
  const v =
    1000000 * d.getUTCFullYear() +
    10000 * (d.getUTCMonth() + 1) +
    100 * d.getUTCDate() +
    d.getUTCHours() +
    1;

  for (const host of ROUTER_HOSTS) {
    try {
      const url = host.includes('?') ? `${host}&v=${v}` : `${host}?v=${v}`;
      const res = await axios.get(url, {
        timeout: 4500,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const data = res.data;
      if (data && data.c) {
        // Base64 decode destination
        const decoded = decodeBase64(data.c);

        // Extract origin: https://new10.hdhub4u.cl/?utm=mn1 -> https://new10.hdhub4u.cl
        const parsed = new URL(decoded);
        activeDomain = parsed.origin;
        lastProbeTime = now;
        return activeDomain;
      }
    } catch {
      // Try next host in pool
      continue;
    }
  }

  return activeDomain;
}
