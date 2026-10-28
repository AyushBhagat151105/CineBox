export interface ParsedSeasonEpisode {
  season?: number;
  episode?: number;
  isPack?: boolean;
}

export function parseSeasonEpisode(filename: string, contextTitle?: string): ParsedSeasonEpisode {
  const combined = `${contextTitle || ''} ${filename}`;

  // 1. Match S01E01, S1E1, S01.E01, S1 - E1, S01 EP01, etc.
  const seMatch = combined.match(/\bS(\d{1,2})[\s._-]*E(?:P)?(\d{1,3})\b/i);
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
      isPack: false,
    };
  }

  // 2. Match Season 1 Episode 2
  const fullMatch = combined.match(/\bSeason\s*(\d{1,2})\s*[-_.]?\s*(?:Episode|Ep)\s*(\d{1,3})\b/i);
  if (fullMatch) {
    return {
      season: parseInt(fullMatch[1], 10),
      episode: parseInt(fullMatch[2], 10),
      isPack: false,
    };
  }

  // 3. Match standalone Episode in filename (e.g. "E01 - Drive", "EP 03", "Episode 4")
  const epMatch = filename.match(/\b(?:E|EP|Episode)\s*(\d{1,3})\b/i);
  // Detect season from context (e.g. "Season 1", "S01")
  const seasonFromContext = combined.match(/\b(?:Season|S)\s*(\d{1,2})\b/i);
  const contextSeason = seasonFromContext ? parseInt(seasonFromContext[1], 10) : undefined;

  if (epMatch) {
    return {
      season: contextSeason,
      episode: parseInt(epMatch[1], 10),
      isPack: false,
    };
  }

  // 4. Match Season Pack / Complete Season (e.g. "S08", "Season 8", "Complete Season 1", "Pack")
  if (contextSeason !== undefined) {
    const isPack = /pack|complete|all\s*episodes|zip|rar/i.test(combined) || epMatch === null;
    return {
      season: contextSeason,
      episode: undefined,
      isPack,
    };
  }

  return {};
}

// Clean and standardize episode filename
export function formatEpisodeTitle(
  rawFilename: string,
  quality: string,
  season?: number,
  episode?: number
): string {
  if (episode !== undefined) {
    const sPrefix = season !== undefined ? `S${season < 10 ? '0' : ''}${season}` : '';
    const ePrefix = `EP ${episode < 10 ? '0' : ''}${episode}`;
    const prefix = sPrefix ? `${sPrefix} · ${ePrefix}` : ePrefix;
    return `${prefix} (${quality})`;
  }

  // Filter out meaningless shortener labels like "Drive", "Watch", "Download", "Instant"
  const cleaned = rawFilename
    .replace(/^(\s*E\d+\s*[-–:]\s*)?(drive|watch|instant|download|hubdrive|hubcloud)\s*$/i, '')
    .trim();

  if (!cleaned || cleaned.length < 3) {
    return `Release (${quality})`;
  }

  return cleaned;
}
