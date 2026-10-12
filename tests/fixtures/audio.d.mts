/*
 * Type declarations for tests/fixtures/audio.mjs (v4.0.1) — the
 * synthetic audio builders the media tests fixture with.
 */

export type Mp3Options = {
  seconds?: number;
  version?: number;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  track?: string;
  disc?: string;
  composer?: string;
  comment?: string;
  [field: string]: unknown;
};

export type M4aOptions = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  discTotal?: number;
  composer?: string;
  comment?: string;
  [field: string]: unknown;
};

export type FlacOptions = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: string;
  genre?: string;
  trackNumber?: number;
  trackTotal?: number;
  discNumber?: number;
  discTotal?: number;
  composer?: string;
  comment?: string;
  [field: string]: unknown;
};

export function buildMp3(options?: Mp3Options): Uint8Array;

export function buildM4a(options?: M4aOptions): Uint8Array;

export function buildFlac(options?: FlacOptions): Uint8Array;

export type WavOptions = {
  title?: string;
  artist?: string;
  album?: string;
  composer?: string;
  year?: string;
  genre?: string;
  track?: string;
  comment?: string;
  seconds?: number;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  [field: string]: unknown;
};

export function buildWav(options?: WavOptions): Uint8Array;

export function buildCoverPng(): Uint8Array;

export function buildId3Tag(
  version: number,
  frames: Uint8Array[]
): Uint8Array;

export function id3FrameV23(
  id: string,
  payload: Uint8Array
): Uint8Array;

export function id3FrameV24(
  id: string,
  payload: Uint8Array
): Uint8Array;

export function buildMpegFrame(): Uint8Array;

export function concat(
  ...parts: Uint8Array[]
): Uint8Array;

export function uint32BE(
  value: number
): Uint8Array;

export function readUint32BE(
  bytes: Uint8Array,
  offset: number
): number;
