"use client";

import { useEffect, useMemo, useState } from "react";
import { BuildingRenderer } from "@/components/Map/osm/BuildingRenderer";
import { RoadRenderer } from "@/components/Map/osm/RoadRenderer";
import { WaterRenderer } from "@/components/Map/osm/WaterRenderer";
import {
  DEFAULT_BBOX,
  OSM_MAP_HEIGHT,
  OSM_MAP_WIDTH,
} from "@/lib/osmMap/MapLoader";
import {
  OSM_BG,
  type BBox,
  type ProcessedOsmMap,
} from "@/lib/osmMap/types";

export interface OsmMapProps {
  /** south, west, north, east */
  bbox?: BBox;
  width?: number;
  height?: number;
  className?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProcessedOsmMap };

/**
 * OSM city map — fetches real OpenStreetMap data and renders custom SVG.
 * Not a slippy map; no tiles / Leaflet / MapLibre.
 */
export function Map({
  bbox = DEFAULT_BBOX,
  width = OSM_MAP_WIDTH,
  height = OSM_MAP_HEIGHT,
  className,
}: OsmMapProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const bboxKey = useMemo(
    () => bbox.map((n) => n.toFixed(5)).join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable key from values
    [bbox[0], bbox[1], bbox[2], bbox[3]],
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });

    const params = new URLSearchParams({
      south: String(bbox[0]),
      west: String(bbox[1]),
      north: String(bbox[2]),
      east: String(bbox[3]),
      width: String(width),
      height: String(height),
    });

    const timer = window.setTimeout(() => controller.abort(), 45_000);

    fetch(`/api/osm?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | ProcessedOsmMap
          | { error?: string }
          | null;
        if (!res.ok) {
          const message =
            payload && "error" in payload && payload.error
              ? payload.error
              : `OSM load failed (${res.status})`;
          throw new Error(message);
        }
        if (!payload || !("roads" in payload)) {
          throw new Error("OSM response was empty");
        }
        return payload as ProcessedOsmMap;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.name === "AbortError"
            ? "Timed out loading OpenStreetMap. Try again in a moment."
            : err instanceof Error
              ? err.message
              : "Failed to load OSM map";
        setState({ status: "error", message });
      })
      .finally(() => {
        window.clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [bboxKey, bbox, width, height]);

  if (state.status === "loading") {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          background: OSM_BG,
          display: "grid",
          placeItems: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-ui), system-ui, sans-serif",
            fontSize: 13,
            color: "rgba(70, 82, 96, 0.75)",
          }}
        >
          Loading OpenStreetMap…
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={className}
        style={{
          width: "100%",
          height: "100%",
          background: OSM_BG,
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <p
          style={{
            margin: 0,
            maxWidth: 360,
            textAlign: "center",
            fontFamily: "var(--font-ui), system-ui, sans-serif",
            fontSize: 13,
            color: "#6B3A2A",
          }}
        >
          {state.message}
        </p>
      </div>
    );
  }

  const { data } = state;

  return (
    <svg
      aria-hidden
      className={className}
      viewBox={`0 0 ${data.width} ${data.height}`}
      preserveAspectRatio="xMidYMid meet"
      shapeRendering="geometricPrecision"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        background: OSM_BG,
      }}
    >
      <rect width={data.width} height={data.height} fill={OSM_BG} />
      <WaterRenderer water={data.water} />
      <BuildingRenderer buildings={data.buildings} />
      <RoadRenderer roads={data.roads} />
    </svg>
  );
}

export default Map;
