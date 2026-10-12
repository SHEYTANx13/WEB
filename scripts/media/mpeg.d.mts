/*
 * Type declarations for scripts/media/mpeg.mjs (v4.0.1).
 */

export type MpegFrameHeader = {
  offset: number;
  version: number;
  layer: number;
  bitrate: number;
  sampleRate: number;
  channelMode: number;
  samplesPerFrame: number;
};

export type XingHeader = {
  frames?: number;
  bytes?: number;
  frameCount: number;
};

export function parseMpegFrameHeader(
  bytes: Uint8Array,
  offset: number
): MpegFrameHeader | null;

export function findFirstMpegFrame(
  bytes: Uint8Array,
  from?: number
): MpegFrameHeader | null;

export function readXingHeader(
  bytes: Uint8Array,
  frame: MpegFrameHeader
): XingHeader | null;

export function computeMp3Duration(
  head: Uint8Array,
  fileSize: number
): number | null;
