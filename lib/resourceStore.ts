/*
 * Resource store — typed async resource manager with an explicit
 * memory policy.
 *
 * Single source of truth for "load an async resource exactly once".
 *
 * Guarantees:
 * - request deduplication: concurrent callers share one in-flight promise
 * - failure cleanup: a rejected entry is removed so a later caller retries
 * - race protection: callers can pass an AbortSignal; aborted loads are
 *   dropped from the cache so the next caller starts fresh
 * - stale-result protection: entries older than `staleAfter` are re-fetched
 *   (in-flight entry is still shared while refreshing)
 * - bounded memory: the settled-value LRU never grows past
 *   RESOURCE_STORE_MAX_ENTRIES; the least recently USED settled entry is
 *   evicted first. In-flight entries are never evicted.
 * - TTL expiry: `short-lived` / `transient` entries are dropped when
 *   `staleAfter` elapses (checked lazily on access and in sweeps)
 * - explicit invalidation + safe retry after eviction
 *
 * RESOURCE LIFETIME CLASSES (Cache Policy):
 *
 * - "immutable"    LONG-LIVED. Build-stamped data, content-addressed
 *                  assets, stable configuration. Kept until evicted by
 *                  the LRU bound (which in practice never fires for the
 *                  handful of immutable resources this site holds).
 *
 * - "short-lived"  REFRESHABLE. Remote/derived metadata that may change
 *                  (media probes, manifests fetched at runtime).
 *                  Requires `staleAfter`; the settled value is dropped
 *                  after the TTL and re-verified on next use.
 *
 * - "transient"    DISPOSABLE. Prediction/preload scratch data and other
 *                  values that should not outlive a short window.
 *                  Requires `staleAfter`; aggressively swept.
 *
 * SESSION state (navigation) and PERSISTENT state (reading position,
 * preferences) still do not belong here — they live in React state and
 * localStorage respectively.
 */

export type ResourceLifetime =
  | "immutable"
  | "short-lived"
  | "transient";

type ResourceEntry = {
  promise: Promise<unknown>;

  createdAt: number;

  /*
   * Touched on lookup so LRU eviction reflects actual usage, not
   * insertion order.
   */
  lastAccessAt: number;

  lifetime: ResourceLifetime;

  staleAfter: number | undefined;
};

type ResourceStoreStats = {
  hits: number;
  misses: number;
  evictions: number;
  expiries: number;
  settledEntries: number;
  inFlightEntries: number;
};

const RESOURCE_STORE_MAX_ENTRIES = 24;

const inFlight = new Map<string, ResourceEntry>();
const settled = new Map<string, ResourceEntry>();

const stats: ResourceStoreStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  expiries: 0,
  settledEntries: 0,
  inFlightEntries: 0
};

export type LoadResourceOptions = {
  /*
   * Milliseconds after which a settled entry is considered stale and a
   * fresh load is started. Required for short-lived/transient entries;
   * optional (and usually omitted) for immutable ones.
   */
  staleAfter?: number;

  /*
   * Lifetime class for the settled value. Defaults to "immutable",
 * matching the dominant build-stamped content of a static site.
   */
  lifetime?: ResourceLifetime;

  /*
   * Abort the underlying work. The entry is removed from the cache when
   * the abort fires so the resource is not left half-open.
   */
  signal?: AbortSignal;
};

function isExpired(entry: ResourceEntry, now: number): boolean {
  if (entry.lifetime === "immutable") {
    return false;
  }

  return (
    entry.staleAfter !== undefined &&
    now - entry.createdAt >= entry.staleAfter
  );
}

function dropEntry(key: string) {
  inFlight.delete(key);
  settled.delete(key);
}

function touchEntry(entry: ResourceEntry, now: number) {
  entry.lastAccessAt = now;
}

/*
 * Bounded-memory law: before inserting a new settled value, evict the
 * least recently used settled entry when the store is at capacity.
 * In-flight entries are invisible to eviction — dropping them would
 * strand active callers.
 */
function evictIfNeeded() {
  while (settled.size >= RESOURCE_STORE_MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of settled) {
      if (entry.lastAccessAt < oldestAccess) {
        oldestAccess = entry.lastAccessAt;
        oldestKey = key;
      }
    }

    if (oldestKey === null) {
      break;
    }

    settled.delete(oldestKey);
    stats.evictions += 1;
  }
}

/*
 * Drop expired short-lived/transient entries. Runs opportunistically on
 * loads (cheap: the map holds at most RESOURCE_STORE_MAX_ENTRIES items).
 */
function sweepExpired(now: number) {
  for (const [key, entry] of settled) {
    if (isExpired(entry, now)) {
      settled.delete(key);
      stats.expiries += 1;
    }
  }
}

function publishStats() {
  stats.settledEntries = settled.size;
  stats.inFlightEntries = inFlight.size;
}

export function loadResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: LoadResourceOptions = {}
): Promise<T> {
  const { staleAfter, signal, lifetime = "immutable" } = options;
  const now = Date.now();

  const live = inFlight.get(key);

  if (live) {
    stats.hits += 1;

    touchEntry(live, now);

    return live.promise as Promise<T>;
  }

  const cached = settled.get(key);

  if (cached) {
    if (!isExpired(cached, now)) {
      stats.hits += 1;

      touchEntry(cached, now);

      return cached.promise as Promise<T>;
    }

    settled.delete(key);
    stats.expiries += 1;
  }

  stats.misses += 1;

  sweepExpired(now);

  if (staleAfter === undefined && lifetime !== "immutable") {
    /*
     * A short-lived/transient entry without a TTL would live forever,
     * contradicting its class. Treat it as expired-immediately on the
     * next read rather than corrupting the policy silently.
     */
    throw new Error(
      `resourceStore: ${lifetime} resource "${key}" requires staleAfter`
    );
  }

  const promise = loader().then(
    (value) => {
      /*
       * If the entry was dropped while loading (abort or explicit
       * invalidation), do not resurrect it — the next caller should
       * start a fresh load rather than receive a stale settle.
       */
      if (inFlight.get(key)?.promise !== promise) {
        return value;
      }

      inFlight.delete(key);

      evictIfNeeded();

      settled.set(key, {
        promise: Promise.resolve(value),
        createdAt: Date.now(),
        lastAccessAt: Date.now(),
        lifetime,
        staleAfter
      });

      publishStats();

      return value;
    },
    (reason) => {
      /*
       * Failure cleanup: never cache a rejection. The next caller
       * must be able to retry.
       */
      dropEntry(key);

      publishStats();

      throw reason;
    }
  );

  inFlight.set(key, {
    promise,
    createdAt: now,
    lastAccessAt: now,
    lifetime,
    staleAfter
  });

  publishStats();

  if (signal) {
    const handleAbort = () => {
      if (inFlight.get(key)?.promise === promise) {
        inFlight.delete(key);

        publishStats();
      }
    };

    if (signal.aborted) {
      handleAbort();
    } else {
      signal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  return promise;
}

/*
 * Synchronous peek. Returns the settled value container when present
 * and fresh, or null when the resource has never completed a load, has
 * expired, or failed.
 */
export function peekResource<T>(key: string): Promise<T> | null {
  const entry = settled.get(key);

  if (!entry || isExpired(entry, Date.now())) {
    return null;
  }

  return (entry.promise as Promise<T>) ?? null;
}

/*
 * Explicit invalidation for cases where the owner knows the resource
 * changed (for example after a write or a manual refresh).
 */
export function invalidateResource(key: string) {
  dropEntry(key);

  publishStats();
}

/*
 * Drop every expired entry regardless of pending loads. Exposed so a
 * future memory-pressure listener can shed cache weight without
 * reaching into module internals.
 */
export function sweepResourceStore() {
  sweepExpired(Date.now());

  publishStats();
}

/*
 * Release every settled value but keep in-flight promises alive. Used
 * for graceful degradation under memory pressure: active loads finish,
 * retained values are shed, and later lookups simply miss.
 */
export function releaseSettledResources() {
  const inFlightKeys = [...inFlight.keys()];

  settled.clear();

  for (const key of inFlightKeys) {
    const entry = inFlight.get(key);

    if (entry) {
      /*
       * Do not let the settle path resurrect the value: drop the
       * in-flight entry too, so callers already holding the promise
       * still receive their result while new callers start fresh.
       */
      inFlight.delete(key);
    }
  }

  publishStats();
}

export function getResourceStoreStats(): ResourceStoreStats {
  publishStats();

  return { ...stats };
}

export function clearResourceStore() {
  inFlight.clear();
  settled.clear();

  publishStats();
}
