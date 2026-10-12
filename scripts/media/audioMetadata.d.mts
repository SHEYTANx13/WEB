/*
 * Type declarations for scripts/media/audioMetadata.mjs (v4.0.1).
 */

export type RangeResponse = {
  status: number;
  arrayBuffer: ArrayBuffer;
  contentRange: string | null;
  acceptRanges: string | null;
  contentType?: string | null;
};

export type FetchRange = (
  url: string,
  start: number,
  end: number
) => Promise<RangeResponse>;

export type AudioMetadataResult = {
  fields: {
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
  duration?: number;
  exact: boolean;
  source: string;
};

export function extractAudioMetadata(options: {
  url: string;
  kind: string;
  fetchRange: FetchRange;
}): Promise<AudioMetadataResult>;
