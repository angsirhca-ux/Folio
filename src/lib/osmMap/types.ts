/** Shared types for the OSM → SVG map pipeline. */

import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
} from "geojson";

/** south, west, north, east — Overpass / GeoJSON bbox order. */
export type BBox = [south: number, west: number, north: number, east: number];

export type RoadFeature = Feature<
  LineString | MultiLineString,
  { highway?: string; name?: string; width: number }
>;

export type BuildingFeature = Feature<
  Polygon | MultiPolygon,
  { name?: string }
>;

export type WaterFeature = Feature<
  Polygon | MultiPolygon | LineString | MultiLineString,
  { waterway?: string; natural?: string; kind: "area" | "line"; width: number }
>;

export interface ProcessedOsmMap {
  width: number;
  height: number;
  bbox: BBox;
  roads: FeatureCollection<RoadFeature["geometry"], RoadFeature["properties"]>;
  buildings: FeatureCollection<
    BuildingFeature["geometry"],
    BuildingFeature["properties"]
  >;
  water: FeatureCollection<WaterFeature["geometry"], WaterFeature["properties"]>;
}

export type AnyGeom = Geometry;

export const OSM_MAP_WIDTH = 1600;
export const OSM_MAP_HEIGHT = 1200;

/** Cream paper */
export const OSM_BG = "#F7F3EA";
/** Buildings */
export const OSM_BUILDING = "#AEB9C5";
/** Roads */
export const OSM_ROAD = "#FFFFFF";
/** Rivers / water */
export const OSM_WATER = "#4D9BC7";

/**
 * Default viewport — compact Amsterdam Jordaan slice (loads quickly).
 * Configurable via MapLoader / Map props /api/osm query.
 */
export const DEFAULT_BBOX: BBox = [52.3708, 4.8775, 52.3762, 4.8905];
