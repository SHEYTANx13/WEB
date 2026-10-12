/*
 * Type declarations for scripts/media/mp4.mjs (v4.0.1).
 */

export type Mp4Atom = {
  type: string;
  start: number;
  size: number;
  headerSize: number;
  bodyStart: number;
  end: number;
};

export type Mp4Fields = {
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

export type Mp4Metadata = {
  fields: Mp4Fields;
  durationSeconds?: number;
  [field: string]: unknown;
};

export function walkAtoms(
  bytes: Uint8Array,
  start: number,
  end: number
): Generator<Mp4Atom>;

export function parseMp4Metadata(
  bytes: Uint8Array
): Mp4Metadata | null;

export function looksLikeMp4(
  bytes: Uint8Array
): boolean;
