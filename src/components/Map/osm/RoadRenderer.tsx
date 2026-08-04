"use client";

import { geometryToPath } from "@/lib/osmMap/Geometry";
import { OSM_ROAD } from "@/lib/osmMap/types";
import type { ProcessedOsmMap } from "@/lib/osmMap/types";

interface RoadRendererProps {
  roads: ProcessedOsmMap["roads"];
}

/**
 * Renders OSM highways as white SVG strokes (no networking).
 */
export function RoadRenderer({ roads }: RoadRendererProps) {
  return (
    <g
      fill="none"
      stroke={OSM_ROAD}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {roads.features.map((f, i) => {
        if (!f.geometry) return null;
        const d = geometryToPath(f.geometry);
        if (!d) return null;
        return (
          <path
            key={typeof f.id === "string" || typeof f.id === "number" ? f.id : i}
            d={d}
            strokeWidth={f.properties?.width ?? 4}
          />
        );
      })}
    </g>
  );
}
