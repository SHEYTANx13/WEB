/*
 * tests/player-global.test.ts — the global Music player contract
 * (v4.0.2): persistence, reload restoration (paused, never
 * autoplaying), the pending-seek resume path, singleton/store
 * survival semantics, and the no-request-before-intent performance
 * proofs at the store level.
 *
 * The store runs against a scripted FAKE audio element and a minimal
 * window/localStorage shim (node --test has neither) — no real
 * network, fully deterministic.
 */

import { describe, it, beforeEach, afterEach } from "node:test";

import assert from "node:assert/strict";

import {
  createPlayerStore,
  getPlayerStore,
  resetPlayerStoreForTests,
  setPlayerAudioFactory,
  type PlayerAudioElement
} from "../lib/player/playerStore";

import {
  clearPersistedSessionForTests,
  hasPersistedSession
} from "../lib/player/sessionPresence";

import {
  readPersistedSession,
  writePersistedSession
} from "../lib/player/persistence";

import type { MusicItem } from "../lib/media/normalize";

/* ---------------------------------------------------------------- */
/* Window + storage shim                                             */
/* ---------------------------------------------------------------- */

type StorageShim = Map<string, string>;

const originalWindow = (
  globalThis as { window?: unknown }
).window;

function installWindowShim(): StorageShim {
  const storage: StorageShim = new Map();

  const windowShim = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      }
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      visibilityState: "visible"
    }
  };

  (globalThis as { window?: unknown }).window =
    windowShim;

  return storage;
}

function restoreOriginalWindow() {
  (globalThis as { window?: unknown }).window =
    originalWindow;
}

/* ---------------------------------------------------------------- */
/* Fake audio element                                                */
/* ---------------------------------------------------------------- */

type FakeAudio = PlayerAudioElement & {
  listeners: Map<string, (() => void)[]>;

  emit(type: string): void;

  playCalls: number[];

  sources: string[];
};

function makeFakeAudio(): FakeAudio {
  const listeners = new Map<string, (() => void)[]>();

  const audio: FakeAudio = {
    src: "",
    preload: "",
    volume: 1,
    muted: false,
    currentTime: 0,
    duration: 0,
    paused: true,
    playbackRate: 1,

    listeners,

    playCalls: [],

    sources: [],

    emit(type) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },

    async play() {
      audio.playCalls.push(audio.sources.length);

      audio.paused = false;

      audio.emit("play");

      return;
    },

    pause() {
      audio.paused = true;

      audio.emit("pause");
    },

    load() {},

    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];

      list.push(listener);

      listeners.set(type, list);
    },

    removeEventListener(type, listener) {
      const list = listeners.get(type) ?? [];

      listeners.set(
        type,
        list.filter((entry) => entry !== listener)
      );
    }
  };

  let currentSrc = "";

  Object.defineProperty(audio, "src", {
    get: () => currentSrc,

    set: (value) => {
      currentSrc = value;

      audio.sources.push(value);
    }
  });

  return audio;
}

const TRACKS: MusicItem[] = [
  "One",
  "Two",
  "Three"
].map((title, index) => ({
  id: `Music/${title}.mp3`,
  name: title,
  path: `${title}.mp3`,
  kind: "mp3" as const,
  category: "music" as const,
  title,
  rawUrl: `https://cdn.test/${title}.mp3`,
  githubUrl: `https://github.test/${title}.mp3`,
  coverUrl: undefined,
  source: {
    kind: "contents" as const,
    branch: "Music",
    path: `${title}.mp3`
  },
  track: {
    title,
    artist: "Artist",
    duration: 60 + index,
    source: "manifest" as const
  }
}));

function setup() {
  resetPlayerStoreForTests();

  clearPersistedSessionForTests();

  const audio = makeFakeAudio();

  setPlayerAudioFactory(() => audio);

  const store = createPlayerStore();

  store.setCollection(TRACKS, "media:all");

  /* The browser wires element events via the player surface; tests
   * wire the same path explicitly so the fake element is observed. */
  store.attachElementListeners();

  return { store, audio };
}

beforeEach(() => {
  installWindowShim();
});

afterEach(() => {
  restoreOriginalWindow();

  resetPlayerStoreForTests();

  clearPersistedSessionForTests();
});

/* ---------------------------------------------------------------- */
/* Persistence module                                                */
/* ---------------------------------------------------------------- */

describe("player persistence — session snapshot", () => {
  it("round-trips a session through storage", () => {
    writePersistedSession({
      currentTrackId: "Music/One.mp3",
      currentTime: 41.5,
      upcoming: ["Music/Two.mp3"],
      history: ["Music/Three.mp3"],
      collectionId: "media:all",
      repeat: "all",
      shuffle: true
    });

    assert.equal(hasPersistedSession(), true);

    const session = readPersistedSession();

    assert.deepEqual(session, {
      version: "v1",
      currentTrackId: "Music/One.mp3",
      position: 41.5,
      upcoming: ["Music/Two.mp3"],
      history: ["Music/Three.mp3"],
      collectionId: "media:all",
      repeat: "all",
      shuffle: true
    });
  });

  it("rejects corrupt, foreign, and session-less payloads", () => {
    assert.equal(
      readPersistedSession(),
      null,
      "nothing stored → no session"
    );

    (
      (globalThis as { window: StorageLike }).window
    ).localStorage.setItem(
      "web-player-session",
      "{not json"
    );

    assert.equal(readPersistedSession(), null);

    (
      (globalThis as { window: StorageLike }).window
    ).localStorage.setItem(
      "web-player-session",
      JSON.stringify({ version: "v0", currentTrackId: "x" })
    );

    assert.equal(
      readPersistedSession(),
      null,
      "wrong version → no session"
    );

    (
      (globalThis as { window: StorageLike }).window
    ).localStorage.setItem(
      "web-player-session",
      JSON.stringify({
        version: "v1",
        currentTrackId: "x",
        upcoming: "not-an-array",
        history: []
      })
    );

    assert.equal(
      readPersistedSession(),
      null,
      "malformed queue → no session"
    );
  });

  it("a session without a current track is not a session", () => {
    writePersistedSession({
      currentTrackId: null,
      currentTime: 10,
      upcoming: [],
      history: [],
      collectionId: null,
      repeat: "off",
      shuffle: false
    });

    assert.equal(readPersistedSession(), null);

    assert.equal(hasPersistedSession(), false);
  });
});

type StorageLike = {
  localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
};

/* ---------------------------------------------------------------- */
/* Reload restoration                                                */
/* ---------------------------------------------------------------- */

describe("player store — reload restoration (paused, never autoplaying)", () => {
  it("restores a persisted session as a PAUSED player at the persisted position", () => {
    const { store, audio } = setup();

    /* Simulate a session a previous page load persisted. */
    writePersistedSession({
      currentTrackId: "Music/Two.mp3",
      currentTime: 37,
      upcoming: ["Music/Three.mp3"],
      history: ["Music/One.mp3"],
      collectionId: "media:all",
      repeat: "all",
      shuffle: true
    });

    const restored = store.restorePersistedSession();

    assert.equal(restored, true);

    const state = store.getState();

    assert.equal(state.currentTrackId, "Music/Two.mp3");

    assert.equal(state.status, "paused");

    assert.equal(state.currentTime, 37);

    assert.deepEqual(state.upcoming, ["Music/Three.mp3"]);

    assert.deepEqual(state.history, ["Music/One.mp3"]);

    assert.equal(state.repeat, "all");

    assert.equal(state.shuffle, true);

    /*
     * NO audio request happened: the element was never given a src
     * and play() was never called.
     */
    assert.equal(audio.sources.length, 0);

    assert.equal(audio.playCalls.length, 0);

    assert.equal(audio.paused, true);
  });

  it("restoration requires an explicit gesture to resume — the pending seek lands with the metadata", () => {
    const { store, audio } = setup();

    writePersistedSession({
      currentTrackId: "Music/Two.mp3",
      currentTime: 25,
      upcoming: ["Music/Three.mp3"],
      history: [],
      collectionId: "media:all",
      repeat: "off",
      shuffle: false
    });

    store.restorePersistedSession();

    /* The user's explicit gesture. */
    store.togglePlay();

    assert.equal(
      audio.sources.at(-1),
      "https://cdn.test/Two.mp3",
      "the resume committed the restored track"
    );

    assert.equal(store.getState().status, "playing");

    /* The metadata load applies the restored position exactly once. */
    audio.duration = 60;

    audio.emit("loadedmetadata");

    assert.equal(audio.currentTime, 25);

    assert.equal(store.getState().currentTime, 25);

    audio.currentTime = 26;

    audio.emit("timeupdate");

    assert.equal(
      store.getState().currentTime,
      26,
      "a later metadata event no longer snaps to the restored position"
    );
  });

  it("an explicit seek supersedes the restored position", () => {
    const { store, audio } = setup();

    writePersistedSession({
      currentTrackId: "Music/One.mp3",
      currentTime: 50,
      upcoming: [],
      history: [],
      collectionId: "media:all",
      repeat: "off",
      shuffle: false
    });

    store.restorePersistedSession();

    /* The user scrubs BEFORE resuming. */
    store.seek(12);

    store.togglePlay();

    audio.duration = 60;

    audio.emit("loadedmetadata");

    assert.equal(audio.currentTime, 12);

    assert.equal(store.getState().currentTime, 12);
  });

  it("a stale session whose track left the catalog restores nothing", () => {
    const { store, audio } = setup();

    writePersistedSession({
      currentTrackId: "Music/Gone.mp3",
      currentTime: 12,
      upcoming: [],
      history: [],
      collectionId: "media:all",
      repeat: "off",
      shuffle: false
    });

    assert.equal(store.restorePersistedSession(), false);

    const state = store.getState();

    assert.equal(state.status, "idle");

    assert.equal(state.currentTrackId, null);

    assert.equal(audio.sources.length, 0);
  });

  it("playing a DIFFERENT track after a restore does not inherit its position", () => {
    const { store, audio } = setup();

    writePersistedSession({
      currentTrackId: "Music/One.mp3",
      currentTime: 55,
      upcoming: [],
      history: [],
      collectionId: "media:all",
      repeat: "off",
      shuffle: false
    });

    store.restorePersistedSession();

    store.playCollectionFrom("Music/Two.mp3");

    audio.duration = 61;

    audio.emit("loadedmetadata");

    assert.equal(
      audio.currentTime,
      0,
      "a fresh track starts at zero — no leaked restore position"
    );
  });
});

/* ---------------------------------------------------------------- */
/* Singleton / navigation survival                                   */
/* ---------------------------------------------------------------- */

describe("player store — one store survives navigation (module singleton)", () => {
  it("getPlayerStore returns the SAME instance across calls (route-safe)", () => {
    resetPlayerStoreForTests();

    const first = getPlayerStore();

    const second = getPlayerStore();

    assert.equal(first, second);

    assert.equal(
      (globalThis as { window: { __webPlayerStore?: unknown } })
        .window.__webPlayerStore,
      first
    );
  });

  it("the store, queue, and position survive a simulated route change (no reset path exists)", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    audio.currentTime = 17;

    audio.emit("timeupdate");

    /* A route change touches NO player API — nothing to call. The
     * store is a module singleton: assert the state it still holds. */
    const state = store.getState();

    assert.equal(state.currentTrackId, "Music/One.mp3");

    assert.equal(state.currentTime, 17);

    assert.deepEqual(state.upcoming, [
      "Music/Two.mp3",
      "Music/Three.mp3"
    ]);

    assert.equal(audio.paused, false);

    /* The element keeps playing — no pause/src reset happened. */
    assert.equal(audio.sources.length, 1);
  });
});

/* ---------------------------------------------------------------- */
/* Performance proofs (store level)                                  */
/* ---------------------------------------------------------------- */

describe("player store — no request before intent (performance contract)", () => {
  it("no audio source is assigned until an explicit playback intent", () => {
    const { store, audio } = setup();

    /* Catalog registration alone requests nothing. */
    store.setCollection(TRACKS, "media:all");

    assert.equal(audio.sources.length, 0);

    assert.equal(audio.playCalls.length, 0);

    /* Neither does a restored (paused) session. */
    writePersistedSession({
      currentTrackId: "Music/One.mp3",
      currentTime: 5,
      upcoming: [],
      history: [],
      collectionId: "media:all",
      repeat: "off",
      shuffle: false
    });

    store.restorePersistedSession();

    assert.equal(audio.sources.length, 0);

    assert.equal(audio.playCalls.length, 0);

    /* Only the intent loads audio. */
    store.playCollectionFrom("Music/One.mp3");

    assert.equal(audio.sources.length, 1);

    assert.equal(audio.sources[0], "https://cdn.test/One.mp3");
  });

  it("the session snapshot is written at meaningful transitions", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    const afterPlay = readPersistedSession();

    assert.equal(afterPlay?.currentTrackId, "Music/One.mp3");

    assert.deepEqual(afterPlay?.upcoming, [
      "Music/Two.mp3",
      "Music/Three.mp3"
    ]);

    store.addToQueue("Music/One.mp3");

    assert.deepEqual(
      readPersistedSession()?.upcoming,
      ["Music/Two.mp3", "Music/Three.mp3", "Music/One.mp3"],
      "queue changes persist immediately"
    );

    store.toggleShuffle();

    assert.equal(readPersistedSession()?.shuffle, true);

    store.cycleRepeat();

    assert.equal(readPersistedSession()?.repeat, "all");
  });
});
