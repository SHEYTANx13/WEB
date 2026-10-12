"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { usePathname } from "next/navigation";

import {
  ROUTE_PROGRESS_CAP_MS,
  ROUTE_PROGRESS_GRACE_MS
} from "@/lib/loadPhase";

import styles from "@/components/RouteProgress.module.css";

/*
 * ROUTE PROGRESS (v4.0.5) — the ONE loading signal for real
 * document route navigation, mounted exactly once from the ROOT
 * layout so it survives every App Router navigation (the same law
 * as the global Music Player host). It replaces the v4.0.4
 * full-screen route overlay: normal tab navigation on a document
 * site should feel like a polished large website, not an
 * application splash screen.
 *
 * Experience contract:
 *
 *   NAV-ISLAND CLICK (internal link, normal click only)
 *     → the navigation island fires ROUTE_PROGRESS_EVENT
 *     → navigation starts IMMEDIATELY (never prevented, never
 *       delayed — the router proceeds exactly as it would have)
 *     → GRACE PERIOD (ROUTE_PROGRESS_GRACE_MS): fast/warmed/cached
 *       navigations commit inside it and never show anything
 *     → a 2px indeterminate red line appears at the very top of
 *       the viewport — only while the navigation is unresolved
 *     → destination pathname commits (usePathname)
 *     → the destination paints (double rAF), then the line fades
 *
 * Honesty contract: display-only — pointer-events: none in every
 * state, indeterminate motion only (no fake percentage), no
 * minimum duration, no focus trap, no scroll lock, no scroll
 * noise. The line is decorative chrome (aria-hidden): the router
 * itself announces the destination, so an extra live region would
 * only add noise for assistive technology.
 *
 * Race contract: every intent carries a monotonic token; timers
 * and dismissal callbacks act only while their token is the
 * LATEST one, so rapid repeated clicks keep the signal continuous
 * under the newest navigation and a stale navigation can never
 * dismiss (or re-show) the latest state. ROUTE_PROGRESS_CAP_MS is
 * a safety valve that clears a silently-died navigation.
 *
 * Reduced motion: the sweep collapses to a static thin line —
 * presence without motion. Without JavaScript the line never
 * shows (the html.reveal-js gate keeps it invisible in the static
 * export).
 *
 * Separation of concerns (v4.0.5): world-scene module loading
 * keeps its own system (SceneLoadingScreen, scene variant); this
 * component never touches it. Exactly ONE mechanism exists for
 * document-route navigation.
 */

/**
 * The DOM event the navigation island (UnifiedSiteNav) dispatches
 * on a genuine internal navigation click. A string constant on the
 * window event bus — the two systems share a contract, not a
 * bundle: the island owns WHICH clicks are navigations (modifier /
 * new-tab / external / same-route exclusions live there); this
 * host owns everything else (timing, dismissal, motion).
 */
export const ROUTE_PROGRESS_EVENT = "web:route-progress";

type PendingProgress = {
  /** Monotonic intent token — the latest intent always wins. */
  token: number;

  /** The normalized path the navigation started from. */
  startedFrom: string;
};

export default function RouteProgress() {
  const pathname = usePathname();

  const [active, setActive] =
    useState(false);

  const pendingRef =
    useRef<PendingProgress | null>(null);

  const tokenRef = useRef(0);

  /*
   * The event listener closes over the LATEST pathname (usePathname
   * in render scope would freeze it at mount time — the listener is
   * registered once).
   */
  const pathnameRef = useRef(pathname);

  const graceTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const capTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const clearTimers = useCallback(() => {
    if (
      graceTimerRef.current !== null
    ) {
      clearTimeout(
        graceTimerRef.current
      );

      graceTimerRef.current = null;
    }

    if (capTimerRef.current !== null) {
      clearTimeout(
        capTimerRef.current
      );

      capTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    clearTimers();

    pendingRef.current = null;

    setActive(false);
  }, [clearTimers]);

  /*
   * Dismissal lets the destination PAINT before the line starts
   * fading (double rAF), so the exit reads as "destination settled
   * in" instead of a flicker. Guarded by the intent token: a newer
   * intent that arrived inside the two frames owns the signal and
   * cannot be dismissed by the stale callback.
   */
  const scheduleDismissal = useCallback(
    (token: number) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (
            pendingRef.current?.token !==
            token
          ) {
            return;
          }

          finish();
        });
      });
    },
    [finish]
  );

  /*
   * ROUTE READINESS — the pathname commits when the destination
   * route has rendered. Matching the pending origin dismisses the
   * signal; a commit to ANY other path (back/forward during a
   * pending navigation, router fallback) also ends it — a committed
   * route means the navigation is over, and a newer intent re-arms
   * everything.
   */
  useEffect(() => {
    const pending =
      pendingRef.current;

    if (!pending) {
      return;
    }

    const current =
      pathname ?? "/";

    if (current === pending.startedFrom) {
      return;
    }

    scheduleDismissal(
      pending.token
    );
  }, [pathname, scheduleDismissal]);

  useEffect(() => {
    const handleIntent = () => {
      /*
       * LATEST NAVIGATION WINS: bump the token, supersede any
       * pending progress, restart the grace period. An already
       * visible line simply stays visible — no flicker between
       * rapid clicks.
       */
      const token =
        ++tokenRef.current;

      pendingRef.current = {
        token,
        startedFrom:
          pathnameRef.current ?? "/"
      };

      clearTimers();

      graceTimerRef.current =
        setTimeout(() => {
          if (
            pendingRef.current?.token !==
            token
          ) {
            return;
          }

          setActive(true);
        }, ROUTE_PROGRESS_GRACE_MS);

      /*
       * Safety cap (not a duration): a navigation that silently
       * dies must not leave a zombie line. A committed route
       * dismisses long before this through the pathname effect.
       */
      capTimerRef.current =
        setTimeout(() => {
          if (
            pendingRef.current?.token !==
            token
          ) {
            return;
          }

          finish();
        }, ROUTE_PROGRESS_CAP_MS);
    };

    window.addEventListener(
      ROUTE_PROGRESS_EVENT,
      handleIntent
    );

    return () => {
      window.removeEventListener(
        ROUTE_PROGRESS_EVENT,
        handleIntent
      );
    };
  }, [clearTimers, finish]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return (
    <div
      className={
        styles.routeProgress
      }
      data-active={
        active ? "true" : "false"
      }
      aria-hidden="true"
    />
  );
}
