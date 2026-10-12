/*
 * covers.mjs — deterministic Media cover resolution.
 *
 * Resolution order (strict, no fuzzy matching):
 *   1. explicit cover path on the manifest item
 *   2. a cover image whose EXACT basename matches the audio file's
 *      basename, living in the audio's folder (.jpeg / .png)
 *   3. the folder cover: the first existing candidate of
 *      cover.jpeg, cover.png, folder.jpeg, folder.png,
 *      front.jpeg, front.png in the audio's folder
 *   4. fallback: no cover (the UI renders its own artwork fallback)
 *
 * "Existing" is supplied by a probe callback (HEAD request at sync
 * time; a path-listing in tests). Only the two extensions above are
 * honoured; case must match the remote path exactly.
 */

export const COVER_EXTENSIONS = ["jpeg", "png"];

export const FOLDER_COVER_BASENAMES = [
  "cover",
  "folder",
  "front"
];

function isCoverExtension(name) {
  return COVER_EXTENSIONS.some(
    (extension) => name.toLowerCase().endsWith(`.${extension}`)
  );
}

/**
 * Join a folder prefix with a name ("" folder → bare name).
 */
function joinPath(folder, name) {
  return folder.length > 0 ? `${folder}/${name}` : name;
}

/**
 * Resolve the cover path for an audio item.
 *
 * @param {object} item — { source, cover? } manifest record
 * @param {(path: string) => boolean | Promise<boolean>} exists
 *   probe: true when the path exists in the item's branch
 * @returns {Promise<string | null>} resolved cover path or null
 */
export async function resolveCoverPath(
  item,
  exists
) {
  const source = item.source;

  const lastSlash = source.lastIndexOf("/");

  const folder = lastSlash >= 0 ? source.slice(0, lastSlash) : "";

  const fileName =
    lastSlash >= 0 ? source.slice(lastSlash + 1) : source;

  const dotIndex = fileName.lastIndexOf(".");

  const baseName =
    dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

  /* 1. Explicit cover path — trusted when present and cover-typed. */
  if (
    typeof item.cover === "string" &&
    item.cover.length > 0 &&
    isCoverExtension(item.cover)
  ) {
    return item.cover;
  }

  /* 2. Matching basename: "Track 01.mp3" → "Track 01.jpeg"/"Track 01.png". */
  for (const extension of COVER_EXTENSIONS) {
    const candidate = `${baseName}.${extension}`;

    if (await exists(joinPath(folder, candidate))) {
      return joinPath(folder, candidate);
    }
  }

  /* 3. Folder cover candidates, first existing wins. */
  for (const base of FOLDER_COVER_BASENAMES) {
    for (const extension of COVER_EXTENSIONS) {
      const candidate = `${base}.${extension}`;

      if (await exists(joinPath(folder, candidate))) {
        return joinPath(folder, candidate);
      }
    }
  }

  /* 4. Fallback — no cover. */
  return null;
}
