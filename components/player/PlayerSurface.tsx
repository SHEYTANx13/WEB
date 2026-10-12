"use client";

import { useEffect } from "react";

import {
  attachMediaSession,
  getPlayerStore
} from "@/lib/player/playerStore";

import { usePlayerState } from "@/lib/player/usePlayer";

import { getMusicItems } from "@/lib/mediaRepository";

import MiniPlayer from "@/components/player/MiniPlayer";

import ExpandedPlayer from "@/components/player/ExpandedPlayer";

import styles from "@/components/player/Player.module.css";

/*
 * PLAYER SURFACE (v4.0.2) — the rendered shell of the global player.
 *
 * Mounted lazily by GlobalMusicPlayerHost (the root-layout host)
 * either after the first playback intent or when a persisted session
 * exists after a full reload — so this module (and the single
 * audio element it wires) never loads for visitors who never press
 * play and never saved a session. Renders:
 *
 *   - MiniPlayer: persistent bottom bar (desktop) / sticky compact
 *     bar (mobile) — the always-visible player surface on EVERY route
 *   - ExpandedPlayer: portal overlay with large artwork, full
 *     controls and the queue, opened on demand
 *
 * On mount it registers the FULL music catalog (module-scope data —
 * zero network) into the one store, restores any persisted session as
 * a PAUSED player (never autoplaying), wires the audio element's
 * event bridge once, and centralizes the Media Session integration.
 * The Media scene refines the registered collection when it mounts —
 * it is a catalog/intent surface, never the player's owner.
 *
 * A flow spacer keeps page content scrollable clear of the bar.
 */
export default function PlayerSurface() {
  const state = usePlayerState();

  useEffect(() => {
    const store = getPlayerStore();

    /*
     * The catalog registry: the full Music collection, derived once
     * at module scope from the build-time manifest. Registering it
     * here (not only inside the Media scene) is what lets a session
     * restored on ANY route resolve its track, queue, and position.
     */
    store.setCollection(
      getMusicItems(),
      "media:catalog"
    );

    /*
     * Reload restore: paused player at the persisted position. A
     * first visit has no session — this is a no-op. Restoration
     * never assigns the audio element's src, so NO audio request
     * happens before the user's next explicit gesture.
     */
    store.restorePersistedSession();

    store.attachElementListeners();

    attachMediaSession(store);
  }, []);

  /*
   * Honest visibility: the bar renders only when there is something
   * to show (a selected track or any non-idle status). A stale
   * persisted session that cannot resolve resolves nothing — the
   * surface mounts, restores no state, and renders no empty bar.
   */
  const visible =
    state.status !== "idle" ||
    state.currentTrackId !== null;

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        className={
          styles.surfaceSpacer
        }
        aria-hidden="true"
      />

      <MiniPlayer />

      {state.expanded && <ExpandedPlayer />}
    </>
  );
}
