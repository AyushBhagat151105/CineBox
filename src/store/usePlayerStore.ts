import { create } from 'zustand';
import { PlaybackSource, Release } from '../types/models';

interface PlayerState {
  activeSource: PlaybackSource | null;
  activeRelease: Release | null;
  availableReleases: Release[];
  availableAudioTracks: any[];
  selectedAudioTrack: any | null;
  availableSubtitles: any[];
  selectedSubtitle: any | null;
  resumeSeconds: number;

  setPlayback: (source: PlaybackSource, release: Release, resumeSeconds?: number) => void;
  setAvailableReleases: (releases: Release[]) => void;
  setAudioTracks: (tracks: any[]) => void;
  selectAudioTrack: (track: any) => void;
  setSubtitles: (subs: any[]) => void;
  selectSubtitle: (sub: any) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activeSource: null,
  activeRelease: null,
  availableReleases: [],
  availableAudioTracks: [],
  selectedAudioTrack: null,
  availableSubtitles: [],
  selectedSubtitle: null,
  resumeSeconds: 0,

  setPlayback: (source, release, resumeSeconds = 0) =>
    set({
      activeSource: source,
      activeRelease: release,
      resumeSeconds,
    }),

  setAvailableReleases: (releases) => set({ availableReleases: releases }),
  setAudioTracks: (tracks) => set({ availableAudioTracks: tracks }),
  selectAudioTrack: (track) => set({ selectedAudioTrack: track }),
  setSubtitles: (subs) => set({ availableSubtitles: subs }),
  selectSubtitle: (sub) => set({ selectedSubtitle: sub }),
  reset: () =>
    set({
      activeSource: null,
      activeRelease: null,
      availableAudioTracks: [],
      selectedAudioTrack: null,
      availableSubtitles: [],
      selectedSubtitle: null,
      resumeSeconds: 0,
    }),
}));
