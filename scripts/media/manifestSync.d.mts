/*
 * Type declarations for scripts/media/manifestSync.mjs (v4.0.2).
 */

export type RawMediaItem = {
  [field: string]: unknown;
};

export type MediaManifestItem = {
  sourceType: "contents" | "direct";
  branch?: string;
  source?: string;
  url?: string;
  mimeType?: string;
  title: string;
  type: "book" | "music" | "video" | "art";
  artist?: string;
  album?: string;
  albumArtist?: string;
  metadataSource?: string;
  duration?: number;
  cover?: string | null;
  [field: string]: unknown;
};

export type MediaManifest = {
  version: number;
  updated: string;
  items: MediaManifestItem[];
};

export type SourceManifest = {
  version?: number;
  updated?: string;
  items?: RawMediaItem[];
};

export type NormalizeResult =
  | { error: string; item?: undefined }
  | { item: MediaManifestItem; error?: undefined };

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

export function normalizeRawItem(
  raw: unknown,
  origin: string
): NormalizeResult;

export function isValidDirectMediaUrl(
  url: string
): boolean;

export function enrichMusicItem(options: {
  item: MediaManifestItem;
  branchBaseUrl: string;
  fetchRange: FetchRange;
  warn?: (message: string) => void;
}): Promise<{
  item: MediaManifestItem;
  warning?: string;
}>;

export function buildMediaManifest(options: {
  library: SourceManifest | null;
  music: SourceManifest | null;
  branchBaseUrl: string;
  fetchRange: FetchRange;
}): Promise<{
  manifest: MediaManifest;
  warnings: string[];
}>;
