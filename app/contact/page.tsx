import type { Metadata } from "next";

import {
  JsonLd,
  PERSON_ID,
  contentBreadcrumbEntity,
  contentWebPageEntity
} from "@/lib/seo";

import { CONTACT_ROUTE, contentRouteMetadata, routeHref } from "@/lib/hubs";

import { EMAIL_LINK, LINKEDIN_LINK } from "@/lib/links";

import ContentShell from "@/components/content/ContentShell";

import { FocusList, LinkCardRow, Prose, Section } from "@/components/content/ContentBlocks";

import { BRAND_STAR } from "@/lib/brand";

import styles from "@/components/content/content.module.css";

/*
 * /contact/ (v3.2) — the single, honest contact document.
 *
 * Design laws:
 * - One primary CTA: Email Parsa Tak. The mailto is resolved from
 *   lib/links.ts (the site's verified link source of truth) — the
 *   address is never duplicated as a separate constant.
 * - Secondary channels: GitHub and LinkedIn. No backend, no form, no
 *   tracking: contact is plain, crawlable anchors.
 * - Collaboration types are separated the way inquiries actually
 *   arrive: academic/research, business/engineering, project
 *   collaboration, and open technical collaboration.
 * - Structured data: one WebPage whose `about` references the
 *   site-wide Person @id — the Person node itself is never
 *   duplicated.
 *
 * v4.0.5: the page's first document block is the TRANSMISSION
 * ARTIFACT — the four collaboration intents wired to the one verified
 * email action, with GitHub / LinkedIn as the secondary paths —
 * rendered through ContentShell's ONE generic docFeature slot. The
 * artifact carries the primary action; the sections below keep the
 * full collaboration-type statements, the before-writing guidance,
 * and the supporting destinations. Same honest model as before: no
 * form, no backend, no tracking, nothing invented.
 */

export const metadata: Metadata = contentRouteMetadata({
  route: CONTACT_ROUTE.slug,
  title: CONTACT_ROUTE.metaTitle,
  description: CONTACT_ROUTE.metaDescription,
  ogAlt: "Contact Parsa Tak — research collaboration, engineering engagements, projects"
});

const COLLABORATION_TYPES: readonly { title: string; body: string }[] = [
  {
    title: "Academic / research",
    body: "Reasoning architectures, AI evaluation and benchmarking, local-first AI, AI system governance. Replication attempts, methodological criticism, and joint evaluation work are welcome — the specifications (AIST-2026.09, ASI-100-Elite) are public and open to scrutiny."
  },
  {
    title: "Business / engineering",
    body: "AI systems and local agents, model and system evaluation, fast static web engineering, and architecture reviews before commitments harden. Name the problem, the constraints, and the timeline; a short answer — including 'not a good fit' when true — comes back quickly."
  },
  {
    title: "Project collaboration",
    body: "SHEYTAN, FreeIran, WEB, and the Contents repository accept issue reports, patches, and specification feedback through GitHub. For anything that needs discussion before code, open an issue first, then follow up by email."
  },
  {
    title: "Open technical collaboration",
    body: "Practitioners working on reasoning, evaluation, and local AI infrastructures — comparisons, benchmarks, critiques, and build logs are the useful currency. Public channels (GitHub, the community links on the About page) are the right first stop for open discussion."
  }
];

/*
 * TRANSMISSION ARTIFACT DATA (v4.0.5) — the intent labels the
 * transmission console renders. They are the first line of every
 * COLLABORATION_TYPES entry above, in the same order: the console is
 * the compact index, the FocusList below is the full statement, and
 * the two can never disagree because both derive from the same
 * four-type model. tests/document-shell.test.ts pins the count
 * equality so adding a type updates both surfaces together.
 */
const TRANSMISSION_INTENTS: readonly { label: string }[] = [
  { label: "Academic / research" },
  { label: "Business / engineering" },
  { label: "Project collaboration" },
  { label: "Open technical collaboration" }
];

export default function ContactPage() {
  const crumbs = [
    { name: "Home", href: "/" },
    { name: "Contact", href: null }
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            contentWebPageEntity({
              route: `${CONTACT_ROUTE.slug}/`,
              name: CONTACT_ROUTE.metaTitle,
              description: CONTACT_ROUTE.metaDescription,
              about: { "@id": PERSON_ID }
            }),
            contentBreadcrumbEntity(`${CONTACT_ROUTE.slug}/`, crumbs)
          ]
        }}
      />

      <ContentShell
        kicker="CONTACT"
        title="Contact"
        crumbs={crumbs}
        activeHref="/contact/"
        docFeature={<ContactTransmissionArtifact />}
        lead={[
          "I am an independent software engineer, product builder, and AI systems researcher. Inquiries about research collaboration, engineering engagements, project contributions, and open technical collaboration all reach me in one place — and the fastest one is a direct email.",
          "There is no form and no backend on this page: contact is a plain mailto link you can see and verify, plus the public profiles where the work already lives."
        ]}
      >
        <Section title="Collaboration types">
          <Prose>
            <p>
              The four intents in the transmission console above are
              separated the way inquiries actually arrive. Each one below
              states what it covers in full — and a useful first message,
              whatever the intent, says who you are, what you want to build
              or investigate, and what a good outcome would look like;
              anything that can be answered in a short reply gets one.
            </p>
          </Prose>

          <FocusList items={COLLABORATION_TYPES} />
        </Section>

        <Section title="Before writing">
          <Prose>
            <p>
              A few things make first messages productive. For research: name
              the specification, benchmark, or claim you want to examine —
              the artifacts are public, so the conversation can start from
              evidence instead of summaries. For engineering: describe the
              system boundary and the constraints (local-first, no telemetry,
              offline behaviour) that matter to you, because those decisions
              shape everything downstream. For projects: open a GitHub issue
              with a reproduction or a spec proposal before writing a patch.
            </p>
            <p>
              Response is manual and human on both ends — there are no
              autoresponders, no sales sequences, and no tracking pixels on
              this site.
            </p>
          </Prose>
        </Section>

        <Section title="Where the work lives">
          <Prose>
            <p>
              If it helps to ground an inquiry before writing, the work
              itself is public — the shipped systems, the specifications and
              frameworks behind them, and the working method that connects
              the two. These documents are the honest pre-reading for any
              collaboration type above.
            </p>
          </Prose>

          <LinkCardRow
            links={[
              {
                label: "Selected Work — what has already been built",
                href: "/work/",
                note: "The systems, the problems they solve, and the repositories",
                external: false
              },
              {
                label: "Research — the specifications and frameworks",
                href: "/research/",
                note: "AIST-2026.09, ASI-100-Elite, REP, AI Instructions, USEF",
                external: false
              },
              {
                label: "About — the working method",
                href: "/about/",
                note: "Research, engineering, product building, and the pipeline",
                external: false
              }
            ]}
          />
        </Section>
      </ContentShell>
    </>
  );
}

/*
 * CONTACT TRANSMISSION ARTIFACT (v4.0.5) — the page's first document
 * block, rendered through ContentShell's ONE generic docFeature slot.
 * The four collaboration intents this page actually serves converge,
 * over one wired line, on the ONE primary action — the verified
 * mailto resolved from lib/links.ts (EMAIL_LINK), never a duplicated
 * address constant — with GitHub / LinkedIn as the secondary paths.
 * The visual language extends the unified nav's contact identity
 * (navContactRipple / navContactPacket) at document scale: packet
 * dots on each intent, one node at the action end, one quiet CSS
 * ripple — transform/opacity only, static under reduced motion, no
 * pointer tracking, no canvas, no client component. Server-rendered
 * semantic HTML inside this page file; the same honest contact model
 * as the rest of the page (plain anchors, no form, no backend).
 */
function ContactTransmissionArtifact() {
  const emailHref =
    EMAIL_LINK?.href ?? "mailto:Parsaetak@gmail.com";

  return (
    <section
      className={styles.transmissionArtifact}
      aria-labelledby="contact-transmission-title"
    >
      <div className={styles.artifactHead}>
        {/*
          * The 13-point star — the site identity — anchors the
          * artifact to the same brand vocabulary as the shell.
          * Decorative: the kicker text beside it is the content.
          */}
        <img
          className={styles.artifactStar}
          src={BRAND_STAR.red}
          alt=""
          width={22}
          height={22}
          loading="eager"
          decoding="async"
        />

        <p className={styles.artifactKicker}>Transmission</p>
      </div>

      <h2
        className={styles.artifactTitle}
        id="contact-transmission-title"
      >
        Four intents, one channel
      </h2>

      <p className={styles.artifactSummary}>
        Every kind of inquiry this page serves enters through the same
        verified inbox — the same address published in the site footer
        and the public link hub, never a different one.
      </p>

      <div className={styles.transmissionConsole}>
        <ul
          className={styles.transmissionIntents}
          aria-label="Collaboration intents"
        >
          {TRANSMISSION_INTENTS.map((intent) => (
            <li
              key={intent.label}
              className={styles.transmissionIntent}
            >
              <i
                className={
                  styles.transmissionIntentDot
                }
                aria-hidden="true"
              />

              {intent.label}
            </li>
          ))}
        </ul>

        {/*
          * The transmission wire — intents to action. Decorative
          * (aria-hidden): the ripple is compositor-only CSS (scale +
          * opacity) that collapses to a static thin ring under
          * reduced motion, the same treatment as the hero signal.
          */}
        <div
          className={styles.transmissionWire}
          aria-hidden="true"
        >
          <i className={styles.transmissionWireLine} />

          <i className={styles.transmissionWireNode} />
        </div>

        <div className={styles.transmissionAction}>
          <a
            className="button button-primary"
            href={emailHref}
          >
            Email Parsa Tak
          </a>

          <span className={styles.transmissionAddress}>
            {emailHref.replace("mailto:", "")}
          </span>
        </div>
      </div>

      <div className={styles.transmissionSecondary}>
        <span className={styles.transmissionSecondaryLabel}>
          Secondary paths
        </span>

        <a
          className={styles.transmissionSecondaryLink}
          href="https://github.com/Parsaetak"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>

        {LINKEDIN_LINK && (
          <a
            className={styles.transmissionSecondaryLink}
            href={LINKEDIN_LINK.href}
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn ↗
          </a>
        )}
      </div>
    </section>
  );
}
