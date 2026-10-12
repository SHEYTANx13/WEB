import {
  type QualityName,
  type QualityBudget,
  type RuntimeState,
  type RefreshEstimator,
  type RefreshDeltaSampler,
  type InteractionSignals,
  QUALITY_BUDGETS,
  createRefreshEstimator,
  createRefreshDeltaSampler
} from "@/components/redmagic/engineConfig";

import {
  createGlowSprite,
  createNodeSprite,
  createCoreSprite,
  createCoreDetailSprite
} from "@/components/redmagic/engineSprites";

import {
  type GridNode,
  type GridEdge,
  type BoundaryPoint,
  type FlowGeometry,
  type GlobalPotentialField,
  type BoundaryNetworkWeights,
  qualityFromArea,
  buildFlowGeometry,
  ANGULAR_FALLOFF_NORMAL
} from "@/components/redmagic/engineWorld";

import {
  type Point,
  type Shockwave,
  type ModeProfile,
  MAX_SHOCKWAVES,
  ORGANISM_PROFILE,
  RED_MAGIC_TIMING
} from "@/components/redmagic/engineConstants";

import {
  type RedMagicAdaptation,
  type RedMagicSubsystemTimings
} from "@/components/RedMagicTelemetry";

import {
  type RedMagicInteractionDetail
} from "@/components/RedMagicInteraction";

import {
  type RedMagicParticle,
  createPageSeed
} from "@/components/RedMagicParticles";

/*
 * redmagic/engineState.ts — the mutable engine state object (v4.0.1).
 *
 * Mechanically extracted from the engine closure that previously
 * lived inside components/RedMagic.tsx's useEffect: every field is a
 * former closure variable, in the original declaration order, with
 * the original initializer. The simulation/render/input/lifecycle
 * modules receive this single object and mutate it in place; no
 * other mutable state exists.
 *
 * Mount context (the canvas, its 2D context, the reduced-motion
 * media query and the nucleus gradient) is supplied by lifecycle.ts
 * at mount time — the engine never touches the DOM before then.
 */

type EngineMountContext = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  reduceMotionQuery: MediaQueryList;
  nucleusGradient: CanvasGradient;
};

export type EngineState = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  reduceMotionQuery: MediaQueryList;
  nucleusGradient: CanvasGradient;
  pageSeed: number;
  glowSprite: HTMLCanvasElement | null;
  interactionSprite: HTMLCanvasElement | null;
  nodeSprite: HTMLCanvasElement | null;
  coreSprite: HTMLCanvasElement | null;
  coreDetailSprite: HTMLCanvasElement | null;
  reducedMotion: boolean;
  animationFrame: number;
  resizeObserver: | ResizeObserver
      | null;
  intersectionObserver: | IntersectionObserver
      | null;
  visible: boolean;
  documentVisible: boolean;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  dpr: number;
  elapsed: number;
  lastTimestamp: number;
  lastDrawTimestamp: number;
  idleSince: | number
      | null;
  pointer: Point;
  pointerTarget: Point;
  pointerActive: boolean;
  pointerEnergy: number;
  pointerVelocity: number;
  pointerDistance: number;
  pointerAngle: number;
  pointerAngleSin: number;
  pointerAngleCos: number;
  boundaryPointerDistanceFactor: number;
  boundaryPointerStrength: number;
  boundaryAngularLookup: Float32Array<ArrayBuffer>;
  boundaryPrimaryPhaseSin: number;
  boundaryPrimaryPhaseCos: number;
  boundarySecondaryPhaseSin: number;
  boundarySecondaryPhaseCos: number;
  boundaryTertiaryPhaseSin: number;
  boundaryTertiaryPhaseCos: number;
  boundaryTurbulencePhaseSin: number;
  boundaryTurbulencePhaseCos: number;
  interactionEnergy: number;
  interactionTurbulence: number;
  charge: number;
  pointerHeld: boolean;
  averageGridEnergy: number;
  clickParticleCount: number;
  clickLightBoost: number;
  qualityName: QualityName;
  quality: QualityBudget;
  flowGeometry: FlowGeometry;
  particles: RedMagicParticle[];
  gridNodes: GridNode[];
  gridEdges: GridEdge[];
  NETWORK_BUCKET_COUNT: 5;
  networkBucketIndices: Uint16Array[];
  networkBucketCounts: Int32Array<ArrayBuffer>;
  nodePotential: Float32Array<ArrayBuffer>;
  nextNodeEnergy: Float32Array<ArrayBuffer>;
  globalPotential: GlobalPotentialField |
      null;
  membraneBoundary: BoundaryPoint[];
  boundaryNetworkNodeIndices: BoundaryNetworkWeights["nodeIndices"];
  boundaryNetworkNodeWeights: BoundaryNetworkWeights["nodeWeights"];
  boundaryNetworkResidualWeights: BoundaryNetworkWeights["residualWeights"];
  boundaryNetworkInfluenceCounts: BoundaryNetworkWeights["influenceCounts"];
  shockwaves: Shockwave[];
  shockwaveRadialInfluence: Float32Array<ArrayBuffer>;
  shockwaveAngularCoefficient: Float32Array<ArrayBuffer>;
  canvasRectLeft: number;
  canvasRectTop: number;
  performanceSampleTime: number;
  performanceFrames: number;
  latestFps: number;
  lastQualityChange: number;
  softPressure: number;
  activeParticleLimit: number;
  baseParticleCount: number;
  membraneStride: number;
  flowStride: number;
  atmosphereScale: number;
  highestNodeEnergy: number;
  hardRebuildPending: boolean;
  hardRebuildTarget: QualityName |
      null;
  hardRebuildReason: string;
  runtimeState: RuntimeState;
  pointerSpeedPxPerS: number;
  lastPointerMovementAt: number;
  pointerPresentSince: number;
  interactionMemory: number;
  dprLastChangeAt: number;
  dprCap: number;
  refreshEstimator: RefreshEstimator;
  subsystemTiming: | RedMagicSubsystemTimings
      | null;
  timingFrameCount: number;
  activityPublishCounter: number;
  interactionSignals: InteractionSignals;
  lastAdaptTimestamp: number;
  refreshSampler: RefreshDeltaSampler;
  demoteStreak: number;
  promoteStreak: number;
  membraneGradient: CanvasGradient | null;
  profile: ModeProfile;
  lastAdaptation: | RedMagicAdaptation
      | null;
  HARD_REBUILD_MAX_WAIT_MS: 12000;
  hardRebuildScheduledAt: number;
  lastSignalPointerX: number;
  lastSignalPointerY: number;
  lastSignalPointerAt: number;
  particleDrawOptions: {
    context: CanvasRenderingContext2D;
    particles: RedMagicParticle[];
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
    pointer: Point;
    pointerActive: boolean;
    pointerEnergy: number;
    charge: number;
    profile: ModeProfile;
    time: number;
    delta: number;
    reducedMotion: boolean;
    activeLimit: number;
    baseCount: number;
  };
};

export function createEngineState(
  mount: EngineMountContext
): EngineState {
  const reducedMotion = mount.reduceMotionQuery.matches;
  const width = 1;
  const height = 1;
  const centerX = 0;
  const centerY = 0;
  const radius = 1;
  const pointer: Point = {
      x: 0,
      y: 0
    };
  const pointerActive = false;
  const pointerEnergy = 0;
  const charge = 0;
  const qualityName = qualityFromArea(
        window.innerWidth *
        window.innerHeight
      );
  const quality = QUALITY_BUDGETS[
        qualityName
      ];
  const particles: RedMagicParticle[] = [];
  const NETWORK_BUCKET_COUNT = 5;
  const profile = ORGANISM_PROFILE;
  return {
    canvas: mount.canvas,
    context: mount.context,
    reduceMotionQuery: mount.reduceMotionQuery,
    nucleusGradient: mount.nucleusGradient,

    pageSeed: createPageSeed(),
    glowSprite: createGlowSprite(),
    interactionSprite: createGlowSprite(),
    nodeSprite: createNodeSprite(),
    coreSprite: createCoreSprite(),
    coreDetailSprite: createCoreDetailSprite(),
    reducedMotion,
    animationFrame: 0,
    resizeObserver: null,
    intersectionObserver: null,
    visible: true,
    documentVisible: document.visibilityState ===
      "visible",
    width,
    height,
    centerX,
    centerY,
    radius,
    dpr: 1,
    elapsed: 0,
    lastTimestamp: 0,
    lastDrawTimestamp: 0,
    idleSince: 0,
    pointer,
    pointerTarget: {
      x: 0,
      y: 0
    },
    pointerActive,
    pointerEnergy,
    pointerVelocity: 0,
    pointerDistance: 0,
    pointerAngle: 0,
    pointerAngleSin: 0,
    pointerAngleCos: 1,
    boundaryPointerDistanceFactor: 0,
    boundaryPointerStrength: 0,
    boundaryAngularLookup: ANGULAR_FALLOFF_NORMAL,
    boundaryPrimaryPhaseSin: 0,
    boundaryPrimaryPhaseCos: 1,
    boundarySecondaryPhaseSin: 0,
    boundarySecondaryPhaseCos: 1,
    boundaryTertiaryPhaseSin: 0,
    boundaryTertiaryPhaseCos: 1,
    boundaryTurbulencePhaseSin: 0,
    boundaryTurbulencePhaseCos: 1,
    interactionEnergy: 0,
    interactionTurbulence: 0,
    charge,
    pointerHeld: false,
    averageGridEnergy: 0,
    clickParticleCount: 0,
    clickLightBoost: 0,
    qualityName,
    quality,
    flowGeometry: buildFlowGeometry(
        quality
      ),
    particles,
    gridNodes: [],
    gridEdges: [],
    NETWORK_BUCKET_COUNT,
    networkBucketIndices: [],
    networkBucketCounts: new Int32Array(
        NETWORK_BUCKET_COUNT
      ),
    nodePotential: new Float32Array(
        0
      ),
    nextNodeEnergy: new Float32Array(
        0
      ),
    globalPotential: null,
    membraneBoundary: [],
    boundaryNetworkNodeIndices: new Int16Array(
        0
      ),
    boundaryNetworkNodeWeights: new Float32Array(
        0
      ),
    boundaryNetworkResidualWeights: new Float32Array(
        0
      ),
    boundaryNetworkInfluenceCounts: new Uint8Array(
        0
      ),
    shockwaves: [],
    shockwaveRadialInfluence: new Float32Array(
        MAX_SHOCKWAVES
      ),
    shockwaveAngularCoefficient: new Float32Array(
        MAX_SHOCKWAVES
      ),
    canvasRectLeft: 0,
    canvasRectTop: 0,
    performanceSampleTime: 0,
    performanceFrames: 0,
    latestFps: 0,
    lastQualityChange: 0,
    softPressure: 0,
    activeParticleLimit: 0,
    baseParticleCount: 0,
    membraneStride: 1,
    flowStride: 1,
    atmosphereScale: 1,
    highestNodeEnergy: 0,
    hardRebuildPending: false,
    hardRebuildTarget: null,
    hardRebuildReason: "",
    runtimeState: "ambient",
    pointerSpeedPxPerS: 0,
    lastPointerMovementAt: 0,
    pointerPresentSince: 0,
    interactionMemory: 0,
    dprLastChangeAt: 0,
    dprCap: 2,
    refreshEstimator: createRefreshEstimator(),
    subsystemTiming: RED_MAGIC_TIMING
        ? {
            sim: 0,

            grid: 0,

            render: 0,

            membrane: 0,

            network: 0,

            flows: 0,

            core: 0,

            particles: 0
          }
        : null,
    timingFrameCount: 0,
    activityPublishCounter: 0,
    interactionSignals: {
      proximity: 0,

      speed: 0,

      dwell: 0,

      memory: 0,

      charge: 0
    },
    lastAdaptTimestamp: 0,
    refreshSampler: createRefreshDeltaSampler(),
    demoteStreak: 0,
    promoteStreak: 0,
    membraneGradient: null,
    profile,
    lastAdaptation: null,
    HARD_REBUILD_MAX_WAIT_MS: 12000,
    hardRebuildScheduledAt: 0,
    lastSignalPointerX: 0,
    lastSignalPointerY: 0,
    lastSignalPointerAt: 0,

    /*
     * The shared, zero-allocation particle render options object.
     * It snapshots the initial field values exactly as the original
     * closure did at declaration time (the context, the initial
     * particle pool, the initial geometry, the pointer, the profile
     * and the reduced-motion flag); the per-frame fields are
     * rewritten by drawParticles every call. The hoisted locals above
     * guarantee the SAME instances the sibling fields receive.
     */
    particleDrawOptions: {
      context: mount.context,

      particles,

      width,
      height,

      centerX,
      centerY,
      radius,

      pointer,
      pointerActive,

      pointerEnergy,
      charge,

      profile,

      time: 0,
      delta: 0,

      reducedMotion,

      activeLimit: 0,

      baseCount: 0
    }
  };
}

/*
 * The nucleus gradient — allocated ONCE per engine mount, never per
 * frame. CanvasGradient objects are reusable across frames; the
 * per-frame size variation is applied through the canvas transform.
 */
export function createNucleusGradient(
  context: CanvasRenderingContext2D
): CanvasGradient {
  const nucleusGradient = context.createRadialGradient(
    -0.18,
    -0.2,
    0.05,
    0,
    0,
    1
  );

nucleusGradient.addColorStop(
    0,
    "rgba(255, 214, 108, 0.98)"
  );

nucleusGradient.addColorStop(
    0.28,
    "rgba(255, 153, 52, 0.96)"
  );

nucleusGradient.addColorStop(
    0.62,
    "rgba(255, 74, 24, 0.94)"
  );

nucleusGradient.addColorStop(
    1,
    "rgba(185, 16, 10, 0.72)"
  );

  return nucleusGradient;
}

export type Engine = {
  rebuildBoundaryNetworkWeights: () => void;
  applySoftAdaptation: () => void;
  scheduleHardRebuild: (target: QualityName, reason: string) => void;
  setQuality: (name: QualityName, options?: { mode?: "soft" | "hard" | undefined; reason?: string | undefined; } | undefined) => void;
  buildWorld: (name: QualityName, reason?: string) => void;
  rebuildMembraneGradient: () => void;
  resetPerformanceSampling: () => void;
  applyBackingStore: () => void;
  applyDpr: (nextDpr: number) => void;
  resize: () => void;
  updatePointer: (clientX: number, clientY: number) => void;
  updatePointerGeometry: () => void;
  nearestGridNode: (x: number, y: number) => number;
  spawnShockwave: (detail: RedMagicInteractionDetail, strength: number) => void;
  addClickParticle: (x: number, y: number) => void;
  applyParticleImpulse: (detail: RedMagicInteractionDetail, strength: number) => void;
  handleInteractionEvent: (event: Event) => void;
  handleCanvasClick: (event: MouseEvent) => void;
  updateGrid: (delta: number, time: number) => void;
  prepareShockwaveFrame: () => void;
  getBoundaryRadius: (point: BoundaryPoint) => number;
  drawGlow: (x: number, y: number, innerRadius: number, outerRadius: number, alpha: number) => void;
  drawNodeCore: (x: number, y: number, radiusValue: number, alpha: number) => void;
  drawNetwork: (time: number) => void;
  drawInteraction: () => void;
  drawMembrane: (time: number) => void;
  drawEnergyFlows: (time: number) => void;
  drawParticles: (time: number, delta: number) => void;
  drawCore: (time: number) => void;
  updatePhysicalState: (delta: number) => void;
  maybeAdaptQuality: (timestamp: number, idleCapped: boolean) => void;
  render: (timestamp: number) => void;
  start: () => void;
  stop: () => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerLeave: () => void;
  handleMotionChange: (event: MediaQueryListEvent) => void;
  handleIntersection: (entries: IntersectionObserverEntry[]) => void;
  handleVisibility: () => void;
};
