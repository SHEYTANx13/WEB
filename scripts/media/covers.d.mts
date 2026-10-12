/*
 * Type declarations for scripts/media/covers.mjs (v4.0.1).
 */

export const COVER_EXTENSIONS: string[];

export const FOLDER_COVER_BASENAMES: string[];

export function resolveCoverPath(
  item: {
    source: string;
    [field: string]: unknown;
  },
  exists: (path: string) => Promise<boolean>
): Promise<string | null>;
