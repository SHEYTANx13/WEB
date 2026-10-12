/*
 * lib/player/sessionPresence.ts — the ONE raw session-presence probe
 * (v4.0.3).
 *
 * A deliberate split of lib/player/persistence.ts: the GLOBAL PLAYER
 * HOST (components/player/GlobalMusicPlayerHost.tsx) runs on every
 * route and needs exactly one fact — "does a persisted session key
 * exist?" — which is a raw string check. Before v4.0.3 the host
 * imported that probe from persistence.ts, dragging the FULL
 * read/write/validate session module into the shared bundle of every
 * route even though parsing and validation only ever run inside the
 * lazy player surface.
 *
 * This module holds ONLY the storage key and the presence probe:
 *
 *   - no store import, no catalog import, no JSON parsing
 *   - safe on the server (returns false when window is undefined)
 *   - the single source of the session storage key string
 *
 * persistence.ts imports the key from here (one key constant,
 * ever) and keeps the full read/write/validate lifecycle for the
 * lazy player chunk. The host imports the probe from here, so the
 * initial graph of every route pays for one string check instead of
 * the whole session module.
 */

export const SESSION_STORAGE_KEY = "web-player-session";

/**
 * Existence probe used by the global player HOST (which deliberately
 * does not import the store): a raw string check that decides whether
 * the lazy player surface should mount to show a restored, paused
 * player. Parsing/validation happens later, inside the store.
 */
export function hasPersistedSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(SESSION_STORAGE_KEY) !== null
    );
  } catch {
    return false;
  }
}

/**
 * Test hook: clear the persisted session without importing the full
 * persistence module (used by suites that exercise the probe).
 */
export function clearPersistedSessionForTests(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* Nothing to clear. */
  }
}
