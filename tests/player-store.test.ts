/*
 * tests/player-store.test.ts — the global player store: queue
 * semantics, next/previous gestures, repeat/auto-advance, playback
 * error state, and single-audio-element guarantees.
 *
 * The store runs against a scripted FAKE audio element — no real
 * network, no real decoder, fully deterministic.
 */

import { describe, it, beforeEach } from "node:test";

import assert from "node:assert/strict";

import {
  createPlayerStore,
  setPlayerAudioFactory,
  resetPlayerStoreForTests,
  type PlayerAudioElement
} from "../lib/player/playerStore";

import { clearPersistedSessionForTests } from "../lib/player/sessionPresence";

import {
  writePersistedSession
} from "../lib/player/persistence";

import {
  hashSeed,
  shuffleTrackIds
} from "../lib/player/shuffle";

import type { MusicItem } from "../lib/media/normalize";

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

  /* Track the src assignments for assertions. */
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
  "Three",
  "Four"
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
    duration: 30 + index,
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

  /* The browser wires element events via PlayerSurface; tests wire
   * the same path explicitly so the fake element is observed. */
  store.attachElementListeners();

  return { store, audio };
}

describe("player store — play intent and single element", () => {
  beforeEach(() => {
    resetPlayerStoreForTests();
  });

  it("creates exactly ONE audio element and only on play intent", () => {
    let created = 0;

    resetPlayerStoreForTests();

    setPlayerAudioFactory(() => {
      created += 1;

      return makeFakeAudio();
    });

    const store = createPlayerStore();

    store.setCollection(TRACKS, "media:all");

    assert.equal(created, 0, "no audio before any intent");

    store.playCollectionFrom("Music/Two.mp3");

    assert.equal(created, 1, "exactly one element");

    store.playNow("Music/Three.mp3");

    assert.equal(created, 1, "still one element across tracks");

    store.next();

    assert.equal(created, 1);
  });

  it("playCollectionFrom builds the queue from the collection order", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/Two.mp3");

    const state = store.getState();

    assert.equal(state.currentTrackId, "Music/Two.mp3");
    assert.deepEqual(state.upcoming, [
      "Music/Three.mp3",
      "Music/Four.mp3"
    ]);
    assert.equal(state.history.length, 0);
    assert.equal(audio.sources[0], "https://cdn.test/Two.mp3");
  });
});

describe("player store — queue operations", () => {
  it("play next inserts at the head; add appends; duplicates collapse", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    store.playNext("Music/Four.mp3");

    assert.deepEqual(store.getState().upcoming, [
      "Music/Four.mp3",
      "Music/Two.mp3",
      "Music/Three.mp3"
    ]);

    store.addToQueue("Music/Four.mp3");

    assert.equal(
      store.getState().upcoming.filter((id) => id === "Music/Four.mp3")
        .length,
      1
    );

    store.addToQueue("Music/One.mp3");

    assert.deepEqual(store.getState().upcoming, [
      "Music/Four.mp3",
      "Music/Two.mp3",
      "Music/Three.mp3",
      "Music/One.mp3"
    ]);
  });

  it("remove drops one entry; clear empties upcoming; current survives", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    store.removeFromQueue("Music/Two.mp3");

    assert.deepEqual(store.getState().upcoming, [
      "Music/Three.mp3",
      "Music/Four.mp3"
    ]);

    store.clearUpcoming();

    assert.deepEqual(store.getState().upcoming, []);
    assert.equal(store.getState().currentTrackId, "Music/One.mp3");
  });

  it("select queued track plays it immediately and removes it from the queue", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    store.selectQueued("Music/Three.mp3");

    const state = store.getState();

    assert.equal(state.currentTrackId, "Music/Three.mp3");
    /* Three left the queue; the rest keep their order. */
    assert.deepEqual(state.upcoming, ["Music/Two.mp3", "Music/Four.mp3"]);
    assert.deepEqual(state.history, ["Music/One.mp3"]);
    assert.equal(audio.sources.at(-1), "https://cdn.test/Three.mp3");
  });

  it("queued ids outside the registry are refused (deterministic skip)", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    /* Ghost id (not in the registry) — addToQueue refuses it so the
     * queue can never carry an unplayable entry. */
    store.addToQueue("Music/Ghost.mp3");

    assert.deepEqual(store.getState().upcoming, [
      "Music/Two.mp3",
      "Music/Three.mp3",
      "Music/Four.mp3"
    ]);
  });
});

describe("player store — next / previous / auto-advance", () => {
  it("end of track advances into the queue (auto-advance)", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");

    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/Three.mp3");
  });

  it("repeat one replays the current track", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    store.cycleRepeat();

    assert.equal(store.getState().repeat, "all");

    store.cycleRepeat();

    assert.equal(store.getState().repeat, "one");

    const before = audio.sources.length;

    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/One.mp3");
    assert.equal(audio.sources.length, before, "src unchanged — replay");
  });

  it("repeat all restarts the collection when the queue drains", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/Three.mp3");

    store.cycleRepeat(); /* off → all */

    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/Four.mp3");

    audio.emit("ended");

    assert.equal(
      store.getState().currentTrackId,
      "Music/One.mp3",
      "collection restart"
    );
  });

  it("stops honestly when the queue drains with repeat off", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/Four.mp3");

    audio.emit("ended");

    const state = store.getState();

    assert.equal(state.upcoming.length, 0);
    assert.equal(state.status, "paused");
    assert.equal(state.currentTrackId, "Music/Four.mp3");
  });

  it("previous restarts when sufficiently progressed, steps history near the start", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    /* Sufficiently progressed → restart the current track. */
    store.seek(10);

    assert.equal(store.getState().currentTime, 10);

    store.previous();

    assert.equal(store.getState().currentTrackId, "Music/One.mp3");
    assert.equal(store.getState().currentTime, 0);

    /* Advance into Two; history now holds One. */
    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");

    /* Near the beginning → the previous gesture steps history back. */
    store.previous();

    assert.equal(store.getState().currentTrackId, "Music/One.mp3");

    /* History still holds Two (the track we stepped away from), so
     * previous keeps walking back through it — standard behaviour. */
    store.previous();

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");
  });

  it("previous with empty history and no progress restarts the current track", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/Two.mp3");

    store.seek(20);

    store.previous();

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");

    /* History is empty (no track change yet) — a second previous at
     * the very start stays honest and restarts again. */
    store.previous();

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");
  });

  it("manual next walks the queue, then wraps the collection", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    store.next();

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");

    store.clearUpcoming();

    store.next();

    assert.equal(store.getState().currentTrackId, "Music/Three.mp3");
  });
});

describe("player store — state and errors", () => {
  it("tracks play/pause status and time from element events", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    assert.equal(store.getState().status, "playing");

    audio.currentTime = 12;

    audio.emit("timeupdate");

    assert.equal(store.getState().currentTime, 12);

    audio.pause();

    assert.equal(store.getState().status, "paused");

    store.togglePlay();

    assert.equal(store.getState().status, "playing");
  });

  it("surfaces playback errors without crashing the queue", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    audio.emit("error");

    assert.equal(store.getState().status, "error");
    assert.ok(store.getState().error);

    audio.emit("ended");

    assert.equal(store.getState().currentTrackId, "Music/Two.mp3");
  });

  it("volume persists through the store contract (0..1 clamped)", () => {
    const { store } = setup();

    store.setVolume(1.5);

    assert.equal(store.getState().volume, 1);

    store.setVolume(-2);

    assert.equal(store.getState().volume, 0);

    store.setVolume(0.42);

    assert.equal(store.getState().volume, 0.42);

    store.toggleMute();

    assert.equal(store.getState().muted, true);

    store.toggleMute();

    assert.equal(store.getState().muted, false);
  });

  it("seek clamps into the known duration (manifest until element reports)", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    /* The track registry carries duration 30 s for "One". */
    assert.equal(store.getState().duration, 30);

    store.seek(999);

    assert.equal(store.getState().currentTime, 30);

    store.seek(-10);

    assert.equal(store.getState().currentTime, 0);
  });

  it("element-reported duration wins over the manifest once loaded", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    audio.duration = 42.5;

    audio.emit("loadedmetadata");

    assert.equal(store.getState().duration, 42.5);
  });

  it("expanded toggles", () => {
    const { store } = setup();

    assert.equal(store.getState().expanded, false);

    store.setExpanded(true);

    assert.equal(store.getState().expanded, true);
  });

  it("getTrack resolves registry entries and tolerates ghosts", () => {
    const { store } = setup();

    assert.equal(store.getTrack("Music/One.mp3")?.title, "One");
    assert.equal(store.getTrack("Music/Ghost.mp3"), null);
    assert.equal(store.getTrack(null), null);
  });
});

describe("player store — v4.0.2 additions: shuffle, stop, retry, preload", () => {
  it("preload stays \"none\" until an explicit playback intent raises it to \"auto\"", () => {
    const { store, audio } = setup();

    /* The element exists (wired by the surface) but requests nothing. */
    assert.equal(audio.preload, "none");

    store.playCollectionFrom("Music/One.mp3");

    assert.equal(audio.preload, "auto", "loading begins with the intent");

    audio.pause();

    store.togglePlay();

    assert.equal(audio.preload, "auto");
  });

  it("shuffle reorders the ONE queue deterministically (permutation, stable seed)", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    const canonical = [...store.getState().upcoming];

    store.toggleShuffle();

    const shuffled = store.getState().upcoming;

    assert.equal(store.getState().shuffle, true);

    assert.equal(shuffled.length, canonical.length);

    assert.deepEqual(
      [...shuffled].sort(),
      [...canonical].sort(),
      "the shuffled queue is a permutation of the canonical queue"
    );

    /* Deterministic: the same seed produces the same order. */
    assert.deepEqual(
      shuffleTrackIds(canonical, "media:all|Music/One.mp3"),
      shuffled
    );

    /* Toggling off restores the canonical order after the current. */
    store.toggleShuffle();

    assert.equal(store.getState().shuffle, false);

    assert.deepEqual(store.getState().upcoming, canonical);
  });

  it("playCollectionFrom builds a shuffled queue when shuffle is on", () => {
    const { store } = setup();

    store.toggleShuffle();

    store.playCollectionFrom("Music/One.mp3");

    const upcoming = store.getState().upcoming;

    assert.equal(upcoming.length, 3);

    assert.deepEqual(
      [...upcoming].sort(),
      [
        "Music/Four.mp3",
        "Music/Three.mp3",
        "Music/Two.mp3"
      ]
    );

    assert.notDeepEqual(
      upcoming,
      ["Music/Two.mp3", "Music/Three.mp3", "Music/Four.mp3"],
      "the deterministic shuffle actually reordered the queue (seed-fixed expectation)"
    );

    /* Deterministic against the documented seed. */
    assert.deepEqual(
      shuffleTrackIds(
        ["Music/Two.mp3", "Music/Three.mp3", "Music/Four.mp3"],
        "media:all|Music/One.mp3"
      ),
      upcoming
    );
  });

  it("stop pauses and rewinds; the track stays selected", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/Two.mp3");

    audio.currentTime = 12;

    audio.emit("timeupdate");

    store.stop();

    const state = store.getState();

    assert.equal(state.status, "paused");

    assert.equal(state.currentTime, 0);

    assert.equal(state.currentTrackId, "Music/Two.mp3");

    assert.equal(audio.currentTime, 0);

    assert.equal(audio.paused, true);
  });

  it("retry re-commits the current track after an error", () => {
    const { store, audio } = setup();

    store.playCollectionFrom("Music/One.mp3");

    audio.emit("error");

    assert.equal(store.getState().status, "error");

    const sourcesBefore = audio.sources.length;

    store.retry();

    /* The fake audio plays synchronously: the retry already reached
     * "playing" through the element's play event. */
    assert.equal(store.getState().status, "playing");

    assert.equal(
      audio.sources.length,
      sourcesBefore + 1,
      "retry re-assigns the source"
    );

    assert.equal(store.getState().currentTrackId, "Music/One.mp3");

    assert.equal(store.getState().error, null);
  });

  it("registering a narrower collection never evicts the playing track (registry merge)", () => {
    const { store } = setup();

    store.playCollectionFrom("Music/One.mp3");

    /* A filter switch to "book" registers an empty music list. */
    store.setCollection([], "media:book");

    const state = store.getState();

    assert.equal(state.currentTrackId, "Music/One.mp3");

    assert.equal(
      store.getTrack("Music/One.mp3")?.title,
      "One",
      "the playing track keeps its metadata"
    );

    assert.deepEqual(state.upcoming, [
      "Music/Two.mp3",
      "Music/Three.mp3",
      "Music/Four.mp3"
    ]);
  });

  it("next with an empty queue and shuffle on never repeats the current track", () => {
    const { store } = setup();

    store.toggleShuffle();

    store.playCollectionFrom("Music/One.mp3");

    store.clearUpcoming();

    store.next();

    assert.notEqual(
      store.getState().currentTrackId,
      "Music/One.mp3"
    );

    assert.equal(store.getState().upcoming.length, 2);

    assert.equal(store.getState().shuffle, true);
  });
});

describe("player store — shuffle unit contract", () => {
  it("hashSeed is stable and differs across seeds", () => {
    assert.equal(hashSeed("a|b"), hashSeed("a|b"));

    assert.notEqual(hashSeed("a|b"), hashSeed("b|a"));
  });

  it("shuffleTrackIds is deterministic and never mutates its input", () => {
    const ids = ["a", "b", "c", "d", "e"];

    const first = shuffleTrackIds(ids, "seed");

    const second = shuffleTrackIds(ids, "seed");

    assert.deepEqual(first, second);

    assert.deepEqual(ids, ["a", "b", "c", "d", "e"]);

    assert.deepEqual([...first].sort(), [...ids].sort());
  });

  it("shuffleTrackIds degenerates honestly for empty and single queues", () => {
    assert.deepEqual(shuffleTrackIds([], "x"), []);

    assert.deepEqual(shuffleTrackIds(["only"], "x"), ["only"]);
  });
});
