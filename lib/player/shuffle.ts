/*
 * lib/player/shuffle.ts — deterministic queue shuffling (v4.0.2).
 *
 * The player has ONE queue; "shuffle" is an ORDERING of that queue,
 * never a second queue or a hidden playback path. The shuffle is
 * seeded and therefore deterministic: the same collection + current
 * track + queue always produce the same order, which keeps the
 * behavior testable and reproducible without any runtime randomness
 * dependency.
 */

/**
 * FNV-1a 32-bit hash of a seed string — small, stable, and
 * dependency-free.
 */
export function hashSeed(
  seed: string
): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);

    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Mulberry32 PRNG — a tiny, well-understood deterministic generator
 * (32-bit state, uniform output). Good enough for queue order; never
 * used for anything security-shaped.
 */
export function createSeededRandom(
  seed: number
): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);

    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle of a copy of `ids`, seeded by `seed`.
 *
 * Guarantees:
 *   - same input + same seed → same output (deterministic);
 *   - the result is a permutation of the input (nothing lost,
 *     nothing invented);
 *   - the input array is never mutated.
 */
export function shuffleTrackIds(
  ids: readonly string[],
  seed: string
): string[] {
  const shuffled = [...ids];

  const random = createSeededRandom(hashSeed(seed));

  for (
    let index = shuffled.length - 1;
    index > 0;
    index -= 1
  ) {
    const swap = Math.floor(random() * (index + 1));

    const held = shuffled[index];

    shuffled[index] = shuffled[swap];

    shuffled[swap] = held;
  }

  return shuffled;
}
