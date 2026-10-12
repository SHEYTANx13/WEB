/*
 * Type declarations for scripts/media/flac.mjs (v4.0.1).
 */

export type FlacFields = {
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
  discNumber?: number;
  discTotal?: number;
  [field: string]: unknown;
};

export type FlacMetadata = {
  fields: FlacFields;
  durationSeconds?: number;
  complete: boolean;
};

export function parseFlacMetadata(
  bytes: Uint8Array
): FlacMetadata | null;
