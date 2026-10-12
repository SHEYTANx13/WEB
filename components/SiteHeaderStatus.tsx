import styles from "@/components/SiteHeaderStatus.module.css";

/*
 * SITE HEADER STATUS (v4.0.5) — the ONE shared header identity for
 * the whole site:
 *
 *   [ ★ Parsa Tak ] [ ● CURRENT SURFACE ] [ navigation … ]
 *
 * A small red status light beside a mono uppercase label naming the
 * surface the reader is on — the world scene (HOME / SYSTEMS /
 * RED MAGIC / WORK / MEDIA), the blog (BLOG), or the canonical
 * document route (ABOUT / WORK / RESEARCH / CONTACT / the six topic
 * hubs). Before v4.0.5 this identity lived as three separate
 * implementations (the world HUD's pulsing status, the blog's
 * unpulsing chip that stood down at ≤1100px, and nothing on
 * ContentShell routes); this component replaces all of them.
 *
 * OWNERSHIP CONTRACT: this component owns the status MARKUP, the
 * dot, the pulse animation, the spacing, the typography, the
 * reduced-motion behavior and the accessibility behavior. The host
 * headers (LivingShell, BlogHeader, ContentShell) own PLACEMENT
 * only — where the status sits inside their own header geometry.
 * Hosts must not restyle the dot or the label, and no route-specific
 * status variant may be created.
 *
 * RENDER CONTRACT: a server-safe presentational component — no
 * client code, no effects, no state, no pointer interaction, no
 * layout shift (the label space is inherent in normal flow). The
 * animation is CSS-only, transform/opacity based, and stops under
 * prefers-reduced-motion (the static dot keeps its color and glow,
 * so the presence signal survives without motion).
 *
 * ACCESSIBILITY CONTRACT: the dot is decorative (aria-hidden) — the
 * LABEL is the information. Static surfaces (blog, content documents)
 * render no live region at all. The world shell passes `live` because
 * its label legitimately changes client-side as scenes switch; the
 * polite live region announces the new scene once, without repetitive
 * chatter.
 */

type SiteHeaderStatusProps = {
  /** The visible surface identity (rendered uppercase by the stylesheet). */
  label: string;

  /**
   * Announce label changes to assistive technology. Only for hosts
   * whose label changes dynamically after hydration (the world
   * shell's scene state). Static route surfaces must leave it off.
   */
  live?: boolean;
};

export default function SiteHeaderStatus({
  label,
  live = false
}: SiteHeaderStatusProps) {
  return (
    <p
      className={styles.status}
      aria-live={live ? "polite" : undefined}
    >
      <span
        className={styles.dot}
        aria-hidden="true"
      />

      <span className={styles.label}>
        {label}
      </span>
    </p>
  );
}
