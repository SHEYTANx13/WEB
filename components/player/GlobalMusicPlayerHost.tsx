"use client";

import dynamic from "next/dynamic";

import {
  useEffect,
  useState
} from "react";

import { hasPersistedSession } from "@/lib/player/sessionPresence";

const PlayerSurface = dynamic(
  () => import("@/components/player/PlayerSurface"),
  {
    ssr: false
  }
);

const ENGAGE_EVENT = "web:player:engage";

/*
 * GLOBAL MUSIC PLAYER HOST (v4.0.2) — the ONE mount point of the
 * global Music player, rendered by the ROOT application layout
 * (app/layout.tsx) so the player survives every client-side route
 * change: Home, About, Blog, Work, Research, Contact, the topic
 * hubs, and the Media scene alike. It replaced the v4.0.x mount
 * inside LivingShell, which existed only on the "/" world shell and
 * lost the player UI on every route navigation.
 *
 * It still ships NO player code: it only
 *
 *   1. checks localStorage for a persisted session (a raw string
 *      probe — no store import, no catalog import) and mounts the
 *      lazy surface up front when one exists, so a full browser
 *      reload shows the RESTORED PAUSED player immediately; and
 *   2. listens for the store's one-time engagement signal
 *      (dispatched on the first explicit playback intent) and only
 *      then dynamically imports PlayerSurface.
 *
 * The mini bar, expanded player, queue UI, Media Session wiring, and
 * the single audio element live in the lazy chunk that cannot touch
 * any route's initial bundle or the static export's HTML. The
 * DOM-event bridge (a plain string event) is deliberate: it keeps
 * this host from importing the store module, so the entire player
 * subsystem stays out of the shared bundle until music actually
 * plays (or is restored).
 */
export default function GlobalMusicPlayerHost() {
  const [engaged, setEngaged] =
    useState(false);

  useEffect(() => {
    if (engaged) {
      return;
    }

    /*
     * Restored-session path: a returning visitor (full reload) gets
     * the player surface mounted immediately so the paused player is
     * visible — restoration happens inside the surface and NEVER
     * autoplays; playback resumes only on an explicit gesture.
     */
    if (hasPersistedSession()) {
      setEngaged(true);

      return;
    }

    const handleEngage = () => {
      setEngaged(true);
    };

    document.addEventListener(
      ENGAGE_EVENT,
      handleEngage
    );

    return () => {
      document.removeEventListener(
        ENGAGE_EVENT,
        handleEngage
      );
    };
  }, [engaged]);

  if (!engaged) {
    return null;
  }

  return <PlayerSurface />;
}
