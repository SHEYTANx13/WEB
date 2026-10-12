/*
 * Loading state vocabulary and priority contract.
 *
 * The site exposes exactly five load phases. UI may only claim one of
 * these — never an invented percentage. Indeterminate work uses the
 * indeterminate visual treatment; measurable work may add deterministic
 * progress on top of the phase, not instead of it.
 *
 * INITIALIZING — application boot before the shell is interactive.
 * LOADING      — a required resource is being fetched for the current view.
 * PREPARING    — data is resident; the view is being composed or staged.
 * READY        — the view is usable.
 * ERROR        — a required resource failed and recovery is offered.
 */

export type LoadPhase =
  | "INITIALIZING"
  | "LOADING"
  | "PREPARING"
  | "READY"
  | "ERROR";

export const LOAD_PHASES: readonly LoadPhase[] = [
  "INITIALIZING",
  "LOADING",
  "PREPARING",
  "READY",
  "ERROR"
];

/*
 * Loading priority ladder.
 *
 * P0 CRITICAL       — app shell, current scene chunk, essential CSS.
 * P1 NEAR-CRITICAL  — the most probable next scene; fetched as soon as
 *                     the main thread is idle.
 * P2 PREDICTIVE     — the adjacent previous scene; fetched after a second
 *                     idle gap so it never competes with P1.
 * P3 BACKGROUND      — secondary metadata and future navigation targets.
 *                     Nothing currently schedules P3 work.
 * P4 USER-TRIGGERED  — PDFs, audio, video, heavy media. NEVER loaded
 *                     without explicit user intent (READ / LISTEN / WATCH /
 *                     OPEN ARTICLE-style actions).
 */

export type LoadPriority = "P0" | "P1" | "P2" | "P3" | "P4";

/*
 * Background preload scope: the preloader considers at most two scene
 * chunks per active scene (P1 predicted primary + P2 secondary
 * prediction). Actual execution is owned by the unified background
 * scheduler (lib/backgroundScheduler.ts), which orders, deduplicates,
 * cancels, and defers all queued work.
 */
export const BACKGROUND_PRELOAD_BUDGET = 2;

/*
 * Background work runs through the unified scheduler's single idle
 * pump with this timeout.
 */
export const BACKGROUND_IDLE_TIMEOUT_MS = 1800;

/*
 * Grace period before the scene loading overlay may appear (v3.5).
 *
 * Scene transitions no longer carry a minimum duration. The overlay
 * is shown ONLY when the destination module is genuinely still being
 * fetched after this delay — warmed/cached scenes swap in before the
 * next paint and never paint a loader. Keep this value in sync with
 * the scene-variant transition delay in
 * components/SceneLoadingScreen.module.css.
 */
export const SCENE_OVERLAY_DELAY_MS = 180;

/*
 * ROUTE PROGRESS TIMING (v4.0.5).
 *
 * Document-route navigation (App Router) shows the tiny top
 * progress line (components/RouteProgress.tsx) through two bounds
 * owned here so the host and its tests agree:
 *
 * - ROUTE_PROGRESS_GRACE_MS is the GRACE PERIOD between the
 *   navigation intent (the navigation island's click) and the
 *   moment the 2px line may appear. Warmed/cached/fast routes
 *   commit well inside this window and never show anything; a
 *   navigation that is still in flight after it reveals the line
 *   until the destination is actually ready. The mechanism NEVER
 *   delays a route to make itself visible — it is display-only
 *   (pointer-events: none).
 *
 * - ROUTE_PROGRESS_CAP_MS is a safety cap, not a duration: if a
 *   navigation silently dies (offline fetch, aborted render), the
 *   line clears itself instead of becoming a zombie. A committed
 *   route always dismisses the line earlier through the pathname
 *   effect.
 *
 * Both values are documented constants (like
 * SCENE_OVERLAY_DELAY_MS): keeping them here — not inline in the
 * component — is what makes the race-safety tests possible.
 */
export const ROUTE_PROGRESS_GRACE_MS = 150;

export const ROUTE_PROGRESS_CAP_MS = 10000;

/*
 * POST-LOAD SETTLE GATE (v4.0.3).
 *
 * `requestIdleCallback()` is a LOW-PRIORITY mechanism, not permission
 * to run work during critical startup: on a fast connection the main
 * thread goes idle between hydration and first paint, so a bare idle
 * callback can begin speculative downloads before the first useful
 * paint — measured in v4.0.2 (predicted scene chunks and the RED
 * MAGIC organism chunk both started before FCP). `whenPageSettled()`
 * is the deliberate boundary every SPECULATIVE loader must respect:
 *
 *   critical page load → page usable → idle opportunity → speculation
 *
 * The promise resolves when the document has fully loaded (readyState
 * "complete" — every critical resource has finished) and one further
 * idle gap has been granted, so speculation can never steal bandwidth
 * or main-thread time from the first paint. A hard cap keeps a
 * stalled subresource from blocking speculation forever: after
 * SETTLE_CAP_MS the gate opens regardless (speculation is still
 * queued through the background scheduler's own idle pump, so the
 * low-priority guarantee holds either way).
 *
 * The promise is created once per page and shared by every caller
 * (scene preloader, RED MAGIC organism, any future speculative
 * loader). On the server and inside unit tests (no window) it
 * resolves immediately — the gate is a browser scheduling concern
 * only.
 */

export const SETTLE_CAP_MS = 4000;

let settlePromise: Promise<void> | null = null;

export function whenPageSettled(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (settlePromise) {
    return settlePromise;
  }

  settlePromise = new Promise<void>((resolve) => {
    let resolved = false;

    const resolveOnce = () => {
      if (resolved) {
        return;
      }

      resolved = true;

      resolve();
    };

    /*
     * After the load boundary, grant ONE real idle gap so the first
     * speculative byte never lands inside the post-load paint work.
     * The requestIdleCallback timeout (or the 300ms fallback) bounds
     * the wait — the gate cannot stay closed indefinitely once the
     * load boundary has passed.
     */
    const afterLoad = () => {
      if (
        typeof window.requestIdleCallback === "function"
      ) {
        window.requestIdleCallback(resolveOnce, {
          timeout: SETTLE_CAP_MS
        });

        return;
      }

      setTimeout(resolveOnce, 300);
    };

    /*
     * Hard cap: a stalled subresource that never reaches the load
     * event must not block speculation forever. The gate opens after
     * SETTLE_CAP_MS regardless; queued speculation still runs through
     * the background scheduler's own idle pump, so the low-priority
     * guarantee holds either way.
     */
    setTimeout(resolveOnce, SETTLE_CAP_MS);

    if (document.readyState === "complete") {
      afterLoad();

      return;
    }

    window.addEventListener("load", afterLoad, {
      once: true
    });
  });

  return settlePromise;
}
