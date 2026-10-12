"use client";

import type {
  TrackRegistryEntry
} from "@/lib/player/playerStore";

import styles from "@/components/player/Player.module.css";

/*
 * PLAYER ARTWORK (v4.0.0) — cover image with an honest fallback.
 *
 * Covers are remote (Contents CDN) and therefore lazy + dimensioned:
 * loading="lazy", fixed pixel size, decoding async. When no cover
 * resolved for a track, the artwork slot renders the Media identity
 * glyph instead of an empty box — never a placeholder image request.
 */
export default function PlayerArtwork({
  track,
  size,
  large
}: {
  track: TrackRegistryEntry | null;

  size: number;

  large?: boolean;
}) {
  const dimensionStyle = {
    width: `${size}px`,
    height: `${size}px`
  };

  if (track?.coverUrl) {
    return (
      <img
        className={
          large ? styles.artworkLarge : styles.artwork
        }
        style={dimensionStyle}
        src={track.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <span
      className={
        large ? styles.artworkFallbackLarge : styles.artworkFallback
      }
      style={dimensionStyle}
      aria-hidden="true"
    >
      {track ? "MUSIC" : "—"}
    </span>
  );
}
