import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /ai-reasoning/ — AI reasoning topic hub (v3.1). Structure is shared
 * (HubPageView); this file owns the route, metadata, and definition
 * lookup.
 */

const hub = requireHub("ai-reasoning");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "AI reasoning architectures by Parsa Tak — the Reasoning Enhancement Protocol and verification-first design"
});

export default function AiReasoningHubPage() {
  return <HubPageView hub={hub} />;
}
