/*
 * Type declarations for scripts/media/id3.mjs (v4.0.1).
 */

export type Id3Fields = {
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

export type Id3v2ParseResult = {
  complete: boolean;
  requiresBytes: number;
  tagBytes: number;
  fields: Id3Fields;
};

export function parseId3v2(
  bytes: Uint8Array
): Id3v2ParseResult | null;
