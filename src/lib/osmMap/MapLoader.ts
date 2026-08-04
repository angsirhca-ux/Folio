/**
 * MapLoader — Overpass → osmtogeojson → Turf/d3 processing.
 * Networking + conversion live here; renderers only receive ProcessedOsmMap.
 */

import osmtogeojson from "osmtogeojson";
import type { FeatureCollection } from "geojson";
import { processOsmGeoJson } from "./Geometry";
import { fetchOsmForBbox } from "./Overpass";
import {
  DEFAULT_BBOX,
  OSM_MAP_HEIGHT,
  OSM_MAP_WIDTH,
  type BBox,
  type ProcessedOsmMap,
} from "./types";

export interface LoadOsmMapOptions {
  bbox?: BBox;
  width?: number;
  height?: number;
  /** Optional pre-fetched OSM JSON (skips Overpass). */
  osmJson?: unknown;
}

/**
 * Download OSM for a bbox and return SVG-projected GeoJSON layers.
 */
export async function loadOsmMap(
  options: LoadOsmMapOptions = {},
): Promise<ProcessedOsmMap> {
  const bbox = options.bbox ?? DEFAULT_BBOX;
  const width = options.width ?? OSM_MAP_WIDTH;
  const height = options.height ?? OSM_MAP_HEIGHT;

  const osmJson = options.osmJson ?? (await fetchOsmForBbox(bbox));
  const geojson = osmtogeojson(osmJson as Parameters<typeof osmtogeojson>[0], {
    flatProperties: true,
  }) as FeatureCollection;

  return processOsmGeoJson(geojson, { bbox, width, height });
}

export { DEFAULT_BBOX, OSM_MAP_WIDTH, OSM_MAP_HEIGHT };
