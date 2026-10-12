"use client";

import {
  Suspense,
  type ReactNode
} from "react";

import type {
  SceneId
} from "@/lib/sceneIds";

import SceneLoadingScreen from "@/components/SceneLoadingScreen";

import styles from "@/components/SceneViewport.module.css";

type SceneLoaderProps = {
  scene: SceneId;
  pendingScene?: SceneId;
  loading?: boolean;
  children: ReactNode;

  /*
   * P0 (v3.0): the home scene renders SYNCHRONOUSLY (static import),
   * so it must NOT be wrapped in a Suspense boundary. During static
   * export, React flushes boundary content that exceeds the first
   * write as a streamed <div hidden id="S:0"> completion — the
   * visible document then showed only the loading fallback while the
   * entire homepage sat hidden until hydration. Lazy hash scenes
   * still suspend (dynamic imports) and keep their boundary.
   */
  suspense?: boolean;
};

function SceneFallback({
  scene
}: {
  scene: SceneId;
}) {
  return (
    <SceneLoadingScreen
      visible={true}
      variant="scene"
      phase="LOADING"
      label={scene.toUpperCase()}
    />
  );
}

export default function SceneViewport({
  scene,
  pendingScene,
  loading = false,
  suspense = true,
  children
}: SceneLoaderProps) {
  return (
    <section
      className={
        styles.sceneViewport
      }
      data-scene={
        scene
      }
      aria-label={`${scene} scene`}
    >
      {suspense ? (
        <Suspense
          fallback={
            <SceneFallback
              scene={scene}
            />
          }
        >
          <div
            className={
              styles.sceneViewportContent
            }
          >
            {children}
          </div>
        </Suspense>
      ) : (
        <div
          className={
            styles.sceneViewportContent
          }
        >
          {children}
        </div>
      )}

      <SceneLoadingScreen
        visible={
          loading
        }
        variant="scene"
        phase="LOADING"
        label={
          pendingScene
            ? pendingScene.toUpperCase()
            : scene.toUpperCase()
        }
      />

      <div
        className={
          styles.sceneViewportFrame
        }
        aria-hidden="true"
      />

      <div
        className={`${styles.sceneViewportCorner} ${styles.sceneViewportCornerTl}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.sceneViewportCorner} ${styles.sceneViewportCornerTr}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.sceneViewportCorner} ${styles.sceneViewportCornerBl}`}
        aria-hidden="true"
      />

      <div
        className={`${styles.sceneViewportCorner} ${styles.sceneViewportCornerBr}`}
        aria-hidden="true"
      />
    </section>
  );
}

export {
  SceneFallback
};
