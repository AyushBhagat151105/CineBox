export interface ParsedReleaseTags {
  isImax: boolean;
  isRemux: boolean;
  isBluRay: boolean;
  isWebDl: boolean;
  isDoVi: boolean;
  isHdr: boolean;
  resolution: '4K UHD' | '1080p' | '720p' | '480p';
  audio?: string;
  size?: string;
  codec?: string;
  primaryEdition: string;
  tags: {
    label: string;
    type: 'imax' | 'remux' | 'resolution' | 'hdr' | 'audio' | 'size';
  }[];
}

/**
 * Parses raw pirate release filenames into structured quality tags (IMAX, REMUX, 4K UHD, HDR, DDP 5.1).
 */
export function parseReleaseTags(filename?: string): ParsedReleaseTags {
  const f = filename || '';
  const upper = f.toUpperCase();

  // 1. Edition Detection
  const isImax = upper.includes('IMAX');
  const isRemux = upper.includes('REMUX');
  const isBluRay =
    upper.includes('BLURAY') ||
    upper.includes('BLU-RAY') ||
    upper.includes('BDRIP') ||
    upper.includes('BRRIP');
  const isWebDl =
    upper.includes('WEB-DL') ||
    upper.includes('WEBRIP') ||
    upper.includes('WEB.');

  // 2. HDR & Color Profile
  const isDoVi =
    upper.includes('DOVI') ||
    upper.includes('DV') ||
    upper.includes('DOLBY VISION') ||
    upper.includes('DOLBYVISION');
  const isHdr10Plus = upper.includes('HDR10+') || upper.includes('HDR10PLUS');
  const isHdr = isHdr10Plus || upper.includes('HDR') || upper.includes('10BIT');

  // 3. Resolution Detection
  let resolution: '4K UHD' | '1080p' | '720p' | '480p' = '1080p';
  if (upper.includes('2160P') || upper.includes('4K') || upper.includes('UHD')) {
    resolution = '4K UHD';
  } else if (upper.includes('1080P') || upper.includes('FHD')) {
    resolution = '1080p';
  } else if (upper.includes('720P') || upper.includes('HD')) {
    resolution = '720p';
  } else if (upper.includes('480P') || upper.includes('SD')) {
    resolution = '480p';
  }

  // 4. Audio Quality
  let audio: string | undefined;
  if (upper.includes('TRUEHD') || upper.includes('ATMOS')) {
    audio = 'Atmos 7.1';
  } else if (upper.includes('DTS-HD') || upper.includes('DTS-HDMA') || upper.includes('DTS')) {
    audio = 'DTS-HD MA';
  } else if (upper.includes('DDP 7.1') || upper.includes('DDP7.1')) {
    audio = 'DDP 7.1';
  } else if (upper.includes('DDP 5.1') || upper.includes('DDP5.1') || upper.includes('EAC3')) {
    audio = 'DDP 5.1';
  } else if (upper.includes('DD 5.1') || upper.includes('AC3')) {
    audio = 'DD 5.1';
  } else if (upper.includes('DDP 2.0') || upper.includes('DDP2.0')) {
    audio = 'DDP 2.0';
  }

  // 5. Codec
  let codec: string | undefined;
  if (upper.includes('AV1')) codec = 'AV1';
  else if (upper.includes('HEVC') || upper.includes('X265') || upper.includes('H.265')) codec = 'HEVC';
  else if (upper.includes('X264') || upper.includes('H.264')) codec = 'x264';

  // 6. Physical Size (e.g. [26.31 GB] or (5.09 GB))
  const sizeMatch = f.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
  const size = sizeMatch ? sizeMatch[1].toUpperCase() : undefined;

  // Build Tags List
  const tags: ParsedReleaseTags['tags'] = [];

  if (isImax) {
    tags.push({ label: 'IMAX', type: 'imax' });
  }
  if (isRemux) {
    tags.push({ label: 'REMUX', type: 'remux' });
  }

  tags.push({ label: resolution, type: 'resolution' });

  if (isDoVi) {
    tags.push({ label: 'Dolby Vision', type: 'hdr' });
  } else if (isHdr) {
    tags.push({ label: 'HDR', type: 'hdr' });
  }

  if (audio) {
    tags.push({ label: audio, type: 'audio' });
  }

  if (size) {
    tags.push({ label: size, type: 'size' });
  }

  // Primary Edition Title
  let primaryEdition: string = resolution;
  if (isImax && isRemux) primaryEdition = 'IMAX 4K REMUX';
  else if (isImax) primaryEdition = 'IMAX Enhanced';
  else if (isRemux) primaryEdition = `${resolution} REMUX`;
  else if (isBluRay) primaryEdition = `${resolution} BluRay`;
  else if (isWebDl) primaryEdition = `${resolution} WEB-DL`;

  return {
    isImax,
    isRemux,
    isBluRay,
    isWebDl,
    isDoVi,
    isHdr,
    resolution,
    audio,
    size,
    codec,
    primaryEdition,
    tags,
  };
}
