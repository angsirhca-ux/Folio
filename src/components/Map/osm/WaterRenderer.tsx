"use client";

import { geometryToPath } from "@/lib/osmMap/Geometry";
import { OSM_WATER } from "@/lib/osmMap/types";
import type { ProcessedOsmMap } from "@/lib/osmMap/types";

interface WaterRendererProps {
  water: ProcessedOsmMap["water"];
}

/**
 * Renders OSM water areas and waterways (no networking).
 */
export function WaterRenderer({ water }: WaterRendererProps) {
  return (
    <g>
      {water.features.map((f, i) => {
        if (!f.geometry) return null;
        const d = geometryToPath(f.geometry);
        if (!d) return null;
        const key =
          typeof f.id === "string" || typeof f.id === "number" ? f.id : i;
        const kind = f.properties?.kind ?? "area";

        if (kind === "line") {
          return (
            <path
              key={key}
              d={d}
              fill="none"
              stroke={OSM_WATER}
              strokeWidth={f.properties?.width ?? 4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }

        return <path key={key} d={d} fill={OSM_WATER} stroke="none" />;
      })}
    </g>
  );
}
