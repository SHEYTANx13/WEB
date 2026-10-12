"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import styles from "@/components/LivingShell.module.css";

import UnifiedSiteNav, {
  type UnifiedNavEntry
} from "@/components/UnifiedSiteNav";
import SiteHeaderStatus from "@/components/SiteHeaderStatus";
import { BRAND_STAR } from "@/lib/brand";
import SceneLoadingScreen from "@/components/SceneLoadingScreen";
import { PRIMARY_NAV, WORLD_NAV } from "@/lib/navigation";
import ScenePreloader, {
  preloadScene
} from "@/components/ScenePreloader";
import SceneRegistry from "@/components/SceneRegistry";
import SceneUrlSync from "@/components/SceneUrlSync";
import SiteFooter from "@/components/SiteFooter";
import WorldBackground from "@/components/WorldBackground";
import MotionReveal from "@/components/MotionReveal";
import {
  pulseWorld,
  setWorldScene
} from "@/lib/worldSignals";
import { GITHUB_LINK } from "@/lib/links";

import type {
  HomeWritingPost
} from "@/lib/homeWriting";

/*
 * SCENE VOCABULARY (v4.0.1) — the canonical SceneId type, the
 * ordered id list and the legacy "#library" alias map live in
 * lib/sceneIds.ts, the one neutral vocabulary module; shell
 * components import them from there directly.
 */
import type {
  SceneId
} from "@/lib/sceneIds";

export type { SceneId };

export type SceneChangeSource =
  | "navigation"
  | "history";

/*
 * INTERNAL SCENE REGISTRY (v3.2 / v4.0.1) — the five-scene world.
 * Scene ids (home / systems / magic / work / media) are interaction
 * states of the shell, NOT navigation labels; the labels here feed
 * the HUD status readout only. Hash parsing and canonicalisation
 * belong to SceneUrlSync (the single hash parser) and derive from
 * lib/sceneIds.ts. The visible navigation is built from
 * lib/navigation.ts (PRIMARY_NAV + WORLD_NAV), which leads with the
 * professional destinations; the canonical About document is
 * /about/ — there is no #about scene (v4.0.1).
 */
const SCENES: readonly {
  id: SceneId;
  label: string;
  shortLabel: string;
}[] =
  [
    {
      id: "home",
      label: "Home",
      shortLabel: "HOME"
    },
    {
      id: "systems",
      label: "Systems",
      shortLabel: "SYSTEMS"
    },
    {
      id: "magic",
      label: "RED Magic",
      shortLabel: "MAGIC"
    },
    {
      id: "work",
      label: "Work",
      shortLabel: "WORK"
    },
    {
      id: "media",
      label: "Media",
      shortLabel: "MEDIA"
    }
  ];

type LivingShellProps = {
  /*
   * SERVER-SIDE WRITING SELECTION (v3.0): computed once in
   * app/page.tsx from the blog content index and passed down to the
   * home scene. Serializable metadata only — article bodies never
   * enter the client graph through this path.
   */
  writingPosts?: readonly HomeWritingPost[];
};

export default function LivingShell({
  writingPosts
}: LivingShellProps) {
  const [
    activeScene,
    setActiveScene
  ] = useState<SceneId>(
    "home"
  );

  /*
   * Mirror of activeScene kept next to the setter so changeScene can
   * stay referentially stable. SceneUrlSync's URL listeners then stop
   * resubscribing on every scene change.
   */
  const activeSceneRef =
    useRef<SceneId>("home");

  const [
    urlReady,
    setUrlReady
  ] = useState(false);

  /*
   * HASH OWNERSHIP (v4.0.1): SceneUrlSync is the single hash
   * parser; it resolves the initial URL, reports the scene through
   * onSceneChange, canonicalises the address bar and signals
   * onReady once the boot resolution is done — that signal drops
   * the loading screen and starts the preloader. The shell itself
   * never parses the URL.
   */
  const handleUrlReady =
    useCallback(
      () => {
        setUrlReady(
          true
        );
      },
      []
    );

  /*
   * Connect the global organism to the active scene. The first run
   * establishes the initial mood; every later scene change fires a
   * coordinated organism pulse. These are module-level signals — no
   * React re-render is caused beyond the scene switch itself.
   */
  const organismInitializedRef =
    useRef(false);

  useEffect(() => {
    setWorldScene(
      activeScene
    );

    if (
      !organismInitializedRef.current
    ) {
      organismInitializedRef.current =
        true;

      return;
    }

    pulseWorld();
  }, [activeScene]);

  const changeScene = useCallback(
    (
      scene: SceneId,
      source: SceneChangeSource =
        "navigation"
    ) => {
      if (
        scene ===
        activeSceneRef.current
      ) {
        return;
      }

      activeSceneRef.current =
        scene;

      if (
        source ===
        "navigation"
      ) {
        const hash =
          scene ===
          "home"
            ? ""
            : `#${scene}`;

        window.history.pushState(
          null,
          "",
          `${window.location.pathname}${window.location.search}${hash}`
        );
      }

      setActiveScene(
        scene
      );
    },
    []
  );

  const changeSceneFromHistory =
    useCallback(
      (
        scene: SceneId
      ) => {
        changeScene(
          scene,
          "history"
        );
      },
      [changeScene]
    );

  const activeSceneDefinition =
    SCENES.find(
      (scene) =>
        scene.id ===
        activeScene
    );

  const github = GITHUB_LINK;

  /*
   * NAVIGATION (v3.7) — one unified navigation system (see
   * UnifiedSiteNav). The desktop track leads with the four-entry
   * primary nav; HOME stays an in-shell scene action (a same-route
   * link could not switch the hash scene); ABOUT, BLOG and CONTACT
   * are real routes. The canonical /work/ and /research/ documents
   * live in the Blog content ecosystem (footer collections row and
   * the Blog's lab map), while the experiential #work scene remains
   * reachable through its in-content links. The experimental scenes
   * (SYSTEMS, RED MAGIC, MEDIA) follow as the quieter world group,
   * and GitHub rides as a utility entry in the disclosure menu. The
   * ≤860px disclosure panel is the same component's compact mode —
   * same labels, ordering, accents and animation language.
   */
  const navEntries = useMemo<readonly UnifiedNavEntry[]>(
    () => [
      ...PRIMARY_NAV.map(
        (entry): UnifiedNavEntry =>
          entry.id === "home"
            ? {
                kind: "action",
                group: "primary",
                id: "home",
                label: entry.label,
                shortLabel: entry.shortLabel,
                active: activeScene === "home",
                onSelect: () => changeScene("home")
              }
            : {
                kind: "link",
                group: "primary",
                id: entry.id,
                label: entry.label,
                shortLabel: entry.shortLabel,
                href: entry.href
              }
      ),
      ...WORLD_NAV.map(
        (entry): UnifiedNavEntry => ({
          kind: "action",
          group: "world",
          id: entry.id,
          label: entry.label,
          shortLabel: entry.shortLabel,
          active: entry.id === activeScene,
          onSelect: () =>
            changeScene(
              entry.id as SceneId
            )
        })
      ),
      ...(github
        ? [
            {
              kind: "link" as const,
              group: "utility" as const,
              id: "github",
              label: github.label,
              shortLabel: "GITHUB",
              href: github.href,
              external: true
            }
          ]
        : [])
    ],
    [activeScene, changeScene, github]
  );

  /*
   * Scene warming (v3.4): hover/focus on a scene action preloads
   * that scene's module immediately, bypassing the background
   * scheduler — the same explicit-intent contract the unified
   * navigation has carried since the scene-link row was retired.
   */
  const warmScene = useCallback((id: string) => {
    void preloadScene(id as SceneId);
  }, []);

  return (
    <div
      className={
        styles.livingShell
      }
      data-active-scene={
        activeScene
      }
    >
      <WorldBackground />

      {/*
        * RED CURSOR moved to the ROOT application layout (v4.0.5) —
        * the same root-layout law as the global Music player and the
        * route progress line. The world shell renders only on "/", so
        * a cursor mounted here left every document route (/about/,
        * /contact/, /work/, /research/, the hubs) on the native
        * pointer. The root layout now owns the ONE cursor mount,
        * site-wide; this shell keeps no cursor mount of its own.
        */}

      {/*
        * One reveal observer for the world shell — HUD, scenes and
        * footer all share it. Never mounted per scene.
        */}
      <MotionReveal />

      <SceneUrlSync
        scene={
          activeScene
        }
        onSceneChange={
          changeSceneFromHistory
        }
        onReady={
          handleUrlReady
        }
      />

      {urlReady && (
        <ScenePreloader
          scene={
            activeScene
          }
        />
      )}

      <header
        className={
          styles.livingShellHud
        }
        data-reveal="instant"
      >
        <div
          className={
            styles.livingShellHudInner
          }
        >
          <a
            className={
              styles.livingShellBrand
            }
            href="#top"
            aria-label="Parsa Tak home"
            onClick={(
              event
            ) => {
              event.preventDefault();

              changeScene(
                "home"
              );
            }}
          >
            <span
              className={
                styles.livingShellBrandEye
              }
              aria-hidden="true"
            >
              {/*
               * The 13-point star — the Parsa Tak site identity. A
               * static asset on purpose: no component hydration for a
               * logo. The accessible name lives on the wrapping link
               * (aria-label="Parsa Tak home"), so the image is
               * decorative to assistive technology.
               */}
              <img
                src={BRAND_STAR.red}
                alt=""
                width={36}
                height={36}
                loading="eager"
                decoding="async"
              />
            </span>

            <span
              className={
                styles.livingShellBrandName
              }
            >
              Parsa Tak
            </span>
          </a>

          {/*
            * HEADER STATUS (v4.0.5) — the shared SiteHeaderStatus
            * identity, rendering the active scene's label (HOME /
            * SYSTEMS / RED MAGIC / WORK / MEDIA) beside the brand.
            * The markup, dot, pulse, typography and reduced-motion
            * behavior live in SiteHeaderStatus; this HUD owns
            * placement only. `live` keeps the v3.x polite announce-
            * ment of scene changes — the label legitimately changes
            * client-side as the reader moves through the world.
            */}
          <SiteHeaderStatus
            label={
              activeSceneDefinition?.label ??
              "Home"
            }
            live
          />

          <UnifiedSiteNav
            menuId="world-unified-nav"
            entries={
              navEntries
            }
            onActionWarm={
              warmScene
            }
          />

          <div
            className={
              styles.livingShellHudActions
            }
          >
            {github && (
              <a
                className={
                  styles.livingShellGithub
                }
                href={
                  github.href
                }
                target="_blank"
                rel="noreferrer"
              >
                GitHub ↗
              </a>
            )}
          </div>
        </div>
      </header>

      <main
        id="top"
        className={
          styles.livingShellViewport
        }
        data-active-scene={
          activeScene
        }
      >
        {/*
          * SCENE REGISTRY (v2.7): rendered on the server and during
          * hydration with the default scene ("home"), so the home
          * route's semantic content — the single h1, capabilities,
          * featured projects, workflow — exists in the exported
          * static HTML, not only after client JavaScript runs. The
          * first client render matches the server render (the
          * initial scene state is "home" on both), so hydration
          * cannot mismatch; the URL-determined scene correction
          * happens through SceneUrlSync's single parser on mount,
          * behind the loading screen, through the normal transition
          * machinery.
          */}
        <SceneRegistry
          scene={
            activeScene
          }
          writingPosts={
            writingPosts
          }
        />
      </main>

      <SiteFooter />

      {/*
        * GLOBAL MUSIC PLAYER (v4.0.2) — the player host moved from
        * this shell to the ROOT application layout (app/layout.tsx):
        * the world shell renders only on "/", and a player mounted
        * here would lose its UI on every route navigation. The
        * root-layout mount keeps the ONE store and the ONE audio
        * element alive site-wide; this shell keeps no player mount
        * of its own.
        */}

      <SceneLoadingScreen
        visible={
          !urlReady
        }
        phase="INITIALIZING"
        label="LIVE WORLD"
      />
    </div>
  );
}
