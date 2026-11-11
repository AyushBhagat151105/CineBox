import { describe, it, expect } from 'bun:test';
import { parseSeasonEpisode } from '../src/utils/seasonEpisode';
import { cleanDisplayTitle, cleanMovieTitle } from '../src/utils/title';
import { sanitizeStreamUrl } from '../src/utils/url';
import { extractGreenmotorsPayload, decodeGreenmotorsPayload } from '../src/providers/hdhub4u/resolver';

describe('Season & Episode Parsing', () => {
  it('parses standard SxxExx notation', () => {
    const res = parseSeasonEpisode('Loki.S02E04.1080p.WEB-DL.mkv');
    expect(res.season).toBe(2);
    expect(res.episode).toBe(4);
    expect(res.isPack).toBe(false);
  });

  it('parses Season and Episode written in words', () => {
    const res = parseSeasonEpisode('Breaking Bad Season 5 Episode 14 720p.mkv');
    expect(res.season).toBe(5);
    expect(res.episode).toBe(14);
    expect(res.isPack).toBe(false);
  });

  it('detects season pack archives', () => {
    const res = parseSeasonEpisode('Stranger.Things.Season.4.Complete.Pack.720p.zip');
    expect(res.season).toBe(4);
    expect(res.episode).toBeUndefined();
    expect(res.isPack).toBe(true);
  });
});

describe('Title Sanitization', () => {
  it('cleans private-use glyphs and leading symbols from movie titles', () => {
    const raw = ' - Oppenheimer (2023) ';
    const cleaned = cleanMovieTitle(raw);
    expect(cleaned).toBe('Oppenheimer (2023)');
  });

  it('cleans display titles by stripping codec tags while preserving IMAX', () => {
    const display = cleanDisplayTitle('Dune: Part Two (2024) IMAX WEB-DL');
    expect(display).toBe('Dune: Part Two (2024) IMAX');
  });
});

describe('Stream URL Sanitization', () => {
  it('encodes unsafe characters for external video players', () => {
    const raw = 'https://cdn.example.com/stream/Dune [2024] {1080p} file.mp4';
    const clean = sanitizeStreamUrl(raw);
    expect(clean).toBe('https://cdn.example.com/stream/Dune%20%5B2024%5D%20%7B1080p%7D%20file.mp4');
    expect(clean).not.toContain(' ');
    expect(clean).not.toContain('[');
    expect(clean).not.toContain(']');
  });
});

describe('GreenMotors Payload Extraction and Decoding', () => {
  it('extracts payload from single-quoted s("o", ...) call', () => {
    const html = `<html><head><script>s('o', 'TXlTZWNyZXRQYXlsb2Fk');</script></head></html>`;
    const payload = extractGreenmotorsPayload(html);
    expect(payload).toBe('TXlTZWNyZXRQYXlsb2Fk');
  });

  it('extracts payload from double-quoted s("o", ...) call', () => {
    const html = `<html><head><script>s("o", "QW5vdGhlclBheWxvYWQ=");</script></head></html>`;
    const payload = extractGreenmotorsPayload(html);
    expect(payload).toBe('QW5vdGhlclBheWxvYWQ=');
  });

  it('returns null on missing payload', () => {
    const html = `<html><body><div>No obfuscated script here</div></body></html>`;
    const payload = extractGreenmotorsPayload(html);
    expect(payload).toBeNull();
  });

  it('decodes rot13 and 4-tier base64 payload to destination URL', () => {
    // Generate valid test payload:
    // target -> base64 -> json({o: ...}) -> base64 -> rot13 -> base64 -> base64
    const targetUrl = 'https://hubcloud.one/drive/abcd1234efgh';
    const rot13 = (s: string) =>
      s.replace(/[a-zA-Z]/g, (c) => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
      });

    const b64 = (s: string) => Buffer.from(s).toString('base64');
    const b64Target = b64(targetUrl);
    const jsonStr = JSON.stringify({ o: b64Target });
    const s4 = b64(jsonStr);
    const s3 = rot13(s4);
    const s2 = b64(s3);
    const s1 = b64(s2);

    const decoded = decodeGreenmotorsPayload(s1);
    expect(decoded).toBe(targetUrl);
  });
});

describe('Aggregator Engine', () => {
  it('deduplicates identical items from multiple providers', () => {
    const { AggregatorService } = require('../src/providers/aggregator');
    const service = new AggregatorService();
    const item1 = {
      id: { provider: 'hdhub4u', value: 'https://hdhub4u.eco/post1' },
      title: 'Dune: Part Two',
      year: '2024',
      mediaType: 'movie',
      availableProviders: ['hdhub4u'],
    };
    const item2 = {
      id: { provider: 'fourkhdhub', value: 'https://4khdhub.one/post2' },
      title: 'Dune Part Two',
      year: '2024',
      mediaType: 'movie',
      availableProviders: ['fourkhdhub'],
    };

    const deduplicated = service.deduplicateCatalog([item1, item2]);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].availableProviders).toContain('hdhub4u');
    expect(deduplicated[0].availableProviders).toContain('fourkhdhub');
  });

  it('preflight probe rejects intermediate shortener and webpage landing URLs', async () => {
    const { AggregatorService } = require('../src/providers/aggregator');
    const service = new AggregatorService();

    const shorteners = [
      'https://greenmotors.club/verify/12345',
      'https://hubdrive.space/file/abc',
      'https://snvhost.com/login.php',
      'https://example.com/stream.html',
    ];

    for (const url of shorteners) {
      const probe = await service.probeStream(url);
      expect(probe.isHealthy).toBe(false);
      expect(probe.isSeekable).toBe(false);
    }
  });
});

