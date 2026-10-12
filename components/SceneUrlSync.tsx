"use client";

import {
  useEffect,
  useRef
} from "react";

import type {
  SceneId
} from "@/lib/sceneIds";

import {
  SCENE_ID_ALIASES,
  SCENE_IDS
} from "@/lib/sceneIds";

type SceneUrlSyncProps = {
  scene: SceneId;
  onSceneChange: (
    scene: SceneId
  ) => void;
  /*
   * Called ONCE after the initial hash resolution completes — the
   * shell uses it to drop its boot loading screen and start the
   * scene preloader only after the URL has spoken (v4.0.1: this
   * component is the single owner of that decision).
   */
  onReady?: () => void;
};

/*
 * THE HASH PARSER (v4.0.1). SceneUrlSync is the one authoritative
 * URL → world-scene parser and the one code path allowed to rewrite
 * the address bar. Contract:
 *
 *   #media      → media
 *   #library    → media (deliberate compatibility alias)
 *   #<invalid>  → home (safe fallback)
 *   "" / #home  → home
 *   encoded     → decoded first, then trimmed/lowercased
 */
function readSceneFromHash(): SceneId {
  let hash =
    window.location.hash
      .replace(
        /^#/,
        ""
      );

  /*
   * Hashes set by the browser arrive percent-encoded ("# MAGIC "
   * becomes "#%20MAGIC%20"), so the trim below would otherwise
   * operate on encoded bytes and never trim anything. Decode first;
   * a malformed percent sequence falls back to the raw string.
   */
  try {
    hash =
      decodeURIComponent(
        hash
      );
  } catch {
    /* keep the raw hash */
  }

  hash =
    hash
      .trim()
      .toLowerCase();

  if (
    hash === "" ||
    hash === "home"
  ) {
    return "home";
  }

  /*
   * "#library" is the backward-compatible alias of the canonical
   * "#media" scene (v4.0.0 Media migration). Aliased hashes resolve
   * to their target scene and the address bar is normalised to the
   * canonical form by normalizeHash below.
   */
  const aliased =
    (SCENE_ID_ALIASES as Record<
      string,
      SceneId | undefined
    >)[hash];

  if (aliased) {
    return aliased;
  }

  return SCENE_IDS.includes(
    hash as SceneId
  )
    ? (hash as SceneId)
    : "home";
}

/*
 * Canonicalisation — the only URL rewrite path. Home renders as the
 * clean path (no hash); every other scene as "#<scene>".
 * replaceState never fires hashchange or popstate, so rewriting can
 * never re-enter the parser.
 */
function normalizeHash(
  scene: SceneId
) {
  const targetHash =
    scene === "home"
      ? ""
      : `#${scene}`;

  const currentHash =
    window.location.hash;

  if (
    currentHash ===
    targetHash
  ) {
    return;
  }

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${targetHash}`
  );
}

export default function SceneUrlSync({
  scene,
  onSceneChange,
  onReady
}: SceneUrlSyncProps) {
  /*
   * Scene and handlers live in refs so the browser listeners below
   * are registered exactly once per mount. The previous shape
   * depended on [scene, onSceneChange] and resubscribed both window
   * listeners on every scene change — correct, but needless
   * teardown/setup churn (and one more retained closure per swap) on
   * a permanently-mounted shell component.
   */
  const sceneRef =
    useRef(scene);

  const onSceneChangeRef =
    useRef(onSceneChange);

  const onReadyRef =
    useRef(onReady);

  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    onSceneChangeRef.current =
      onSceneChange;
  }, [onSceneChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const initialScene =
      readSceneFromHash();

    if (
      initialScene !==
      sceneRef.current
    ) {
      onSceneChangeRef.current(
        initialScene
      );
    }

    normalizeHash(
      initialScene
    );

    onReadyRef.current?.();
  }, []);

  useEffect(() => {
    const handleNavigation =
      () => {
        const nextScene =
          readSceneFromHash();

        onSceneChangeRef.current(
          nextScene
        );

        /*
         * Canonicalize the URL after any hash navigation.
         * Invalid (e.g. "#bogus") and aliased (e.g. "#library",
         * "#MAGIC") hashes resolve to a scene above, but the raw
         * hash would otherwise stay in the address bar —
         * inconsistent with the load-time normalization in the
         * mount effect, which always rewrites to the canonical
         * form. replaceState never fires hashchange or popstate,
         * so this cannot re-enter.
         */
        normalizeHash(
          nextScene
        );
      };

    window.addEventListener(
      "hashchange",
      handleNavigation
    );

    window.addEventListener(
      "popstate",
      handleNavigation
    );

    return () => {
      window.removeEventListener(
        "hashchange",
        handleNavigation
      );

      window.removeEventListener(
        "popstate",
        handleNavigation
      );
    };
  }, []);

  return null;
}
