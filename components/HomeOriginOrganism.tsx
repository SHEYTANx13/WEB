"use client";

import { useEffect, useState } from "react";

import type {
  ComponentType
} from "react";

import { BRAND_STAR } from "@/lib/brand";

import {
  allowsSpeculativeNetwork,
  isMemoryConstrained
} from "@/lib/backgroundScheduler";

import { scheduleIdle } from "@/lib/idleScheduler";

import { whenPageSettled } from "@/lib/loadPhase";

import styles from "@/components/scenes/HomeScene.module.css";

/*
 * HOME ORIGIN ORGANISM (v3.0) — the lazy edge of the hero.
 *
 * P0 performance law: the home scene now renders synchronously into
 * the exported HTML (see SceneRegistry), which put HomeScene inside
 * the initial page graph. RedMagic — the multi-thousand-line canvas
 * organism —
 * used to be statically imported here, so the initial payload paid
 * for the whole experimental layer before any user asked for it.
 *
 * This wrapper inverts that:
 * - Server render and first client render show a CSS-only "seed":
 *   the same red-core composition, zero canvas, zero animation code.
 * - After hydration, ONLY when the environment allows it (motion
 *   permitted, no save-data, not a memory-constrained device), the
 *   real organism is fetched through ONE dynamic import() at idle
 *   time and mounted over the seed. The seed stays mounted
 *   underneath so the swap is seamless while the chunk streams in.
 * - Reduced-motion, save-data and low-memory visitors keep the
 *   seed permanently: the hero stays complete, just dormant.
 *
 * IMPLEMENTATION NOTE: this deliberately uses a raw import() plus
 * local state instead of next/dynamic. A dynamic()/lazy boundary
 * suspends during static export — which is exactly what pushed the
 * whole home scene into React's hidden streamed wrapper before
 * (the P0 bug this file helps fix). A plain import() creates the
 * same single async chunk with zero Suspense involvement.
 *
 * The RED MAGIC identity is preserved — it simply arrives when the
 * browser can afford it, instead of blocking or bloating first load.
 */

export default function HomeOriginOrganism() {
  const [
    Organism,
    setOrganism
  ] = useState<ComponentType | null>(
    null
  );

  useEffect(() => {
    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (
      reducedMotion ||
      !allowsSpeculativeNetwork() ||
      isMemoryConstrained()
    ) {
      return;
    }

    /*
     * POST-LOAD SETTLE GATE (v4.0.3): the organism is an enhancement,
     * not content — it starts downloading only after the page has
     * fully loaded and granted one idle gap (see lib/loadPhase.ts).
     * In v4.0.2 the bare idle callback could fire between hydration
     * and first paint, and the ~50KB engine chunk began competing
     * with the hero's first render before anyone had seen the page.
     * The seed stays mounted underneath, so the swap remains
     * seamless whenever the fetch lands.
     */
    let cancelled = false;

    let cancelIdle: (() => void) | null = null;

    void whenPageSettled().then(() => {
      if (cancelled) {
        return;
      }

      cancelIdle = scheduleIdle(() => {
        if (cancelled) {
          return;
        }

        import("@/components/RedMagic")
          .then((module) => {
            if (cancelled) {
              return;
            }

            setOrganism(
              () => module.default
            );
          })
          .catch(() => {
            /* Network hiccup: the seed stays. A later visit retries. */
          });
      }, 2400);
    });

    return () => {
      cancelled = true;

      cancelIdle?.();
    };
  }, []);

  return (
    <>
      <span
        className={
          styles.homeOriginSeed
        }
        aria-hidden="true"
      >
        <span
          className={
            styles.homeOriginSeedGlow
          }
        />

        <span
          className={
            styles.homeOriginSeedRing
          }
        />

        <span
          className={`${styles.homeOriginSeedRing} ${styles.homeOriginSeedRingTwo}`}
        />

        <img
          src={BRAND_STAR.red}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
        />
      </span>

      {Organism && <Organism />}
    </>
  );
}
