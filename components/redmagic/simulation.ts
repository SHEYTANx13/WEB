/*
 * redmagic/simulation.ts — world construction, grid physics and the
 * adaptive-quality engine (v4.0.1).
 *
 * Mechanically extracted from the engine closure in
 * components/RedMagic.tsx: the function bodies are unchanged; the
 * shared mutable state arrives as the single EngineState object and
 * sibling engine functions are reached through the late-bound
 * Engine object.
 */

import type { EngineState, Engine } from "@/components/redmagic/engineState";

import {
  type QualityName,
  QUALITY_BUDGETS,
  SOFT_PARTICLE_FLOOR,
  STATE_SIMULATION_SCALE,
  resolvePressureDpr,
  dprCeilingFor,
  closeRefreshWindow,
  recordRefreshDelta,
  resetRefreshDeltaSampler,
  representativeWindowHz
} from "@/components/redmagic/engineConfig";

import {
  type BoundaryPoint,
  qualityFromArea,
  createBoundary,
  buildFlowGeometry,
  createGrid,
  buildGlobalPotentialWeights,
  buildBoundaryNetworkWeights,
  sampleAngularLookup,
  ANGULAR_FALLOFF_NORMAL,
  ANGULAR_FALLOFF_ACTIVE,
  MAX_NETWORK_INFLUENCES
} from "@/components/redmagic/engineWorld";

import {
  TAU,
  MAX_SHOCKWAVES,
  SHOCKWAVE_DURATION,
  GRID_ENERGY_DECAY,
  GRID_IDLE_ENERGY,
  GRID_MAX_NODE_ENERGY,
  GRID_ROUTE_BONUS,
  GRID_FLOW_LIMIT,
  GRID_POINTER_RADIUS,
  GRID_POINTER_CONTRIBUTION,
  MAX_CLICK_PARTICLES,
  PARTICLE_WRAP_MARGIN,
  CLICK_LIGHT_BOOST_MAX,
  CLICK_LIGHT_DECAY,
  CLICK_LIGHT_DECAY_REFERENCE_MS,
  ORGANISM_PROFILE,
  clamp,
  smoothstep,
  distanceSquared
} from "@/components/redmagic/engineConstants";

import {
  type RedMagicSubsystemTimings,
  publishRedMagicPerformance
} from "@/components/RedMagicTelemetry";

import {
  type RedMagicInteractionDetail
} from "@/components/RedMagicInteraction";

import {
  createParticles,
  placeParticles
} from "@/components/RedMagicParticles";

export function createSimulationModule(
  state: EngineState,
  engine: Engine
): Pick<Engine, "rebuildBoundaryNetworkWeights" | "applySoftAdaptation" | "scheduleHardRebuild" | "setQuality" | "buildWorld" | "rebuildMembraneGradient" | "resetPerformanceSampling" | "updatePointer" | "updatePointerGeometry" | "nearestGridNode" | "spawnShockwave" | "addClickParticle" | "applyParticleImpulse" | "updateGrid" | "prepareShockwaveFrame" | "getBoundaryRadius" | "updatePhysicalState" | "maybeAdaptQuality"> {
/*
   * Boundary→network influence tables (v2.1): the table construction
   * is a pure build-time function in redmagic/engineWorld.ts; this
   * closure only rebinds the engine's working references to the
   * freshly built structures (old tables become garbage with the
   * closure that held them).
   */
  const rebuildBoundaryNetworkWeights =
    () => {
      const weights =
        buildBoundaryNetworkWeights(
          state.membraneBoundary,
          state.gridNodes
        );

      state.boundaryNetworkNodeIndices =
        weights.nodeIndices;

      state.boundaryNetworkNodeWeights =
        weights.nodeWeights;

      state.boundaryNetworkResidualWeights =
        weights.residualWeights;

      state.boundaryNetworkInfluenceCounts =
        weights.influenceCounts;
    };

/*
   * SOFT ADAPTATION (Runtime v2) — immediate, non-structural work
   * reduction inside the current tier. Pressure 0..1 scales:
   * - active particle count (update/draw/impulse loops)
   * - membrane draw stride (coarser stroke, structures intact)
   * - energy-flow draw stride
   * - secondary atmosphere/glow allowance
   * No pools, grids, boundaries or influence tables are touched, so
   * this is safe to apply the moment performance pressure appears —
   * including between frames of an ongoing interaction.
   */
  const applySoftAdaptation =
    () => {
      const pressure =
        state.softPressure;

      const poolFloor =
        Math.max(
          4,
          Math.round(
            state.quality.particles *
              SOFT_PARTICLE_FLOOR
          )
        );

      state.activeParticleLimit =
        Math.max(
          poolFloor,
          Math.round(
            state.quality.particles *
              (1 - pressure * 0.45)
          )
        );

      state.membraneStride =
        pressure > 0.55
          ? 2
          : 1;

      state.flowStride =
        pressure > 0.55
          ? 2
          : 1;

      state.atmosphereScale =
        state.quality.atmosphere *
        (1 - pressure * 0.4);
    };



  const scheduleHardRebuild =
    (
      target: QualityName,
      reason: string
    ) => {
      if (
        state.hardRebuildPending &&
        state.hardRebuildTarget ===
          target
      ) {
        return;
      }

      state.hardRebuildPending =
        true;

      state.hardRebuildTarget =
        target;

      state.hardRebuildReason =
        reason;

      state.hardRebuildScheduledAt =
        performance.now();
    };

/*
   * setQuality (Runtime v2) — two-level adaptation.
   *
   * mode "soft" (default): retarget the budget immediately (flows,
   * particle limit, strides, atmosphere) and — when the new tier
   * needs different structures (grid size, boundary resolution, pool
   * size) — schedule the hard rebuild for the next settled frame.
   * mode "hard": rebuild synchronously. Used on mount, when reduced
   * motion flips (a static frame cannot see a deferred rebuild), and
   * when a resize changes the tier before any interaction exists.
   */
  const setQuality =
    (
      name: QualityName,
      options?: {
        mode?: "soft" | "hard";
        reason?: string;
      }
    ) => {
      const mode =
        options?.mode ?? "soft";

      const reason =
        options?.reason ??
        "unspecified";

      const changed =
        name !== state.qualityName;

      if (
        !changed &&
        mode === "soft"
      ) {
        return;
      }

      state.lastAdaptation =
        changed
          ? {
              type:
                mode === "hard"
                  ? "hard"
                  : "soft",
              from: state.qualityName,
              to: name,
              reason,
              at:
                performance.now()
            }
          : state.lastAdaptation;

      state.qualityName = name;

      state.quality =
        QUALITY_BUDGETS[name];

      state.flowGeometry =
        buildFlowGeometry(
          state.quality
        );

      state.dprCap = dprCeilingFor(
        name,
        state.width * state.height
      );

      if (
        mode === "hard"
      ) {
        engine.buildWorld(
          name,
          reason
        );

        return;
      }

      /*
       * Soft path: structures from the previous tier keep working
       * (grid/boundary/pools are all self-consistent); the new tier's
       * structure sizes are adopted by the deferred hard rebuild.
       * Until then the soft outputs already deliver a real work
       * reduction — that is the point of the two-level design.
       */
      state.softPressure =
        name === qualityFromArea(
          state.width * state.height
        )
          ? 0
          : 0.35;

      engine.applySoftAdaptation();

      if (changed) {
        engine.scheduleHardRebuild(
          name,
          reason
        );
      }

      state.lastQualityChange =
        performance.now();
    };



  const buildWorld =
    (
      name: QualityName,
      reason: string = "build"
    ) => {
      state.qualityName =
        name;

      state.quality =
        QUALITY_BUDGETS[
          name
        ];

      state.flowGeometry =
        buildFlowGeometry(
          state.quality
        );

      state.particles =
        createParticles(
          state.quality.particles,
          (
            state.pageSeed +
            state.quality.gridSize *
              1009 +
            state.quality.particles *
              9176
          ) >>>
            0
        );

      state.clickParticleCount =
        0;

      state.baseParticleCount =
        state.particles.length;

      placeParticles(
        state.particles,
        state.width,
        state.height
      );

      const grid =
        createGrid(
          state.quality.gridSize
        );

      state.gridNodes =
        grid.nodes;

      state.gridEdges =
        grid.edges;

      state.networkBucketIndices =
        [];

      for (
        let bucket = 0;
        bucket <
          state.NETWORK_BUCKET_COUNT;
        bucket += 1
      ) {
        state.networkBucketIndices
          .push(
            new Uint16Array(
              state.gridEdges.length
            )
          );
      }

      state.networkBucketCounts =
        new Int32Array(
          state.NETWORK_BUCKET_COUNT
        );

      state.nodePotential =
        new Float32Array(
          state.gridNodes.length
        );

      state.nextNodeEnergy =
        new Float32Array(
          state.gridNodes.length
        );

      const globalPotentialField =
        buildGlobalPotentialWeights(
          state.gridNodes
        );

      state.globalPotential =
        globalPotentialField;

      state.membraneBoundary =
        createBoundary(
          state.quality.membraneSteps
        );

      engine.rebuildBoundaryNetworkWeights();

      state.shockwaves =
        [];

      state.averageGridEnergy =
        0;

      state.highestNodeEnergy = 0;

      /*
       * A structural rebuild resets soft adaptation to the new tier's
       * full budget — the hard rebuild IS the recovery path.
       */
      state.softPressure = 0;

      engine.applySoftAdaptation();

      state.hardRebuildPending = false;

      state.hardRebuildTarget = null;

      if (reason !== "build") {
        state.lastAdaptation = {
          type: "hard",

          from:
            state.lastAdaptation?.to ?? name,

          to: name,

          reason,

          at:
            performance.now()
        };
      }

      state.lastQualityChange =
        performance.now();
    };



  const rebuildMembraneGradient =
    () => {
      state.membraneGradient =
        state.context.createRadialGradient(
          state.centerX,
          state.centerY,
          state.radius *
            0.35,
          state.centerX,
          state.centerY,
          state.radius *
            1.2
        );

      state.membraneGradient.addColorStop(
        0,
        "rgba(255, 34, 24, 0)"
      );

      state.membraneGradient.addColorStop(
        0.64,
        "rgba(190, 0, 0, 0.06)"
      );

      state.membraneGradient.addColorStop(
        0.9,
        "rgba(255, 38, 25, 0.11)"
      );

      state.membraneGradient.addColorStop(
        1,
        "rgba(255, 25, 20, 0.01)"
      );
    };

/*
   * MEASUREMENT RESET (v2.1) — a real geometry or DPR change is a
   * structural event: the open performance window and the refresh
   * sampling window are invalidated so the next window measures the
   * new configuration cleanly. (Hidden-tab suspension uses the same
   * reset; see handleVisibility.)
   */
  const resetPerformanceSampling =
    () => {
      resetRefreshDeltaSampler(
        state.refreshSampler
      );

      state.lastAdaptTimestamp = 0;

      state.performanceSampleTime = 0;

      state.performanceFrames = 0;

      state.latestFps = 0;
    };



  const updatePointer =
    (
      clientX: number,
      clientY: number
    ) => {
      state.pointerTarget.x =
        clamp(
          clientX -
            state.canvasRectLeft,
          0,
          state.width
        );

      state.pointerTarget.y =
        clamp(
          clientY -
            state.canvasRectTop,
          0,
          state.height
        );

      /*
       * Smoothed pointer speed from consecutive raw events. Event
       * timestamps are wall-clock; the 1..400ms guard rejects both
       * zero-delta coalesced events and stale bursts after tab switches.
       */
      const now =
        performance.now();

      if (
        state.lastSignalPointerAt >
        0
      ) {
        const dt =
          now -
          state.lastSignalPointerAt;

        if (
          dt >= 1 &&
          dt <= 400
        ) {
          const dx =
            clientX -
            state.lastSignalPointerX;

          const dy =
            clientY -
            state.lastSignalPointerY;

          const eventSpeed =
            (Math.hypot(dx, dy) / dt) * 1000;

          state.pointerSpeedPxPerS +=
            (eventSpeed - state.pointerSpeedPxPerS) *
            0.35;
        }
      }

      state.lastSignalPointerX = clientX;

      state.lastSignalPointerY = clientY;

      state.lastSignalPointerAt = now;

      state.lastPointerMovementAt = now;

      if (
        state.pointerPresentSince ===
        0
      ) {
        state.pointerPresentSince = now;
      }
    };



  const updatePointerGeometry =
    () => {
      const dx =
        state.pointer.x -
        state.centerX;

      const dy =
        state.pointer.y -
        state.centerY;

      state.pointerDistance =
        Math.hypot(
          dx,
          dy
        );

      if (
        state.pointerDistance >
        0.0001
      ) {
        state.pointerAngle =
          Math.atan2(
            dy,
            dx
          );

        state.pointerAngleSin =
          dy /
          state.pointerDistance;

        state.pointerAngleCos =
          dx /
          state.pointerDistance;
      } else {
        state.pointerAngle =
          0;

        state.pointerAngleSin =
          0;

        state.pointerAngleCos =
          1;
      }

      /*
       * These values are now calculated once per frame rather than
       * once per boundary point.
       */
      state.boundaryPointerDistanceFactor =
        clamp(
          1 -
            state.pointerDistance /
              (
                state.radius *
                2.2
              ),
          0,
          1
        );

      state.boundaryAngularLookup =
        state.pointerEnergy >
          0.7
          ? ANGULAR_FALLOFF_ACTIVE
          : ANGULAR_FALLOFF_NORMAL;

      state.boundaryPointerStrength =
        state.boundaryPointerDistanceFactor *
        0.075 *
        state.profile.pointerGain;
    };



  const nearestGridNode =
    (
      x: number,
      y: number
    ) => {
      let closest =
        -1;

      let closestDistance =
        Number.POSITIVE_INFINITY;

      for (
        let index = 0;
        index <
          state.gridNodes.length;
        index += 1
      ) {
        const node =
          state.gridNodes[
            index
          ];

        const distance =
          distanceSquared(
            x,
            y,
            node.x,
            node.y
          );

        if (
          distance <
          closestDistance
        ) {
          closestDistance =
            distance;

          closest =
            index;
        }
      }

      return closest;
    };



  const spawnShockwave =
    (
      detail:
        RedMagicInteractionDetail,
      strength: number
    ) => {
      const shockwaveAngle =
        Math.atan2(
          detail.y -
            state.centerY,
          detail.x -
            state.centerX
        );

      const angleSin =
        Math.sin(
          shockwaveAngle
        );

      const angleCos =
        Math.cos(
          shockwaveAngle
        );

      /*
       * Shockwaves are created only on discrete interaction events,
       * so keeping this exact calculation preserves their visual
       * response without moving the cost into the animation loop.
       */
      const angularInfluence =
        new Float32Array(
          state.membraneBoundary.length
        );

      for (
        let index = 0;
        index <
          state.membraneBoundary.length;
        index += 1
      ) {
        const point =
          state.membraneBoundary[
            index
          ];

        const deltaSin =
          point.sin *
            angleCos -
          point.cos *
            angleSin;

        const deltaCos =
          point.cos *
            angleCos +
          point.sin *
            angleSin;

        const delta =
          Math.atan2(
            deltaSin,
            deltaCos
          );

        angularInfluence[
          index
        ] =
          Math.exp(
            -(
              delta *
              delta
            ) /
              0.34
          );
      }

      state.shockwaves.push({
        x:
          detail.x,

        y:
          detail.y,

        angle:
          shockwaveAngle,

        age:
          0,

        strength:
          clamp(
            strength *
              state.profile.shockwaveGain,
            0,
            1.4
          ),

        angularInfluence
      });

      if (
        state.shockwaves.length >
        MAX_SHOCKWAVES
      ) {
        state.shockwaves.shift();
      }

      const closest =
        engine.nearestGridNode(
          detail.x,
          detail.y
        );

      if (
        closest <
        0
      ) {
        return;
      }

      const injection =
        clamp(
          strength *
            state.profile.shockwaveGain,
          0,
          1.2
        );

      state.gridNodes[
        closest
      ].energy =
        clamp(
          state.gridNodes[
            closest
          ].energy +
            injection,
          0,
          GRID_MAX_NODE_ENERGY
        );

      const neighbors =
        state.gridNodes[
          closest
        ].neighbors;

      for (
        let index = 0;
        index <
          neighbors.length;
        index += 1
      ) {
        const neighborIndex =
          neighbors[
            index
          ];

        const neighbor =
          state.gridNodes[
            neighborIndex
          ];

        neighbor.energy =
          clamp(
            neighbor.energy +
              injection *
                0.09,
            0,
            GRID_MAX_NODE_ENERGY
          );
      }
    };



  const addClickParticle =
    (
      x: number,
      y: number
    ) => {
      if (
        state.clickParticleCount >=
        MAX_CLICK_PARTICLES
      ) {
        state.clickLightBoost =
          CLICK_LIGHT_BOOST_MAX;

        return;
      }

      const particleSeed =
        (
          state.pageSeed ^
          (
            (
              state.clickParticleCount +
              1
            ) *
            0x9e3779b9
          )
        ) >>>
          0;

      const created =
        createParticles(
          1,
          particleSeed
        );

      if (
        created.length ===
        0
      ) {
        return;
      }

      const particle =
        created[0];

      particle.x =
        clamp(
          x,
          -PARTICLE_WRAP_MARGIN,
          state.width +
            PARTICLE_WRAP_MARGIN
        );

      particle.y =
        clamp(
          y,
          -PARTICLE_WRAP_MARGIN,
          state.height +
            PARTICLE_WRAP_MARGIN
        );

      const dx =
        x -
        state.centerX;

      const dy =
        y -
        state.centerY;

      const distance =
        Math.max(
          0.001,
          Math.hypot(
            dx,
            dy
          )
        );

      const normalX =
        dx /
        distance;

      const normalY =
        dy /
        distance;

      const baseKick =
        0.012 +
        Math.min(
          0.04,
          state.pointerVelocity *
            0.0012
        );

      particle.velocityX +=
        normalX *
        baseKick;

      particle.velocityY +=
        normalY *
        baseKick;

      particle.impulseX +=
        normalX *
        1.4;

      particle.impulseY +=
        normalY *
        1.4;

      particle.revealable =
        false;

      particle.revealStrength =
        1;

      particle.revealRadius =
        1;

      state.particles.push(
        particle
      );

      state.clickParticleCount +=
        1;

      state.clickLightBoost =
        Math.max(
          state.clickLightBoost,
          0.42
        );
    };



  const applyParticleImpulse =
    (
      detail:
        RedMagicInteractionDetail,
      strength: number
    ) => {
      const influenceRadius =
        state.radius *
        (
          0.24 +
          detail.proximity *
            0.62
        );

      const influenceRadiusSquared =
        influenceRadius *
        influenceRadius;

      const impulseStrength =
        clamp(
          strength *
            state.profile.particleImpulse,
          0,
          1.5
        );

      /*
       * Soft adaptation (Runtime v2): impulses skip base-pool
       * particles beyond the active limit; click particles (index
       * >= baseParticleCount) always receive the impulse so
       * interaction feedback never degrades.
       */
      const impulseLimit =
        Math.max(
          0,
          state.activeParticleLimit
        );

      for (
        let index = 0;
        index <
          state.particles.length;
        index += 1
      ) {
        if (
          index <
            state.baseParticleCount &&
          index >=
            impulseLimit
        ) {
          continue;
        }

        const particle =
          state.particles[
            index
          ];

        const dx =
          particle.x -
          detail.x;

        const dy =
          particle.y -
          detail.y;

        const localDistanceSquared =
          dx * dx +
          dy * dy;

        if (
          localDistanceSquared >
          influenceRadiusSquared
        ) {
          continue;
        }

        const distance =
          Math.sqrt(
            Math.max(
              localDistanceSquared,
              0.0001
            )
          );

        const falloff =
          1 -
          distance /
            influenceRadius;

        const normalizedX =
          dx /
          distance;

        const normalizedY =
          dy /
          distance;

        const localStrength =
          falloff *
          impulseStrength;

        particle.impulseX +=
          normalizedX *
          localStrength;

        particle.impulseY +=
          normalizedY *
          localStrength;

        if (
          detail.energy >
          0.7
        ) {
          const rotational =
            Math.min(
              detail.velocity *
                0.006,
              0.18
            );

          particle.impulseX +=
            -normalizedY *
            rotational;

          particle.impulseY +=
            normalizedX *
            rotational;
        }
      }
    };



  const updateGrid =
    (
      delta: number,
      time: number
    ) => {
      if (
        state.gridNodes.length ===
        0
      ) {
        return;
      }

      const deltaScale =
        clamp(
          delta /
            16,
          0,
          2
        );

      const activeProfile =
        ORGANISM_PROFILE;

      const decay =
        Math.pow(
          GRID_ENERGY_DECAY,
          deltaScale *
            activeProfile.recovery
        );

      /*
       * REDUNDANT-WORK ELIMINATION (v2.1): the velocity decay and
       * the breathing position are frame-uniform — Math.pow(0.8, …)
       * was evaluated once per node per frame (49 pow calls at the
       * high tier) and the node position was written twice (the
       * pre-breathing write was dead the moment the breathing write
       * followed). Both now happen once per frame / once per node.
       */
      const velocityDecay =
        Math.pow(
          0.8,
          deltaScale
        );

      for (
        let index = 0;
        index <
          state.gridNodes.length;
        index += 1
      ) {
        const node =
          state.gridNodes[
            index
          ];

        node.energy *=
          decay;

        node.velocity *=
          velocityDecay;

        const breathing =
          Math.sin(
            time *
              0.001 +
              node.phase
          );

        const breathingScale =
          1 +
          breathing *
            0.012;

        node.x =
          state.centerX +
          node.homeX *
            state.radius *
            breathingScale;

        node.y =
          state.centerY +
          node.homeY *
            state.radius *
            breathingScale;
      }

      const nodeCount =
        state.gridNodes.length;

      /*
       * BOUNDED POTENTIAL (Runtime v2): snapshot the decayed energies
       * into a typed array once, then accumulate each node's potential
       * from its precomputed top-K neighbourhood — no object reads and
       * no all-node pairs inside the hot loop. Replaces the dense N×N
       * weighting pass (measured hotspot; see
       * buildGlobalPotentialWeights for the measurement and model).
       */
      const potentialField =
        state.globalPotential;

      if (
        potentialField &&
        potentialField.count ===
          nodeCount
      ) {
        const snapshot =
          potentialField.snapshot;

        for (
          let index = 0;
          index <
            nodeCount;
          index += 1
        ) {
          snapshot[index] =
            state.gridNodes[index].energy;
        }

        const fieldIndices =
          potentialField.indices;

        const fieldWeights =
          potentialField.weights;

        const fieldTotals =
          potentialField.totals;

        const fieldK =
          potentialField.k;

        for (
          let index = 0;
          index <
            nodeCount;
          index += 1
        ) {
          const row =
            index * fieldK;

          let weightedEnergy = 0;

          for (
            let slot = 0;
            slot < fieldK;
            slot += 1
          ) {
            weightedEnergy +=
              snapshot[
                fieldIndices[
                  row + slot
                ]
              ] *
              fieldWeights[
                row + slot
              ];
          }

          const totalWeight =
            fieldTotals[index];

          state.nodePotential[
            index
          ] =
            totalWeight > 0
              ? clamp(
                  weightedEnergy /
                    totalWeight,
                  0,
                  GRID_MAX_NODE_ENERGY
                )
              : 0;
        }
      } else {
        /*
         * Fallback (field not built or size mismatch): zero potential
         * keeps the simulation stable until the next buildWorld.
         */
        state.nodePotential.fill(0);
      }

      /*
       * Seed next-frame energies from the decayed values (v2.1: the
       * previous fill(0) was dead work — the copy below overwrites
       * every element unconditionally).
       */
      for (
        let index = 0;
        index <
          state.gridNodes.length;
        index += 1
      ) {
        state.nextNodeEnergy[
          index
        ] =
          state.gridNodes[
            index
          ].energy;
      }

      for (
        let index = 0;
        index <
          state.gridEdges.length;
        index += 1
      ) {
        const edge =
          state.gridEdges[
            index
          ];

        const a =
          state.gridNodes[
            edge.a
          ];

        const b =
          state.gridNodes[
            edge.b
          ];

        const energyDifference =
          a.energy -
          b.energy;

        if (
          Math.abs(
            energyDifference
          ) <
          GRID_ENERGY_DECAY *
            0.004
        ) {
          edge.flow *=
            0.86;

          continue;
        }

        const potentialDifference =
          state.nodePotential[
            edge.a
          ] -
          state.nodePotential[
            edge.b
          ];

        const directionalDifference =
          energyDifference +
          potentialDifference *
            0.42;

        const sign =
          directionalDifference >=
          0
            ? 1
            : -1;

        const magnitude =
          Math.abs(
            directionalDifference
          );

        const resistance =
          edge.resistance *
          (
            1 +
            edge.flow *
              0.65
          );

        const conductance =
          activeProfile.gridConductance /
          Math.max(
            0.5,
            resistance
          );

        const flow =
          clamp(
            magnitude *
              conductance *
              deltaScale,
            0,
            GRID_FLOW_LIMIT
          );

        if (
          sign > 0
        ) {
          state.nextNodeEnergy[
            edge.a
          ] -=
            flow;

          state.nextNodeEnergy[
            edge.b
          ] +=
            flow;
        } else {
          state.nextNodeEnergy[
            edge.a
          ] +=
            flow;

          state.nextNodeEnergy[
            edge.b
          ] -=
            flow;
        }

        edge.flow =
          clamp(
            edge.flow *
              0.74 +
              flow *
                1.8,
            0,
            1
          );

        const nodeVelocity =
          flow /
          Math.max(
            0.02,
            edge.restLength
          );

        a.velocity +=
          nodeVelocity *
          sign *
          0.12;

        b.velocity -=
          nodeVelocity *
          sign *
          0.12;
      }

      for (
        let index = 0;
        index <
          state.gridNodes.length;
        index += 1
      ) {
        const node =
          state.gridNodes[
            index
          ];

        if (
          node.energy <
          GRID_IDLE_ENERGY
        ) {
          continue;
        }

        const neighbors =
          node.neighbors;

        const neighborEdges =
          node.neighborEdges;

        if (
          neighbors.length ===
          0
        ) {
          continue;
        }

        let bestNeighbor =
          -1;

        let bestEffort =
          Number.POSITIVE_INFINITY;

        const currentPotential =
          state.nodePotential[
            index
          ];

        for (
          let neighborIndex = 0;
          neighborIndex <
            neighbors.length;
          neighborIndex += 1
        ) {
          const neighbor =
            neighbors[
              neighborIndex
            ];

          const edgeIndex =
            neighborEdges[
              neighborIndex
            ];

          const edge =
            state.gridEdges[
              edgeIndex
            ];

          const potentialDifference =
            Math.max(
              0,
              currentPotential -
                state.nodePotential[
                  neighbor
                ]
            );

          const edgeResistance =
            edge.resistance *
            (
              1 +
              edge.flow *
                0.55
            );

          const effort =
            edgeResistance +
            potentialDifference *
              0.7 -
            state.nodePotential[
              neighbor
            ] *
              GRID_ROUTE_BONUS;

          if (
            effort <
            bestEffort
          ) {
            bestEffort =
              effort;

            bestNeighbor =
              neighbor;
          }
        }

        if (
          bestNeighbor <
          0
        ) {
          continue;
        }

        const availableEnergy =
          Math.max(
            0,
            state.nextNodeEnergy[
              index
            ]
          );

        const routeFlow =
          clamp(
            availableEnergy *
              activeProfile.gridConductance *
              0.09 *
              deltaScale,
            0,
            0.035
          );

        state.nextNodeEnergy[
          index
        ] -=
          routeFlow;

        state.nextNodeEnergy[
          bestNeighbor
        ] +=
          routeFlow;
      }

      const pointerInfluenceRadius =
        state.radius *
        GRID_POINTER_RADIUS;

      const pointerInfluenceRadiusSquared =
        pointerInfluenceRadius *
        pointerInfluenceRadius;

      let totalGridEnergy =
        0;

      let frameHighestEnergy = 0;

      for (
        let index = 0;
        index <
          state.gridNodes.length;
        index += 1
      ) {
        const node =
          state.gridNodes[
            index
          ];

        const globalTarget =
          state.nodePotential[
            index
          ] *
          activeProfile.globalPotentialGain;

        let pointerInfluence =
          0;

        if (
          state.pointerActive
        ) {
          const pointerDistanceSquared =
            distanceSquared(
              state.pointer.x,
              state.pointer.y,
              node.x,
              node.y
            );

          if (
            pointerDistanceSquared <
            pointerInfluenceRadiusSquared
          ) {
            pointerInfluence =
              smoothstep(
                1 -
                  Math.sqrt(
                    pointerDistanceSquared
                  ) /
                    pointerInfluenceRadius
              ) *
              activeProfile.pointerGain;
          }
        }

        const pointerContribution =
          pointerInfluence *
          GRID_POINTER_CONTRIBUTION;

        const organicPulse =
          (
            Math.sin(
              time *
                0.0015 +
                node.phase
            ) +
            1
          ) *
          0.5 *
          0.003;

        state.nextNodeEnergy[
          index
        ] +=
          globalTarget *
            deltaScale +
          pointerContribution *
            deltaScale +
          organicPulse *
            deltaScale;

        node.energy =
          clamp(
            state.nextNodeEnergy[
              index
            ],
            0,
            GRID_MAX_NODE_ENERGY
          );

        if (
          node.energy >
          frameHighestEnergy
        ) {
          frameHighestEnergy =
            node.energy;
        }

        totalGridEnergy +=
          node.energy;

        node.velocity *=
          0.96;

        if (
          node.energy >
          0.03
        ) {
          node.velocity +=
            node.energy *
            0.01;
        }
      }

      state.averageGridEnergy =
        state.gridNodes.length >
        0
          ? totalGridEnergy /
            state.gridNodes.length
          : 0;

      /*
       * Track the aggregate during the update step (Runtime v2):
       * drawCore previously re-scanned every node every frame just
       * to recover this maximum — pure redundant hot-path work.
       */
      state.highestNodeEnergy =
        frameHighestEnergy;
    };



  const prepareShockwaveFrame =
    () => {
      const shockwaveCount =
        state.shockwaves.length;

      if (
        shockwaveCount ===
        0
      ) {
        return;
      }

      const pointRadius =
        state.radius *
        0.9;

      const widthFactor =
        state.radius *
        0.11;

      const widthSquared =
        Math.max(
          1,
          widthFactor *
            widthFactor
        );

      for (
        let index = 0;
        index <
          shockwaveCount;
        index += 1
      ) {
        const shockwave =
          state.shockwaves[
            index
          ];

        const progress =
          clamp(
            shockwave.age /
              SHOCKWAVE_DURATION,
            0,
            1
          );

        const currentRadius =
          state.radius *
          (
            0.08 +
            progress *
              1.05
          );

        const waveOffset =
          pointRadius -
          currentRadius;

        state.shockwaveRadialInfluence[
          index
        ] =
          Math.exp(
            -(
              waveOffset *
              waveOffset
            ) /
              widthSquared
          );

        state.shockwaveAngularCoefficient[
          index
        ] =
          (
            1 -
            progress
          ) *
          shockwave.strength *
          0.1352;
      }
    };



  const getBoundaryRadius =
    (
      point:
        BoundaryPoint
    ) => {
      const primaryWave =
        (
          point.sin3 *
            state.boundaryPrimaryPhaseCos +
          point.cos3 *
            state.boundaryPrimaryPhaseSin
        ) *
        0.034;

      const secondaryWave =
        (
          point.sin7 *
            state.boundarySecondaryPhaseCos +
          point.cos7 *
            state.boundarySecondaryPhaseSin
        ) *
        0.022;

      const tertiaryWave =
        (
          point.sin11 *
            state.boundaryTertiaryPhaseCos +
          point.cos11 *
            state.boundaryTertiaryPhaseSin
        ) *
        0.012;

      let interaction =
        0;

      /*
       * The old hot path performed:
       *
       *   atan2(...)
       *   exp(...)
       *
       * for every boundary point.
       *
       * Now:
       * - point.angle is already precomputed
       * - pointerAngle is computed once per frame
       * - wrapped angular delta uses simple branches
       * - Gaussian response is sampled from a lookup table
       */
      if (
        state.pointerActive &&
        state.pointerDistance >
          0.0001 &&
        state.boundaryPointerStrength >
          0
      ) {
        let delta =
          point.angle -
          state.pointerAngle;

        if (
          delta >
          Math.PI
        ) {
          delta -=
            TAU;
        } else if (
          delta <
          -Math.PI
        ) {
          delta +=
            TAU;
        }

        interaction =
          sampleAngularLookup(
            delta,
            state.boundaryAngularLookup
          ) *
          state.boundaryPointerStrength;
      }

      const turbulenceWave =
        (
          point.sin13 *
            state.boundaryTurbulencePhaseCos +
          point.cos13 *
            state.boundaryTurbulencePhaseSin
        );

      const turbulence =
        state.interactionTurbulence *
        (
          0.012 +
          turbulenceWave *
            0.008
        );

      const influenceCapacity =
        Math.min(
          MAX_NETWORK_INFLUENCES,
          state.gridNodes.length
        );

      let networkDeformation =
        state.averageGridEnergy *
        state.boundaryNetworkResidualWeights[
          point.fieldIndex
        ];

      const networkOffset =
        point.fieldIndex *
        influenceCapacity;

      const influenceCount =
        state.boundaryNetworkInfluenceCounts[
          point.fieldIndex
        ];

      for (
        let index = 0;
        index <
          influenceCount;
        index += 1
      ) {
        const nodeIndex =
          state.boundaryNetworkNodeIndices[
            networkOffset +
              index
          ];

        if (
          nodeIndex <
          0
        ) {
          continue;
        }

        networkDeformation +=
          state.gridNodes[
            nodeIndex
          ].energy *
          state.boundaryNetworkNodeWeights[
            networkOffset +
              index
          ];
      }

      let shockwaveDeformation =
        0;

      const shockwaveCount =
        state.shockwaves.length;

      for (
        let index = 0;
        index <
          shockwaveCount;
        index += 1
      ) {
        const shockwave =
          state.shockwaves[
            index
          ];

        shockwaveDeformation +=
          state.shockwaveRadialInfluence[
            index
          ] *
          shockwave.angularInfluence[
            point.fieldIndex
          ] *
          state.shockwaveAngularCoefficient[
            index
          ];
      }

      return (
        1 +
        primaryWave +
        secondaryWave +
        tertiaryWave +
        interaction +
        turbulence +
        networkDeformation +
        shockwaveDeformation
      );
    };



  const updatePhysicalState =
    (
      delta: number
    ) => {
      const interactionRecovery =
        state.profile.recovery;

      state.interactionTurbulence *=
        Math.pow(
          0.92,
          delta /
            16
        );

      state.pointerVelocity *=
        Math.pow(
          0.84,
          delta /
            16
        );

      /*
       * Runtime v2: interactionEnergy is a decaying EVENT FLOOR, not
       * a follower of pointerEnergy. Discrete events lift it; it then
       * decays with its own memory so energy falls naturally after a
       * burst instead of being pinned near its peak.
       */
      state.interactionEnergy *=
        Math.pow(
          0.988,
          delta /
            16
        );

      if (
        state.interactionEnergy <
        0.004
      ) {
        state.interactionEnergy = 0;
      }

      state.clickLightBoost *=
        Math.pow(
          CLICK_LIGHT_DECAY,
          delta /
            CLICK_LIGHT_DECAY_REFERENCE_MS
        );

      if (
        state.clickLightBoost <
        0.001
      ) {
        state.clickLightBoost =
          0;
      }

      if (
        !state.pointerActive
      ) {
        state.charge *=
          Math.pow(
            0.94,
            delta /
              16
          );
      }

      const timingGridStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.updateGrid(
        delta *
          interactionRecovery,
        state.elapsed
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.grid +=
          performance.now() -
          timingGridStart;
      }

      for (
        let index =
          state.shockwaves.length -
          1;
        index >=
          0;
        index -= 1
      ) {
        const shockwave =
          state.shockwaves[
            index
          ];

        shockwave.age +=
          delta *
          interactionRecovery;

        if (
          shockwave.age >
          SHOCKWAVE_DURATION
        ) {
          state.shockwaves.splice(
            index,
            1
          );
        }
      }
    };

/*
   * maybeAdaptQuality (Runtime v2) — the engine's measurement and
   * adaptation controller.
   *
   * Sampling: raw inter-frame deltas feed the refresh estimator and a
   * ~1.8s fps window. IDLE-CADENCE FRAMES ARE EXCLUDED: an organism
   * deliberately redrawing at 33ms is a cadence decision, not a
   * performance problem — counting those frames made the sampler
   * demote quality on healthy machines that were merely idle (the
   * sampler now also resets across state transitions so a window
   * never mixes idle and active frames).
   *
   * Adaptation: quality responds to SUSTAINED conditions only
   * (two bad windows demote, three good windows promote, a 3.5s
   * recovery guard sits after every change). Demotion applies SOFT
   * adaptation immediately — real work reduction the very next frame
   * — and schedules the HARD structural rebuild for the next settled
   * frame. Promotion restores soft outputs immediately and schedules
   * the structural rebuild the same way, so both directions are real
   * work changes with no mid-interaction rebuilds.
   */
  const maybeAdaptQuality =
    (
      timestamp: number,
      idleCapped: boolean
    ) => {
      if (
        state.reducedMotion
      ) {
        return;
      }

      /*
       * Idle-capped frames (idle cadence drew this frame at the
       * reduced rate) never feed the sampler — the window instead
       * restarts so the next active phase is measured cleanly.
       */
      if (
        idleCapped
      ) {
        state.performanceSampleTime = timestamp;

        state.performanceFrames = 0;

        state.lastAdaptTimestamp = timestamp;

        return;
      }

      /*
       * Collect the raw (unclamped) inter-frame delta for refresh
       * estimation. The simulation clamps deltas at 32 ms, but the
       * DISPLAY's native interval lives below that cap under normal
       * conditions. V2.1: valid deltas are recorded into the bounded
       * sampler buffer; the window's representative is a robust low
       * PERCENTILE of the samples (engineConfig) instead of the raw
       * minimum — a single glitch-short interval can no longer pin
       * the estimate at a phantom refresh rate.
       */
      if (
        state.lastAdaptTimestamp !==
        0
      ) {
        const rawDelta =
          timestamp -
          state.lastAdaptTimestamp;

        if (
          rawDelta >=
            3 &&
          rawDelta <=
            34
        ) {
          recordRefreshDelta(
            state.refreshSampler,
            rawDelta
          );
        }
      }

      state.lastAdaptTimestamp =
        timestamp;

      if (
        state.performanceSampleTime ===
        0
      ) {
        state.performanceSampleTime =
          timestamp;

        return;
      }

      state.performanceFrames +=
        1;

      const sampleElapsed =
        timestamp -
        state.performanceSampleTime;

      if (
        sampleElapsed <
        1800
      ) {
        return;
      }

      const sampledFrames =
        state.performanceFrames;

      const fps =
        (
          sampledFrames *
          1000
        ) /
        sampleElapsed;

      const frameTime =
        sampledFrames >
        0
          ? sampleElapsed /
            sampledFrames
          : 0;

      state.performanceSampleTime =
        timestamp;

      state.performanceFrames =
        0;

      state.latestFps = fps;

      /*
       * Subsystem averages for this window (measurement builds
       * only): per drawn frame, reset after publication.
       */
      let subsystems:
        | RedMagicSubsystemTimings
        | undefined;

      if (
        state.subsystemTiming !== null
      ) {
        if (
          state.timingFrameCount >
            0
        ) {
          const frames =
            state.timingFrameCount;

          subsystems = {
            sim:
              state.subsystemTiming.sim /
              frames,

            grid:
              state.subsystemTiming.grid /
              frames,

            render:
              state.subsystemTiming.render /
              frames,

            membrane:
              state.subsystemTiming.membrane /
              frames,

            network:
              state.subsystemTiming.network /
              frames,

            flows:
              state.subsystemTiming.flows /
              frames,

            core:
              state.subsystemTiming.core /
              frames,

            particles:
              state.subsystemTiming.particles /
              frames
          };
        }

        state.subsystemTiming.sim = 0;

        state.subsystemTiming.grid = 0;

        state.subsystemTiming.render = 0;

        state.subsystemTiming.membrane = 0;

        state.subsystemTiming.network = 0;

        state.subsystemTiming.flows = 0;

        state.subsystemTiming.core = 0;

        state.subsystemTiming.particles = 0;

        state.timingFrameCount = 0;
      }

      /*
       * Refresh estimate (v2.1): the window's representative is the
       * robust percentile of the collected samples — sustained-fast
       * adoption, sustained-collapse decay, null window when too few
       * valid deltas arrived (suspension/idle gaps).
       */
      const windowHz =
        representativeWindowHz(
          state.refreshSampler
        );

      closeRefreshWindow(
        state.refreshEstimator,
        windowHz
      );

      resetRefreshDeltaSampler(
        state.refreshSampler
      );

      const refreshHzEstimate =
        state.refreshEstimator.estimate;

      publishRedMagicPerformance({
        fps,

        frameTime,

        quality:
          state.qualityName,

        dpr: state.dpr,

        dprCap: state.dprCap,

        width: state.width,

        height: state.height,

        pointerEnergy:
          Math.round(
            state.pointerEnergy *
              100
          ) /
          100,

        refreshHz:
          refreshHzEstimate >
          0
            ? Math.round(
                refreshHzEstimate
              )
            : undefined,

        runtimeState: state.runtimeState,

        simulationScale:
          STATE_SIMULATION_SCALE[
            state.runtimeState
          ],

        particlesActive:
          Math.min(
            state.activeParticleLimit,
            state.baseParticleCount
          ) +
          (state.particles.length -
            state.baseParticleCount),

        particlesBudget:
          state.quality.particles,

        gridNodes:
          state.gridNodes.length,

        gridEdges:
          state.gridEdges.length,

        membranePoints:
          state.membraneBoundary.length,

        flowCount:
          state.quality.flowCount,

        flowSegments:
          state.quality.flowSegments,

        membraneStride: state.membraneStride,

        atmosphere:
          Math.round(
            state.atmosphereScale * 100
          ) /
          100,

        lastAdaptation:
          state.lastAdaptation ??
          undefined,

        subsystems
      });

      if (
        timestamp -
          state.lastQualityChange <
        3500
      ) {
        return;
      }

      /*
       * RELATIVE thresholds. With no estimate yet the fallback lines
       * behave conservatively (48 / 55). On a measured display:
       *
       *   60 Hz  → demote below 48, promote above 54
       *   120 Hz → demote below 86, promote above 108
       *
       * A display running at its native rate is never demoted; a
       * display that lost a third of its frames is, regardless of
       * how good the absolute numbers look.
       */
      const hasEstimate =
        refreshHzEstimate >
        40;

      const demoteLine =
        hasEstimate
          ? Math.max(
              48,
              refreshHzEstimate *
                0.72
            )
          : 55;

      const promoteLine =
        hasEstimate
          ? refreshHzEstimate *
            0.9
          : 58;

      let nextQuality:
        | QualityName
        | null =
        null;

      let adaptReason =
        "";

      if (
        fps <
        demoteLine
      ) {
        state.demoteStreak +=
          1;

        state.promoteStreak =
          0;

        if (
          state.demoteStreak >=
          2
        ) {
          if (
            state.qualityName ===
            "high"
          ) {
            nextQuality =
              "medium";

            adaptReason = "sustained-fps";
          } else if (
            fps <
              50 &&
            state.qualityName ===
              "medium"
          ) {
            nextQuality =
              "low";

            adaptReason = "sustained-fps";
          }
        }
      } else {
        state.demoteStreak =
          0;
      }

      if (
        fps >=
        promoteLine
      ) {
        state.promoteStreak +=
          1;

        if (
          state.promoteStreak >=
          3
        ) {
          if (
            state.qualityName ===
              "medium"
          ) {
            nextQuality =
              "high";

            adaptReason = "recovery";
          } else if (
            state.qualityName ===
              "low" &&
            fps >=
              58
          ) {
            nextQuality =
              "medium";

            adaptReason = "recovery";
          }
        }
      } else {
        state.promoteStreak =
          0;
      }

      /*
       * DPR pressure evidence (v2.1), captured from THIS window's
       * streaks before any reset below: the same two-bad-window /
       * three-good-window hysteresis the quality controller uses.
       */
      const sustainedPoor =
        state.demoteStreak >=
          2;

      const sustainedRecovery =
        state.promoteStreak >=
          3;

      if (
        nextQuality !==
        null
      ) {
        state.demoteStreak =
          0;

        state.promoteStreak =
          0;

        /*
         * SOFT FIRST: the new tier's budgets (particle limit, flows,
         * strides, atmosphere) apply from the next drawn frame. The
         * structural rebuild is scheduled and executes on a settled
         * frame — never mid-interaction.
         */
        engine.setQuality(nextQuality, {
          mode: "soft",
          reason: adaptReason
        });
      }

      /*
       * MEASURED-PRESSURE DPR (v2.1): evaluated HERE, on the
       * measurement boundary — no resize event required. Sustained
       * degradation lowers the backing-store resolution one coarse
       * step (real fill-rate reduction, cheaper to reverse than a
       * structural rebuild); sustained recovery with a healthy
       * measured ratio restores it toward the static ceiling one
       * fine step. The policy itself (engineConfig.resolvePressureDpr)
       * owns the debounce, floor, ceiling and never-raise-while-poor
       * law. applyDpr performs the switch and invalidates the
       * sampling windows so the next window measures the new
       * resolution instead of mixing old and new frames.
       */
      if (
        !state.reducedMotion
      ) {
        const pressureDpr =
          resolvePressureDpr({
            currentDpr: state.dpr,

            ceiling: dprCeilingFor(
              state.qualityName,
              state.width *
                state.height
            ),

            deviceDpr:
              window.devicePixelRatio ||
              1,

            sustainedPoor,

            sustainedRecovery,

            performanceRatio:
              refreshHzEstimate >
                0
                ? fps /
                  refreshHzEstimate
                : 0,

            lastChangeAt:
              state.dprLastChangeAt,

            now: performance.now()
          });

        engine.applyDpr(
          pressureDpr
        );
      }
    };

  return {
    rebuildBoundaryNetworkWeights,
    applySoftAdaptation,
    scheduleHardRebuild,
    setQuality,
    buildWorld,
    rebuildMembraneGradient,
    resetPerformanceSampling,
    updatePointer,
    updatePointerGeometry,
    nearestGridNode,
    spawnShockwave,
    addClickParticle,
    applyParticleImpulse,
    updateGrid,
    prepareShockwaveFrame,
    getBoundaryRadius,
    updatePhysicalState,
    maybeAdaptQuality
  };
}
