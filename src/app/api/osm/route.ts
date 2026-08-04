import { NextResponse } from "next/server";
import { loadOsmMap } from "@/lib/osmMap/MapLoader";
import {
  DEFAULT_BBOX,
  OSM_MAP_HEIGHT,
  OSM_MAP_WIDTH,
  type BBox,
  type ProcessedOsmMap,
} from "@/lib/osmMap/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cache = new Map<string, { at: number; data: ProcessedOsmMap }>();
const CACHE_TTL_MS = 1000 * 60 * 30;

function parseBbox(url: URL): BBox {
  const south = Number(url.searchParams.get("south"));
  const west = Number(url.searchParams.get("west"));
  const north = Number(url.searchParams.get("north"));
  const east = Number(url.searchParams.get("east"));
  if ([south, west, north, east].every((n) => Number.isFinite(n))) {
    return [south, west, north, east];
  }
  return DEFAULT_BBOX;
}

/**
 * GET /api/osm?south&west&north&east&width&height
 * Downloads OSM via Overpass, converts to projected GeoJSON layers.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const bbox = parseBbox(url);
    const width = Number(url.searchParams.get("width")) || OSM_MAP_WIDTH;
    const height = Number(url.searchParams.get("height")) || OSM_MAP_HEIGHT;
    const key = `${bbox.join(",")}:${width}x${height}`;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.data);
    }

    const data = await loadOsmMap({ bbox, width, height });
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load OpenStreetMap data";
    console.error("[api/osm]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
