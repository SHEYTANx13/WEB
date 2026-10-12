/*
 * Type declarations for scripts/media/bytes.mjs (v4.0.1) — the tests
 * import these zero-dependency byte helpers directly; the shapes
 * mirror the runtime implementations.
 */

export function readUint32BE(
  bytes: Uint8Array,
  offset: number
): number;

export function readUint32LE(
  bytes: Uint8Array,
  offset: number
): number;

export function readSyncSafeUint32BE(
  bytes: Uint8Array,
  offset: number
): number;

export function readFourCc(
  bytes: Uint8Array,
  offset: number
): string;

export function startsWithAscii(
  bytes: Uint8Array,
  offset: number,
  text: string
): boolean;

export function indexOfAscii(
  bytes: Uint8Array,
  from: number,
  text: string
): number;

export function decodeId3Text(
  bytes: Uint8Array,
  encodingByte: number
): string;

export function splitNullSeparated(
  text: string
): string[];

export function normalizeGenre(
  value: string
): string;

export function parseSlashPair(
  value: string
): { index: number; total: number | null } | null;

export function formatDuration(
  seconds: number
): string | null;
