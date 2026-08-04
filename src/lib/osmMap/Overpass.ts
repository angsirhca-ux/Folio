/**
 * Overpass API client — downloads highways, buildings, and water for a bbox.
 */

import type { BBox } from "./types";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface OsmJson {
  version?: number;
  generator?: string;
  elements: unknown[];
}

function bboxClause(bbox: BBox): string {
  const [south, west, north, east] = bbox;
  return `${south},${west},${north},${east}`;
}

/**
 * Lean Overpass QL — ways only + `out geom` (no full node recurse).
 * Much faster / less likely to hang than `(._;>;); out body`.
 */
export function buildOverpassQuery(bbox: BBox): string {
  const b = bboxClause(bbox);
  return `
[out:json][timeout:25];
(
  way["highway"](${b});
  way["building"](${b});
  way["waterway"](${b});
  way["natural"="water"](${b});
  way["water"](${b});
);
out geom;
`.trim();
}

/**
 * Fetch raw OSM JSON for the bounding box from a public Overpass endpoint.
 */
export async function fetchOsmForBbox(bbox: BBox): Promise<OsmJson> {
  const query = buildOverpassQuery(bbox);
  let lastError: Error | null = null;

  for (const url of OVERPASS_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "FolioNovelStudio/0.1 (OSM city basemap; local app)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new Error(`Overpass ${res.status}: ${await res.text()}`);
        continue;
      }
      const json = (await res.json()) as OsmJson;
      if (!json.elements?.length) {
        lastError = new Error("Overpass returned no map elements for this area");
        continue;
      }
      return json;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error(`Overpass timed out (${url})`);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Overpass request failed");
}
