"use client";

/*
 * lib/player/usePlayer.ts — React binding for the player store.
 *
 * useSyncExternalStore keeps the store's singleton semantics: Media
 * cards, the mini player and the expanded player all observe ONE
 * state object and can never drift apart.
 */

import { useCallback, useSyncExternalStore } from "react";

import {
  getPlayerStore,
  type PlayerState
} from "@/lib/player/playerStore";

export function usePlayerState(): PlayerState {
  const store = getPlayerStore();

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(listener),
    [store]
  );

  const getSnapshot = useCallback(
    () => store.getState(),
    [store]
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );
}

/**
 * Stable command surface (the store methods are referentially fixed).
 */
export function usePlayerCommands() {
  return getPlayerStore();
}
