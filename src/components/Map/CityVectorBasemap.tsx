"use client";

import { Map as OsmMap } from "@/components/Map/osm/Map";

/**
 * City corkboard basemap — real OSM streets/buildings rendered as custom SVG.
 */
export function CityVectorBasemap() {
  return (
    <OsmMap className="pointer-events-none absolute inset-0 h-full w-full select-none" />
  );
}
