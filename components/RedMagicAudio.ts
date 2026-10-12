import type {
  RedMagicInteractionDetail,
  RedMagicInteractionType
} from "@/components/RedMagicInteraction";

/*
 * RED MAGIC SOUND ENGINE (v3.6) — ONE engine, ONE sound.
 *
 * There are no named modes and no profiles: a single ambient
 * synthesis graph gives the organism one continuous sonic
 * identity, and interaction changes its intensity and timbre —
 * never its character.
 *
 * Graph:
 *
 *   low body (52 Hz + 78 Hz sines, warm fifth)
 *   harmonic body (104 Hz triangle)          → lowpass "bodyFilter"
 *   shimmer (416 Hz + 624 Hz sines)          → bandpass, slow tremolo
 *   breath LFO (0.045 Hz) → bodyFilter.frequency ± 55 Hz
 *   texture (looping noise)                  → bandpass, activity-driven
 *
 *   ambient bus ─┐
 *   transient bus┴→ compressor (soft safety) → master → destination
 *
 * Interaction contract (unchanged event stream):
 * - "move"/"charge" events set the continuous intensity target
 *   (energy/proximity open the filter, raise body/shimmer/texture)
 * - "impact"/"flick"/"release"/"orbit"/"enter"/"leave" trigger short
 *   transient envelopes layered on top of the ambient bed
 * - intensity self-decays toward idle when interaction stops
 *
 * Browser policy contract:
 * - the AudioContext is ONLY constructed once the page has seen a
 *   real user activation (toggle click, pointerdown, keydown) —
 *   never during hydration — so the engine can never log an
 *   autoplay-policy warning
 * - a stored ON preference is restored at mount but only becomes
 *   audible after the first user gesture anywhere on the page
 * - tab hidden → suspend; tab visible → resume if enabled
 * - OFF fades the master gain out and suspends the context
 */

type AudioNodes = {
  master: GainNode;
  compressor: DynamicsCompressorNode;
  ambientGain: GainNode;
  transientGain: GainNode;
  bodyGain: GainNode;
  bodyFilter: BiquadFilterNode;
  lowOscillator: OscillatorNode;
  fifthOscillator: OscillatorNode;
  harmonicOscillator: OscillatorNode;
  shimmerGain: GainNode;
  shimmerFilter: BiquadFilterNode;
  shimmerOscillator: OscillatorNode;
  shimmerOvertone: OscillatorNode;
  shimmerTremolo: OscillatorNode;
  shimmerTremoloGain: GainNode;
  breathLfo: OscillatorNode;
  breathLfoGain: GainNode;
  textureSource: AudioBufferSourceNode;
  textureGain: GainNode;
  textureFilter: BiquadFilterNode;
};

const STORAGE_KEY =
  "red-magic-sound-enabled";

/*
 * Gain staging (v3.6): the v3.5 engine topped out near -50 dB
 * (master 0.075 × ambient 0.018–0.052) — technically running,
 * practically inaudible. One honest level plan replaces it: a
 * firm master, a compressor as the safety net, and ambient
 * layers that sit clearly above the noise floor at idle and
 * rise with interaction.
 */
const MASTER_GAIN = 0.85;

const FADE_CONSTANT = 0.12;

const EVENT_COOLDOWN_MS = 72;

/*
 * Minimum spacing between ambient parameter updates. Interaction
 * events include one coalesced "move" per animation frame; applying
 * setTargetAtTime 60×/s to parameters with 0.14–0.18 s smoothing
 * constants is inaudible busywork. 90 ms (≈11 Hz) is far above the
 * smoothing resolution — the audible response is identical.
 */
const AMBIENT_UPDATE_MIN_S = 0.09;

/*
 * Interaction intensity decays toward idle when the pointer stops.
 * The organism itself keeps energy internal state; the engine only
 * hears events, so it relaxes on its own clock.
 */
const INTENSITY_DECAY_MS = 320;

const INTENSITY_DECAY_FACTOR = 0.9;

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function isAudioContext(
  value: unknown
): value is AudioContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "createOscillator" in value &&
    "createGain" in value
  );
}

/*
 * True once the browser has registered ANY user activation on the
 * page (sticky activation). Constructing an AudioContext before
 * this is what prints "The AudioContext was not allowed to start"
 * into the console — the engine refuses to do it.
 */
function hasStickyActivation(): boolean {
  if (
    typeof navigator === "undefined"
  ) {
    return false;
  }

  const activation = (
    navigator as Navigator & {
      userActivation?: {
        hasBeenActive?: boolean;
      };
    }
  ).userActivation;

  return (
    activation?.hasBeenActive ===
    true
  );
}

export class RedMagicAudio {
  private context:
    AudioContext | null =
    null;

  private nodes:
    AudioNodes | null =
    null;

  private enabled =
    false;

  private intensity = 0;

  private charge = 0;

  private visible = true;

  private lastEventTime = 0;

  private lastAmbientUpdateTime = -1;

  private lastDecayTime = -1;

  private suspendTimer:
    ReturnType<
      typeof setTimeout
    > | null =
    null;

  private decayTimer:
    ReturnType<
      typeof setInterval
    > | null =
    null;

  private attachedTarget:
    EventTarget | null =
    null;

  private visibilityHandler:
    (() => void) | null =
    null;

  /*
   * One-shot gesture listeners (pointerdown / keydown / touchend)
   * used when a stored ON preference is restored at mount: the
   * first real gesture anywhere on the page starts the engine.
   * They are passive, capture-phase, and removed the moment the
   * graph is running (or the engine is turned off).
   */
  private gestureArmed =
    false;

  private gestureHandler:
    (() => void) | null =
    null;

  constructor() {
    this.enabled =
      this.readPreference();

    this.visibilityHandler =
      () => {
        void this.handleVisibilityChange();
      };

    if (
      typeof document !==
      "undefined"
    ) {
      document.addEventListener(
        "visibilitychange",
        this.visibilityHandler
      );

      this.visible =
        document.visibilityState ===
        "visible";
    }
  }

  private readPreference() {
    if (
      typeof window ===
      "undefined"
    ) {
      return false;
    }

    try {
      return (
        window.localStorage.getItem(
          STORAGE_KEY
        ) === "true"
      );
    } catch {
      return false;
    }
  }

  private writePreference(
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
        STORAGE_KEY,
        String(enabled)
      );
    } catch {
      /*
       * localStorage can be unavailable in restrictive
       * privacy modes. Audio functionality should continue.
       */
    }
  }

  public isEnabled() {
    return this.enabled;
  }

  public setEnabled(
    enabled: boolean,
    options?: {
      deferStart?: boolean;
    }
  ) {
    this.enabled =
      enabled;

    this.writePreference(
      enabled
    );

    if (
      enabled
    ) {
      /*
       * deferStart (v2.8): restoring a stored ON preference at
       * mount must not construct the AudioContext before any user
       * gesture. A deferred start records the preference and arms
       * the one-shot gesture listeners; the first pointerdown /
       * keydown / touchend anywhere (or the toggle click itself,
       * which calls setEnabled without deferStart from inside the
       * click handler) starts the graph from inside a real gesture.
       */
      if (
        options?.deferStart
      ) {
        this.armGestures();

        return;
      }

      void this.ensureStarted(
        true
      );
    } else {
      this.disarmGestures();

      this.stop();
    }
  }

  public attach(
    target: EventTarget
  ) {
    this.detach();

    this.attachedTarget =
      target;

    target.addEventListener(
      "red-magic-interaction",
      this.handleEvent
    );
  }

  public detach() {
    if (
      this.attachedTarget
    ) {
      this.attachedTarget.removeEventListener(
        "red-magic-interaction",
        this.handleEvent
      );

      this.attachedTarget =
        null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Gesture arming — the honest path from "preference ON" to sound.  */
  /* ---------------------------------------------------------------- */

  private armGestures() {
    if (
      typeof document ===
        "undefined" ||
      this.gestureArmed
    ) {
      return;
    }

    this.gestureArmed =
      true;

    this.gestureHandler =
      () => {
        if (
          !this.enabled
        ) {
          this.disarmGestures();

          return;
        }

        void this.ensureStarted(
          true
        );
      };

    document.addEventListener(
      "pointerdown",
      this.gestureHandler,
      {
        capture: true,
        passive: true
      }
    );

    document.addEventListener(
      "keydown",
      this.gestureHandler,
      {
        capture: true,
        passive: true
      }
    );

    document.addEventListener(
      "touchend",
      this.gestureHandler,
      {
        capture: true,
        passive: true
      }
    );
  }

  private disarmGestures() {
    if (
      !this.gestureArmed ||
      typeof document ===
        "undefined"
    ) {
      this.gestureArmed =
        false;

      return;
    }

    this.gestureArmed =
      false;

    if (
      this.gestureHandler
    ) {
      document.removeEventListener(
        "pointerdown",
        this.gestureHandler,
        {
          capture: true
        }
      );

      document.removeEventListener(
        "keydown",
        this.gestureHandler,
        {
          capture: true
        }
      );

      document.removeEventListener(
        "touchend",
        this.gestureHandler,
        {
          capture: true
        }
      );

      this.gestureHandler =
        null;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Context + graph construction.                                    */
  /* ---------------------------------------------------------------- */

  private ensureContext(
    fromGesture: boolean
  ) {
    if (
      !this.enabled
    ) {
      return null;
    }

    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }

    if (
      this.context
    ) {
      return this.context;
    }

    /*
     * Autoplay policy gate: only construct the AudioContext once
     * the page has sticky user activation (any prior click / tap /
     * key press), or from inside a real gesture handler. This is
     * what keeps the console clean — a context constructed before
     * activation is what browsers warn about.
     */
    if (
      !fromGesture &&
      !hasStickyActivation()
    ) {
      return null;
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (
      !AudioContextConstructor
    ) {
      return null;
    }

    this.context =
      new AudioContextConstructor();

    return this.context;
  }

  /*
   * A soft noise buffer (≈pink) for the activity-driven texture
   * layer. 2 seconds, deterministic-ish, cheap to build once.
   */
  private createTextureBuffer(
    context: AudioContext
  ) {
    const length =
      Math.floor(
        context.sampleRate *
          2
      );

    const buffer =
      context.createBuffer(
        1,
        length,
        context.sampleRate
      );

    const data =
      buffer.getChannelData(
        0
      );

    let b0 = 0;

    let b1 = 0;

    let b2 = 0;

    for (
      let i = 0;
      i < length;
      i += 1
    ) {
      const white =
        Math.random() *
          2 -
        1;

      /*
       * Paul Kellet's economical pink-noise filter — one sample of
       * warmth per sample of noise, no assets, no downloads.
       */
      b0 =
        0.99765 *
          b0 +
        white *
          0.0990460;

      b1 =
        0.96300 *
          b1 +
        white *
          0.2965164;

      b2 =
        0.57000 *
          b2 +
        white *
          1.0526913;

      data[i] =
        (b0 +
          b1 +
          b2 +
          white *
            0.1848) *
        0.22;
    }

    return buffer;
  }

  private ensureGraph() {
    const existing =
      this.nodes;

    if (
      existing
    ) {
      return existing;
    }

    const context =
      this.context;

    if (
      !context
    ) {
      return null;
    }

    const master =
      context.createGain();

    const compressor =
      context.createDynamicsCompressor();

    const ambientGain =
      context.createGain();

    const transientGain =
      context.createGain();

    const bodyGain =
      context.createGain();

    const bodyFilter =
      context.createBiquadFilter();

    const lowOscillator =
      context.createOscillator();

    const fifthOscillator =
      context.createOscillator();

    const harmonicOscillator =
      context.createOscillator();

    const shimmerGain =
      context.createGain();

    const shimmerFilter =
      context.createBiquadFilter();

    const shimmerOscillator =
      context.createOscillator();

    const shimmerOvertone =
      context.createOscillator();

    const shimmerTremolo =
      context.createOscillator();

    const shimmerTremoloGain =
      context.createGain();

    const breathLfo =
      context.createOscillator();

    const breathLfoGain =
      context.createGain();

    const textureSource =
      context.createBufferSource();

    const textureGain =
      context.createGain();

    const textureFilter =
      context.createBiquadFilter();

    /*
     * Soft-safety chain: everything passes a gentle compressor
     * before the master gain, so stacked transients over a full
     * ambient bed can never clip the output.
     */
    compressor.threshold.value =
      -20;

    compressor.knee.value =
      18;

    compressor.ratio.value =
      3;

    compressor.attack.value =
      0.01;

    compressor.release.value =
      0.28;

    master.gain.value = 0;

    ambientGain.gain.value =
      1;

    transientGain.gain.value =
      0.9;

    /*
     * Ambient voice levels are set by applyIntensity(); the values
     * here are the idle defaults (intensity 0).
     */
    bodyGain.gain.value =
      0.055;

    bodyFilter.type =
      "lowpass";

    bodyFilter.frequency.value =
      150;

    bodyFilter.Q.value =
      0.85;

    lowOscillator.type =
      "sine";

    lowOscillator.frequency.value =
      52;

    fifthOscillator.type =
      "sine";

    fifthOscillator.frequency.value =
      78.2;

    harmonicOscillator.type =
      "triangle";

    harmonicOscillator.frequency.value =
      104;

    /*
     * Low body voices: the root dominates, the fifth beats very
     * slowly against it (52 × 1.504), the triangle adds warm
     * harmonics — one cohesive low mass, not three instruments.
     */
    lowOscillator.connect(
      bodyFilter
    );

    fifthOscillator.connect(
      bodyFilter
    );

    harmonicOscillator.connect(
      bodyFilter
    );

    bodyFilter.connect(
      bodyGain
    );

    bodyGain.connect(
      ambientGain
    );

    shimmerFilter.type =
      "bandpass";

    shimmerFilter.frequency.value =
      700;

    shimmerFilter.Q.value =
      1.1;

    shimmerOscillator.type =
      "sine";

    shimmerOscillator.frequency.value =
      416;

    shimmerOvertone.type =
      "sine";

    shimmerOvertone.frequency.value =
      624;

    shimmerTremolo.type =
      "sine";

    shimmerTremolo.frequency.value =
      0.06;

    shimmerTremoloGain.gain.value =
      0.5;

    shimmerOscillator.connect(
      shimmerFilter
    );

    shimmerOvertone.connect(
      shimmerFilter
    );

    /*
     * The tremolo scales the shimmer gain around its target —
     * wired as shimmerGain.gain modulation depth.
     */
    shimmerTremolo.connect(
      shimmerTremoloGain
    );

    shimmerTremoloGain.connect(
      shimmerGain.gain
    );

    shimmerFilter.connect(
      shimmerGain
    );

    shimmerGain.connect(
      ambientGain
    );

    /*
     * Breath: the whole low mass slowly opens and closes, ~22 s
     * per full cycle, ±55 Hz around the intensity-set cutoff.
     */
    breathLfo.type =
      "sine";

    breathLfo.frequency.value =
      0.045;

    breathLfoGain.gain.value =
      55;

    breathLfo.connect(
      breathLfoGain
    );

    breathLfoGain.connect(
      bodyFilter.frequency
    );

    /*
     * Texture: the activity surface — inaudible at rest, present
     * under interaction, never a second personality.
     */
    textureSource.buffer =
      this.createTextureBuffer(
        context
      );

    textureSource.loop =
      true;

    textureFilter.type =
      "bandpass";

    textureFilter.frequency.value =
      480;

    textureFilter.Q.value =
      0.8;

    textureGain.gain.value =
      0;

    textureSource.connect(
      textureFilter
    );

    textureFilter.connect(
      textureGain
    );

    textureGain.connect(
      ambientGain
    );

    ambientGain.connect(
      compressor
    );

    transientGain.connect(
      compressor
    );

    compressor.connect(
      master
    );

    master.connect(
      context.destination
    );

    lowOscillator.start();

    fifthOscillator.start();

    harmonicOscillator.start();

    shimmerOscillator.start();

    shimmerOvertone.start();

    shimmerTremolo.start();

    breathLfo.start();

    textureSource.start();

    this.nodes = {
      master,
      compressor,
      ambientGain,
      transientGain,
      bodyGain,
      bodyFilter,
      lowOscillator,
      fifthOscillator,
      harmonicOscillator,
      shimmerGain,
      shimmerFilter,
      shimmerOscillator,
      shimmerOvertone,
      shimmerTremolo,
      shimmerTremoloGain,
      breathLfo,
      breathLfoGain,
      textureSource,
      textureGain,
      textureFilter
    };

    this.applyIntensity(
      this.intensity,
      0.2
    );

    return this.nodes;
  }

  /* ---------------------------------------------------------------- */
  /* Start / stop.                                                    */
  /* ---------------------------------------------------------------- */

  private async ensureStarted(
    fromGesture = false
  ) {
    /*
     * Fast path (perf): once the graph exists and is running there
     * is nothing to do — the interaction stream only adjusts
     * targets through applyIntensity().
     */
    if (
      this.nodes &&
      this.context &&
      this.context.state ===
        "running"
    ) {
      this.disarmGestures();

      return true;
    }

    if (
      !this.enabled ||
      !this.visible
    ) {
      return false;
    }

    const context =
      this.ensureContext(
        fromGesture
      );

    if (
      !isAudioContext(
        context
      )
    ) {
      return false;
    }

    const nodes =
      this.ensureGraph();

    if (
      !nodes
    ) {
      return false;
    }

    if (
      context.state ===
      "suspended"
    ) {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    if (
      context.state !==
      "running"
    ) {
      return false;
    }

    /*
     * ON must be audible (v3.6 law): stop() leaves the master gain
     * at zero and the context suspended, so every successful start
     * ramps the master back to its designed level. A running
     * context with a zero master is the "silently stuck" failure
     * mode this engine refuses to have.
     */
    if (
      this.suspendTimer !==
      null
    ) {
      clearTimeout(
        this.suspendTimer
      );

      this.suspendTimer =
        null;
    }

    nodes.master.gain.setTargetAtTime(
      MASTER_GAIN,
      context.currentTime,
      FADE_CONSTANT
    );

    this.disarmGestures();

    this.startDecayLoop();

    return true;
  }

  private stop() {
    this.stopDecayLoop();

    const context =
      this.context;

    const nodes =
      this.nodes;

    if (
      this.suspendTimer !==
      null
    ) {
      clearTimeout(
        this.suspendTimer
      );

      this.suspendTimer =
        null;
    }

    if (
      !context ||
      !nodes
    ) {
      return;
    }

    /*
     * Fade first, suspend after: an immediate suspend() would cut
     * the tail mid-envelope. ~0.5 s at 3× the fade constant is
     * inaudibly "immediate" for a toggle while staying click-free.
     */
    nodes.master.gain.setTargetAtTime(
      0,
      context.currentTime,
      FADE_CONSTANT
    );

    this.suspendTimer =
      setTimeout(
        () => {
          this.suspendTimer =
            null;

          const liveContext =
            this.context;

          if (
            liveContext &&
            liveContext.state ===
              "running"
          ) {
            void liveContext.suspend();
          }
        },
        500
      );
  }

  /* ---------------------------------------------------------------- */
  /* Visibility.                                                      */
  /* ---------------------------------------------------------------- */

  private async handleVisibilityChange() {
    if (
      typeof document ===
      "undefined"
    ) {
      return;
    }

    this.visible =
      document.visibilityState ===
      "visible";

    const context =
      this.context;

    if (
      !context
    ) {
      return;
    }

    if (
      !this.visible
    ) {
      if (
        context.state ===
        "running"
      ) {
        try {
          await context.suspend();
        } catch {
          // Ignore browser lifecycle races.
        }
      }

      return;
    }

    if (
      this.enabled
    ) {
      await this.ensureStarted();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Intensity — the one continuous personality control.              */
  /* ---------------------------------------------------------------- */

  private startDecayLoop() {
    if (
      this.decayTimer !==
      null
    ) {
      return;
    }

    this.lastDecayTime =
      performance.now();

    this.decayTimer =
      setInterval(
        () => {
          const now =
            performance.now();

          const elapsed =
            now -
            this.lastDecayTime;

          this.lastDecayTime =
            now;

          if (
            now -
              this.lastEventTime >
            INTENSITY_DECAY_MS &&
            this.intensity >
            0
          ) {
            const steps =
              Math.max(
                1,
                elapsed /
                  INTENSITY_DECAY_MS
              );

            this.intensity =
              clamp(
                this.intensity *
                  Math.pow(
                    INTENSITY_DECAY_FACTOR,
                    steps
                  ),
                0,
                1
              );

            this.applyIntensity(
              this.intensity,
              0.35
            );
          }
        },
        INTENSITY_DECAY_MS
      );
  }

  private stopDecayLoop() {
    if (
      this.decayTimer !==
      null
    ) {
      clearInterval(
        this.decayTimer
      );

      this.decayTimer =
        null;
    }
  }

  /*
   * The single timbre control. intensity 0 = resting organism,
   * 1 = fully active: the low mass gains up, the filter opens,
   * the shimmer brightens, the texture surface becomes audible.
   */
  private applyIntensity(
    intensity: number,
    smoothing: number
  ) {
    const context =
      this.context;

    const nodes =
      this.nodes;

    if (
      !context ||
      !nodes
    ) {
      return;
    }

    const i =
      clamp(
        intensity,
        0,
        1
      );

    const now =
      context.currentTime;

    nodes.bodyGain.gain.setTargetAtTime(
      0.055 +
        0.11 *
          i,
      now,
      smoothing
    );

    nodes.bodyFilter.frequency.setTargetAtTime(
      130 +
        250 *
          i +
        this
          .proximityBoost *
          420,
      now,
      smoothing
    );

    nodes.shimmerGain.gain.setTargetAtTime(
      0.004 +
        0.05 *
          i,
      now,
      smoothing
    );

    nodes.shimmerFilter.frequency.setTargetAtTime(
      620 +
        560 *
          i,
      now,
      smoothing
    );

    nodes.textureGain.gain.setTargetAtTime(
      0.085 *
        i,
      now,
      smoothing
    );
  }

  private proximityBoost = 0;

  private updateAmbient(
    detail: RedMagicInteractionDetail
  ) {
    const context =
      this.context;

    const nodes =
      this.nodes;

    if (
      !context ||
      !nodes
    ) {
      return;
    }

    /*
     * Throttle (perf): move events arrive per animation frame; the
     * ambient targets only need to track interaction at a fraction
     * of that rate given the smoothing constants applied below.
     */
    if (
      context.currentTime -
        this.lastAmbientUpdateTime <
      AMBIENT_UPDATE_MIN_S
    ) {
      return;
    }

    this.lastAmbientUpdateTime =
      context.currentTime;

    const energy =
      clamp(
        detail.energy,
        0,
        1
      );

    const proximity =
      clamp(
        detail.proximity,
        0,
        1
      );

    this.proximityBoost =
      proximity;

    /*
     * The organism's own energy is the intensity source; proximity
     * only shapes the timbre (filter opening) inside
     * applyIntensity. Interaction never switches character —
     * it presses on the same voice.
     */
    this.intensity =
      Math.max(
        this.intensity *
          0.82,
        energy
      );

    this.applyIntensity(
      this.intensity +
        Math.min(
          0.12,
          this.charge *
            0.12
        ),
      0.16
    );
  }

  /* ---------------------------------------------------------------- */
  /* Transients — evidence of life, layered over the ambient bed.     */
  /* ---------------------------------------------------------------- */

  private triggerEnvelope(
    frequency: number,
    duration: number,
    peakGain: number,
    oscillatorType:
      OscillatorType =
      "sine"
  ) {
    const context =
      this.context;

    const nodes =
      this.nodes;

    if (
      !context ||
      !nodes
    ) {
      return;
    }

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    const filter =
      context.createBiquadFilter();

    const now =
      context.currentTime;

    const end =
      now +
      duration;

    oscillator.type =
      oscillatorType;

    oscillator.frequency.setValueAtTime(
      frequency,
      now
    );

    filter.type =
      "lowpass";

    filter.frequency.setValueAtTime(
      Math.max(
        500,
        frequency *
          5
      ),
      now
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      Math.max(
        0.0002,
        peakGain
      ),
      now +
        Math.min(
          0.018,
          duration *
            0.16
        )
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      end
    );

    oscillator.connect(
      filter
    );

    filter.connect(
      gain
    );

    gain.connect(
      nodes.transientGain
    );

    oscillator.start(
      now
    );

    oscillator.stop(
      end +
        0.02
    );
  }

  private triggerImpact(
    detail: RedMagicInteractionDetail
  ) {
    const intensity =
      clamp(
        detail.proximity,
        0,
        1
      );

    this.triggerEnvelope(
      250 +
        intensity *
          160,
      0.17,
      0.16 +
        intensity *
          0.1,
      "triangle"
    );

    this.triggerEnvelope(
      82 +
        intensity *
          36,
      0.22,
      0.13 +
        intensity *
          0.07,
      "sine"
    );
  }

  private triggerFlick(
    detail: RedMagicInteractionDetail
  ) {
    const intensity =
      clamp(
        detail.energy,
        0,
        1
      );

    this.triggerEnvelope(
      380 +
        intensity *
          420,
      0.09,
      0.1 +
        intensity *
          0.07,
      "sawtooth"
    );
  }

  private triggerRelease(
    detail: RedMagicInteractionDetail
  ) {
    const charge =
      clamp(
        detail.charge,
        0,
        1
      );

    if (
      charge <
      0.08
    ) {
      return;
    }

    this.triggerEnvelope(
      65 +
        charge *
          28,
      0.32,
      0.14 +
        charge *
          0.16,
      "sine"
    );

    this.triggerEnvelope(
      420 +
        charge *
          580,
      0.26,
      0.07 +
        charge *
          0.1,
      "triangle"
    );

    this.triggerEnvelope(
      900 +
        charge *
          1200,
      0.19,
      0.024 +
        charge *
          0.045,
      "sine"
    );
  }

  private triggerOrbit(
    detail: RedMagicInteractionDetail
  ) {
    const intensity =
      clamp(
        detail.proximity,
        0,
        1
      );

    this.triggerEnvelope(
      300 +
        intensity *
          320,
      0.16,
      0.035 +
        intensity *
          0.07,
      "triangle"
    );
  }

  private handleEvent = (
    event: Event
  ) => {
    const customEvent =
      event as CustomEvent<RedMagicInteractionDetail>;

    const detail =
      customEvent.detail;

    if (
      !detail
    ) {
      return;
    }

    /*
     * Start attempt per event: cheap when already running (one
     * state comparison), and the ONLY path that makes a restored
     * ON preference audible once the page has seen activation.
     */
    void this.ensureStarted();

    this.charge =
      clamp(
        detail.charge,
        0,
        1
      );

    this.updateAmbient(
      detail
    );

    const now =
      performance.now();

    const interactiveEvent: RedMagicInteractionType =
      detail.type;

    if (
      now -
        this.lastEventTime <
        EVENT_COOLDOWN_MS &&
      interactiveEvent !==
        "release"
    ) {
      return;
    }

    this.lastEventTime =
      now;

    switch (
      interactiveEvent
    ) {
      case "impact":
        this.triggerImpact(
          detail
        );
        break;

      case "flick":
        this.triggerFlick(
          detail
        );
        break;

      case "release":
        this.triggerRelease(
          detail
        );
        break;

      case "orbit":
        this.triggerOrbit(
          detail
        );
        break;

      case "enter":
        this.triggerEnvelope(
          170,
          0.18,
          0.07,
          "sine"
        );
        break;

      case "leave":
        this.triggerEnvelope(
          135,
          0.22,
          0.05,
          "sine"
        );
        break;

      case "charge":
      case "move":
        break;
    }
  };

  public destroy() {
    this.detach();

    this.disarmGestures();

    this.stopDecayLoop();

    if (
      this.suspendTimer !==
      null
    ) {
      clearTimeout(
        this.suspendTimer
      );

      this.suspendTimer =
        null;
    }

    if (
      typeof document !==
        "undefined" &&
      this.visibilityHandler
    ) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityHandler
      );
    }

    const context =
      this.context;

    if (
      context &&
      context.state !==
        "closed"
    ) {
      void context.close();
    }

    this.nodes =
      null;

    this.context =
      null;
  }
}
