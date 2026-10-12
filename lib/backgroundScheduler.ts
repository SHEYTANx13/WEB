/*
 * Unified background work scheduler.
 *
 * ONE coherent queue for all non-urgent work. Built on the shared idle
 * scheduler (lib/idleScheduler.ts) — there is exactly one pending idle
 * callback at any moment, so background systems can never spawn
 * competing timers.
 *
 * Model: TASK → PRIORITY → STATE → OWNER → LIFETIME
 *
 * - Tasks are queued with a numeric priority (lower = more urgent).
 * - The pump executes at most one task per idle gap, then yields, so
 *   a burst of queued work can never monopolize the main thread.
 * - Every task carries an owner (the subsystem that enqueued it) so
 *   speculative work can be cancelled wholesale the moment user
 *   intent changes — user interaction always wins.
 * - Deduplication: enqueueing an id that is already queued or running
 *   is a no-op.
 * - Visibility: while the document is hidden the pump is suspended
 *   (pending idle callback cancelled). Queued tasks resume when the
 *   page becomes visible again. No heavy loops in hidden tabs.
 * - Connection awareness: save-data and 2G connections drop
 *   speculative (PREDICTIVE and lower) tasks at enqueue time.
 * - Memory pressure: where the browser exposes device memory
 *   (navigator.deviceMemory), constrained devices drop speculative
 *   tasks. Core work (USER_NAVIGATION/CURRENT_SESSION) is never
 *   dropped — memory adaptation degrades gracefully, never breaks.
 *
 * Telemetry: bounded counters, module scope, no network, no personal
 * data. Exposed through getBackgroundSchedulerStats() for
 * verification.
 */

import {
  scheduleIdle,
  type CancelIdle
} from "@/lib/idleScheduler";

import {
  BACKGROUND_IDLE_TIMEOUT_MS
} from "@/lib/loadPhase";

/*
 * Capability probes (v4.0.3) live in lib/connection.ts — the ONE
 * probe module, shared with the unified navigation (which must skip
 * speculative warming under constrained connections without shipping
 * the scheduler's task queue). The import keeps the scheduler's own
 * drop-at-enqueue behaviour working; the re-export keeps every
 * existing consumer unchanged.
 */
import {
  allowsSpeculativeNetwork,
  isMemoryConstrained
} from "@/lib/connection";

export {
  allowsSpeculativeNetwork,
  getConnectionState,
  isMemoryConstrained
} from "@/lib/connection";

export const BACKGROUND_PRIORITY = {
  /** Requested by an explicit user action right now. */
  USER_NAVIGATION: 0,
  /** Most probable next destination; cheap and high value. */
  NEAR_TERM: 1,
  /** Second-order prediction. */
  PREDICTIVE: 2,
  /** Nice-to-have background maintenance. */
  BACKGROUND: 3
} as const;

export type BackgroundPriorityValue =
  (typeof BACKGROUND_PRIORITY)[keyof typeof BACKGROUND_PRIORITY];

export type BackgroundTask = {
  id: string;

  priority: BackgroundPriorityValue;

  /** Subsystem that enqueued the task; used for wholesale cancellation. */
  owner: string;

  run: () => void | Promise<unknown>;
};

type QueuedTask = BackgroundTask & { enqueuedAt: number };

type SchedulerStats = {
  enqueued: number;
  executed: number;
  cancelled: number;
  dropped: number;
  queueDepth: number;
};

const queue: QueuedTask[] = [];

const runningIds = new Set<string>();

let pumpScheduled = false;

let pumpCancel: CancelIdle | null = null;

const stats: SchedulerStats = {
  enqueued: 0,
  executed: 0,
  cancelled: 0,
  dropped: 0,
  queueDepth: 0
};

/* -------------------------------------------------------------------------- */
/* Capability probes (moved to lib/connection.ts in v4.0.3)                   */
/* -------------------------------------------------------------------------- */

export function isPageVisible(): boolean {
  return (
    typeof document === "undefined" ||
    document.visibilityState === "visible"
  );
}

/* -------------------------------------------------------------------------- */
/* Pump                                                                       */
/* -------------------------------------------------------------------------- */

function pump() {
  pumpScheduled = false;
  pumpCancel = null;

  if (!isPageVisible()) {
    /* Suspended: tasks stay queued until visibility resumes. */
    return;
  }

  const task = queue.shift();

  if (!task) {
    publishStats();

    return;
  }

  runningIds.add(task.id);

  stats.executed += 1;

  publishStats();

  Promise.resolve()
    .then(task.run)
    .catch(() => {
      /* Background work must never surface as an unhandled rejection. */
    })
    .finally(() => {
      runningIds.delete(task.id);

      publishStats();

      schedulePump();
    });
}

function schedulePump() {
  if (pumpScheduled || !isPageVisible()) {
    return;
  }

  if (queue.length === 0) {
    return;
  }

  pumpScheduled = true;

  pumpCancel = scheduleIdle(pump, BACKGROUND_IDLE_TIMEOUT_MS);
}

function publishStats() {
  stats.queueDepth = queue.length;
}

/*
 * Resume the pump when the tab becomes visible again. The listener is
 * installed lazily on first enqueue and never removed — the scheduler
 * lives for the lifetime of the page, and one passive listener is the
 * entire permanent footprint.
 */
let visibilityListenerInstalled = false;

function installVisibilityResume() {
  if (
    visibilityListenerInstalled ||
    typeof document === "undefined"
  ) {
    return;
  }

  visibilityListenerInstalled = true;

  document.addEventListener(
    "visibilitychange",
    () => {
      if (isPageVisible()) {
        schedulePump();
      }
    },
    { passive: true }
  );
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function hasBackgroundTask(id: string): boolean {
  return runningIds.has(id) || queue.some((task) => task.id === id);
}

/*
 * Queue a task. Returns a cancel function. Speculative tasks are
 * dropped immediately when the network or the device cannot afford
 * them; core tasks always queue.
 */
export function enqueueBackgroundTask(
  task: BackgroundTask
): () => void {
  if (hasBackgroundTask(task.id)) {
    return () => cancelBackgroundTask(task.id);
  }

  const isSpeculative = task.priority >= BACKGROUND_PRIORITY.PREDICTIVE;

  if (isSpeculative && !allowsSpeculativeNetwork()) {
    stats.dropped += 1;

    publishStats();

    return () => undefined;
  }

  if (isSpeculative && isMemoryConstrained()) {
    stats.dropped += 1;

    publishStats();

    return () => undefined;
  }

  queue.push({ ...task, enqueuedAt: Date.now() });

  queue.sort(
    (a, b) =>
      a.priority - b.priority || a.enqueuedAt - b.enqueuedAt
  );

  stats.enqueued += 1;

  publishStats();

  installVisibilityResume();

  schedulePump();

  return () => cancelBackgroundTask(task.id);
}

export function cancelBackgroundTask(id: string) {
  const index = queue.findIndex((task) => task.id === id);

  if (index >= 0) {
    queue.splice(index, 1);

    stats.cancelled += 1;

    publishStats();
  }
}

/*
 * Cancel every queued task belonging to one owner. Called when the
 * state that made the speculation useful has changed (scene switch,
 * unmount) so stale work never executes.
 */
export function cancelBackgroundTasksByOwner(owner: string) {
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (queue[index].owner === owner) {
      queue.splice(index, 1);

      stats.cancelled += 1;
    }
  }

  publishStats();
}

export function getBackgroundSchedulerStats(): SchedulerStats {
  publishStats();

  return { ...stats };
}
