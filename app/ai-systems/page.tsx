import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /ai-systems/ — AI systems engineering topic hub (v3.1). Structure
 * is shared (HubPageView); this file owns the route, metadata, and
 * definition lookup.
 */

const hub = requireHub("ai-systems");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "AI systems engineering by Parsa Tak — constitutional frameworks, governed agents, verification"
});

export default function AiSystemsHubPage() {
  return <HubPageView hub={hub} />;
}
