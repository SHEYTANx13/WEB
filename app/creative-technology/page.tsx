import type { Metadata } from "next";

import { contentRouteMetadata, requireHub } from "@/lib/hubs";

import HubPageView from "@/components/content/HubPageView";

/*
 * /creative-technology/ — creative technology topic hub (v3.1).
 * Structure is shared (HubPageView); this file owns the route,
 * metadata, and definition lookup.
 */

const hub = requireHub("creative-technology");

export const metadata: Metadata = contentRouteMetadata({
  route: hub.slug,
  title: hub.metaTitle,
  description: hub.metaDescription,
  ogAlt: "Creative technology by Parsa Tak — RED MAGIC, the living web, and computational interfaces"
});

export default function CreativeTechnologyHubPage() {
  return <HubPageView hub={hub} />;
}
