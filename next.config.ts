import type { NextConfig } from "next";

import { readFileSync } from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

/*
 * CANONICAL BASE PATH (SEO v2 hardening, v2.1): the deployment prefix
 * is declared once in data/routes.json (site.basePath) and read here —
 * next.config, the blog pipeline and the verifiers all resolve the
 * same value, so the registry is the single place it can change.
 */
const registryPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "data",
  "routes.json"
);

const registryBasePath = (
  JSON.parse(readFileSync(registryPath, "utf8")) as {
    site: { basePath: string };
  }
).site.basePath;

const nextConfig: NextConfig = {
  output: "export",

  basePath: isGitHubPages ? registryBasePath : "",

  trailingSlash: true,

  images: {
    unoptimized: true
  },

  reactStrictMode: true,

  poweredByHeader: false,

  /*
   * Exposed so plain anchors that cannot use next/link can build
   * basePath-aware URLs at render time (app/not-found.tsx uses this
   * to stay inside the deployment prefix). Inlined at build time,
   * mirroring the basePath decision above and the blog pipeline's
   * GITHUB_ACTIONS detection.
   *
   * RED_MAGIC_TIMING is defaulted to "0" so Next ALWAYS inlines a
   * literal: default builds compile the engine's measurement gate to
   * `false` before minification (dead-code eliminated — nothing
   * measurement-related ships), while
   * `NEXT_PUBLIC_RED_MAGIC_TIMING=1 npm run build` inlines "1" and
   * compiles the subsystem profiling in.
   */
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? registryBasePath : "",

    NEXT_PUBLIC_RED_MAGIC_TIMING:
      process.env.NEXT_PUBLIC_RED_MAGIC_TIMING === "1" ? "1" : "0"
  },

  experimental: {
    optimizePackageImports: ["react", "react-dom"]
  }
};

export default nextConfig;
