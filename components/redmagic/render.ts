/*
 * redmagic/render.ts — the draw passes and the frame loop (v4.0.1).
 *
 * Mechanically extracted from the engine closure in
 * components/RedMagic.tsx: the function bodies are unchanged; the
 * shared mutable state arrives as the single EngineState object and
 * sibling engine functions are reached through the late-bound
 * Engine object.
 */

import type { EngineState, Engine } from "@/components/redmagic/engineState";

import {
  STATE_SIMULATION_SCALE,
  STILL_POINTER_IDLE_MS,
  SETTLED_ENERGY,
  SPEED_SATURATION_PX_S,
  DWELL_SATURATION_MS,
  interactionTargetEnergy,
  isSettledFrame
} from "@/components/redmagic/engineConfig";

import {
  TAU,
  SHOCKWAVE_DURATION,
  IDLE_CADENCE_DELAY_MS,
  IDLE_FRAME_INTERVAL_MS,
  CORE_ROTATION_SPEED,
  CORE_DETAIL_ROTATION_SPEED,
  CORE_MOVEMENT_SPEED,
  CORE_MOVEMENT_AMPLITUDE,
  clamp
} from "@/components/redmagic/engineConstants";

import {
  updateAndDrawParticles
} from "@/components/RedMagicParticles";

import {
  noteOrganismActivity
} from "@/lib/worldSignals";

export function createRenderModule(
  state: EngineState,
  engine: Engine
): Pick<Engine, "drawGlow" | "drawNodeCore" | "drawNetwork" | "drawInteraction" | "drawMembrane" | "drawEnergyFlows" | "drawParticles" | "drawCore" | "render"> {


  const drawGlow =
    (
      x: number,
      y: number,
      innerRadius: number,
      outerRadius: number,
      alpha: number
    ) => {
      const boostedAlpha =
        clamp(
          alpha *
            (
              1 +
              state.clickLightBoost *
                0.7
            ),
          0,
          1
        );

      if (
        state.glowSprite
      ) {
        state.context.globalAlpha =
          boostedAlpha;

        state.context.drawImage(
          state.glowSprite,
          x -
            outerRadius,
          y -
            outerRadius,
          outerRadius *
            2,
          outerRadius *
            2
        );

        state.context.globalAlpha =
          1;

        return;
      }

      const gradient =
        state.context.createRadialGradient(
          x,
          y,
          innerRadius,
          x,
          y,
          outerRadius
        );

      gradient.addColorStop(
        0,
        `rgba(255, 80, 20, ${boostedAlpha})`
      );

      gradient.addColorStop(
        0.35,
        `rgba(255, 28, 12, ${
          boostedAlpha *
          0.46
        })`
      );

      gradient.addColorStop(
        1,
        "rgba(255, 0, 0, 0)"
      );

      state.context.fillStyle =
        gradient;

      state.context.beginPath();

      state.context.arc(
        x,
        y,
        outerRadius,
        0,
        TAU
      );

      state.context.fill();
    };



  const drawNodeCore =
    (
      x: number,
      y: number,
      radiusValue: number,
      alpha: number
    ) => {
      const boostedAlpha =
        clamp(
          alpha *
            (
              1 +
              state.clickLightBoost *
                0.55
            ),
          0,
          1
        );

      if (
        !state.nodeSprite
      ) {
        state.context.globalAlpha =
          boostedAlpha;

        state.context.fillStyle =
          "rgba(255, 92, 70, 1)";

        state.context.beginPath();

        state.context.arc(
          x,
          y,
          radiusValue,
          0,
          TAU
        );

        state.context.fill();

        state.context.globalAlpha =
          1;

        return;
      }

      const diameter =
        Math.max(
          2.4,
          radiusValue *
            2
        );

      state.context.globalAlpha =
        boostedAlpha;

      state.context.drawImage(
        state.nodeSprite,
        x -
          diameter *
            0.5,
        y -
          diameter *
            0.5,
        diameter,
        diameter
      );

      state.context.globalAlpha =
        1;
    };



  const drawNetwork =
    (
      time: number
    ) => {
      if (
        state.gridNodes.length ===
        0
      ) {
        return;
      }

      state.context.lineCap =
        "round";

      state.context.lineJoin =
        "round";

      /*
       * CLASSIFY PASS (v2.1): one sweep decides each edge's stroke
       * bucket AND records its index in that bucket's preallocated
       * index list — the draw passes below walk only their own
       * members instead of re-scanning the full edge array once per
       * bucket (the pre-v2.1 path performed six full sweeps).
       */
      state.networkBucketCounts
        .fill(
          0
        );

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

        const energy =
          (
            a.energy +
            b.energy
          ) *
          0.5;

        const active =
          clamp(
            energy *
              1.8 +
              edge.flow *
                1.4,
            0,
            1
          );

        let bucket =
          4;

        if (
          active <
          0.01
        ) {
          bucket =
            0;
        } else if (
          active <
          0.12
        ) {
          bucket =
            1;
        } else if (
          active <
          0.3
        ) {
          bucket =
            2;
        } else if (
          active <
          0.62
        ) {
          bucket =
            3;
        }

        state.networkBucketIndices[
          bucket
        ][
          state.networkBucketCounts[
            bucket
          ]
        ] =
          index;

        state.networkBucketCounts[
          bucket
        ] +=
          1;
      }

      const lightMultiplier =
        1 +
        state.clickLightBoost *
          0.75;

      if (
        state.networkBucketCounts[
          0
        ] >
          0
      ) {
        state.context.beginPath();

        const bucketList =
          state.networkBucketIndices[
            0
          ];

        const bucketCount =
          state.networkBucketCounts[
            0
          ];

        for (
          let member = 0;
          member <
            bucketCount;
          member += 1
        ) {
          const edge =
            state.gridEdges[
              bucketList[
                member
              ]
            ];

          const a =
            state.gridNodes[
              edge.a
            ];

          const b =
            state.gridNodes[
              edge.b
            ];

          state.context.moveTo(
            a.x,
            a.y
          );

          state.context.lineTo(
            b.x,
            b.y
          );
        }

        state.context.globalAlpha =
          0.012 *
          lightMultiplier;

        state.context.lineWidth =
          0.4;

        state.context.strokeStyle =
          "rgba(115, 18, 18, 1)";

        state.context.stroke();
      }

      if (
        state.networkBucketCounts[
          1
        ] >
          0
      ) {
        state.context.beginPath();

        const bucketList =
          state.networkBucketIndices[
            1
          ];

        const bucketCount =
          state.networkBucketCounts[
            1
          ];

        for (
          let member = 0;
          member <
            bucketCount;
          member += 1
        ) {
          const edge =
            state.gridEdges[
              bucketList[
                member
              ]
            ];

          const a =
            state.gridNodes[
              edge.a
            ];

          const b =
            state.gridNodes[
              edge.b
            ];

          state.context.moveTo(
            a.x,
            a.y
          );

          state.context.lineTo(
            b.x,
            b.y
          );
        }

        state.context.globalAlpha =
          0.028 *
          lightMultiplier;

        state.context.lineWidth =
          0.46;

        state.context.strokeStyle =
          "rgba(255, 70, 52, 1)";

        state.context.stroke();
      }

      if (
        state.networkBucketCounts[
          2
        ] >
          0
      ) {
        state.context.beginPath();

        const bucketList =
          state.networkBucketIndices[
            2
          ];

        const bucketCount =
          state.networkBucketCounts[
            2
          ];

        for (
          let member = 0;
          member <
            bucketCount;
          member += 1
        ) {
          const edge =
            state.gridEdges[
              bucketList[
                member
              ]
            ];

          const a =
            state.gridNodes[
              edge.a
            ];

          const b =
            state.gridNodes[
              edge.b
            ];

          state.context.moveTo(
            a.x,
            a.y
          );

          state.context.lineTo(
            b.x,
            b.y
          );
        }

        state.context.globalAlpha =
          0.052 *
          lightMultiplier;

        state.context.lineWidth =
          0.56;

        state.context.strokeStyle =
          "rgba(255, 70, 52, 1)";

        state.context.stroke();
      }

      if (
        state.networkBucketCounts[
          3
        ] >
          0
      ) {
        state.context.beginPath();

        const bucketList =
          state.networkBucketIndices[
            3
          ];

        const bucketCount =
          state.networkBucketCounts[
            3
          ];

        for (
          let member = 0;
          member <
            bucketCount;
          member += 1
        ) {
          const edge =
            state.gridEdges[
              bucketList[
                member
              ]
            ];

          const a =
            state.gridNodes[
              edge.a
            ];

          const b =
            state.gridNodes[
              edge.b
            ];

          state.context.moveTo(
            a.x,
            a.y
          );

          state.context.lineTo(
            b.x,
            b.y
          );
        }

        state.context.globalAlpha =
          0.092 *
          lightMultiplier;

        state.context.lineWidth =
          0.72;

        state.context.strokeStyle =
          "rgba(255, 70, 52, 1)";

        state.context.stroke();
      }

      if (
        state.networkBucketCounts[
          4
        ] >
          0
      ) {
        state.context.beginPath();

        const bucketList =
          state.networkBucketIndices[
            4
          ];

        const bucketCount =
          state.networkBucketCounts[
            4
          ];

        for (
          let member = 0;
          member <
            bucketCount;
          member += 1
        ) {
          const edge =
            state.gridEdges[
              bucketList[
                member
              ]
            ];

          const a =
            state.gridNodes[
              edge.a
            ];

          const b =
            state.gridNodes[
              edge.b
            ];

          state.context.moveTo(
            a.x,
            a.y
          );

          state.context.lineTo(
            b.x,
            b.y
          );
        }

        state.context.globalAlpha =
          0.13 *
          lightMultiplier;

        state.context.lineWidth =
          1.1;

        state.context.strokeStyle =
          "rgba(255, 70, 52, 1)";

        state.context.stroke();
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

        const potential =
          state.nodePotential[
            index
          ];

        const energy =
          node.energy;

        const localPulse =
          1 +
          Math.sin(
            time *
              0.003 +
              node.phase
          ) *
            0.12;

        const nodeRadius =
          (
            1.5 +
            energy *
              4.2 +
            potential *
              1.5
          ) *
          localPulse;

        const nodeAlpha =
          clamp(
            (
              0.24 +
              energy *
                0.72 +
              potential *
                0.16
            ) *
              (
                1 +
                state.clickLightBoost *
                  0.55
              ),
            0,
            1
          );

        engine.drawNodeCore(
          node.x,
          node.y,
          Math.max(
            1.2,
            nodeRadius
          ),
          nodeAlpha
        );

        /*
         * Budget-gated glow pass (Runtime v2): the node-glow sprite
         * layer is part of the atmosphere allocation. Lower tiers
         * raise the energy floor and soft adaptation scales the
         * alpha — the cheap line network stays, the expensive glow
         * layer degrades first.
         */
        if (
          energy >
            state.quality.nodeGlowFloor &&
          state.atmosphereScale >
            0.25
        ) {
          engine.drawGlow(
            node.x,
            node.y,
            0,
            nodeRadius *
              (
                3.2 +
                energy *
                  2
              ),
            (
              0.028 +
              energy *
                0.07
            ) *
              state.atmosphereScale
          );
        }
      }

      state.context.globalAlpha =
        1;
    };



  const drawInteraction =
    () => {
      if (
        !state.pointerActive &&
        state.pointerEnergy <=
          0.01 &&
        state.shockwaves.length ===
          0
      ) {
        return;
      }

      const fieldRadius =
        state.radius *
        (
          0.25 +
          state.pointerEnergy *
            0.8 +
          state.interactionTurbulence *
            0.18 +
          state.charge *
            0.18
        ) *
        state.profile.pointerGain;

      const visualPointerX =
        state.pointerTarget.x;

      const visualPointerY =
        state.pointerTarget.y;

      if (
        state.pointerActive &&
        state.interactionSprite
      ) {
        state.context.globalAlpha =
          (
            0.04 +
            state.pointerEnergy *
              0.065
          ) *
          (
            1 +
            state.clickLightBoost *
              0.7
          );

        state.context.drawImage(
          state.interactionSprite,
          visualPointerX -
            fieldRadius,
          visualPointerY -
            fieldRadius,
          fieldRadius *
            2,
          fieldRadius *
            2
        );

        state.context.globalAlpha =
          1;
      } else if (
        state.pointerActive
      ) {
        engine.drawGlow(
          visualPointerX,
          visualPointerY,
          0,
          fieldRadius,
          0.045 +
            state.pointerEnergy *
              0.06
        );
      }

      for (
        let index = 0;
        index <
          state.shockwaves.length;
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

        const waveRadius =
          state.radius *
          (
            0.08 +
            progress *
              1.05
          );

        state.context.globalAlpha =
          (
            1 -
            progress
          ) *
          shockwave.strength *
          0.38 *
          (
            1 +
            state.clickLightBoost *
              0.55
          );

        state.context.lineWidth =
          1 +
          shockwave.strength *
            1.5;

        state.context.strokeStyle =
          "rgba(255, 74, 54, 1)";

        state.context.beginPath();

        state.context.arc(
          shockwave.x,
          shockwave.y,
          waveRadius,
          0,
          TAU
        );

        state.context.stroke();

        const innerRadius =
          waveRadius *
          0.92;

        state.context.globalAlpha *=
          0.25;

        state.context.lineWidth *=
          0.55;

        state.context.beginPath();

        state.context.arc(
          shockwave.x,
          shockwave.y,
          innerRadius,
          0,
          TAU
        );

        state.context.stroke();
      }

      state.context.globalAlpha =
        1;
    };



  const drawMembrane =
    (
      time: number
    ) => {
      engine.prepareShockwaveFrame();

      const primaryPhase =
        time *
        0.0011;

      state.boundaryPrimaryPhaseSin =
        Math.sin(
          primaryPhase
        );

      state.boundaryPrimaryPhaseCos =
        Math.cos(
          primaryPhase
        );

      const secondaryPhase =
        1.3 -
        time *
          0.0008;

      state.boundarySecondaryPhaseSin =
        Math.sin(
          secondaryPhase
        );

      state.boundarySecondaryPhaseCos =
        Math.cos(
          secondaryPhase
        );

      const tertiaryPhase =
        time *
        0.00065;

      state.boundaryTertiaryPhaseSin =
        Math.sin(
          tertiaryPhase
        );

      state.boundaryTertiaryPhaseCos =
        Math.cos(
          tertiaryPhase
        );

      const turbulencePhase =
        time *
          0.004 +
        state.pointerAngle *
          2;

      state.boundaryTurbulencePhaseSin =
        Math.sin(
          turbulencePhase
        );

      state.boundaryTurbulencePhaseCos =
        Math.cos(
          turbulencePhase
        );

      state.context.beginPath();

      /*
       * Membrane draw stride (Runtime v2 soft adaptation): under soft
       * pressure the stroke is drawn every second point. The boundary
       * structures and influence tables stay intact — only the stroke
       * resolution drops, so recovery is instant and lossless.
       */
      const boundaryStride =
        state.membraneStride;

      for (
        let index = 0;
        index <
          state.membraneBoundary.length;
        index += boundaryStride
      ) {
        const point =
          state.membraneBoundary[
            index
          ];

        const normalizedRadius =
          engine.getBoundaryRadius(
            point
          ) *
          state.radius;

        const x =
          state.centerX +
          point.cos *
            normalizedRadius;

        const y =
          state.centerY +
          point.sin *
            normalizedRadius;

        if (
          index ===
          0
        ) {
          state.context.moveTo(
            x,
            y
          );
        } else {
          state.context.lineTo(
            x,
            y
          );
        }
      }

      state.context.closePath();

      if (
        state.membraneGradient
      ) {
        state.context.fillStyle =
          state.membraneGradient;

        state.context.globalAlpha =
          1 +
          state.clickLightBoost *
            0.3;

        state.context.fill();

        state.context.globalAlpha =
          1;
      }

      const lightMultiplier =
        1 +
        state.clickLightBoost *
          0.65;

      /*
       * STRING-FREE STROKES (v2.1): the stroke colour used to be
       * rebuilt from a template literal every frame — two fresh
       * strings per frame here, one more in drawEnergyFlows. The
       * strokeStyle is now a constant and the light multiplier is
       * applied through globalAlpha, which composites identically
       * (source alpha = strokeStyle alpha × globalAlpha) while
       * allocating nothing.
       */
      state.context.lineWidth =
        state.reducedMotion
          ? 1.2
          : 1.6;

      state.context.strokeStyle =
        "rgb(255, 55, 40)";

      state.context.globalAlpha =
        0.68 *
        lightMultiplier;

      state.context.stroke();

      state.context.lineWidth =
        4;

      state.context.strokeStyle =
        "rgb(125, 0, 0)";

      state.context.globalAlpha =
        0.12 *
        lightMultiplier;

      state.context.stroke();

      state.context.globalAlpha =
        1;
    };



  const drawEnergyFlows =
    (
      time: number
    ) => {
      const flowCount =
        state.quality.flowCount;

      if (
        flowCount ===
        0
      ) {
        return;
      }

      const flowSegments =
        state.quality.flowSegments;

      const geometry =
        state.flowGeometry;

      const angleTime =
        time *
        0.0012;

      const waveTime =
        time *
        0.0017;

      const angleTimeSin =
        Math.sin(
          angleTime
        );

      const angleTimeCos =
        Math.cos(
          angleTime
        );

      const waveTimeSin =
        Math.sin(
          waveTime
        );

      const waveTimeCos =
        Math.cos(
          waveTime
        );

      const angleAmplitude =
        0.05 +
        state.interactionTurbulence *
          0.018;

      const waveAmplitude =
        state.radius *
        (
          0.025 +
          state.interactionTurbulence *
            0.016
        );

      state.context.lineWidth =
        (
          0.8 +
          state.pointerEnergy *
            0.8 +
          state.interactionTurbulence *
            0.5
        );

      /* String-free stroke (v2.1): constant colour, alpha via globalAlpha. */
      state.context.strokeStyle =
        "rgb(255, 70, 48)";

      state.context.globalAlpha =
        (
          0.08 +
          state.pointerEnergy *
            0.05 +
          state.interactionTurbulence *
            0.035
        ) *
        (
          1 +
          state.clickLightBoost *
            0.65
        );

      state.context.beginPath();

      for (
        let index = 0;
        index <
          flowCount;
        index += 1
      ) {
        const direction =
          geometry.directions[
            index
          ];

        const baseAngle =
          geometry.baseAngles[
            index
          ] +
          time *
            0.00016 *
            direction +
          state.interactionTurbulence *
            0.04 *
            direction;

        const baseSin =
          Math.sin(
            baseAngle
          );

        const baseCos =
          Math.cos(
            baseAngle
          );

        const flowOffset =
          index *
          (
            flowSegments +
            1
          );

        /*
         * Flow draw stride (Runtime v2 soft adaptation): coarser
         * point sampling under pressure; geometry arrays are intact
         * so the stride restores to 1 losslessly.
         */
        const segmentStride =
          state.flowStride;

        for (
          let segment = 0;
          segment <= flowSegments;
          segment += segmentStride
        ) {
          const pointIndex =
            flowOffset +
            segment;

          const phaseSin =
            geometry.anglePhaseSin[
              pointIndex
            ] *
              angleTimeCos +
            geometry.anglePhaseCos[
              pointIndex
            ] *
              angleTimeSin;

          const angleOffset =
            phaseSin *
            angleAmplitude;

          const angleOffsetSquared =
            angleOffset *
            angleOffset;

          const offsetSin =
            angleOffset -
            angleOffset *
              angleOffsetSquared /
              6;

          const offsetCos =
            1 -
            angleOffsetSquared *
              0.5;

          const directionX =
            baseCos *
              offsetCos -
            baseSin *
              offsetSin;

          const directionY =
            baseSin *
              offsetCos +
            baseCos *
              offsetSin;

          const waveSin =
            geometry.wavePhaseSin[
              pointIndex
            ] *
              waveTimeCos +
            geometry.wavePhaseCos[
              pointIndex
            ] *
              waveTimeSin;

          const radialDistance =
            geometry.distanceScales[
              pointIndex
            ] *
            state.radius +
            waveSin *
              waveAmplitude;

          const x =
            state.centerX +
            directionX *
              radialDistance;

          const y =
            state.centerY +
            directionY *
              radialDistance;

          if (
            segment ===
            0
          ) {
            state.context.moveTo(
              x,
              y
            );
          } else {
            state.context.lineTo(
              x,
              y
            );
          }
        }
      }

      state.context.stroke();

      state.context.globalAlpha =
        1;
    };



  const drawParticles =
    (
      time: number,
      delta: number
    ) => {
      state.particleDrawOptions.width =
        state.width;

      state.particleDrawOptions.height =
        state.height;

      state.particleDrawOptions.centerX =
        state.centerX;

      state.particleDrawOptions.centerY =
        state.centerY;

      state.particleDrawOptions.radius =
        state.radius;

      state.particleDrawOptions.pointer =
        state.pointer;

      state.particleDrawOptions.pointerActive =
        state.pointerActive;

      state.particleDrawOptions.pointerEnergy =
        state.pointerEnergy;

      state.particleDrawOptions.charge =
        state.charge;

      state.particleDrawOptions.time =
        time;

      state.particleDrawOptions.delta =
        delta;

      state.particleDrawOptions.activeLimit =
        state.activeParticleLimit;

      state.particleDrawOptions.baseCount =
        state.baseParticleCount;

      updateAndDrawParticles(
        state.particleDrawOptions
      );
    };



  const drawCore =
    (
      time: number
    ) => {
      const pulse =
        1 +
        Math.sin(
          time *
            0.0022
        ) *
          0.035 +
        Math.sin(
          time *
            0.0049
        ) *
          0.012;

      /*
       * Highest node energy arrives tracked from updateGrid (Runtime
       * v2) — the per-frame re-scan of every grid node that used to
       * live here is gone; the aggregate is produced where the
       * energies are already in registers.
       */
      const highestGridEnergy =
        state.highestNodeEnergy;

      const activePulse =
        state.pointerEnergy *
          0.11 *
          state.profile.coreGain +
        state.charge *
          0.18 *
          state.profile.coreGain +
        state.interactionTurbulence *
          0.035 +
        state.pointerVelocity *
          0.003 *
          state.profile.coreGain +
        state.averageGridEnergy *
          0.09 +
        highestGridEnergy *
          0.035 +
        state.clickLightBoost *
          0.06;

      const solarBreathing =
        1 +
        Math.sin(
          time *
            CORE_MOVEMENT_SPEED
        ) *
          CORE_MOVEMENT_AMPLITUDE +
        Math.sin(
          time *
            0.0029
        ) *
          0.004;

      const movementEnergy =
        clamp(
          (
            state.pointerEnergy *
              0.08 +
            state.charge *
              0.12 +
            state.averageGridEnergy *
              0.035 +
            state.interactionTurbulence *
              0.03 +
            state.clickLightBoost *
              0.035
          ) *
            state.profile.coreGain,
          0,
          0.18
        );

      const coreRadius =
        state.radius *
        0.49 *
        (
          pulse +
          activePulse
        ) *
        solarBreathing;

      const coreRotation =
        time *
        CORE_ROTATION_SPEED;

      const detailRotation =
        time *
        CORE_DETAIL_ROTATION_SPEED;

      const dynamicScale =
        1 +
        movementEnergy;

      engine.drawGlow(
        state.centerX,
        state.centerY,
        coreRadius *
          0.08,
        coreRadius *
          (
            1.72 +
            movementEnergy *
              1.8
          ),
        0.11 +
          state.pointerEnergy *
            0.04 *
            state.profile.coreGain +
          state.charge *
            0.035 +
          state.averageGridEnergy *
            0.04 +
          movementEnergy *
            0.09
      );

      if (
        state.charge >
          0.01 &&
        state.atmosphereScale >
          0.3
      ) {
        engine.drawGlow(
          state.centerX,
          state.centerY,
          coreRadius *
            0.2,
          coreRadius *
            (
              1.9 +
              state.charge *
                1.2
            ),
          (
            0.055 +
            state.charge *
              0.09
          ) *
            state.atmosphereScale
        );
      }

      if (
        state.coreSprite
      ) {
        state.context.save();

        state.context.globalAlpha =
          1;

        state.context.translate(
          state.centerX,
          state.centerY
        );

        state.context.rotate(
          coreRotation
        );

        state.context.scale(
          dynamicScale,
          dynamicScale
        );

        state.context.drawImage(
          state.coreSprite,
          -coreRadius,
          -coreRadius,
          coreRadius *
            2,
          coreRadius *
            2
        );

        state.context.restore();
      }

      if (
        state.coreDetailSprite
      ) {
        state.context.save();

        state.context.globalAlpha =
          clamp(
            (
              0.42 +
              state.pointerEnergy *
                0.14 +
              state.interactionTurbulence *
                0.1 +
              state.charge *
                0.08
            ) *
              (
                1 +
                state.clickLightBoost *
                  0.35
              ),
            0,
            1
          );

        state.context.translate(
          state.centerX,
          state.centerY
        );

        state.context.rotate(
          detailRotation
        );

        state.context.scale(
          1 +
            movementEnergy *
              0.45,
          1 +
            movementEnergy *
              0.45
        );

        state.context.drawImage(
          state.coreDetailSprite,
          -coreRadius,
          -coreRadius,
          coreRadius *
            2,
          coreRadius *
            2
        );

        state.context.restore();

        state.context.globalAlpha =
          1;
      }

      const nucleusRadius =
        state.radius *
        0.17 *
        (
          1 +
          Math.sin(
            time *
              0.0036
          ) *
            0.08 +
          state.charge *
            0.25 +
          state.averageGridEnergy *
            0.12 +
          movementEnergy *
            0.35 +
          state.clickLightBoost *
            0.1
        );

      engine.drawGlow(
        state.centerX,
        state.centerY,
        nucleusRadius *
          0.1,
        nucleusRadius *
          2.2,
        (
          0.09 +
          state.pointerEnergy *
            0.05 +
          state.averageGridEnergy *
            0.04 +
          movementEnergy *
            0.05
        ) *
          state.atmosphereScale
      );

      /*
       * Fill the nucleus through the cached gradient. The transform
       * maps one unit of user space onto nucleusRadius device
       * pixels, reproducing the original per-frame gradient geometry
       * exactly:
       *   gradient inner center  (−0.18r, −0.2r), inner radius 0.05r
       *   gradient outer center  (0, 0),        outer radius r
       *   fill arc center        (−0.08r, −0.1r), radius (0.9+me·0.3)r
       */
      state.context.save();

      state.context.translate(
        state.centerX,
        state.centerY
      );

      state.context.scale(
        nucleusRadius,
        nucleusRadius
      );

      state.context.fillStyle =
        state.nucleusGradient;

      state.context.globalAlpha =
        clamp(
          0.94 +
            state.clickLightBoost *
              0.08,
          0,
          1
        );

      state.context.beginPath();

      state.context.arc(
        -0.08,
        -0.1,
        0.9 +
          movementEnergy *
            0.3,
        0,
        TAU
      );

      state.context.fill();

      state.context.restore();

      state.context.globalAlpha =
        1;
    };



  const render =
    (
      timestamp: number
    ) => {
      /*
       * SUSPENDED — offscreen or hidden document: zero work. The loop
       * does not reschedule itself; start() re-arms it on visibility.
       */
      if (
        !state.visible ||
        !state.documentVisible
      ) {
        state.runtimeState = "suspended";

        state.animationFrame =
          0;

        return;
      }

      /*
       * POINTER STILLNESS (Runtime v2): a pointer that rests on the
       * canvas without moving used to pin the engine at full vsync
       * forever ("active = high energy" by mere presence). Under the
       * continuous signal model its energy decays naturally, and once
       * it settles the organism earns the idle cadence exactly as if
       * the pointer had left.
       */
      const pointerStillMs =
        state.pointerActive &&
        state.lastPointerMovementAt > 0
          ? timestamp - state.lastPointerMovementAt
          : 0;

      const pointerStillIdle =
        state.pointerActive &&
        pointerStillMs >
          STILL_POINTER_IDLE_MS &&
        state.pointerEnergy <
          SETTLED_ENERGY;

      /*
       * A settled still pointer enters the idle cadence backdated to
       * when stillness passed the threshold, so the cadence delay is
       * measured from the moment the organism actually calmed — not
       * from when the engine noticed.
       */
      if (
        pointerStillIdle &&
        state.idleSince === null
      ) {
        state.idleSince =
          state.lastPointerMovementAt +
          STILL_POINTER_IDLE_MS;
      }

      /*
       * Idle cadence (v2.8, extended in Runtime v2): with no pointer
       * intent (or a settled still pointer), skip the expensive
       * redraw and just reschedule. Physics deltas collapse to the
       * clamp ceiling on the next drawn frame, so ambient motion
       * stays continuous — only the redraw rate drops.
       */
      if (
        (!state.pointerActive ||
          pointerStillIdle) &&
        state.idleSince !== null &&
        timestamp - state.idleSince >
          IDLE_CADENCE_DELAY_MS &&
        timestamp - state.lastDrawTimestamp <
          IDLE_FRAME_INTERVAL_MS
      ) {
        state.runtimeState = "idle";

        state.animationFrame =
          window.requestAnimationFrame(
            engine.render
          );

        return;
      }

      /*
       * Distinguish "this frame drew at the idle cadence" from "this
       * frame drew at full rate" — the sampler must never mix the
       * two (see maybeAdaptQuality).
       */
      const idleCapped =
        (!state.pointerActive ||
          pointerStillIdle) &&
        state.idleSince !== null &&
        timestamp - state.idleSince >
          IDLE_CADENCE_DELAY_MS;

      state.lastDrawTimestamp =
        timestamp;

      if (
        state.lastTimestamp ===
        0
      ) {
        state.lastTimestamp =
          timestamp;

        state.performanceSampleTime =
          timestamp;
      }

      const delta =
        clamp(
          timestamp -
            state.lastTimestamp,
          0,
          32
        );

      state.lastTimestamp =
        timestamp;

      /*
       * RUNTIME STATE (Runtime v2) — explicit, telemetry-visible:
       * active (interaction energy high or pointer moving),
       * ambient (awake at low energy, moderate sim rate),
       * recovery (quality recently changed — cadence held stable).
       * idle/reduced/suspended return above or below.
       */
      /*
       * Proximity only counts while the pointer is actually on
       * the canvas — a stale geometry value from a departed
       * pointer must never hold the organism awake.
       */
      state.interactionSignals.proximity =
        state.pointerActive
          ? state.boundaryPointerDistanceFactor
          : 0;

      state.interactionSignals.speed =
        clamp(
          state.pointerSpeedPxPerS /
            SPEED_SATURATION_PX_S,
          0,
          1
        );

      /*
       * Presence builds dwell; stillness bleeds it away at 0.75×
       * so resting on the canvas cannot hold energy forever.
       */
      state.interactionSignals.dwell =
        state.pointerPresentSince > 0 &&
        state.pointerActive
          ? clamp(
              (timestamp -
                state.pointerPresentSince -
                pointerStillMs * 0.75) /
                DWELL_SATURATION_MS,
              0,
              1
            )
          : 0;

      state.interactionSignals.memory =
        state.interactionMemory;

      state.interactionSignals.charge =
        state.charge;

      const signalEnergy =
        interactionTargetEnergy(
          state.interactionSignals
        );

      const recovered =
        timestamp - state.lastQualityChange <
        3500;

      if (
        state.pointerActive &&
        (signalEnergy > 0.42 ||
          state.interactionEnergy > 0.3)
      ) {
        state.runtimeState = "active";
      } else if (
        recovered &&
        state.softPressure > 0
      ) {
        state.runtimeState = "recovery";
      } else if (
        state.pointerActive ||
        state.pointerEnergy > 0.06 ||
        state.interactionEnergy > 0.02
      ) {
        state.runtimeState = "ambient";
      } else {
        state.runtimeState = "idle";
      }

      const interactionScale =
        state.reducedMotion
          ? 0
          : STATE_SIMULATION_SCALE[
              state.runtimeState
            ];

      if (
        !state.reducedMotion
      ) {
        state.elapsed +=
          delta *
          state.profile.timeScale *
          interactionScale;
      }

      const time =
        state.reducedMotion
          ? 0
          : state.elapsed;

      const stepDelta =
        state.reducedMotion
          ? 0
          : delta *
            state.profile.timeScale *
            interactionScale;

      state.pointer.x +=
        (
          state.pointerTarget.x -
          state.pointer.x
        ) *
        Math.min(
          1,
          delta *
            state.profile.responseLag
        );

      state.pointer.y +=
        (
          state.pointerTarget.y -
          state.pointer.y
        ) *
        Math.min(
          1,
          delta *
            state.profile.responseLag
        );

      /*
       * CONTINUOUS INTERACTION MODEL (Runtime v2) — replaces the
       * binary "pointer present = ceiling / absent = floor" law.
       * pointerEnergy now chases the signal-driven target: proximity,
       * smoothed speed, sustained presence, decaying impulse memory
       * and deliberate charge. Discrete events (impact/flick/charge/
       * release) hold an interactionEnergy FLOOR that decays with its
       * own memory, so energy rises and falls naturally and never
       * jumps to the ceiling just because the pointer exists.
       */
      const targetEnergy = Math.max(
        signalEnergy,
        state.interactionEnergy * 0.85
      );

      const riseRate = 0.011;

      const fallRate = 0.0035;

      state.pointerEnergy +=
        (targetEnergy - state.pointerEnergy) *
        Math.min(
          1,
          delta *
            (targetEnergy > state.pointerEnergy
              ? riseRate
              : fallRate)
        );

      /* Signal decay: speed fades without fresh events; memory lingers. */
      state.pointerSpeedPxPerS *=
        Math.pow(
          0.9,
          delta / 16
        );

      state.interactionMemory *=
        Math.pow(
          0.9975,
          delta / 16
        );

      if (state.interactionMemory < 0.004) {
        state.interactionMemory = 0;
      }

      if (
        state.pointerHeld
      ) {
        state.charge =
          clamp(
            state.charge +
              delta *
                0.00082,
            0,
            1
          );
      }

      engine.updatePointerGeometry();

      const timingSimStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.updatePhysicalState(
        stepDelta
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.sim +=
          performance.now() -
          timingSimStart;
      }

      /*
       * WORLD COORDINATION (Runtime v2): publish the organism's
       * arousal to the shared world-signal store (a module number —
       * no listeners, no allocation). WorldBackground reads it to
       * keep its own ambient layer from amplifying the SAME pointer
       * energy the interactive canvas is already expressing — one
       * shared visual/performance budget across both layers.
       */
      state.activityPublishCounter += 1;

      if (
        state.activityPublishCounter >=
        8
      ) {
        state.activityPublishCounter = 0;

        noteOrganismActivity(
          Math.max(
            state.pointerEnergy,
            state.interactionMemory
          )
        );
      }

      /*
       * HARD REBUILD EXECUTION (Runtime v2, settle rule hardened in
       * v2.1): a scheduled structural rebuild runs ONLY on a settled
       * frame — no live shockwaves, no turbulence, no recent click
       * particles, and a pointer that is EITHER absent OR resting
       * still past the stillness/energy thresholds (the pre-v2.1
       * predicate demanded pointerleave, so a parked pointer held
       * every rebuild hostage — measured: none within 15 s). The
       * HARD_REBUILD_MAX_WAIT_MS timeout remains as the safety net
       * for any state the settle model does not cover.
       */
      if (
        state.hardRebuildPending &&
        state.hardRebuildTarget !== null
      ) {
        const settled =
          isSettledFrame(
            state.pointerActive,

            pointerStillIdle,

            state.shockwaves.length,

            state.interactionTurbulence,

            state.clickParticleCount
          );

        const waitedOut =
          state.hardRebuildScheduledAt > 0 &&
          performance.now() -
            state.hardRebuildScheduledAt >
            state.HARD_REBUILD_MAX_WAIT_MS;

        /*
         * The timeout is a FULL escape, not a settled-frame variant:
         * it lets a long-pending rebuild through on any NON-ACTIVE
         * frame (its documented intent — "sustained degradation
         * cannot defer recovery forever on a constantly-hovered
         * canvas"). A pointer parked ON the organism core holds
         * proximity energy above the settle threshold by design, so
         * without this escape that canvas would never rebuild.
         */
        const timeoutEscape =
          waitedOut &&
          state.runtimeState !==
            "active";

        if (
          (settled &&
            (state.runtimeState ===
              "idle" ||
              pointerStillIdle)) ||
          timeoutEscape
        ) {
          const target = state.hardRebuildTarget;

          const reason = state.hardRebuildReason;

          engine.buildWorld(target, reason);
        }
      }

      state.context.globalAlpha =
        1;

      /*
       * Subsystem timing (v2.1, measurement builds only): the sim
       * clock wraps updatePhysicalState above; the render clock wraps
       * clear → particles. Both are read once per subsystem via
       * performance.now() and accumulated per window.
       */
      const timingRenderStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      state.context.clearRect(
        0,
        0,
        state.width,
        state.height
      );

      engine.drawInteraction();

      const timingMembraneStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.drawMembrane(
        time
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.membrane +=
          performance.now() -
          timingMembraneStart;
      }

      const timingNetworkStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.drawNetwork(
        time
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.network +=
          performance.now() -
          timingNetworkStart;
      }

      const timingFlowsStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.drawEnergyFlows(
        time
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.flows +=
          performance.now() -
          timingFlowsStart;
      }

      const timingCoreStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.drawCore(
        time
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.core +=
          performance.now() -
          timingCoreStart;
      }

      const timingParticlesStart =
        state.subsystemTiming !== null
          ? performance.now()
          : 0;

      engine.drawParticles(
        time,
        stepDelta
      );

      if (
        state.subsystemTiming !== null
      ) {
        state.subsystemTiming.particles +=
          performance.now() -
          timingParticlesStart;

        state.subsystemTiming.render +=
          performance.now() -
          timingRenderStart;

        state.timingFrameCount +=
          1;
      }

      engine.maybeAdaptQuality(
        timestamp,
        idleCapped
      );

      /*
       * Reduced motion (v2.8): render exactly one static frame and
       * stop scheduling. Redrawing an identical frame at full
       * vsync is not reduced motion — it is the same cost with
       * time frozen. Event-driven state changes (pointer, click,
       * resize, visibility) call start() themselves, which
       * produces one fresh static frame per event.
       */
      if (state.reducedMotion) {
        state.runtimeState = "reduced";

        state.animationFrame =
          0;

        return;
      }

      state.animationFrame =
        window.requestAnimationFrame(
          engine.render
        );
    };

  return {
    drawGlow,
    drawNodeCore,
    drawNetwork,
    drawInteraction,
    drawMembrane,
    drawEnergyFlows,
    drawParticles,
    drawCore,
    render
  };
}
