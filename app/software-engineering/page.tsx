import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /software-engineering/ — software engineering topic hub (v3.1).
 * Structure is shared (HubPageView); this file owns the route,
 * metadata, and definition lookup.
 */

const hub = requireHub("software-engineering");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "Software engineering notes and systems by Parsa Tak — deterministic pipelines, honest testing, static architecture"
});

export default function SoftwareEngineeringHubPage() {
  return <HubPageView hub={hub} />;
}
