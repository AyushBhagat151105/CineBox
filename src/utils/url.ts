/**
 * Sanitizes and encodes raw media stream URLs for native video players (VLC, ExoPlayer, MX Player).
 *
 * Direct stream URLs extracted from pirate indexers often contain unencoded characters
 * (spaces, square brackets, curly braces) in their file paths.
 * Android's Uri.parse() and VLC's native C++ player require strict RFC 3986 encoding;
 * unencoded spaces or brackets cause VLC to throw MRL parse errors and exit immediately.
 */
export function sanitizeStreamUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;

  return rawUrl
    .trim()
    .replace(/ /g, '%20')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D')
    .replace(/\|/g, '%7C')
    .replace(/\\/g, '%5C')
    .replace(/\^/g, '%5E')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/"/g, '%22')
    .replace(/`/g, '%60');
}
