import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /ai-evaluation/ — AI evaluation topic hub (v3.1). Structure is
 * shared (HubPageView); this file owns the route, metadata, and
 * definition lookup.
 */

const hub = requireHub("ai-evaluation");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "AI evaluation and benchmarks by Parsa Tak — UHIT, AIST-2026.09, ASI-100-Elite, verification-first measurement"
});

export default function AiEvaluationHubPage() {
  return <HubPageView hub={hub} />;
}
