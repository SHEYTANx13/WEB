/*
 * Shared idle-time scheduler.
 *
 * Single source of truth for "run this when the main thread is idle".
 * Uses requestIdleCallback when available and falls back to a short
 * timeout elsewhere. Returns a cancel function in both cases.
 */

export type CancelIdle = () => void;

export function scheduleIdle(
  callback: () => void,
  timeout = 1200
): CancelIdle {
  if (
    typeof window !==
      "undefined" &&
    typeof window.requestIdleCallback ===
      "function"
  ) {
    const id =
      window.requestIdleCallback(
        callback,
        {
          timeout
        }
      );

    return () => {
      window.cancelIdleCallback(
        id
      );
    };
  }

  const id =
    globalThis.setTimeout(
      callback,
      300
    );

  return () => {
    globalThis.clearTimeout(
      id
    );
  };
}
