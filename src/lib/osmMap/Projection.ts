/**
 * Geographic projection — lon/lat → SVG coordinates via d3-geo.
 */

import { geoMercator, type GeoProjection } from "d3-geo";
import type { BBox } from "./types";

export interface ProjectionOptions {
  bbox: BBox;
  width: number;
  height: number;
  /** Padding inside the SVG viewport (px). */
  padding?: number;
}

/**
 * Mercator projection fitted to the bbox and SVG size.
 *
 * Uses a MultiPoint of the bbox corners for fitExtent — fitting a Polygon
 * under default Mercator clipping collapses dense city-scale extents.
 */
export function createMapProjection(options: ProjectionOptions): GeoProjection {
  const { bbox, width, height, padding = 8 } = options;
  const [south, west, north, east] = bbox;

  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    {
      type: "MultiPoint",
      coordinates: [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
      ],
    },
  );
}

/** Project a single [lon, lat] position into SVG [x, y]. */
export function projectPosition(
  projection: GeoProjection,
  lon: number,
  lat: number,
): [number, number] {
  const p = projection([lon, lat]);
  if (!p) return [0, 0];
  return [p[0], p[1]];
}
