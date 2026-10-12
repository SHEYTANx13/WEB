/*
 * Type declarations for scripts/media/manifestSchema.mjs (v4.0.2).
 */

export function validateMediaManifest(
  manifest: unknown
): string[];

export function isValidDirectMediaUrl(
  url: string
): boolean;

export function resolveDirectAudioKind(
  url: string,
  mimeType?: string
): string | null;
