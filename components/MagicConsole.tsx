"use client";

import {
  useEffect,
  useState
} from "react";

import RedMagic from "@/components/RedMagic";

import MagicInteractionLayer from "@/components/MagicInteractionLayer";

import {
  subscribeRedMagicPerformance,
  type RedMagicPerformanceSample
} from "@/components/RedMagicTelemetry";

import styles from "@/components/MagicConsole.module.css";

const SOUND_STORAGE_KEY =
  "red-magic-sound-enabled";

function readSoundPreference() {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(
        SOUND_STORAGE_KEY
      ) === "true"
    );
  } catch {
    return false;
  }
}

function writeSoundPreference(
  enabled: boolean
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      SOUND_STORAGE_KEY,
      String(enabled)
    );
  } catch {
    /*
     * Sound still works when localStorage
     * is unavailable.
     */
  }
}

/*
 * Vitality is judged RELATIVE to the display the engine measured, not
 * against an absolute marketing number. A 60 Hz panel sustaining 60 is
 * native-rate smooth; a 120 Hz panel sustaining 75 is degraded. The
 * label stays honest: nothing here claims a guaranteed frame rate.
 */
function vitalityLabel(
  fps: number,
  refreshHz?: number
) {
  if (
    refreshHz !==
      undefined &&
    refreshHz >=
      40
  ) {
    if (
      fps >=
      refreshHz *
        0.9
    ) {
      return refreshHz >=
        118
        ? "120 HZ"
        : `${Math.round(
            refreshHz
          )} HZ`;
    }

    if (
      fps >=
      refreshHz *
        0.72
    ) {
      return "STABLE";
    }

    if (
      fps >=
      refreshHz *
        0.5
    ) {
      return "DEGRADED";
    }

    return "CONSERVING";
  }

  if (
    fps >=
    120
  ) {
    return "120 HZ";
  }

  if (
    fps >=
    105
  ) {
    return "SMOOTH";
  }

  if (
    fps >=
    90
  ) {
    return "STABLE";
  }

  if (
    fps >=
    60
  ) {
    return "DEGRADED";
  }

  return "CONSERVING";
}

function signalLabel(
  energy: number
) {
  if (
    energy < 0.18
  ) {
    return "RESTING";
  }

  if (
    energy < 0.7
  ) {
    return "AWAKE";
  }

  return "ACTIVE";
}

function formLabel(
  quality:
    RedMagicPerformanceSample[
      "quality"
    ]
) {
  if (
    quality ===
    "high"
  ) {
    return "DENSE";
  }

  if (
    quality ===
    "medium"
  ) {
    return "BALANCED";
  }

  return "LIGHT";
}

/*
 * Runtime state label (Runtime v2): the organism's explicit cadence —
 * reduced / suspended / idle / ambient / active / recovery. Rendered
 * in the vitals readout so the engine's runtime state is observable
 * without any new overlay or tooling.
 */
function stateLabel(
  state?: RedMagicPerformanceSample["runtimeState"]
) {
  if (
    !state
  ) {
    return "—";
  }

  return state.toUpperCase();
}

/*
 * Vitals readout — isolated subscriber (perf, v3.1.1).
 *
 * The performance sample arrives roughly every 1.8 s; it used to be
 * React state in MagicConsole itself, so every sample re-rendered the
 * whole console subtree including MagicInteractionLayer and the
 * RedMagic canvas component (a full vDOM diff over the hottest tree
 * in the app for three text labels). The subscription now lives in
 * this leaf component: telemetry ticks re-render only the three
 * vitals values.
 */
function MagicVitals() {
  const [
    sample,
    setSample
  ] =
    useState<RedMagicPerformanceSample | null>(
      null
    );

  useEffect(
    () =>
      subscribeRedMagicPerformance(
        setSample
      ),
    []
  );

  const signal =
    sample
      ? signalLabel(
          sample.pointerEnergy ??
            0
        )
      : "—";

  const vitality =
    sample
      ? vitalityLabel(
          sample.fps,
          sample.refreshHz
        )
      : "—";

  const form =
    sample
      ? formLabel(
          sample.quality
        )
      : "—";

  const state =
    stateLabel(
      sample?.runtimeState
    );

  return (
    <div
      className={
        styles.magicVitals
      }
    >
      <div>
        <span>
          SIGNAL
        </span>

        <strong>
          {signal}
        </strong>
      </div>

      <div>
        <span>
          VITALITY
        </span>

        <strong>
          {vitality}
        </strong>
      </div>

      <div>
        <span>
          FORM
        </span>

        <strong>
          {form}
        </strong>
      </div>

      <div>
        <span>
          STATE
        </span>

        <strong>
          {state}
        </strong>
      </div>
    </div>
  );
}

/*
 * MAGIC CONSOLE (v3.6) — one control surface, one sound.
 *
 * The v3.5 behaviour selector (DRIFT / LISTEN / SURGE) is retired:
 * the organism is a single continuous system whose reactivity comes
 * from interaction, not from a named mode. The only control is the
 * master sound state — SOUND ON / SOUND OFF — wired directly to the
 * RED MAGIC sound engine, which is genuinely audible when ON.
 */
export default function MagicConsole() {
  const [
    soundEnabled,
    setSoundEnabled
  ] =
    useState(false);

  const [
    soundHydrated,
    setSoundHydrated
  ] =
    useState(false);

  useEffect(() => {
    setSoundEnabled(
      readSoundPreference()
    );

    setSoundHydrated(
      true
    );
  }, []);

  const toggleSound =
    () => {
      const next =
        !soundEnabled;

      setSoundEnabled(
        next
      );

      writeSoundPreference(
        next
      );
    };

  return (
    <div
      className={
        styles.magicLab
      }
    >
      <div
        className={
          styles.magicLabBar
        }
      >
        <p
          className={
            styles.magicLabNote
          }
          aria-live="polite"
        >
          {soundEnabled
            ? "Sound is on. The organism's ambient voice is live — move through its field and its intensity follows you."
            : "Sound is off. Turn it on to hear the organism's ambient voice while you interact with it."}
        </p>

        <div
          className={
            styles.magicLabActions
          }
        >
          <button
            type="button"
            className={
              styles.magicSoundControl
            }
            aria-pressed={
              soundEnabled
            }
            aria-label={
              soundEnabled
                ? "Turn RED MAGIC sound off"
                : "Turn RED MAGIC sound on"
            }
            disabled={
              !soundHydrated
            }
            onClick={
              toggleSound
            }
          >
            SOUND{" "}
            {soundEnabled
              ? "ON"
              : "OFF"}
          </button>
        </div>
      </div>

      <div
        className={
          styles.magicLabFrame
        }
      >
        <div
          className={
            styles.magicLabShell
          }
        >
          <MagicInteractionLayer
            soundEnabled={
              soundEnabled
            }
          >
            <RedMagic />
          </MagicInteractionLayer>
        </div>
      </div>

      <MagicVitals />
    </div>
  );
}
