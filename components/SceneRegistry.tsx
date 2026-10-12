"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";

import HomeScene from "@/components/scenes/HomeScene";

import type {
  ComponentType
} from "react";

import type {
  SceneId
} from "@/lib/sceneIds";

import type {
  HomeWritingPost
} from "@/lib/homeWriting";

import {
  isSceneModuleReady,
  loadSceneModule
} from "@/components/ScenePreloader";

import SceneViewport from "@/components/SceneViewport";

import styles from "@/components/SceneRegistry.module.css";

/*
 * Scene registry.
 *
 * Every secondary scene component resolves through loadSceneModule(),
 * the single import site owned by ScenePreloader. The dynamic()
 * wrappers below exist only to integrate React.lazy-compatible
 * rendering with Suspense — they never produce their own import
 * graphs, so the bundler emits exactly one chunk per scene.
 *
 * P0 (v3.0) — the HOME scene is the exception: it is imported
 * statically. A dynamic() scene suspends during static export, so
 * the exported homepage previously carried its semantic content
 * only inside React's streamed <div hidden id="S:0"> completion
 * while the visible document showed a loading gate. Statically
 * importing the scene renders it synchronously into <main> in the
 * exported HTML: crawlers, social scrapers and no-JS visitors read
 * the real homepage immediately, hydration still matches (initial
 * scene is "home" on both sides), and the other four scenes keep
 * their interaction-gated loading (v4.0.1: the about scene is gone
 * — /about/ is the canonical document).
 */

const SystemsScene = dynamic(
  () =>
    loadSceneModule(
      "systems"
    )
);

const RedMagicScene = dynamic(
  () =>
    loadSceneModule(
      "magic"
    )
);

const WorkScene = dynamic(
  () =>
    loadSceneModule(
      "work"
    )
);

const MediaScene = dynamic(
  () =>
    loadSceneModule(
      "media"
    )
);

const SCENE_COMPONENTS:
  Record<
    SceneId,
    ComponentType
  > = {
  home: HomeScene,
  systems: SystemsScene,
  magic: RedMagicScene,
  work: WorkScene,
  media: MediaScene
};

/*
 * TRANSITION MODEL (v3.5) — requested → load → render when ready.
 *
 * There is NO minimum transition time. A timer can never make a
 * transition feel faster; it can only make a ready destination feel
 * slower. The two paths:
 *
 * FAST PATH — the destination module is already resident (warmed by
 * hover/focus intent, predicted by the background preloader, or
 * visited earlier in the session). The registry swaps it in inside a
 * layout effect, i.e. BEFORE the browser paints the transitioning
 * state: no blocking loader, no blank frame, no artificial wait.
 * The keyed scene-enter host still plays its short settle animation,
 * which is the visible "navigation pulse" of a cached transition.
 *
 * SLOW PATH — the module genuinely needs a network fetch. The current
 * scene dips out through the transition layer while the request runs;
 * the SceneLoadingScreen overlay fades in only after
 * SCENE_OVERLAY_DELAY_MS, so a fetch that lands quickly never shows a
 * loader, and one that lands slowly shows the honest loading surface
 * (indeterminate signal motion around the 13-point star — never a
 * fake percentage).
 *
 * RACE PROTECTION — the monotonic transitionId plus the effect
 * cleanup keep rapid navigation correct: only the LATEST requested
 * scene may commit, and a superseded load can never render.
 */

/*
 * useLayoutEffect runs only on the client; the static prerender of
 * this component never takes a transition (initial scene === rendered
 * scene), so the effect body is a no-op during export. The
 * isomorphic alias simply keeps React's server warning quiet.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined"
    ? useLayoutEffect
    : useEffect;

type SceneRegistryProps = {
  scene: SceneId;

  /*
   * SERVER-SIDE WRITING SELECTION (v3.0): forwarded to the home
   * scene only. The home scene is statically rendered, so these
   * props land in the exported HTML.
   */
  writingPosts?: readonly HomeWritingPost[];
};

export default function SceneRegistry({
  scene,
  writingPosts
}: SceneRegistryProps) {
  const [
    renderedScene,
    setRenderedScene
  ] = useState<SceneId>(
    scene
  );

  const transitionId =
    useRef(0);

  /*
   * Transition state is derived, not stored: while the requested
   * scene differs from the rendered one, a transition is in
   * flight. This removes a synchronous setState inside the effect.
   */
  const transitioning =
    scene !== renderedScene;

  useIsomorphicLayoutEffect(() => {
    if (
      scene === renderedScene
    ) {
      return;
    }

    const currentTransitionId =
      ++transitionId.current;

    /*
     * FAST PATH — destination already resident. Commit the swap in
     * the layout-effect phase so the browser never paints a
     * transitioning frame for a cached scene.
     */
    if (
      isSceneModuleReady(
        scene
      )
    ) {
      setRenderedScene(
        scene
      );

      return;
    }

    /*
     * SLOW PATH — P0 fetch of the requested scene. preloadScene
     * deduplicates with any warming request already in flight.
     * Render the moment the module lands; no timer is involved.
     */
    let cancelled = false;

    void loadSceneModule(
      scene
    ).then(() => {
      if (
        cancelled ||
        currentTransitionId !==
          transitionId.current
      ) {
        return;
      }

      setRenderedScene(
        scene
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    scene,
    renderedScene
  ]);

  const Scene =
    SCENE_COMPONENTS[
      renderedScene
    ] ?? HomeScene;

  return (
    <SceneViewport
      scene={
        renderedScene
      }
      pendingScene={
        transitioning
          ? scene
          : undefined
      }
      loading={
        transitioning
      }
      /*
       * v3.5: `loading` now means "the requested module is genuinely
       * being fetched". On the fast path this flag never survives a
       * paint, so the loading overlay stays invisible for cached
       * destinations exactly as designed.
       */
      /*
       * P0 (v3.0): the home scene is statically rendered — it must
       * not sit behind a Suspense boundary, or static export streams
       * it into the hidden S:0 completion instead of the visible
       * document. Every other scene resolves through dynamic import
       * and keeps its boundary.
       */
      suspense={
        renderedScene !== "home"
      }
    >
      {/*
        * SCENE TRANSITION MOTION (v2.2).
        *
        * The layer handles the outgoing fade (data-transitioning);
        * the keyed host inside it replays a short settle animation on
        * every scene mount, so the incoming scene rises into place
        * while the layer fades back in. One keyframe, transform and
        * opacity only, reduced-motion aware via CSS.
        */}
      <div
        className={
          styles.sceneTransitionLayer
        }
        data-transitioning={
          transitioning
            ? "true"
            : "false"
        }
      >
        <div
          className={
            styles.sceneEnterHost
          }
          key={
            renderedScene
          }
        >
          {renderedScene === "home" ? (
            <HomeScene writingPosts={writingPosts} />
          ) : (
            <Scene />
          )}
        </div>
      </div>
    </SceneViewport>
  );
}
