/**
 * Geometry processing with Turf.js + d3-geo projection.
 * Classify → simplify → filter → clip → project into SVG space.
 */

import * as turf from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { GeoProjection } from "d3-geo";
import { createMapProjection } from "./Projection";
import type {
  BBox,
  BuildingFeature,
  ProcessedOsmMap,
  RoadFeature,
  WaterFeature,
} from "./types";

const ROAD_WIDTH: Record<string, number> = {
  motorway: 16,
  motorway_link: 12,
  trunk: 14,
  trunk_link: 11,
  primary: 12,
  primary_link: 9,
  secondary: 9,
  secondary_link: 7,
  tertiary: 7,
  tertiary_link: 5.5,
  unclassified: 5,
  residential: 5,
  living_street: 4.5,
  pedestrian: 4,
  service: 3,
  track: 2.5,
  path: 2,
  footway: 1.75,
  cycleway: 2,
  steps: 1.5,
  corridor: 2,
};

const MIN_BUILDING_AREA_M2 = 35;
const SIMPLIFY_TOLERANCE_DEG = 0.000012;

function asProps(f: Feature): Record<string, unknown> {
  return (f.properties ?? {}) as Record<string, unknown>;
}

function roadWidth(highway: string | undefined): number {
  if (!highway) return 4;
  return ROAD_WIDTH[highway] ?? 4;
}

function isRoad(f: Feature): boolean {
  const h = asProps(f).highway;
  return typeof h === "string" && h.length > 0;
}

function isBuilding(f: Feature): boolean {
  const b = asProps(f).building;
  return b !== undefined && b !== null && b !== "no" && b !== false;
}

function isWater(f: Feature): boolean {
  const p = asProps(f);
  if (typeof p.waterway === "string") return true;
  if (p.natural === "water") return true;
  if (p.landuse === "basin" || p.landuse === "reservoir") return true;
  if (p.water !== undefined && p.water !== null && p.water !== "no") return true;
  return false;
}

function cloneFeature<G extends Geometry>(
  f: Feature,
  geometry: G,
  properties: Record<string, unknown>,
): Feature<G> {
  return {
    type: "Feature",
    geometry,
    properties,
    ...(f.id !== undefined ? { id: f.id } : {}),
  };
}

function projectCoords(
  coords: Position,
  projection: GeoProjection,
): Position {
  const [x, y] = projection(coords as [number, number]) ?? [0, 0];
  return [x, y];
}

function projectRing(
  ring: Position[],
  projection: GeoProjection,
): Position[] {
  return ring.map((c) => projectCoords(c, projection));
}

function projectGeometry(
  geometry: Geometry,
  projection: GeoProjection,
): Geometry | null {
  switch (geometry.type) {
    case "Point":
      return {
        type: "Point",
        coordinates: projectCoords(geometry.coordinates, projection),
      };
    case "MultiPoint":
      return {
        type: "MultiPoint",
        coordinates: geometry.coordinates.map((c) =>
          projectCoords(c, projection),
        ),
      };
    case "LineString":
      return {
        type: "LineString",
        coordinates: projectRing(geometry.coordinates, projection),
      };
    case "MultiLineString":
      return {
        type: "MultiLineString",
        coordinates: geometry.coordinates.map((line) =>
          projectRing(line, projection),
        ),
      };
    case "Polygon":
      return {
        type: "Polygon",
        coordinates: geometry.coordinates.map((ring) =>
          projectRing(ring, projection),
        ),
      };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geometry.coordinates.map((poly) =>
          poly.map((ring) => projectRing(ring, projection)),
        ),
      };
    case "GeometryCollection":
      return null;
    default:
      return null;
  }
}

function simplifyFeature(f: Feature): Feature | null {
  if (!f.geometry) return null;
  try {
    if (
      f.geometry.type === "Polygon" ||
      f.geometry.type === "MultiPolygon" ||
      f.geometry.type === "LineString" ||
      f.geometry.type === "MultiLineString"
    ) {
      const simplified = turf.simplify(f, {
        tolerance: SIMPLIFY_TOLERANCE_DEG,
        highQuality: true,
      });
      return simplified as Feature;
    }
  } catch {
    return f;
  }
  return f;
}

function clipFeature(f: Feature, bbox: BBox): Feature | null {
  const [south, west, north, east] = bbox;
  const turfBbox: [number, number, number, number] = [west, south, east, north];
  try {
    const g = f.geometry;
    if (
      !g ||
      (g.type !== "LineString" &&
        g.type !== "MultiLineString" &&
        g.type !== "Polygon" &&
        g.type !== "MultiPolygon")
    ) {
      return f;
    }
    const clipped = turf.bboxClip(
      f as Feature<
        LineString | MultiLineString | Polygon | MultiPolygon
      >,
      turfBbox,
    ) as Feature;
    if (!clipped.geometry) return null;
    return clipped;
  } catch {
    return f;
  }
}

function buildingAreaM2(f: Feature): number {
  try {
    return turf.area(f);
  } catch {
    return 0;
  }
}

/**
 * Process raw GeoJSON from osmtogeojson into projected SVG-space layers.
 */
export function processOsmGeoJson(
  geojson: FeatureCollection,
  options: { bbox: BBox; width: number; height: number },
): ProcessedOsmMap {
  const { bbox, width, height } = options;
  const projection = createMapProjection({ bbox, width, height });

  const roads: RoadFeature[] = [];
  const buildings: BuildingFeature[] = [];
  const water: WaterFeature[] = [];

  for (const raw of geojson.features) {
    if (!raw.geometry) continue;

    let f: Feature | null = simplifyFeature(raw);
    if (!f) continue;
    f = clipFeature(f, bbox);
    if (!f || !f.geometry) continue;

    const projected = projectGeometry(f.geometry, projection);
    if (!projected) continue;

    const props = asProps(f);

    if (isRoad(f)) {
      if (
        projected.type !== "LineString" &&
        projected.type !== "MultiLineString"
      ) {
        continue;
      }
      const highway = String(props.highway ?? "");
      // Skip non-drivable clutter that muddies the map
      if (
        highway === "elevator" ||
        highway === "proposed" ||
        highway === "construction"
      ) {
        continue;
      }
      roads.push(
        cloneFeature(f, projected as LineString | MultiLineString, {
          highway,
          name: typeof props.name === "string" ? props.name : undefined,
          width: roadWidth(highway),
        }) as RoadFeature,
      );
      continue;
    }

    if (isBuilding(f)) {
      if (projected.type !== "Polygon" && projected.type !== "MultiPolygon") {
        continue;
      }
      if (buildingAreaM2(f) < MIN_BUILDING_AREA_M2) continue;
      buildings.push(
        cloneFeature(f, projected as Polygon | MultiPolygon, {
          name: typeof props.name === "string" ? props.name : undefined,
        }) as BuildingFeature,
      );
      continue;
    }

    if (isWater(f)) {
      const waterway =
        typeof props.waterway === "string" ? props.waterway : undefined;
      const natural =
        typeof props.natural === "string" ? props.natural : undefined;
      const isLine =
        projected.type === "LineString" ||
        projected.type === "MultiLineString";
      const isArea =
        projected.type === "Polygon" || projected.type === "MultiPolygon";
      if (!isLine && !isArea) continue;

      let width = 4;
      if (waterway === "river") width = 14;
      else if (waterway === "canal") width = 10;
      else if (waterway === "stream" || waterway === "drain") width = 3;

      water.push(
        cloneFeature(f, projected as WaterFeature["geometry"], {
          waterway,
          natural,
          kind: isArea ? "area" : "line",
          width,
        }) as WaterFeature,
      );
    }
  }

  // Wider roads drawn later (on top)
  roads.sort((a, b) => (a.properties?.width ?? 0) - (b.properties?.width ?? 0));

  return {
    width,
    height,
    bbox,
    roads: { type: "FeatureCollection", features: roads },
    buildings: { type: "FeatureCollection", features: buildings },
    water: { type: "FeatureCollection", features: water },
  };
}

/** Convert projected GeoJSON geometry into an SVG path `d` string. */
export function geometryToPath(geometry: Geometry): string {
  switch (geometry.type) {
    case "LineString":
      return ringToPath(geometry.coordinates, false);
    case "MultiLineString":
      return geometry.coordinates.map((c) => ringToPath(c, false)).join(" ");
    case "Polygon":
      return geometry.coordinates.map((c) => ringToPath(c, true)).join(" ");
    case "MultiPolygon":
      return geometry.coordinates
        .flatMap((poly) => poly.map((c) => ringToPath(c, true)))
        .join(" ");
    default:
      return "";
  }
}

function ringToPath(ring: Position[], close: boolean): string {
  if (ring.length === 0) return "";
  const [x0, y0] = ring[0];
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = ring[i];
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  if (close) d += " Z";
  return d;
}
