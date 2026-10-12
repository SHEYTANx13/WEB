import type { Metadata } from "next";

import LivingShell from "@/components/LivingShell";

import { getHomeWritingPosts } from "@/lib/homeWriting";

import {
  HOME_TITLE,
  JsonLd,
  homeWebPageEntity
} from "@/lib/seo";

/*
 * The world shell: one route, six hash scenes. The scenes are an
 * interaction architecture, not separate documents, so this page
 * carries exactly ONE WebPage object for the single canonical URL.
 * Concepts that deserve independent indexing (framework articles)
 * live as real /blog/<slug>/ routes instead of hash URLs.
 */

export const metadata: Metadata = {
  title: HOME_TITLE
};

export default function Home() {
  /*
   * SERVER-SIDE WRITING SELECTION (v3.0): the strongest articles
   * are picked here, on the server, from the blog content index and
   * passed down as serializable props. The home scene renders them
   * into the exported HTML without ever importing the server-only
   * blog data layer into the client graph.
   */
  const writingPosts = getHomeWritingPosts();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [homeWebPageEntity()]
        }}
      />

      <LivingShell writingPosts={writingPosts} />
    </>
  );
}
