#!/usr/bin/env node
/*
 * build-blog.mjs — static blog content pipeline.
 *
 * SOURCE (content/blog/*.md)
 *   → PARSE frontmatter (incl. optional related/project/topics)
 *   → VALIDATE records + relationship graph (fail loudly: file + reason)
 *   → RENDER markdown to HTML (small trusted subset, fully escaped,
 *     top-level blocks annotated with reveal attributes)
 *   → NORMALIZE (reading time, cover URLs, link basePath)
 *   → INDEX (tags, categories, related, prev/next)
 *   → EMIT data/blog/posts.json + public/sitemap.xml
 *
 * Related content (v2.5): a deterministic scoring model combines
 * explicit author relationships (frontmatter `related`) with signal
 * overlap — shared tags, shared topics, category, project, significant
 * title/excerpt terms, and a bounded recency tie-break. No ML, no
 * runtime computation: related sets are computed once here and
 * validated (no missing slugs, no self-links, no duplicates).
 *
 * SEO emission law: the sitemap is generated from the SAME content
 * index that produces the site routes — site configuration + blog
 * slugs + real static routes. There is no separately maintained
 * URL list, so the sitemap can never disagree with the site.
 * lastmod values are the articles' own updated/date fields — never
 * "today" — so freshness is never faked.
 *
 * Zero runtime dependencies. Runs before `next dev` and `next build`
 * (see package.json scripts) and inside the deployment workflow.
 *
 * Environment awareness mirrors next.config.ts:
 *   GITHUB_ACTIONS === "true" → basePath "/WEB", otherwise "".
 *
 * A malformed article FAILS the build. A missing/empty content
 * directory is an explicit empty state, not a failure.
 */

import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { existsSync, openSync, readSync, closeSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const DATA_DIR = path.join(ROOT, "data", "blog");

/*
 * CANONICAL SITE FACTS (SEO v2 hardening, v2.1): the origin, the site
 * name and the deployment basePath are DERIVED from data/routes.json —
 * the single manually maintained registry. No script may re-declare
 * them as independent literals; a change to the registry is the one
 * place these facts move.
 */
const ROUTE_REGISTRY = JSON.parse(
  readFileSync(path.join(ROOT, "data", "routes.json"), "utf8")
);

const SITE_URL = ROUTE_REGISTRY.site.origin;
const SITE_NAME = ROUTE_REGISTRY.site.name;
const SITE_DESCRIPTION =
  "Notes from an evolving laboratory for AI systems, reasoning architecture, creative technology, and RED MAGIC.";

const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";
const BASE_PATH = IS_GITHUB_ACTIONS ? ROUTE_REGISTRY.site.basePath : "";

/*
 * Root-relative site OG image. Validated below so a missing social
 * image fails the build instead of shipping broken og:image URLs.
 * Root-relative on purpose: og metadata is resolved against the
 * metadataBase (which already contains /WEB), never basePath-prefixed.
 */
const SITE_OG_IMAGE_PATH = "/og-default.png";
const SITE_OG_IMAGE_FILE = path.join(ROOT, "public", "og-default.png");

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WORDS_PER_MINUTE = 200;

/*
 * CONTENT-TYPE MODEL (v3.7): every article carries one of three
 * formal content types — `article` (field notes / essays), `work`
 * (documentation of a built system or project), `research`
 * (research-programme writing). The type is REQUIRED frontmatter:
 * the classification is the author's own statement of what the
 * article means, never inferred from its title, and an unknown or
 * missing value fails the build so the Blog content modes can never
 * silently orphan a post.
 */
const CONTENT_TYPES = new Set(["article", "work", "research"]);

/*
 * Related-content model (v2.5). Up to six related articles when the
 * catalogue is large enough; candidates qualify only through a real
 * relevance signal — never through recency alone.
 */
const MAX_RELATED = 6;

/*
 * Shared-signal hints (v2.5.5): the strongest concrete reasons WHY a
 * scored candidate is related, emitted alongside the score so the
 * article can show them as tiny mono hints ("verification ·
 * systems-thinking"). Capped to keep rows quiet; order inside the
 * cap: project > tags > topics > significant terms (the same
 * authority order the scoring weights use). Explicit author
 * relationships carry no signals — the page renders their
 * provenance differently ("author-curated").
 */
const MAX_SHARED_SIGNALS = 3;

const RELATED_WEIGHTS = {
  SHARED_TAG: 3,
  SHARED_TOPIC: 2,
  SAME_CATEGORY: 4,
  SAME_PROJECT: 3,
  SHARED_TERM: 1,
  SHARED_TERM_CAP: 4,
  RECENCY_SPREAD: 1
};

/*
 * Hash scenes of the world shell — the legal targets of `/#scene`
 * links inside article bodies. DERIVED from the canonical registry
 * (data/routes.json scenes.names) so the checker can never drift
 * from the shell's real vocabulary. "#library" is retained as the
 * single deliberate backward-compatibility alias of "#media"
 * (mirroring SCENE_ID_ALIASES in lib/sceneIds.ts, the runtime's
 * alias map): links published before the v4.0.0 Media migration
 * must keep validating. No other legacy scene hash is accepted.
 */
const SCENE_HASH_ALIASES = new Set(["library"]);

const KNOWN_SCENES = new Set([
  ...ROUTE_REGISTRY.scenes.names,
  ...SCENE_HASH_ALIASES
]);

/*
 * CANONICAL DOCUMENT ROUTES (v4.0.1) — every real public route from
 * the registry (plus the blog index handled separately below).
 * Article bodies may link any of them root-relative, with or without
 * the trailing slash; a fragment is allowed and resolved against the
 * built documents by verify-seo.mjs (the export-level checker).
 */
const CANONICAL_ROUTE_PATHS = new Set(
  ROUTE_REGISTRY.routes
    .filter((route) => route.path !== "" && route.path !== "blog")
    .map((route) => `/${route.path}`)
);

/*
 * Stopwords for the significant-term overlap signal. Small,
 * deterministic, and tuned to this site's editorial vocabulary —
 * generic filler words must never create fake relatedness.
 */
const TERM_STOPWORDS = new Set([
  "about", "above", "after", "again", "against", "because", "been",
  "before", "being", "below", "between", "both", "cannot", "come",
  "could", "does", "doing", "down", "during", "each", "every",
  "from", "further", "have", "here", "into", "just", "like",
  "made", "make", "more", "most", "never", "only", "other",
  "over", "said", "same", "should", "some", "still", "such",
  "take", "than", "that", "their", "theirs", "them", "then",
  "there", "these", "they", "this", "those", "through", "under",
  "until", "very", "want", "well", "were", "what", "when",
  "where", "which", "while", "who", "whom", "will", "with",
  "within", "without", "would", "your", "yours"
]);

/*
 * Significant-term extraction for the subject-similarity signal:
 * title + subtitle + excerpt + topics + tags, lowercased, tokenised,
 * stopword- and number-filtered, with light plural folding so
 * "system" and "systems" match. Deterministic by construction.
 */
function significantTerms(record) {
  const source = [
    record.title,
    record.subtitle,
    record.excerpt,
    ...(Array.isArray(record.topics) ? record.topics : []),
    ...(Array.isArray(record.tags) ? record.tags : [])
  ]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLowerCase();

  const terms = new Set();
  for (const token of source.split(/[^a-z0-9]+/)) {
    if (token.length < 4 || /^\d+$/.test(token)) {
      continue;
    }
    if (TERM_STOPWORDS.has(token)) {
      continue;
    }
    const folded =
      token.length > 4 && token.endsWith("s") && !token.endsWith("ss")
        ? token.slice(0, -1)
        : token;
    terms.add(folded);
  }
  return terms;
}

/*
 * Search metadata is composed ONCE here instead of being re-derived
 * in the browser on every keystroke. The client island only lowercases
 * the query and checks inclusion against this precomputed haystack.
 */
function buildSearchHaystack(record) {
  return [
    record.title,
    record.subtitle,
    record.excerpt,
    record.category,
    record.type,
    record.author,
    record.project,
    ...(Array.isArray(record.tags) ? record.tags : []),
    ...(Array.isArray(record.topics) ? record.topics : [])
  ]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

const failures = [];

function fail(file, reason) {
  failures.push(`  ${file}\n    ${reason}`);
}

/* -------------------------------------------------------------------------- */
/* Frontmatter parsing                                                        */
/* -------------------------------------------------------------------------- */

function parseScalar(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

function parseInlineArray(raw) {
  const value = raw.trim();
  if (!(value.startsWith("[") && value.endsWith("]"))) {
    return null;
  }
  const inner = value.slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((part) => parseScalar(part).toString().trim())
    .filter((part) => part.length > 0);
}

function parseFrontmatter(source) {
  const lines = source.split(/\r?\n/);
  if (lines[0] === undefined || lines[0].trim() !== "---") {
    return { data: {}, body: source };
  }

  const data = {};
  const contextStack = [];

  let index = 1;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") {
      index += 1;
      break;
    }

    const objectMatch = line.match(/^(\s*)([A-Za-z][A-Za-z0-9_-]*):\s*$/);
    if (objectMatch) {
      const depth = Math.floor(objectMatch[1].length / 2);
      contextStack.length = depth;
      contextStack[depth] = objectMatch[2];
      const container =
        depth === 0 ? data : getOrCreate(data, contextStack.slice(0, depth));
      container[objectMatch[2]] = {};
      continue;
    }

    const pairMatch = line.match(/^(\s*)([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (pairMatch) {
      const [, indent, key, rawValue] = pairMatch;
      const depth = Math.floor(indent.length / 2);
      contextStack.length = depth;

      const container =
        depth === 0 ? data : getOrCreate(data, contextStack.slice(0, depth));

      if (rawValue.trim().startsWith("[")) {
        const arrayValue = parseInlineArray(rawValue);
        if (arrayValue !== null) {
          container[key] = arrayValue;
          continue;
        }
      }

      container[key] = parseScalar(rawValue);
    }
  }

  const body = lines.slice(index).join("\n").trim();
  return { data, body };
}

function getOrCreate(root, keys) {
  let node = root;
  for (const key of keys) {
    if (node[key] === undefined) {
      node[key] = {};
    }
    node = node[key];
  }
  return node;
}

/* -------------------------------------------------------------------------- */
/* Markdown rendering (trusted subset, HTML-escaped)                          */
/* -------------------------------------------------------------------------- */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyHeading(text, usedIds) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  let id = base || "section";
  let counter = 2;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

function renderInline(text, usedIds) {
  let html = escapeHtml(text);

  /*
   * Links and images are re-injected after escaping so only the
   * approved href/src shapes reach the DOM.
   */
  html = html.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (match, alt, src) => {
      if (!isSafeUrl(src)) {
        return escapeHtml(match);
      }
      return bodyImg(src, alt);
    }
  );

  html = html.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (match, label, href) => {
      if (!isSafeUrl(href)) {
        return escapeHtml(match);
      }
      const isInternal = href.startsWith("/");
      return `<a href="${applyBasePath(href)}"${isInternal ? "" : ' target="_blank" rel="noreferrer"'}>${label}</a>`;
    }
  );

  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  html = html.replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>"
  );

  html = html.replace(
    /(^|[\s(])\*([^*\s][^*]*)\*/g,
    "$1<em>$2</em>"
  );

  return html;
}

function isSafeUrl(url) {
  if (url.startsWith("#") || url.startsWith("/")) {
    return true;
  }
  return /^https?:\/\//i.test(url) || /^mailto:/i.test(url);
}

/*
 * Root-relative URLs are emitted with the deployment basePath so
 * the generated HTML is correct for the environment being built.
 */
function applyBasePath(url) {
  if (BASE_PATH === "" || !url.startsWith("/")) {
    return url;
  }
  return `${BASE_PATH}${url}`;
}

/*
 * Intrinsic image size (v2.8) — lets body <img> markup carry
 * width/height attributes so the browser can reserve the layout
 * box before the bytes arrive (the same layout-shift protection
 * the cover pipeline enforces on covers). Only local, already
 * validated images are considered: PNG dimensions come from the
 * IHDR header (signature + first chunk), SVG from explicit
 * width/height or the viewBox aspect. Anything unreadable or
 * remote returns null and the attributes are simply omitted —
 * a measurement failure must never break the build.
 */
function imageIntrinsicSize(src) {
  if (typeof src !== "string" || !src.startsWith("/blog/images/")) {
    return null;
  }

  const file = path.join(ROOT, "public", src.replace(/^\//, ""));

  try {
    if (!existsSync(file)) {
      return null;
    }

    if (/\.png$/i.test(src)) {
      const buffer = Buffer.alloc(24);
      const fd = openSync(file, "r");
      try {
        readSync(fd, buffer, 0, 24, 0);
      } finally {
        closeSync(fd);
      }

      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47;

      if (!isPng) {
        return null;
      }

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);

      if (width > 0 && height > 0) {
        return { width, height };
      }

      return null;
    }

    if (/\.svg$/i.test(src)) {
      const source = readFileSync(file, "utf8").slice(0, 4096);

      const widthAttr = source.match(/\bwidth="([\d.]+)"/);
      const heightAttr = source.match(/\bheight="([\d.]+)"/);

      if (widthAttr && heightAttr) {
        const width = Number.parseFloat(widthAttr[1]);
        const height = Number.parseFloat(heightAttr[1]);

        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      const viewBox = source.match(/\bviewBox="[\d.\-\s]+([\d.]+)\s+([\d.]+)"/);

      if (viewBox) {
        const width = Number.parseFloat(viewBox[1]);
        const height = Number.parseFloat(viewBox[2]);

        if (width > 0 && height > 0) {
          return { width, height };
        }
      }

      return null;
    }
  } catch {
    return null;
  }

  return null;
}

/*
 * Shared <img> emission for body images: lazy, async-decoded, and
 * dimensioned when the intrinsic size is known (CLS protection).
 */
function bodyImg(src, alt) {
  const size = imageIntrinsicSize(src);

  const sizeAttributes = size
    ? ` width="${size.width}" height="${size.height}"`
    : "";

  return `<img src="${applyBasePath(src)}" alt="${alt}"${sizeAttributes} loading="lazy" decoding="async" />`;
}

function renderMarkdown(source) {
  const usedIds = new Set();
  const headings = [];
  const lines = source.split(/\r?\n/);
  const out = [];

  let inCodeBlock = false;
  let codeLanguage = "";
  let codeBuffer = [];
  let paragraphBuffer = [];
  let listType = null;
  let listBuffer = [];
  let quoteBuffer = [];

  /*
   * READING MOTION (v2.5): top-level blocks are annotated at BUILD
   * time with reveal attributes so the article unfolds through the
   * existing one-observer system (MotionReveal). Blocks are grouped
   * into chunks that restart at every h2: the heading reveals first
   * (order 0) and its supporting content settles after it (orders
   * 1–4, capped). Presentation only — without JavaScript the
   * pre-paint reveal-js class never lands and every block stays
   * visible, so crawlers and no-JS readers always get the article.
   */
  let chunkPosition = 0;

  function revealAttributes(kind) {
    const order = Math.min(chunkPosition, 4);
    chunkPosition += 1;
    return ` data-reveal="${kind}" data-reveal-order="${order}"`;
  }

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      out.push(
        `<p${revealAttributes("")}>${renderInline(paragraphBuffer.join(" "), usedIds)}</p>`
      );
      paragraphBuffer = [];
    }
  }

  function flushList() {
    if (listType !== null) {
      const tag = listType === "ordered" ? "ol" : "ul";
      const attrs = revealAttributes("");
      const items = listBuffer
        .map((item) => `<li>${renderInline(item, usedIds)}</li>`)
        .join("");
      out.push(`<${tag}${attrs}>${items}</${tag}>`);
      listType = null;
      listBuffer = [];
    }
  }

  function flushQuote() {
    if (quoteBuffer.length > 0) {
      out.push(
        `<blockquote${revealAttributes("quote")}><p>${renderInline(quoteBuffer.join(" "), usedIds)}</p></blockquote>`
      );
      quoteBuffer = [];
    }
  }

  function flushAll() {
    flushParagraph();
    flushList();
    flushQuote();
  }

  for (const line of lines) {
    const trimmed = line.trim();

    /* Fenced code blocks */
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        const escapedCode = escapeHtml(codeBuffer.join("\n"));
        /*
         * The fence is wrapped in .code-block (v2.5.2): the box
         * carries the frame, the language label, and (at runtime)
         * the COPY button, so that chrome stays PINNED while wide
         * code scrolls horizontally inside the <pre>. The reveal
         * attributes live on the wrapper — the motion CSS is
         * attribute-based and animates the box as one unit.
         */
        out.push(
          `<div class="code-block"${revealAttributes("code")} data-language="${escapeHtml(codeLanguage)}"><pre><code>${escapedCode}</code></pre></div>`
        );
        inCodeBlock = false;
        codeBuffer = [];
        codeLanguage = "";
      } else {
        flushAll();
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    /* Blank line */
    if (trimmed === "") {
      flushAll();
      continue;
    }

    /* Horizontal rule */
    if (/^-{3,}$/.test(trimmed)) {
      flushAll();
      out.push(`<hr${revealAttributes("fade")} />`);
      continue;
    }

    /* Headings */
    const headingMatch = trimmed.match(/^(#{2,4})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugifyHeading(text, usedIds);
      headings.push({ id, text, level });

      /* An h2 opens a new motion chunk; h3/h4 stay in the current one. */
      if (level === 2) {
        chunkPosition = 0;
      }

      /*
       * HEADING ANCHORS (v2.5.2): every section heading carries a
       * server-rendered "#" self-link so readers (and other articles,
       * via the fragment-validated internal links) can deep-link a
       * section with zero JavaScript. The anchor is omitted when the
       * heading text itself renders a link — nested <a> is invalid.
       */
      const inlineHtml = renderInline(text, usedIds);
      const anchor = inlineHtml.includes("<a")
        ? ""
        : `<a class="h-anchor" href="#${id}" aria-label="Link to this section"><span aria-hidden="true">#</span></a>`;

      out.push(
        `<h${level}${revealAttributes("heading")} id="${id}">${inlineHtml}${anchor}</h${level}>`
      );
      continue;
    }

    /* Blockquote */
    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      quoteBuffer.push(trimmed.slice(2));
      continue;
    }

    /* Unordered list */
    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "unordered") {
        flushList();
        listType = "unordered";
      }
      listBuffer.push(unorderedMatch[1]);
      continue;
    }

    /* Ordered list */
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushQuote();
      if (listType !== "ordered") {
        flushList();
        listType = "ordered";
      }
      listBuffer.push(orderedMatch[1]);
      continue;
    }

    /* Standalone image */
    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imageMatch && isSafeUrl(imageMatch[2])) {
      flushAll();
      out.push(
        `<figure${revealAttributes("scale")}>${bodyImg(imageMatch[2], imageMatch[1])}</figure>`
      );
      continue;
    }

    /* Paragraph line */
    flushList();
    flushQuote();
    paragraphBuffer.push(trimmed);
  }

  flushAll();

  return { html: out.join("\n"), headings };
}

/* -------------------------------------------------------------------------- */
/* Social image twins                                                          */
/* -------------------------------------------------------------------------- */

/*
 * og:image twin path for a cover: same file, extension swapped to
 * .png. Covers committed as PNG/JPG already serve as their own
 * social image. The twin's EXISTENCE is validated alongside the
 * cover itself — a missing twin fails the build with the expected
 * path instead of shipping an og:image URL that 404s on social
 * platforms.
 */
function coverOgSrc(coverSrc) {
  if (/\.(png|jpe?g|webp)$/i.test(coverSrc)) {
    return coverSrc;
  }
  return coverSrc.replace(/\.svg$/i, ".png");
}

function validateCoverTwin(coverSrc, file) {
  const ogSrc = coverOgSrc(coverSrc);
  const ogFile = path.join(ROOT, "public", ogSrc.replace(/^\//, ""));
  if (!existsSync(ogFile)) {
    fail(
      file,
      `cover social-image twin not found: ${ogSrc} (og:image requires a PNG twin of every SVG cover)`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function isValidDateString(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

function validatePost(record, file) {
  const problems = [];

  if (typeof record.title !== "string" || record.title.trim() === "") {
    problems.push("title is required and must be a non-empty string");
  }

  if (typeof record.excerpt !== "string" || record.excerpt.trim() === "") {
    problems.push("excerpt is required (short summary for index and feed)");
  }

  if (!isValidDateString(record.date)) {
    problems.push("date is required and must be YYYY-MM-DD");
  }

  if (
    record.updated !== undefined &&
    !isValidDateString(record.updated)
  ) {
    problems.push("updated must be YYYY-MM-DD when present");
  }

  if (
    isValidDateString(record.date) &&
    isValidDateString(record.updated) &&
    record.updated < record.date
  ) {
    problems.push("updated must not be earlier than date");
  }

  if (typeof record.author !== "string" || record.author.trim() === "") {
    problems.push("author is required");
  }

  if (
    typeof record.category !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.category)
  ) {
    problems.push("category is required (lowercase kebab-case)");
  }

  /*
   * CONTENT-TYPE MODEL (v3.7) — required, one of the three formal
   * content types. Validated here so the Blog content modes and the
   * SEO content-discovery checks can trust it without a fallback.
   */
  if (
    typeof record.type !== "string" ||
    !CONTENT_TYPES.has(record.type)
  ) {
    problems.push(
      `type is required and must be one of: ${[...CONTENT_TYPES].join(", ")} (got ${JSON.stringify(record.type)})`
    );
  }

  if (
    record.tags !== undefined &&
    (!Array.isArray(record.tags) ||
      record.tags.some(
        (tag) => typeof tag !== "string" || tag.trim() === ""
      ))
  ) {
    problems.push("tags must be an array of non-empty strings");
  }

  if (
    record.featured !== undefined &&
    typeof record.featured !== "boolean"
  ) {
    problems.push("featured must be true or false");
  }

  if (record.cover !== undefined && record.cover !== null) {
    if (typeof record.cover !== "object") {
      problems.push("cover must be an object");
    } else {
      if (
        typeof record.cover.src !== "string" ||
        !/^\/blog\/images\//.test(record.cover.src)
      ) {
        problems.push("cover.src must start with /blog/images/");
      } else {
        const coverFile = path.join(
          ROOT,
          "public",
          record.cover.src.replace(/^\//, "")
        );
        if (!existsSync(coverFile)) {
          problems.push(`cover file not found: ${record.cover.src}`);
        }
        validateCoverTwin(record.cover.src, file);
      }
      if (
        typeof record.cover.alt !== "string" ||
        record.cover.alt.trim() === ""
      ) {
        problems.push("cover.alt is required when cover is present");
      }
      if (
        !Number.isInteger(record.cover.width) ||
        record.cover.width <= 0 ||
        !Number.isInteger(record.cover.height) ||
        record.cover.height <= 0
      ) {
        problems.push("cover.width/height must be positive integers");
      }
    }
  }

  /*
   * Optional explicit relationships (v2.5). The graph itself is
   * validated after every slug is known (see main): unknown targets,
   * self-links, and duplicate entries fail with the file name.
   */
  if (record.related !== undefined) {
    if (
      !Array.isArray(record.related) ||
      record.related.some(
        (slug) => typeof slug !== "string" || !SLUG_PATTERN.test(slug)
      )
    ) {
      problems.push(
        "related must be an array of article slugs (lowercase kebab-case)"
      );
    }
  }

  if (
    record.project !== undefined &&
    record.project !== null &&
    (typeof record.project !== "string" || record.project.trim() === "")
  ) {
    problems.push("project must be a non-empty string when present");
  }

  if (
    record.topics !== undefined &&
    (!Array.isArray(record.topics) ||
      record.topics.some(
        (topic) => typeof topic !== "string" || topic.trim() === ""
      ))
  ) {
    problems.push("topics must be an array of non-empty strings");
  }

  if (typeof record.body !== "string" || record.body.trim() === "") {
    problems.push("article body is empty");
  }

  for (const problem of problems) {
    fail(file, problem);
  }

  return problems.length === 0;
}

/*
 * Internal link validation (v2.5 / v4.0.1) — every link in an
 * article body must resolve to something real:
 *   - external links use https (never http, never localhost)
 *   - root-relative links stay free of the deployment basePath
 *     (content is written root-relative; the pipeline adds the base)
 *   - /blog/<slug>/[<fragment>] targets must exist, and a fragment
 *     must match a real heading id of the target article
 *   - canonical document routes from the route registry
 *     (/about/, /work/, /research/, /contact/, topic hubs, …)
 *     are accepted with or without the trailing slash; fragments on
 *     them are validated against the built export by verify-seo.mjs
 *   - /#<scene> targets must match a real hash scene of the shell
 *   - anything else fails: no dead internal links ship
 */
function checkInternalLinks(body, validSlugs, headingsBySlug, file) {
  for (const match of body.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
    const href = match[1];

    if (href.startsWith("#") || /^mailto:/i.test(href)) {
      continue;
    }

    if (/^https?:\/\//i.test(href)) {
      if (/^http:\/\//i.test(href)) {
        fail(file, `external link must use https: ${href}`);
      }
      if (/localhost/i.test(href)) {
        fail(file, `external link references localhost: ${href}`);
      }
      continue;
    }

    if (!href.startsWith("/")) {
      fail(
        file,
        `link must be root-relative or an absolute https URL: ${href}`
      );
      continue;
    }

    if (href.startsWith("//")) {
      fail(file, `protocol-relative link is ambiguous: ${href}`);
      continue;
    }

    if (BASE_PATH !== "" && href.startsWith(`${BASE_PATH}/`)) {
      fail(
        file,
        `link repeats the deployment base path: ${href} (write root-relative links; the pipeline adds "${BASE_PATH}")`
      );
      continue;
    }

    if (/localhost/i.test(href)) {
      fail(file, `internal link references localhost: ${href}`);
      continue;
    }

    const [rawPath, fragment] = href.split("#");
    const cleanPath = rawPath.split("?")[0];

    if (cleanPath === "/" || cleanPath === "") {
      if (fragment !== undefined && fragment !== "" && !KNOWN_SCENES.has(fragment)) {
        fail(
          file,
          `home link points to unknown scene "#${fragment}" (known: ${[...KNOWN_SCENES].join(", ")})`
        );
      }
      continue;
    }

    if (cleanPath === "/blog" || cleanPath === "/blog/") {
      continue;
    }

    const blogMatch = cleanPath.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch) {
      const slug = blogMatch[1];
      if (slug === "images") {
        continue;
      }
      if (!validSlugs.has(slug)) {
        fail(file, `internal blog link points to unknown slug: ${slug}`);
        continue;
      }
      if (fragment !== undefined && fragment !== "") {
        const headingIds = headingsBySlug.get(slug);
        if (headingIds && !headingIds.has(fragment)) {
          fail(
            file,
            `link fragment "#${fragment}" matches no heading in "${slug}"`
          );
        }
      }
      continue;
    }

    /*
     * Canonical document routes (registry-derived): accepted with
     * or without the trailing slash. A query (e.g. /blog/?type=work
     * style filters on hubs) or fragment may follow; the export-level
     * verifier checks fragments against real document ids.
     */
    const routePath = cleanPath.endsWith("/")
      ? cleanPath.slice(0, -1)
      : cleanPath;

    if (CANONICAL_ROUTE_PATHS.has(routePath)) {
      continue;
    }

    fail(file, `internal link does not resolve to a known route: ${href}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Normalization + indexing                                                   */
/* -------------------------------------------------------------------------- */

function countWords(body) {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\-]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain === "" ? 0 : plain.split(" ").length;
}

/*
 * RELATED CONTENT (v2.5) — deterministic, human-meaningful.
 *
 * Signals, in descending authority:
 *   1. explicit `related` frontmatter (author-guaranteed, always first)
 *   2. shared tags           (×3 each, capped at three tags)
 *   3. same category         (×4)
 *   4. same project          (×3)
 *   5. shared topics         (×2 each, capped at three)
 *   6. shared significant terms from title/excerpt/topics (×1, capped)
 *   7. recency               (bounded tie-break ONLY — never qualifies
 *                             a candidate on its own)
 *
 * A candidate enters the set only with at least one qualifying signal
 * (tag, topic, category, project, or ≥2 shared terms). The result is
 * deterministic across runs: no randomness, no ML, no runtime work.
 */
function scoreRelatedCandidate(post, other, recencyBonus) {
  const sharedTags = other.tags.filter((tag) => post.tags.includes(tag));
  const sharedTopics = other.topics.filter((topic) =>
    post.topics.includes(topic)
  );
  /*
   * The shared significant terms themselves (v2.5.5) — insertion
   * order of post.terms is deterministic (built from the record's
   * own title/subtitle/excerpt/topics/tags in fixed order), so the
   * emitted hints are stable across runs.
   */
  const sharedTermList =
    other.terms
      ? [...post.terms].filter((term) => other.terms.has(term))
      : [];
  const sharedTerms = sharedTermList.length;
  const sameCategory = other.category === post.category;
  const sameProject =
    post.project !== null &&
    other.project !== null &&
    post.project === other.project;

  let score = 0;
  score += Math.min(sharedTags.length, 3) * RELATED_WEIGHTS.SHARED_TAG;
  score += Math.min(sharedTopics.length, 3) * RELATED_WEIGHTS.SHARED_TOPIC;
  if (sameCategory) {
    score += RELATED_WEIGHTS.SAME_CATEGORY;
  }
  if (sameProject) {
    score += RELATED_WEIGHTS.SAME_PROJECT;
  }
  score +=
    Math.min(sharedTerms, RELATED_WEIGHTS.SHARED_TERM_CAP) *
    RELATED_WEIGHTS.SHARED_TERM;
  score += recencyBonus;

  const qualifies =
    sharedTags.length > 0 ||
    sharedTopics.length > 0 ||
    sameCategory ||
    sameProject ||
    sharedTerms >= 2;

  /*
   * Human-readable shared signals (v2.5.5): concrete overlap names
   * in authority order, capped at MAX_SHARED_SIGNALS. The category
   * match is deliberately NOT a hint — the row already shows the
   * category label with its accent dot.
   */
  const shared = [];
  if (sameProject && post.project) {
    shared.push(post.project);
  }
  for (const tag of sharedTags) {
    if (shared.length >= MAX_SHARED_SIGNALS) break;
    shared.push(tag);
  }
  for (const topic of sharedTopics) {
    if (shared.length >= MAX_SHARED_SIGNALS) break;
    shared.push(topic);
  }
  for (const term of sharedTermList) {
    if (shared.length >= MAX_SHARED_SIGNALS) break;
    shared.push(term);
  }

  return {
    slug: other.slug,
    score: Math.round(score * 100) / 100,
    qualifies,
    shared
  };
}

function buildRelated(posts) {
  const related = {};
  const total = posts.length;

  for (const post of posts) {
    const chosen = [];
    const chosenSlugs = new Set();

    /*
     * Explicit relationships first, in the author's order. Validated
     * separately (see main): unknown slugs, self-links, and duplicates
     * never reach this point.
     */
    for (const slug of post.explicitRelated) {
      chosen.push({ slug, score: null, explicit: true, shared: [] });
      chosenSlugs.add(slug);
    }

    const scored = posts
      .filter((other) => other.slug !== post.slug && !chosenSlugs.has(other.slug))
      .map((other) =>
        scoreRelatedCandidate(
          post,
          other,
          total > 1
            ? (1 - other.recencyRank / (total - 1)) * RELATED_WEIGHTS.RECENCY_SPREAD
            : 0
        )
      )
      .filter((candidate) => candidate.qualifies)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
          (a.slug < b.slug ? -1 : 1)
      )
      .slice(0, MAX_RELATED - chosen.length);

    for (const candidate of scored) {
      chosen.push({
        slug: candidate.slug,
        score: candidate.score,
        explicit: false,
        shared: candidate.shared
      });
      chosenSlugs.add(candidate.slug);
    }

    related[post.slug] = chosen;
  }

  return related;
}

function buildAdjacent(postsByDateAsc) {
  const adjacent = {};
  postsByDateAsc.forEach((post, index) => {
    adjacent[post.slug] = {
      prev: index > 0 ? postsByDateAsc[index - 1].slug : null,
      next:
        index < postsByDateAsc.length - 1
          ? postsByDateAsc[index + 1].slug
          : null
    };
  });
  return adjacent;
}

/*
 * REVERSE LINK GRAPH (v2.5.4) — "what links here".
 *
 * The forward link graph is the article bodies themselves: every
 * internal /blog/<slug>/ hyperlink an author writes. This index
 * inverts it: for each article, WHICH other articles link TO it,
 * derived by scanning the rendered HTML (so it sees exactly what a
 * reader sees — prose links only, never navigation chrome, which is
 * page-level and not part of the body HTML).
 *
 * Deterministic: sources are scanned in the posts array order
 * (date descending, slug ascending), duplicates collapse, self-links
 * are impossible by construction (a body never links to its own
 * article page). Slugs with zero inbound links are simply absent.
 */
function buildLinksHere(posts) {
  const articleHrefPattern =
    /href="[^"]*\/blog\/([a-z0-9][a-z0-9-]*)\/[^"]*"/g;
  const linksHere = {};

  for (const source of posts) {
    const html = String(source.html ?? "");
    const targets = new Set();
    let match;

    articleHrefPattern.lastIndex = 0;

    while ((match = articleHrefPattern.exec(html)) !== null) {
      const target = match[1];

      if (target !== source.slug && posts.some((p) => p.slug === target)) {
        targets.add(target);
      }
    }

    for (const target of targets) {
      (linksHere[target] ??= []).push(source.slug);
    }
  }

  return linksHere;
}

/* -------------------------------------------------------------------------- */
/* Sitemap                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Sitemap source of truth: site configuration (SITE_URL) + the blog
 * content index + the real static routes of the site. Only genuinely
 * indexable, canonical URLs are listed — no hash scenes, no filter
 * states, no search results, no asset URLs.
 *
 * lastmod policy (sitemap freshness):
 * - articles: the article's own `updated` date, falling back to `date`
 * - /blog/: the newest article modification the index reflects
 * - /: omitted — the world shell has no dated content model, and
 *   inventing a date would fake freshness.
 * - content routes (v3.1): each route's own content-revision date —
 *   bumped only when the page's substantive content changes, never
 *   the build date. Fake freshness is still banned.
 * priority/changefreq are deliberately omitted: search engines
 * ignore them and they would be speculative signals.
 */

/*
 * STATIC CONTENT ROUTES (SEO v2) — derived from data/routes.json, the
 * canonical route registry (read once at the top of this file). The
 * registry is the single manually maintained route list; the sitemap,
 * verify-seo.mjs and lib/hubs.ts all read the same facts, so the
 * sitemap can never disagree with the verified route set. lastmod
 * values are content-revision dates from the registry — bumped only
 * when a route's substantive content changes, never the build date.
 * Fake freshness is still banned.
 */
const STATIC_CONTENT_ROUTES = ROUTE_REGISTRY.routes
  .filter(
    (route) =>
      route.sitemap.include &&
      route.path !== "" &&
      route.path !== "blog"
  )
  .map((route) => ({
    path: route.path,
    lastmod: route.sitemap.lastmod
  }));

/*
 * Total sitemap URL count: home + blog index + every article + the
 * static content routes.
 */
function sitemapUrlCount(postCount) {
  return 2 + postCount + STATIC_CONTENT_ROUTES.length;
}

function buildSitemap(posts) {
  const urls = [
    `  <url>\n    <loc>${SITE_URL}/</loc>\n  </url>`,
  ];

  /*
   * Static content routes (v3.1): /about/, /work/, and the topic
   * hubs — each with its own content-revision lastmod, never the
   * build date.
   */
  for (const route of STATIC_CONTENT_ROUTES) {
    urls.push(
      `  <url>\n    <loc>${SITE_URL}/${route.path}/</loc>\n    <lastmod>${route.lastmod}</lastmod>\n  </url>`
    );
  }

  if (posts.length > 0) {
    const blogLastMod = posts
      .map((post) => post.updated ?? post.date)
      .sort()
      .at(-1);

    urls.push(
      `  <url>\n    <loc>${SITE_URL}/blog/</loc>\n    <lastmod>${blogLastMod}</lastmod>\n  </url>`
    );
  } else {
    urls.push(`  <url>\n    <loc>${SITE_URL}/blog/</loc>\n  </url>`);
  }

  for (const post of posts) {
    const lastMod = post.updated ?? post.date;
    urls.push(
      `  <url>\n    <loc>${SITE_URL}/blog/${post.slug}/</loc>\n    <lastmod>${lastMod}</lastmod>\n  </url>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.join("\n")
  }\n</urlset>\n`;
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  const generatedAt = new Date();
  const posts = [];
  const rawBodies = new Map();
  const headingsBySlug = new Map();

  if (!existsSync(CONTENT_DIR)) {
    console.warn(
      "[blog] content/blog/ does not exist — emitting an explicit empty index."
    );
  }

  const files = existsSync(CONTENT_DIR)
    ? (await readdir(CONTENT_DIR))
        .filter((name) => name.endsWith(".md"))
        .sort()
    : [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const filePath = path.join(CONTENT_DIR, file);
    const source = await readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(source);

    const record = {
      ...data,
      body
    };

    if (!SLUG_PATTERN.test(slug)) {
      fail(file, `filename must match ${SLUG_PATTERN} (got "${slug}")`);
      continue;
    }

    if (!validatePost(record, file)) {
      continue;
    }

    const { html, headings } = renderMarkdown(body);

    const wordCount = countWords(body);
    const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

    const tags = Array.from(
      new Set(
        (Array.isArray(record.tags) ? record.tags : [])
          .map((tag) => String(tag).trim())
          .filter((tag) => tag.length > 0)
      )
    );

    const cover =
      record.cover && typeof record.cover.src === "string"
        ? {
            src: `${BASE_PATH}${record.cover.src}`,
            alt: String(record.cover.alt),
            width: record.cover.width,
            height: record.cover.height,

            /*
             * Social-image twin (og:image / twitter:image). SVG covers
             * are crisp on the page but poorly rendered by social
             * crawlers, so each cover carries a PNG twin at the same
             * path with the extension swapped. ROOT-RELATIVE and
             * deliberately NOT basePath-prefixed: this value is used
             * for metadata only, where Next resolves URLs against the
             * production metadataBase.
             */
            ogSrc: coverOgSrc(record.cover.src)
          }
        : null;

    posts.push({
      slug,
      search: buildSearchHaystack(record),
      title: String(record.title).trim(),
      subtitle:
        typeof record.subtitle === "string" && record.subtitle.trim() !== ""
          ? record.subtitle.trim()
          : null,
      excerpt: String(record.excerpt).trim(),
      description:
        typeof record.description === "string" &&
        record.description.trim() !== ""
          ? record.description.trim()
          : String(record.excerpt).trim(),
      date: record.date,
      updated:
        typeof record.updated === "string" ? record.updated : null,
      author: String(record.author).trim(),
      category: record.category,
      type: record.type,
      tags,

      /*
       * Optional relationship metadata (v2.5). `explicitRelated` is
       * author-declared order (validated below); `project` and
       * `topics` feed the deterministic scoring model. `terms` powers
       * the subject-similarity signal and is NOT emitted.
       */
      explicitRelated: Array.isArray(record.related)
        ? [...new Set(record.related.map((slug) => String(slug).trim()))]
        : [],
      project:
        typeof record.project === "string" && record.project.trim() !== ""
          ? record.project.trim()
          : null,
      topics: Array.from(
        new Set(
          (Array.isArray(record.topics) ? record.topics : [])
            .map((topic) => String(topic).trim())
            .filter((topic) => topic.length > 0)
        )
      ),
      terms: significantTerms(record),

      readingMinutes,
      readingTime: `${readingMinutes} min read`,
      wordCount,
      featured: record.featured === true,
      cover,
      html,
      headings
    });

    rawBodies.set(slug, body);
    headingsBySlug.set(
      slug,
      new Set(headings.map((heading) => heading.id))
    );
  }

  /* Internal link validation runs after all slugs are known. */
  const validSlugs = new Set(posts.map((post) => post.slug));
  const slugSeen = new Set();
  for (const post of posts) {
    if (slugSeen.has(post.slug)) {
      fail(`${post.slug}.md`, "duplicate slug");
      continue;
    }
    slugSeen.add(post.slug);
    checkInternalLinks(
      String(rawBodies.get(post.slug) ?? ""),
      validSlugs,
      headingsBySlug,
      `${post.slug}.md`
    );
  }

  /*
   * Explicit relationship graph validation (v2.5): every declared
   * `related` slug must exist, must not be the article itself, and
   * must not repeat. Failures name the file and the offending slug.
   */
  for (const post of posts) {
    for (const relatedSlug of post.explicitRelated) {
      if (relatedSlug === post.slug) {
        fail(
          `${post.slug}.md`,
          `related list contains a self-link: ${relatedSlug}`
        );
        continue;
      }
      if (!validSlugs.has(relatedSlug)) {
        fail(
          `${post.slug}.md`,
          `related list points to unknown article: ${relatedSlug}`
        );
      }
    }
  }

  /*
   * SEO asset validation: the site-level social image must exist
   * before any page can claim an og:image. Fails loudly with the
   * expected path.
   */
  if (!existsSync(SITE_OG_IMAGE_FILE)) {
    fail(
      "public/og-default.png",
      `site social image not found: ${SITE_OG_IMAGE_PATH} (og:image for home and blog routes requires it)`
    );
  }

  if (failures.length > 0) {
    console.error("\n[blog] CONTENT PIPELINE FAILED:\n");
    console.error(failures.join("\n"));
    console.error(`\n[blog] ${failures.length} invalid record(s). Build aborted.`);
    process.exit(1);
  }

  /* Deterministic order: date descending, then slug ascending. */
  posts.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? -1 : 1
  );

  /*
   * Recency rank for the related tie-break: 0 = newest. Computed
   * AFTER the deterministic sort so it is stable across runs.
   */
  posts.forEach((post, index) => {
    post.recencyRank = index;
  });

  const chronologicalAsc = [...posts].reverse();

  const tagIndex = {};
  const categoryIndex = {};
  for (const post of posts) {
    for (const tag of post.tags) {
      (tagIndex[tag] ??= []).push(post.slug);
    }
    (categoryIndex[post.category] ??= []).push(post.slug);
  }

  const data = {
    version: 2,
    generatedAt: generatedAt.toISOString(),
    basePath: BASE_PATH,
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    siteDescription: SITE_DESCRIPTION,
    posts: posts.map((post) => {
      const {
        terms: _terms,
        recencyRank: _recencyRank,
        explicitRelated: _explicitRelated,
        ...emitted
      } = post;
      return emitted;
    }),
    indexes: {
      tags: tagIndex,
      categories: categoryIndex,
      related: buildRelated(posts),
      adjacent: buildAdjacent(chronologicalAsc),
      linksHere: buildLinksHere(posts)
    }
  };

  /*
   * INBOUND GRAPH Δ (v2.5.6) — before the new posts.json overwrites
   * the previous one, diff this build's reverse-link counts against
   * the stored graph and surface every change in the build log.
   *
   * The inbound badge counts ARE the link graph's public face (index
   * cards, article header pills), so when an edit adds or removes a
   * cross-link between articles the effect lands in the UI silently.
   * This log makes the movement explicit for the author at the exact
   * moment it happens — the same spirit as the links-here build line,
   * but as a per-article ledger instead of a single total.
   *
   * Deterministic: slugs are visited in sorted order; a slug present
   * only in the old graph (article deleted) reads as "N → 0"; a slug
   * present only in the new graph (first links) reads as "0 → N".
   * The very first build (no previous posts.json) says so and skips
   * the ledger rather than printing five "0 → N" rows that mean
   * nothing yet.
   */
  const nextInboundCounts = Object.fromEntries(
    Object.entries(data.indexes.linksHere).map(([slug, sources]) => [
      slug,
      sources.length
    ])
  );

  let previousInboundCounts = null;

  try {
    const previousRaw = JSON.parse(
      await readFile(path.join(DATA_DIR, "posts.json"), "utf8")
    );

    previousInboundCounts = Object.fromEntries(
      Object.entries(previousRaw.indexes?.linksHere ?? {}).map(
        ([slug, sources]) => [slug, sources.length]
      )
    );
  } catch {
    /* no previous graph — first build on this checkout */
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    path.join(DATA_DIR, "posts.json"),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8"
  );

  const sitemap = buildSitemap(posts);
  await writeFile(
    path.join(ROOT, "public", "sitemap.xml"),
    sitemap,
    "utf8"
  );

  const featuredCount = posts.filter((post) => post.featured).length;
  const tagCount = Object.keys(tagIndex).length;
  const categoryCount = Object.keys(categoryIndex).length;
  const typeCounts = { article: 0, work: 0, research: 0 };
  for (const post of posts) {
    typeCounts[post.type] += 1;
  }
  const relatedCount = Object.values(data.indexes.related).reduce(
    (sum, entries) => sum + entries.length,
    0
  );

  console.log(
    `[blog] ${posts.length} article(s) · ${tagCount} tag(s) · ${categoryCount} category(ies) · ${featuredCount} featured`
  );
  console.log(
    `[blog] content types: ${typeCounts.article} article · ${typeCounts.work} work · ${typeCounts.research} research`
  );
  console.log(`[blog] wrote data/blog/posts.json (${posts.length} posts)`);
  console.log(
    `[blog] related graph: ${relatedCount} edge(s) across ${Object.keys(data.indexes.related).length} article(s)`
  );
  const linksHereCount = Object.values(data.indexes.linksHere).reduce(
    (sum, entries) => sum + entries.length,
    0
  );
  console.log(
    `[blog] links-here graph: ${linksHereCount} inbound edge(s) across ${Object.keys(data.indexes.linksHere).length} article(s)`
  );

  /* INBOUND GRAPH Δ (v2.5.6) — the per-article ledger (see above). */
  if (previousInboundCounts === null) {
    console.log("[blog] inbound Δ: first build — no previous graph to diff");
  } else {
    const deltaSlugs = [
      ...new Set([
        ...Object.keys(previousInboundCounts),
        ...Object.keys(nextInboundCounts)
      ])
    ].sort();

    const deltaLines = deltaSlugs
      .map((slug) => {
        const before = previousInboundCounts[slug] ?? 0;
        const after = nextInboundCounts[slug] ?? 0;

        return before === after ? null : `  ${slug}: ${before} → ${after}`;
      })
      .filter(Boolean);

    console.log(
      deltaLines.length > 0
        ? `[blog] inbound Δ:\n${deltaLines.join("\n")}`
        : "[blog] inbound Δ: no changes"
    );
  }
  console.log(
    `[blog] wrote public/sitemap.xml (${sitemapUrlCount(posts.length)} URL(s))`
  );
  console.log(`[blog] basePath: "${BASE_PATH}" (GITHUB_ACTIONS=${IS_GITHUB_ACTIONS})`);

  if (posts.length === 0) {
    console.warn(
      "[blog] no articles found — the blog will render its empty state."
    );
  }
}

main().catch((error) => {
  console.error("[blog] unexpected pipeline failure:", error);
  process.exit(1);
});
