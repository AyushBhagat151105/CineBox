// Utility to sanitize and clean movie titles across providers
export function cleanMovieTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/[-￰-￿]/g, '') // Strip private-use icons and replacement glyphs
    .replace(/^[\s\n\r\t﻿\xA0​‌‍‎‏—–\-_:|\.]+/, '') // Strip leading symbols, dashes, spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// Clean title for display in cards, headers and lists by removing codec spam, tags and junk
export function cleanDisplayTitle(title: string): string {
  if (!title) return '';
  const base = cleanMovieTitle(title);
  return base
    .replace(/^\[(?:18\+|\d+\+)\]\s*/i, '') // remove [18+]
    .replace(/\|\s*(?:Full Movie|TVSeries.*|All Episodes.*)$/i, '') // remove trailing pipeline tags
    .replace(/\b(?:Dual Audio.*|BluRay.*|WEB[- ]?DL.*|HDRip.*|DVDRip.*|HDTV.*|HDTC.*)$/i, '') // strip technical tags
    .replace(/[\s\-_|:]+$/, '') // strip trailing separators
    .replace(/\s+/g, ' ')
    .trim();
}
