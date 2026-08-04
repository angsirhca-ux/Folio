"use client";

import { geometryToPath } from "@/lib/osmMap/Geometry";
import { OSM_BUILDING } from "@/lib/osmMap/types";
import type { ProcessedOsmMap } from "@/lib/osmMap/types";

interface BuildingRendererProps {
  buildings: ProcessedOsmMap["buildings"];
}

/**
 * Renders OSM buildings as filled polygons (no networking).
 */
export function BuildingRenderer({ buildings }: BuildingRendererProps) {
  return (
    <g fill={OSM_BUILDING} stroke="none">
      {buildings.features.map((f, i) => {
        if (!f.geometry) return null;
        const d = geometryToPath(f.geometry);
        if (!d) return null;
        return (
          <path
            key={typeof f.id === "string" || typeof f.id === "number" ? f.id : i}
            d={d}
          />
        );
      })}
    </g>
  );
}
