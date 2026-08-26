export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const isPlaybackRate = (value: number): value is PlaybackRate =>
  PLAYBACK_RATES.some(rate => rate === value);
