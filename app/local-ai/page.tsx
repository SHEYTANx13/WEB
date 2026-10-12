import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /local-ai/ — Local AI topic hub (v3.1). The document structure is
 * shared (HubPageView); this file owns the route, its metadata, and
 * the definition lookup. A missing definition is a build-time
 * failure, never a silently thin page.
 */

const hub = requireHub("local-ai");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "Local AI systems and agents by Parsa Tak — local-first agents, managed inference, verification"
});

export default function LocalAiHubPage() {
  return <HubPageView hub={hub} />;
}
