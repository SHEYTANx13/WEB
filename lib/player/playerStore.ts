/*
 * lib/player/playerStore.ts — the global Music player store (v4.0.2).
 *
 * ONE authoritative audio element for the whole application, created
 * lazily on the first explicit playback intent — never per track,
 * never at page load, never without user interaction (no autoplay).
 * The element belongs to this STORE (attached to document.body, never
 * to a route's React tree), and the store is mounted exactly once by
 * the root application shell (GlobalMusicPlayerHost) — so playback,
 * queue, and position survive every client-side route change without
 * pause, src reset, or store recreation.
 *
 * The store is framework-free (subscribe/getState) so the React
 * binding (usePlayer) stays a thin useSyncExternalStore shim and the
 * pure queue/history/repeat/shuffle logic is unit-testable under
 * `node --test` with a fake audio adapter.
 *
 * QUEUE SEMANTICS (deterministic, derived from the active Media
 * collection):
 *   current    — the playing/selected track id
 *   upcoming   — FIFO queue (play next / add to queue)
 *   history    — LIFO stack of previously PLAYED tracks
 *   play now   — replaces current, pushes it to history
 *   play next  — inserts at the head of upcoming
 *   add        — appends at the tail of upcoming
 *   remove     — removes an upcoming entry by id
 *   select     — an upcoming entry jumps to current
 *   clear      — empties upcoming (current untouched)
 *
 * SHUFFLE (v4.0.2) is an ORDERING of the one queue, never a second
 * queue: enabling it deterministically reshuffles upcoming; disabling
 * restores the collection order after the current track.
 *
 * PREVIOUS: sufficiently progressed (> 3 s) restarts the current
 * track; near the beginning it pops history (or restarts when the
 * stack is empty).
 *
 * AUTO-ADVANCE (end of track): repeat "one" replays; otherwise the
 * next upcoming track plays; with an empty upcoming queue and repeat
 * "all" the active collection restarts (shuffled when shuffle is on);
 * otherwise playback stops — the player never invents a next track.
 *
 * PERSISTENCE (v4.0.2): non-sensitive playback state (repeat, shuffle,
 * queue, history, current track, position, collection identity) is
 * snapshotted to localStorage at meaningful transitions and on page
 * hide. After a full browser reload the session RESTORES as a paused
 * player at the persisted position — autoplay never happens; playback
 * resumes only on the next explicit user gesture. Volume + muted keep
 * their own long-standing key. Client-side route navigation never
 * goes through storage at all.
 */

import type { MusicItem } from "@/lib/media/normalize";

import {
  readPersistedSession,
  writePersistedSession
} from "@/lib/player/persistence";

import {
  shuffleTrackIds
} from "@/lib/player/shuffle";

/* ---------------------------------------------------------------- */
/* Minimal audio element contract (real <audio> or a test fake)      */
/* ---------------------------------------------------------------- */

export type PlayerAudioElement = {
  src: string;
  preload: string;
  volume: number;
  muted: boolean;
  currentTime: number;
  duration: number;
  paused: boolean;
  playbackRate: number;

  play(): Promise<void>;

  pause(): void;

  load(): void;

  addEventListener(
    type: string,
    listener: () => void
  ): void;

  removeEventListener(
    type: string,
    listener: () => void
  ): void;
};

export type PlayerAudioFactory = () => PlayerAudioElement | null;

let audioFactory: PlayerAudioFactory = defaultAudioFactory;

/**
 * Replace the audio element factory (tests inject a fake here;
 * production code never needs to call this).
 */
export function setPlayerAudioFactory(
  factory: PlayerAudioFactory
): void {
  audioFactory = factory;
}

function defaultAudioFactory(): PlayerAudioElement | null {
  if (typeof window === "undefined") {
    return null;
  }

  const element = new window.Audio();

  /*
   * preload "none" until an explicit playback intent exists: the
   * element requests NOTHING at creation, and commitPlaybackStart
   * raises it to "auto" exactly when a track URL is assigned. (The
   * element also carries no src until then, so nothing is fetched.)
   */
  element.preload = "none";

  /*
   * Attach the authoritative element to the document: some engines
   * (notably iOS Safari) refuse to play detached media elements. It
   * is invisible and carries no src until the first play intent, so
   * attaching it requests nothing.
   */
  if (typeof document !== "undefined") {
    element.setAttribute("data-web-player", "true");

    element.style.display = "none";

    element.setAttribute("aria-hidden", "true");

    document.body.appendChild(element);
  }

  return element as unknown as PlayerAudioElement;
}

/* ---------------------------------------------------------------- */
/* State                                                             */
/* ---------------------------------------------------------------- */

export type PlayerRepeat = "off" | "all" | "one";

export type PlayerStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "error";

export type PlayerState = {
  /** Current track id (registry key), null when nothing selected. */
  currentTrackId: string | null;
  /** Upcoming queue (head = next). */
  upcoming: string[];
  /** Previously played tracks, most recent last. */
  history: string[];
  status: PlayerStatus;
  /** Human-readable playback failure reason (role="alert" surface). */
  error: string | null;
  /** Seconds. */
  currentTime: number;
  /** Seconds; manifest duration until the element reports its own. */
  duration: number;
  /** 0..1, persisted to localStorage. */
  volume: number;
  muted: boolean;
  repeat: PlayerRepeat;
  /** Queue-ordering mode (v4.0.2), persisted with the session. */
  shuffle: boolean;
  /** Expanded player surface (large artwork + queue) visibility. */
  expanded: boolean;
  /**
   * Identity of the collection the queue was built from — a
   * deterministic fingerprint of the active Media filter/order.
   * Queued ids outside the registry resolve to nothing (skipped).
   */
  collectionId: string | null;
};

const INITIAL_STATE: PlayerState = {
  currentTrackId: null,
  upcoming: [],
  history: [],
  status: "idle",
  error: null,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  repeat: "off",
  shuffle: false,
  expanded: false,
  collectionId: null
};

const PREVIOUS_RESTART_THRESHOLD_SECONDS = 3;

const VOLUME_STORAGE_KEY = "web-player-volume";

const VOLUME_STORAGE_VERSION = "v1";

type StoredVolume = {
  version: string;
  volume: number;
  muted: boolean;
};

function readStoredVolume(): {
  volume: number;
  muted: boolean;
} {
  if (typeof window === "undefined") {
    return { volume: 1, muted: false };
  }

  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);

    if (!raw) {
      return { volume: 1, muted: false };
    }

    const parsed = JSON.parse(raw) as StoredVolume;

    if (parsed.version !== VOLUME_STORAGE_VERSION) {
      return { volume: 1, muted: false };
    }

    return {
      volume:
        typeof parsed.volume === "number" &&
        Number.isFinite(parsed.volume) &&
        parsed.volume >= 0 &&
        parsed.volume <= 1
          ? parsed.volume
          : 1,
      muted: parsed.muted === true
    };
  } catch {
    return { volume: 1, muted: false };
  }
}

function writeStoredVolume(
  volume: number,
  muted: boolean
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: StoredVolume = {
      version: VOLUME_STORAGE_VERSION,
      volume,
      muted
    };

    window.localStorage.setItem(
      VOLUME_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    /* Storage unavailable — preferences simply stay ephemeral. */
  }
}

/* ---------------------------------------------------------------- */
/* Store                                                             */
/* ---------------------------------------------------------------- */

export type TrackRegistryEntry = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  url: string;
  coverUrl?: string;
  duration?: number;
};

function toRegistryEntry(item: MusicItem): TrackRegistryEntry {
  return {
    id: item.id,
    title: item.track.title,
    artist: item.track.artist ?? item.author,
    album: item.track.album,
    albumArtist: item.track.albumArtist,
    url: item.rawUrl,
    coverUrl: item.coverUrl,
    duration: item.track.duration
  };
}

export type PlayerStore = {
  getState(): PlayerState;

  subscribe(
    listener: () => void
  ): () => void;

  /** Register the playable catalog (Media scene collection). */
  setCollection(
    tracks: MusicItem[],
    collectionId: string
  ): void;

  /** Deterministic collection identity for a filtered list. */
  getCollectionId(): string | null;

  getTrack(
    id: string | null
  ): TrackRegistryEntry | null;

  /* Commands */
  playCollectionFrom(
    trackId: string,
    collectionId?: string
  ): void;

  playNow(trackId: string): void;

  playNext(trackId: string): void;

  addToQueue(trackId: string): void;

  removeFromQueue(trackId: string): void;

  clearUpcoming(): void;

  selectQueued(trackId: string): void;

  togglePlay(): void;

  pause(): void;

  /** Pause and rewind to 0:00 (the track stays selected). */
  stop(): void;

  /** Re-attempt the current track after an error (or reload). */
  retry(): void;

  /** Shuffle reorders the ONE queue deterministically. */
  toggleShuffle(): void;

  next(): void;

  previous(): void;

  seek(seconds: number): void;

  setVolume(value: number): void;

  toggleMute(): void;

  cycleRepeat(): void;

  setExpanded(expanded: boolean): void;

  /**
   * Restore a persisted session (after a full browser reload) as a
   * PAUSED player at the persisted position. Requires the catalog
   * registry to be registered first. NEVER autoplays — the restored
   * position becomes a pending seek applied when the user resumes.
   * Returns true when a session was restored.
   */
  restorePersistedSession(): boolean;

  /** Element event bridge (wired once by the player surface). */
  attachElementListeners(): void;
};

export function createPlayerStore(): PlayerStore {
  let state: PlayerState = {
    ...INITIAL_STATE,
    ...readStoredVolume()
  };

  const listeners = new Set<() => void>();

  /*
   * The registry is a MERGING lookup (v4.0.2): registering a
   * collection adds/updates entries and never evicts existing ones,
   * so the playing track keeps its metadata even when the active
   * Media filter (or a route change) registers a narrower list.
   */
  const registry = new Map<string, TrackRegistryEntry>();

  let collectionOrder: string[] = [];

  let audio: PlayerAudioElement | null = null;

  let listenersAttached = false;

  /*
   * Restored position waiting for the resumed track's metadata — set
   * by restorePersistedSession, consumed by handleLoadedMetadata,
   * superseded by any explicit seek.
   */
  let pendingSeekSeconds: number | null = null;

  /* Throttle for timeupdate-driven session writes (ms). */
  const SESSION_WRITE_INTERVAL_MS = 3000;

  let lastSessionWriteAt = 0;

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function setState(patch: Partial<PlayerState>) {
    state = { ...state, ...patch };

    emit();
  }

  function persistSession() {
    if (typeof window === "undefined") {
      return;
    }

    lastSessionWriteAt = Date.now();

    writePersistedSession({
      currentTrackId: state.currentTrackId,
      currentTime: state.currentTime,
      upcoming: state.upcoming,
      history: state.history,
      collectionId: state.collectionId,
      repeat: state.repeat,
      shuffle: state.shuffle
    });
  }

  function ensureAudio(): PlayerAudioElement | null {
    if (audio) {
      return audio;
    }

    audio = audioFactory();

    if (!audio) {
      return null;
    }

    /*
     * preload "none" at creation (whoever made the element): nothing
     * is requested until commitPlaybackStart raises it to "auto".
     */
    audio.preload = "none";

    audio.volume = state.muted ? 0 : state.volume;

    audio.muted = state.muted;

    return audio;
  }

  function resolveTrack(
    trackId: string | null
  ): TrackRegistryEntry | null {
    if (!trackId) {
      return null;
    }

    return registry.get(trackId) ?? null;
  }

  function commitPlaybackStart(
    entry: TrackRegistryEntry,
    options?: { resume?: boolean }
  ) {
    const element = ensureAudio();

    if (!element) {
      setState({
        status: "error",
        error: "Audio playback is not available in this browser."
      });

      return;
    }

    /*
     * An explicit new track supersedes any restored position; only
     * the resume path (restored session / retry) keeps it.
     */
    if (!options?.resume) {
      pendingSeekSeconds = null;
    }

    /*
     * Push the PREVIOUS current track into history when playback
     * switches to a different track (history never holds duplicates).
     */
    const previousId = state.currentTrackId;

    const history =
      previousId && previousId !== entry.id
        ? [...state.history.filter((id) => id !== previousId), previousId]
        : state.history;

    /* Explicit playback intent: this is where loading begins. */
    element.preload = "auto";

    element.src = entry.url;

    /*
     * Resume keeps the CURRENT position: the pending restored seek
     * when one exists, otherwise the state's last known position (a
     * pre-resume scrub, or the failure point of a mid-track error).
     * Any other path starts at zero.
     */
    const resumePosition = options?.resume
      ? Math.max(
          0,
          pendingSeekSeconds ?? state.currentTime
        )
      : 0;

    setState({
      currentTrackId: entry.id,
      history,
      status: "loading",
      error: null,
      currentTime: resumePosition,
      duration: entry.duration ?? 0
    });

    void element.play().catch(() => {
      setState({
        status: "error",
        error: "The browser could not start playback for this track."
      });
    });

    engageObserver();

    persistSession();
  }

  /**
   * First-play engagement signal. The player surface (mini bar,
   * expanded view) is mounted by GlobalMusicPlayerHost only after
   * this DOM event — keeping the whole player UI out of the initial
   * bundle.
   */
  function engageObserver() {
    if (typeof document === "undefined") {
      return;
    }

    document.dispatchEvent(
      new CustomEvent("web:player:engage")
    );
  }

  function advanceToEnd() {
    if (state.repeat === "one") {
      const element = ensureAudio();

      if (element) {
        element.currentTime = 0;

        void element.play().catch(() => {
          setState({
            status: "error",
            error: "The browser could not restart this track."
          });
        });
      }

      return;
    }

    const [nextId, ...rest] = state.upcoming;

    if (nextId) {
      const entry = resolveTrack(nextId);

      if (entry) {
        setState({ upcoming: rest });

        commitPlaybackStart(entry);

        return;
      }

      /* Queued id not in the registry — skip it deterministically. */
      setState({ upcoming: rest });

      advanceToEnd();

      return;
    }

    if (state.repeat === "all" && collectionOrder.length > 0) {
      const firstId = collectionOrder[0];

      const entry = resolveTrack(firstId);

      if (entry) {
        const remaining = collectionOrder.slice(1);

        commitPlaybackStart(entry);

        setState({
          upcoming: state.shuffle
            ? shuffleTrackIds(
                remaining,
                `${state.collectionId ?? "media"}|${firstId}`
              )
            : remaining,
          collectionId: state.collectionId
        });

        return;
      }
    }

    /* Nothing honest left to play — stop, keep the last state. */
    setState({ status: "paused" });

    persistSession();
  }

  function handleEnded() {
    advanceToEnd();
  }

  function handleTimeUpdate() {
    if (!audio) {
      return;
    }

    setState({ currentTime: audio.currentTime });

    /*
     * Redundant position persistence (the pagehide handler is the
     * authoritative one): throttled so timeupdate's ~4 Hz never
     * becomes a storage storm.
     */
    if (
      typeof window !== "undefined" &&
      Date.now() - lastSessionWriteAt > SESSION_WRITE_INTERVAL_MS
    ) {
      persistSession();
    }
  }

  function handleLoadedMetadata() {
    if (!audio) {
      return;
    }

    const duration = audio.duration;

    const knownDuration =
      Number.isFinite(duration) && duration > 0
        ? duration
        : state.duration;

    const patch: Partial<PlayerState> = {
      duration: knownDuration
    };

    /*
     * The restored position (set by restorePersistedSession) is
     * applied exactly once, when the resumed track's metadata is
     * loaded and the duration is real.
     */
    if (pendingSeekSeconds !== null) {
      const target =
        knownDuration > 0
          ? Math.min(Math.max(pendingSeekSeconds, 0), knownDuration)
          : Math.max(pendingSeekSeconds, 0);

      audio.currentTime = target;

      pendingSeekSeconds = null;

      patch.currentTime = target;
    }

    setState(patch);
  }

  function handlePlay() {
    setState({ status: "playing" });
  }

  function handlePause() {
    if (state.status !== "error") {
      setState({ status: "paused" });
    }

    persistSession();
  }

  function handleError() {
    setState({
      status: "error",
      error: "This track could not be loaded or played."
    });
  }

  const store: PlayerStore = {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getCollectionId() {
      return state.collectionId;
    },

    setCollection(tracks, collectionId) {
      /*
       * MERGE, never evict (v4.0.2): the registry is the id → track
       * lookup the whole site reads; the active collection only
       * defines the ORDER the queue is built from. Registering a
       * narrower list (a filter switch, a route change) must never
       * erase the identity of the track that is playing right now.
       */
      collectionOrder = [];

      for (const track of tracks) {
        const entry = toRegistryEntry(track);

        registry.set(entry.id, entry);

        collectionOrder.push(entry.id);
      }

      if (state.collectionId !== collectionId) {
        setState({ collectionId });
      } else {
        emit();
      }
    },

    getTrack(trackId) {
      return resolveTrack(trackId);
    },

    playCollectionFrom(trackId, collectionId) {
      const entry = resolveTrack(trackId);

      if (!entry) {
        return;
      }

      const index = collectionOrder.indexOf(trackId);

      const ordered =
        index >= 0 ? collectionOrder.slice(index + 1) : [];

      const upcoming =
        state.shuffle
          ? shuffleTrackIds(
              ordered,
              `${collectionId ?? state.collectionId ?? "media"}|${trackId}`
            )
          : ordered;

      setState({
        upcoming,
        collectionId: collectionId ?? state.collectionId
      });

      commitPlaybackStart(entry);
    },

    playNow(trackId) {
      const entry = resolveTrack(trackId);

      if (!entry) {
        return;
      }

      commitPlaybackStart(entry);
    },

    playNext(trackId) {
      if (!registry.has(trackId)) {
        return;
      }

      const upcoming = state.upcoming.filter((id) => id !== trackId);

      upcoming.unshift(trackId);

      setState({ upcoming });

      persistSession();
    },

    addToQueue(trackId) {
      if (!registry.has(trackId)) {
        return;
      }

      if (state.upcoming.includes(trackId)) {
        return;
      }

      setState({ upcoming: [...state.upcoming, trackId] });

      persistSession();
    },

    removeFromQueue(trackId) {
      setState({
        upcoming: state.upcoming.filter((id) => id !== trackId)
      });

      persistSession();
    },

    clearUpcoming() {
      setState({ upcoming: [] });

      persistSession();
    },

    selectQueued(trackId) {
      const entry = resolveTrack(trackId);

      if (!entry) {
        return;
      }

      setState({
        upcoming: state.upcoming.filter((id) => id !== trackId)
      });

      commitPlaybackStart(entry);
    },

    togglePlay() {
      if (!state.currentTrackId) {
        /* Nothing selected: start the collection, if one exists. */
        const firstId = collectionOrder[0];

        if (firstId) {
          store.playCollectionFrom(firstId);
        }

        return;
      }

      const element = ensureAudio();

      if (!element) {
        return;
      }
      /*
       * Restored session (after a full reload): the element exists
       * but was never loaded — resuming means committing the current
       * track with its persisted position, not calling play() on an
       * empty element (which every browser rejects).
       */
      if (!element.src) {
        const entry = resolveTrack(state.currentTrackId);

        if (entry) {
          commitPlaybackStart(entry, { resume: true });
        }

        return;
      }

      if (state.status === "playing") {
        element.pause();

        return;
      }

      void element.play().catch(() => {
        setState({
          status: "error",
          error: "The browser could not resume playback."
        });
      });
    },

    pause() {
      const element = ensureAudio();

      element?.pause();

      persistSession();
    },

    stop() {
      const element = ensureAudio();

      if (element) {
        element.pause();

        /* Rewind only a loaded element (an unloaded one has no
         * position to rewind). */
        if (element.src) {
          element.currentTime = 0;
        }
      }

      pendingSeekSeconds = null;

      setState({
        status: "paused",
        currentTime: 0
      });

      persistSession();
    },

    retry() {
      const entry = resolveTrack(state.currentTrackId);

      if (!entry) {
        return;
      }

      /*
       * Retry re-commits the current track. The resume flag keeps a
       * still-pending restored position alive when the FIRST attempt
       * failed before the track ever loaded.
       */
      commitPlaybackStart(entry, { resume: true });
    },

    toggleShuffle() {
      const shuffle = !state.shuffle;

      let upcoming = state.upcoming;

      if (shuffle) {
        /*
         * Deterministic reshuffle of the ONE queue: same collection,
         * same current track → same order (testable, reproducible).
         */
        upcoming = shuffleTrackIds(
          state.upcoming,
          `${state.collectionId ?? "media"}|${state.currentTrackId ?? "none"}`
        );
      } else {
        /* Back to the canonical collection order after the current
         * track (when the current track belongs to the collection).
         */
        const index = state.currentTrackId
          ? collectionOrder.indexOf(state.currentTrackId)
          : -1;

        if (index >= 0) {
          upcoming = collectionOrder.slice(index + 1);
        }
      }

      setState({ shuffle, upcoming });

      persistSession();
    },

    next() {
      const [nextId, ...rest] = state.upcoming;

      const entry = resolveTrack(nextId ?? null);

      if (entry) {
        setState({ upcoming: rest });

        commitPlaybackStart(entry);

        return;
      }

      if (collectionOrder.length > 0) {
        const currentIndex = state.currentTrackId
          ? collectionOrder.indexOf(state.currentTrackId)
          : -1;

        let wrappedId: string | undefined;

        if (state.shuffle) {
          /*
           * No queue, shuffle on: the next track is a deterministic
           * pick from the remaining collection (never the current
           * track again, unless it is all there is).
           */
          const candidates = collectionOrder.filter(
            (id) => id !== state.currentTrackId
          );

          wrappedId =
            candidates.length > 0
              ? shuffleTrackIds(
                  candidates,
                  `${state.collectionId ?? "media"}|${state.currentTrackId ?? "none"}|next`
                )[0]
              : collectionOrder[
                  (currentIndex + 1) % collectionOrder.length
                ];
        } else {
          wrappedId =
            collectionOrder[
              (currentIndex + 1) % collectionOrder.length
            ];
        }

        const wrapped = resolveTrack(wrappedId ?? null);

        if (wrapped && wrappedId !== state.currentTrackId) {
          const wrappedIndex = collectionOrder.indexOf(wrappedId);

          const ordered =
            wrappedIndex >= 0
              ? collectionOrder.slice(wrappedIndex + 1)
              : [];

          commitPlaybackStart(wrapped);

          setState({
            upcoming: state.shuffle
              ? shuffleTrackIds(
                  ordered,
                  `${state.collectionId ?? "media"}|${wrappedId}`
                )
              : ordered
          });

          persistSession();
        }
      }
    },

    previous() {
      const element = ensureAudio();

      const progressed =
        state.currentTime > PREVIOUS_RESTART_THRESHOLD_SECONDS;

      if (element && progressed) {
        element.currentTime = 0;

        setState({ currentTime: 0 });

        persistSession();

        return;
      }

      const history = [...state.history];

      const previousId = history.pop();

      const entry = resolveTrack(previousId ?? null);

      if (entry) {
        setState({ history });

        commitPlaybackStart(entry);

        return;
      }

      if (element) {
        element.currentTime = 0;

        setState({ currentTime: 0 });

        persistSession();
      }
    },

    seek(seconds) {
      const element = ensureAudio();

      if (!element) {
        return;
      }

      const target =
        state.duration > 0
          ? Math.min(Math.max(seconds, 0), state.duration)
          : Math.max(seconds, 0);

      /*
       * An explicit seek always supersedes a restored pending
       * position — the user's gesture wins over the snapshot.
       */
      pendingSeekSeconds = null;

      element.currentTime = target;

      setState({ currentTime: target });

      persistSession();
    },

    setVolume(value) {
      const volume = Math.min(Math.max(value, 0), 1);

      const element = ensureAudio();

      if (element) {
        element.volume = volume;

        if (volume > 0 && state.muted) {
          element.muted = false;

          setState({ muted: false });
        }
      }

      setState({ volume });

      writeStoredVolume(volume, state.muted);
    },

    toggleMute() {
      const muted = !state.muted;

      const element = ensureAudio();

      if (element) {
        element.muted = muted;
      }

      setState({ muted });

      writeStoredVolume(state.volume, muted);
    },

    cycleRepeat() {
      const order: PlayerRepeat[] = ["off", "all", "one"];

      const next =
        order[(order.indexOf(state.repeat) + 1) % order.length];

      setState({ repeat: next });

      persistSession();
    },

    setExpanded(expanded) {
      setState({ expanded });
    },

    restorePersistedSession() {
      const session = readPersistedSession();

      if (!session) {
        return false;
      }

      const entry = resolveTrack(session.currentTrackId);

      /*
       * Honest restore: a session whose track no longer exists in
       * the catalog is not restored at all — the player stays idle
       * rather than showing a ghost.
       */
      if (!entry) {
        return false;
      }

      /*
       * The persisted position becomes a PENDING seek: state shows
       * it immediately (the bar renders "paused at 1:23"), but the
       * element stays untouched — no src, no load, no autoplay. The
       * position lands on the element when the user resumes.
       */
      pendingSeekSeconds =
        session.position > 0 ? session.position : null;

      setState({
        currentTrackId: entry.id,
        upcoming: session.upcoming.filter(
          (id) => registry.has(id) && id !== entry.id
        ),
        history: session.history.filter((id) =>
          registry.has(id)
        ),
        status: "paused",
        error: null,
        currentTime: session.position,
        duration: entry.duration ?? 0,
        repeat: session.repeat,
        shuffle: session.shuffle,
        collectionId: session.collectionId ?? state.collectionId
      });

      return true;
    },

    attachElementListeners() {
      const element = ensureAudio();

      if (!element || listenersAttached) {
        return;
      }

      listenersAttached = true;

      element.addEventListener("ended", handleEnded);
      element.addEventListener("timeupdate", handleTimeUpdate);
      element.addEventListener("loadedmetadata", handleLoadedMetadata);
      element.addEventListener("play", handlePlay);
      element.addEventListener("pause", handlePause);
      element.addEventListener("error", handleError);

      /*
       * The authoritative session write happens when the page is
       * going away — a reload must always find the freshest state.
       */
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", persistSession);

        window.document.addEventListener(
          "visibilitychange",
          () => {
            if (window.document.visibilityState === "hidden") {
              persistSession();
            }
          }
        );
      }

      /*
       * Playback may have started before the player surface mounted
       * (the engage event triggers a dynamic import). Sync the status
       * with the element's reality — events that fired before the
       * listeners attached must not leave the UI stuck on "loading".
       */
      if (!element.paused) {
        setState({ status: "playing" });
      }
    }
  };

  return store;
}

/* ---------------------------------------------------------------- */
/* Module-level singleton                                            */
/* ---------------------------------------------------------------- */

declare global {
  interface Window {
    __webPlayerStore?: PlayerStore;
  }
}

let singleton: PlayerStore | null = null;

/**
 * The application-wide store. Every surface (Media scene, mini
 * player, expanded player) shares this instance — player state is
 * never duplicated across cards, queue and player UI.
 */
export function getPlayerStore(): PlayerStore {
  if (singleton) {
    return singleton;
  }

  if (typeof window !== "undefined") {
    /* Fast refresh / double-hydration safety. */
    if (window.__webPlayerStore) {
      singleton = window.__webPlayerStore;

      return singleton;
    }
  }

  singleton = createPlayerStore();

  if (typeof window !== "undefined") {
    window.__webPlayerStore = singleton;
  }

  return singleton;
}

/**
 * Testing hook: drop the singleton so a test starts from scratch.
 */
export function resetPlayerStoreForTests(): void {
  singleton = null;

  if (typeof window !== "undefined") {
    delete window.__webPlayerStore;
  }
}

/* ---------------------------------------------------------------- */
/* Media Session integration                                         */
/* ---------------------------------------------------------------- */

type MediaSessionActionDetails = {
  action: string;
  fastSeek?: boolean;
  seekTime?: number;
  seekOffset?: number;
};

type MediaSessionLike = {
  metadata: unknown;

  playbackState: string;

  setActionHandler(
    action: string,
    handler:
      | ((details?: MediaSessionActionDetails) => void)
      | null
  ): void;

  setPositionState?(state: {
    duration?: number;
    playbackRate?: number;
    position?: number;
  }): void;
};

const MEDIA_SESSION_SEEK_STEP_SECONDS = 10;

/**
 * Wire the Media Session API to the store (no-op where unsupported).
 * Called once by the global player surface after the audio element
 * exists — the ONLY place Media Session is wired: metadata,
 * playbackState, position, and every supported action (play, pause,
 * stop, previoustrack, nexttrack, seekbackward, seekforward, seekto)
 * route through the one store. Support is feature-detected action by
 * action; the player is fully functional without any of it.
 */
export function attachMediaSession(
  store: PlayerStore
): void {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator)
  ) {
    return;
  }

  const session = (
    navigator as Navigator & {
      mediaSession: MediaSessionLike;
    }
  ).mediaSession;

  const updateMetadata = () => {
    try {
      const track = store.getTrack(
        store.getState().currentTrackId
      );

      if (!track) {
        return;
      }

      /*
       * The WebIDL type is MediaMetadata? — a MediaMetadata INSTANCE
       * (a plain dictionary throws on assignment). Guarded: engines
       * without the constructor simply skip metadata.
       */
      if (typeof window === "undefined" || typeof window.MediaMetadata !== "function") {
        return;
      }

      session.metadata = new window.MediaMetadata({
        title: track.title,
        artist: track.artist ?? "",
        album: track.album ?? "",
        artwork: track.coverUrl
          ? [
              {
                src: track.coverUrl,
                sizes: "512x512",
                type: "image/png"
              }
            ]
          : []
      });
    } catch {
      /*
       * A Media Session failure must never break playback or the
       * store's subscribers — it is an enhancement, not a feature.
       */
    }
  };

  const syncPlaybackState = () => {
    try {
      const status = store.getState().status;

      session.playbackState =
        status === "playing"
          ? "playing"
          : status === "paused" || status === "loading"
            ? "paused"
            : "none";
    } catch {
      /* Enhancement, never a dependency. */
    }
  };

  const syncPositionState = () => {
    try {
      const state = store.getState();

      if (state.duration <= 0) {
        return;
      }

      session.setPositionState?.({
        duration: state.duration,
        playbackRate: 1,
        position: Math.min(
          Math.max(state.currentTime, 0),
          state.duration
        )
      });
    } catch {
      /* Engines reject inconsistent position payloads — skip. */
    }
  };

  const syncAll = () => {
    updateMetadata();

    syncPlaybackState();

    syncPositionState();
  };

  /* Registered one action at a time: per-action support varies. */
  const registerAction = (
    action: string,
    handler: (details?: MediaSessionActionDetails) => void
  ) => {
    try {
      session.setActionHandler(action, handler);
    } catch {
      /* Unsupported on this platform — safe per-action fallback. */
    }
  };

  registerAction("play", () => store.togglePlay());
  registerAction("pause", () => store.pause());
  registerAction("stop", () => store.stop());
  registerAction("previoustrack", () => store.previous());
  registerAction("nexttrack", () => store.next());

  registerAction("seekbackward", () => {
    const state = store.getState();

    store.seek(
      state.currentTime - MEDIA_SESSION_SEEK_STEP_SECONDS
    );
  });

  registerAction("seekforward", () => {
    const state = store.getState();

    store.seek(
      state.currentTime + MEDIA_SESSION_SEEK_STEP_SECONDS
    );
  });

  registerAction("seekto", (details) => {
    if (
      typeof details?.seekTime !== "number" ||
      !Number.isFinite(details.seekTime)
    ) {
      return;
    }

    store.seek(details.seekTime);
  });

  store.subscribe(syncAll);

  syncAll();
}
