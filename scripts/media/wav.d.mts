/*
 * Type declarations for scripts/media/wav.mjs (v4.0.2).
 */

export type WavFields = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  composer?: string;
  comment?: string;
  trackNumber?: number;
  trackTotal?: number;
  [field: string]: unknown;
};

export type WavMetadata = {
  fields: WavFields;
  durationSeconds?: number;
};

export function parseWavMetadata(
  bytes: Uint8Array
): WavMetadata | null;
