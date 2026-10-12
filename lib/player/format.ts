/**
 * lib/player/format.ts — player-facing time formatting (client side).
 * Mirrors scripts/media/bytes.mjs#formatDuration (build side); both
 * are covered by the test suite. Non-finite input yields null — the
 * UI never shows a fabricated time.
 */
export function formatPlayerTime(
  seconds: number | null | undefined
): string | null {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {
    return null;
  }

  const total = Math.floor(seconds);

  const hours = Math.floor(total / 3600);

  const minutes = Math.floor((total % 3600) / 60);

  const secs = total % 60;

  const twoDigits = String(secs).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${twoDigits}`
    : `${minutes}:${twoDigits}`;
}

/**
 * aria-valuetext for the seek slider: "1:23 of 4:05".
 */
export function formatSeekValueText(
  currentTime: number,
  duration: number
): string {
  const current =
    formatPlayerTime(currentTime) ?? "0:00";

  const total =
    formatPlayerTime(duration) ?? "0:00";

  return `${current} of ${total}`;
}
