"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Circle,
  ImagePlus,
  MapPin,
  Maximize2,
  Minus,
  Mountain,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
import { MapSwitcher } from "@/components/Map/MapSwitcher";
import { useBook } from "@/providers/BookProvider";
import {
  buildMapFromStoryWithClaude,
  useClaudeStatus,
} from "@/hooks/useClaudeEnrichment";
import {
  applyMapLayoutConnections,
} from "@/lib/mapLayout";
import {
  applyMapBackground,
  clearMapBackground,
  createMapPin,
  createMapRegion,
  emptyStoryMap,
  expandMapPins,
  MAP_REGION_KIND_META,
  MAP_REGION_SHAPE_META,
  MAP_TERRITORY_PALETTE,
  pinBounds,
  prepareMapBackground,
  regionOutlineStyle,
  territoryStyle,
  unplacedLocations,
} from "@/lib/map";
import {
  LOCATION_KIND_META,
  povColor,
  type Location,
  type StoryMapPin,
  type StoryMapRegion,
  type StoryMapRegionKind,
  type StoryMapRegionShape,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DRAW_KINDS: StoryMapRegionKind[] = ["territory", "mountains", "water"];
const REGION_SHAPES: StoryMapRegionShape[] = ["rect", "ellipse", "soft"];
type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

const RESIZE_HANDLES: {
  id: ResizeHandle;
  left: string;
  top: string;
  cursor: string;
}[] = [
  { id: "nw", left: "0%", top: "0%", cursor: "nwse-resize" },
  { id: "n", left: "50%", top: "0%", cursor: "ns-resize" },
  { id: "ne", left: "100%", top: "0%", cursor: "nesw-resize" },
  { id: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { id: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { id: "s", left: "50%", top: "100%", cursor: "ns-resize" },
  { id: "sw", left: "0%", top: "100%", cursor: "nesw-resize" },
  { id: "w", left: "0%", top: "50%", cursor: "ew-resize" },
];

function screenDeltaToLocal(
  dxScreen: number,
  dyScreen: number,
  rotationDeg: number,
  mapW: number,
  mapH: number,
  zoom: number,
) {
  const dx = dxScreen / (zoom * mapW);
  const dy = dyScreen / (zoom * mapH);
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function applyRegionResize(
  orig: { x: number; y: number; w: number; h: number },
  handle: ResizeHandle,
  localDx: number,
  localDy: number,
): { x: number; y: number; w: number; h: number } {
  const min = 0.06;
  let { x, y, w, h } = orig;
  if (handle.includes("e")) {
    w = Math.min(1 - orig.x, Math.max(min, orig.w + localDx));
  }
  if (handle.includes("s")) {
    h = Math.min(1 - orig.y, Math.max(min, orig.h + localDy));
  }
  if (handle.includes("w")) {
    const nextW = Math.max(min, Math.min(orig.x + orig.w, orig.w - localDx));
    x = orig.x + orig.w - nextW;
    w = nextW;
    if (x < 0) {
      w = Math.max(min, w + x);
      x = 0;
    }
  }
  if (handle.includes("n")) {
    const nextH = Math.max(min, Math.min(orig.y + orig.h, orig.h - localDy));
    y = orig.y + orig.h - nextH;
    h = nextH;
    if (y < 0) {
      h = Math.max(min, h + y);
      y = 0;
    }
  }
  return {
    x: Math.min(1 - min, Math.max(0, x)),
    y: Math.min(1 - min, Math.max(0, y)),
    w: Math.min(1 - x, Math.max(min, w)),
    h: Math.min(1 - y, Math.max(min, h)),
  };
}

function normalizeDeg(deg: number): number {
  let r = deg % 360;
  if (r < 0) r += 360;
  return Math.round(r * 10) / 10;
}


/** Simple map glyphs — peaks and wave lines, readable at a glance. */
function RegionFeatureGlyphs({
  kind,
  regionId,
  w,
  h,
}: {
  kind: StoryMapRegionKind;
  regionId: string;
  w: number;
  h: number;
}) {
  if (kind === "territory") return null;

  if (kind === "mountains") {
    const peaks = Math.min(8, Math.max(2, Math.round(w * 16)));
    const rows = Math.min(3, Math.max(1, Math.round(h * 9)));
    const glyphs: {
      key: string;
      left: string;
      top: string;
      size: number;
    }[] = [];
    for (let row = 0; row < rows; row++) {
      const count = Math.max(2, peaks - row);
      for (let i = 0; i < count; i++) {
        const left = ((i + 0.55) / count) * 100 + (row % 2 === 1 ? 3.5 : 0);
        const top = 30 + (row / Math.max(1, rows)) * 48;
        const size = 22 + ((i * 3 + row * 5) % 11);
        glyphs.push({
          key: `${row}-${i}`,
          left: `${Math.min(94, Math.max(6, left))}%`,
          top: `${top}%`,
          size,
        });
      }
    }
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {glyphs.map((g) => (
          <svg
            key={g.key}
            width={g.size}
            height={g.size * 0.85}
            viewBox="0 0 32 28"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: g.left, top: g.top }}
            aria-hidden
          >
            <path
              d="M2 26 L16 2 L30 26 Z"
              fill="rgba(78,84,90,0.42)"
              stroke="rgba(52,58,64,0.62)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M10 26 L18 10 L26 26"
              fill="none"
              stroke="rgba(52,58,64,0.4)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="M16 2 L20 10 L16 8 L12 12 Z" fill="rgba(247,243,234,0.7)" />
          </svg>
        ))}
      </div>
    );
  }

  const waveRows = Math.min(7, Math.max(3, Math.round(h * 20)));
  const gradId = `water-sheen-${regionId}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden rounded-[1.75rem]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(210,230,240,0.35)" />
          <stop offset="55%" stopColor="rgba(70,130,160,0.12)" />
          <stop offset="100%" stopColor="rgba(40,100,140,0.18)" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      {Array.from({ length: waveRows }, (_, i) => {
        const y = 20 + ((i + 0.5) / waveRows) * 70;
        const amp = 2.4 + (i % 3) * 0.45;
        const phase = (i % 2) * 7;
        const d = [
          `M ${-8 + phase} ${y}`,
          `Q ${10 + phase} ${y - amp} ${26 + phase} ${y}`,
          `T ${54 + phase} ${y}`,
          `T ${82 + phase} ${y}`,
          `T ${110 + phase} ${y}`,
        ].join(" ");
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={
              i % 2 === 0 ? "rgba(40,100,135,0.48)" : "rgba(75,135,165,0.36)"
            }
            strokeWidth={1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 4.5;

type DragState =
  | {
      kind: "pan";
      startX: number;
      startY: number;
      origPanX: number;
      origPanY: number;
    }
  | {
      kind: "pin";
      pinId: string;
      startX: number;
      startY: number;
      origPinX: number;
      origPinY: number;
    }
  | {
      kind: "draw-region";
      startMapX: number;
      startMapY: number;
    }
  | {
      kind: "move-region";
      regionId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: "resize-region";
      regionId: string;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
      origRotation: number;
    }
  | {
      kind: "rotate-region";
      regionId: string;
      centerMapX: number;
      centerMapY: number;
      startAngle: number;
      origRotation: number;
    };

export function MapPage() {
  const router = useRouter();
  const {
    book,
    hydrated,
    upsertMapPin,
    removeMapPin,
    upsertMapRegion,
    removeMapRegion,
    autoPlaceMapPins,
    updateStoryMap,
    takeBookSnapshot,
    upsertLocations,
    replaceLocation,
  } = useBook();
  const claude = useClaudeStatus();
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [basemapBusy, setBasemapBusy] = useState(false);
  const [basemapError, setBasemapError] = useState<string | null>(null);
  const basemapInputRef = useRef<HTMLInputElement>(null);

  const locations = book.locations ?? [];
  const map = book.map ?? emptyStoryMap();
  const locById = useMemo(() => {
    const m = new Map<string, Location>();
    for (const l of locations) m.set(l.id, l);
    return m;
  }, [locations]);

  const unplaced = useMemo(
    () => unplacedLocations(locations, map),
    [locations, map],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [drawKind, setDrawKind] = useState<StoryMapRegionKind | null>(null);
  const [draftRegion, setDraftRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Local mirror while dragging so we don't spam React on every move for regions. */
  const regionDragLive = useRef<StoryMapRegion | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setPan({
      x: (el.clientWidth - map.width * zoom) / 2,
      y: (el.clientHeight - map.height * zoom) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, map.width, map.height]);

  useEffect(() => {
    setSelectedPinId(null);
    setSelectedRegionId(null);
    setDrawKind(null);
    setDraftRegion(null);
    setZoom(1);
    const el = viewportRef.current;
    if (!el) return;
    setPan({
      x: (el.clientWidth - map.width) / 2,
      y: (el.clientHeight - map.height) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.activeMapId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
        const scale = next / z;
        setPan((p) => ({
          x: mx - (mx - p.x) * scale,
          y: my - (my - p.y) * scale,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  const connections = useMemo(() => {
    const lines: {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [];
    const pinByLoc = new Map(map.pins.map((p) => [p.locationId, p]));
    for (const loc of locations) {
      const from = pinByLoc.get(loc.id);
      if (!from) continue;
      for (const c of loc.connections ?? []) {
        const toId = c.toLocationId;
        if (!toId) continue;
        const to = pinByLoc.get(toId);
        if (!to) continue;
        if (loc.id > toId) continue;
        lines.push({
          key: `${loc.id}:${toId}:${c.id}`,
          x1: from.x * map.width,
          y1: from.y * map.height,
          x2: to.x * map.width,
          y2: to.y * map.height,
        });
      }
    }
    return lines;
  }, [locations, map]);

  function clientToMap(clientX: number, clientY: number) {
    const el = viewportRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    const mx = (clientX - rect.left - pan.x) / zoom;
    const my = (clientY - rect.top - pan.y) / zoom;
    return {
      x: Math.min(1, Math.max(0, mx / map.width)),
      y: Math.min(1, Math.max(0, my / map.height)),
    };
  }

  function onViewportPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-map-pin]")) return;
    if (target.closest("[data-map-region]")) return;

    if (drawKind) {
      const start = clientToMap(e.clientX, e.clientY);
      dragRef.current = {
        kind: "draw-region",
        startMapX: start.x,
        startMapY: start.y,
      };
      setDraftRegion({ x: start.x, y: start.y, w: 0, h: 0 });
      setSelectedPinId(null);
      setSelectedRegionId(null);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    dragRef.current = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelectedPinId(null);
    setSelectedRegionId(null);
  }

  function onViewportPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "pan") {
      setPan({
        x: drag.origPanX + (e.clientX - drag.startX),
        y: drag.origPanY + (e.clientY - drag.startY),
      });
      return;
    }

    if (drag.kind === "pin") {
      const deltaX = (e.clientX - drag.startX) / (zoom * map.width);
      const deltaY = (e.clientY - drag.startY) / (zoom * map.height);
      const pin = map.pins.find((p) => p.id === drag.pinId);
      if (!pin) return;
      upsertMapPin({
        ...pin,
        x: Math.min(1, Math.max(0, drag.origPinX + deltaX)),
        y: Math.min(1, Math.max(0, drag.origPinY + deltaY)),
      });
      return;
    }

    if (drag.kind === "draw-region") {
      const cur = clientToMap(e.clientX, e.clientY);
      const x = Math.min(drag.startMapX, cur.x);
      const y = Math.min(drag.startMapY, cur.y);
      const w = Math.abs(cur.x - drag.startMapX);
      const h = Math.abs(cur.y - drag.startMapY);
      setDraftRegion({ x, y, w, h });
      return;
    }

    if (drag.kind === "move-region") {
      const deltaX = (e.clientX - drag.startX) / (zoom * map.width);
      const deltaY = (e.clientY - drag.startY) / (zoom * map.height);
      const region =
        regionDragLive.current ??
        map.regions.find((r) => r.id === drag.regionId);
      if (!region) return;
      const next = {
        ...region,
        x: Math.min(1 - region.w, Math.max(0, drag.origX + deltaX)),
        y: Math.min(1 - region.h, Math.max(0, drag.origY + deltaY)),
      };
      regionDragLive.current = next;
      upsertMapRegion(next);
      return;
    }

    if (drag.kind === "resize-region") {
      const local = screenDeltaToLocal(
        e.clientX - drag.startX,
        e.clientY - drag.startY,
        drag.origRotation,
        map.width,
        map.height,
        zoom,
      );
      const region =
        regionDragLive.current ??
        map.regions.find((r) => r.id === drag.regionId);
      if (!region) return;
      const box = applyRegionResize(
        {
          x: drag.origX,
          y: drag.origY,
          w: drag.origW,
          h: drag.origH,
        },
        drag.handle,
        local.x,
        local.y,
      );
      const next = { ...region, ...box };
      regionDragLive.current = next;
      upsertMapRegion(next);
      return;
    }

    if (drag.kind === "rotate-region") {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      const angle =
        (Math.atan2(my - drag.centerMapY, mx - drag.centerMapX) * 180) /
        Math.PI;
      const region =
        regionDragLive.current ??
        map.regions.find((r) => r.id === drag.regionId);
      if (!region) return;
      const next = {
        ...region,
        rotation: normalizeDeg(
          drag.origRotation + (angle - drag.startAngle),
        ),
      };
      regionDragLive.current = next;
      upsertMapRegion(next);
    }
  }

  function onViewportPointerUp() {
    const drag = dragRef.current;
    if (drag?.kind === "draw-region" && draftRegion && drawKind) {
      if (draftRegion.w >= 0.05 && draftRegion.h >= 0.05) {
        const meta = MAP_REGION_KIND_META[drawKind];
        const n =
          map.regions.filter((r) => (r.kind ?? "territory") === drawKind)
            .length + 1;
        const region = createMapRegion({
          name: `${meta.defaultName} ${n}`,
          kind: drawKind,
          x: draftRegion.x,
          y: draftRegion.y,
          w: draftRegion.w,
          h: draftRegion.h,
        });
        upsertMapRegion(region);
        setSelectedRegionId(region.id);
        setDrawKind(null);
      }
      setDraftRegion(null);
    }
    dragRef.current = null;
    regionDragLive.current = null;
  }

  function startPinDrag(e: ReactPointerEvent, pin: StoryMapPin) {
    e.stopPropagation();
    if (drawKind) return;
    dragRef.current = {
      kind: "pin",
      pinId: pin.id,
      startX: e.clientX,
      startY: e.clientY,
      origPinX: pin.x,
      origPinY: pin.y,
    };
    setSelectedPinId(pin.locationId);
    setSelectedRegionId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startRegionMove(e: ReactPointerEvent, region: StoryMapRegion) {
    e.stopPropagation();
    if (drawKind) return;
    dragRef.current = {
      kind: "move-region",
      regionId: region.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
    };
    regionDragLive.current = region;
    setSelectedRegionId(region.id);
    setSelectedPinId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startRegionResize(
    e: ReactPointerEvent,
    region: StoryMapRegion,
    handle: ResizeHandle,
  ) {
    e.stopPropagation();
    dragRef.current = {
      kind: "resize-region",
      regionId: region.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
      origW: region.w,
      origH: region.h,
      origRotation: region.rotation ?? 0,
    };
    regionDragLive.current = region;
    setSelectedRegionId(region.id);
    setSelectedPinId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startRegionRotate(e: ReactPointerEvent, region: StoryMapRegion) {
    e.stopPropagation();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerMapX = (region.x + region.w / 2) * map.width;
    const centerMapY = (region.y + region.h / 2) * map.height;
    const mx = (e.clientX - rect.left - pan.x) / zoom;
    const my = (e.clientY - rect.top - pan.y) / zoom;
    const startAngle =
      (Math.atan2(my - centerMapY, mx - centerMapX) * 180) / Math.PI;
    dragRef.current = {
      kind: "rotate-region",
      regionId: region.id,
      centerMapX,
      centerMapY,
      startAngle,
      origRotation: region.rotation ?? 0,
    };
    regionDragLive.current = region;
    setSelectedRegionId(region.id);
    setSelectedPinId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function placeLocation(location: Location) {
    let x = 0.5;
    let y = 0.45;
    const el = viewportRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const mid = clientToMap(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      x = mid.x;
      y = mid.y;
    }
    upsertMapPin(createMapPin(location.id, x, y, location.name.trim() || undefined));
    setSelectedPinId(location.id);
    setSelectedRegionId(null);
  }

  async function buildMapFromStory() {
    setLayoutBusy(true);
    setLayoutError(null);
    setLayoutMessage("Reading the manuscript…");
    try {
      try {
        takeBookSnapshot("Before AI map build");
      } catch {
        /* quota */
      }
      setLayoutMessage("Discovering places & laying out geography…");
      const result = await buildMapFromStoryWithClaude(book);

      if (result.locationsToAdd.length > 0) {
        upsertLocations(result.locationsToAdd);
      }

      const roster = [
        ...(book.locations ?? []).filter(
          (l) => !result.locationsToAdd.some((a) => a.id === l.id),
        ),
        ...result.locationsToAdd,
      ];
      const withLinks = applyMapLayoutConnections(roster, result.layout);
      for (const loc of withLinks) {
        const prev = roster.find((l) => l.id === loc.id);
        if (
          prev &&
          (loc.connections?.length ?? 0) !== (prev.connections?.length ?? 0)
        ) {
          replaceLocation(loc);
        }
      }

      updateStoryMap(result.map);
      requestAnimationFrame(() => fitViewToPins(result.map.pins));

      const bits = [
        result.stats.added
          ? `${result.stats.added} new place${result.stats.added === 1 ? "" : "s"}`
          : null,
        `${result.stats.pins} pin${result.stats.pins === 1 ? "" : "s"}`,
        result.stats.regions
          ? `${result.stats.regions} terrain region${result.stats.regions === 1 ? "" : "s"}`
          : null,
      ].filter(Boolean);
      setLayoutMessage(
        result.summary?.trim()
          ? `${result.summary.trim()} (${bits.join(" · ")})`
          : `Built from the story — ${bits.join(" · ")}.`,
      );
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : "Map build failed.");
      setLayoutMessage(null);
    } finally {
      setLayoutBusy(false);
    }
  }

  function resetView() {
    const el = viewportRef.current;
    setZoom(1);
    if (!el) {
      setPan({ x: 0, y: 0 });
      return;
    }
    setPan({
      x: (el.clientWidth - map.width) / 2,
      y: (el.clientHeight - map.height) / 2,
    });
  }

  /** Frame pins in the viewport — city-scale zoom when they're spread. */
  function fitViewToPins(
    pins: { x: number; y: number }[] = map.pins,
  ) {
    const el = viewportRef.current;
    if (!el || pins.length === 0) {
      resetView();
      return;
    }
    const bounds = pinBounds(pins, pins.length === 1 ? 0.12 : 0.08);
    if (!bounds) {
      resetView();
      return;
    }
    const boxW = Math.max(0.08, bounds.maxX - bounds.minX) * map.width;
    const boxH = Math.max(0.08, bounds.maxY - bounds.minY) * map.height;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(el.clientWidth / boxW, el.clientHeight / boxH) * 0.88),
    );
    const cx = ((bounds.minX + bounds.maxX) / 2) * map.width;
    const cy = ((bounds.minY + bounds.maxY) / 2) * map.height;
    setZoom(nextZoom);
    setPan({
      x: el.clientWidth / 2 - cx * nextZoom,
      y: el.clientHeight / 2 - cy * nextZoom,
    });
  }

  /** Spread a tight cluster, then zoom in so places read like a real city. */
  function expandPlaces() {
    if (map.pins.length < 2) {
      fitViewToPins(map.pins);
      return;
    }
    const expanded = expandMapPins(map);
    updateStoryMap(expanded);
    requestAnimationFrame(() => fitViewToPins(expanded.pins));
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
          <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent)]" />
        </div>
      </div>
    );
  }

  async function onBasemapSelected(file: File | null) {
    if (!file) return;
    setBasemapError(null);
    setBasemapBusy(true);
    try {
      const prepared = await prepareMapBackground(file);
      updateStoryMap(applyMapBackground(map, prepared));
      setZoom(1);
      requestAnimationFrame(() => {
        const el = viewportRef.current;
        if (!el) return;
        setPan({
          x: (el.clientWidth - prepared.width) / 2,
          y: (el.clientHeight - prepared.height) / 2,
        });
      });
    } catch (err) {
      setBasemapError(
        err instanceof Error ? err.message : "Could not upload that map.",
      );
    } finally {
      setBasemapBusy(false);
      if (basemapInputRef.current) basemapInputRef.current.value = "";
    }
  }

  function removeBasemap() {
    setBasemapError(null);
    updateStoryMap(clearMapBackground(map));
  }

  const selectedPin = selectedPinId ? locById.get(selectedPinId) : null;
  const selectedMapPin = selectedPinId
    ? map.pins.find((p) => p.locationId === selectedPinId)
    : null;
  const selectedRegion =
    selectedRegionId != null
      ? map.regions.find((r) => r.id === selectedRegionId) ?? null
      : null;

  return (
    <div className="flex h-screen flex-col lg:flex-row">
      <aside className="folio-scroll flex max-h-[40vh] w-full shrink-0 flex-col border-b border-[var(--border)] bg-[rgba(241,235,224,0.65)] lg:max-h-none lg:w-[17.5rem] lg:border-b-0 lg:border-r">
        <div className="px-5 pb-3 pt-8 lg:px-6 lg:pt-10">
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            Geography
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight text-[var(--ink)]">
            Map
          </h1>
          <MapSwitcher />
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            Upload a real map for contemporary or urban settings, or sketch fantasy
            ranges and water — then pin places so geography sits against the story.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-3 lg:px-6">
          <input
            ref={basemapInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              void onBasemapSelected(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant={map.backgroundImage ? "subtle" : "outline"}
            disabled={basemapBusy || layoutBusy}
            onClick={() => basemapInputRef.current?.click()}
            title="Upload a real map (city streets, floor plan…)"
          >
            <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            {basemapBusy
              ? "Uploading…"
              : map.backgroundImage
                ? "Replace map"
                : "Upload map"}
          </Button>
          {map.backgroundImage ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={basemapBusy || layoutBusy}
              onClick={removeBasemap}
              title="Return to the blank corkboard"
            >
              Clear map
            </Button>
          ) : null}
          <ClaudeDeepenButton
            configured={claude?.configured ?? null}
            busy={layoutBusy}
            label="Build map from story"
            title="Read the manuscript, discover places, and place pins & terrain from story geography"
            onClick={() => void buildMapFromStory()}
            className="rounded-full"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={map.pins.length === 0 || layoutBusy}
            onClick={expandPlaces}
            title="Spread places across the board and zoom in — city-scale view"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            Expand
          </Button>
          {DRAW_KINDS.map((kind) => {
            const meta = MAP_REGION_KIND_META[kind];
            const Icon =
              kind === "mountains"
                ? Mountain
                : kind === "water"
                  ? Waves
                  : Square;
            const active = drawKind === kind;
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={layoutBusy}
                onClick={() => {
                  setDrawKind((v) => (v === kind ? null : kind));
                  setDraftRegion(null);
                  setSelectedPinId(null);
                }}
                title={`Drag on the board to paint ${meta.label.toLowerCase()}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {active ? "Drawing…" : meta.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant="subtle"
            disabled={unplaced.length === 0 || layoutBusy}
            onClick={() => autoPlaceMapPins()}
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            Place all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={map.pins.length === 0 || layoutBusy}
            onClick={() =>
              updateStoryMap({
                ...map,
                pins: [],
                labels: map.labels,
                regions: map.regions,
              })
            }
          >
            Clear pins
          </Button>
        </div>

        {drawKind ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] lg:px-6">
            Drag across the board to paint{" "}
            {MAP_REGION_KIND_META[drawKind].label.toLowerCase()}.
          </p>
        ) : null}
        {map.backgroundImage ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)] lg:px-6">
            Basemap · {map.backgroundName || "Uploaded"} — pin places on top.
          </p>
        ) : null}
        {basemapError ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[#6B3A2A] lg:px-6">
            {basemapError}
          </p>
        ) : null}
        {layoutMessage ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)] lg:px-6">
            {layoutMessage}
          </p>
        ) : null}
        {layoutError ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[#6B3A2A] lg:px-6">
            {layoutError}
          </p>
        ) : null}

        <div className="folio-scroll min-h-0 flex-1 px-3 pb-6 lg:px-4">
          <p className="mb-2 px-2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Features · {map.regions.length}
          </p>
          {map.regions.length === 0 ? (
            <p className="mb-5 px-2 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              None yet — paint Territory, Mountains, or Water on the board.
            </p>
          ) : (
            <ul className="mb-5 space-y-1">
              {map.regions.map((r) => {
                const kind = r.kind ?? "territory";
                const style = territoryStyle(r.color, kind);
                const KindIcon =
                  kind === "mountains"
                    ? Mountain
                    : kind === "water"
                      ? Waves
                      : Square;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegionId(r.id);
                        setSelectedPinId(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                        selectedRegionId === r.id
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[rgba(45,42,38,0.05)]",
                      )}
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
                        style={{
                          background: style.fill,
                          borderColor: style.stroke,
                        }}
                      >
                        <KindIcon
                          className="h-3 w-3 text-[rgba(45,42,38,0.45)]"
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                          {r.name}
                        </span>
                        <span className="block font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
                          {MAP_REGION_KIND_META[kind].label}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mb-2 px-2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Unplaced · {unplaced.length}
          </p>
          {locations.length === 0 ? (
            <div className="mx-2 rounded-xl border border-dashed border-[rgba(45,42,38,0.1)] px-4 py-8 text-center">
              <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                No places in the atlas yet.
              </p>
              <Link
                href="/locations"
                className="mt-3 inline-block font-[family-name:var(--font-ui)] text-sm text-[var(--accent)] hover:underline"
              >
                Open Locations
              </Link>
            </div>
          ) : unplaced.length === 0 ? (
            <p className="px-2 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              Every place is on the map.
            </p>
          ) : (
            <ul className="space-y-1">
              {unplaced.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    onClick={() => placeLocation(loc)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[rgba(45,42,38,0.05)]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: povColor(loc.name) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                        {loc.name || "Unnamed"}
                      </span>
                      <span className="block font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
                        {LOCATION_KIND_META[loc.kind]?.label ?? loc.kind}
                      </span>
                    </span>
                    <MapPin
                      className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]"
                      strokeWidth={1.5}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {map.pins.length > 0 ? (
            <>
              <p className="mb-2 mt-6 px-2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                On the map · {map.pins.length}
              </p>
              <ul className="space-y-1">
                {map.pins.map((pin) => {
                  const loc = locById.get(pin.locationId);
                  if (!loc) return null;
                  return (
                    <li key={pin.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPinId(loc.id);
                          setSelectedRegionId(null);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                          selectedPinId === loc.id
                            ? "bg-[var(--accent-soft)]"
                            : "hover:bg-[rgba(45,42,38,0.05)]",
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: povColor(loc.name) }}
                        />
                        <span className="truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                          {loc.name || pin.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      </aside>

      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          ref={viewportRef}
          className={cn(
            "absolute inset-0 touch-none overflow-hidden",
            drawKind
              ? "cursor-crosshair"
              : "cursor-grab active:cursor-grabbing",
          )}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file?.type.startsWith("image/")) {
              void onBasemapSelected(file);
            }
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 20%, rgba(247,243,234,0.9), transparent 55%), radial-gradient(ellipse at 70% 80%, rgba(176,141,87,0.08), transparent 50%), #E8E2D6",
            }}
          />

          <div
            className="absolute origin-top-left will-change-transform"
            style={{
              width: map.width,
              height: map.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden rounded-[2px] shadow-[0_20px_60px_rgba(45,42,38,0.12)]"
              style={{
                background: map.backgroundImage
                  ? "#1c1a17"
                  : "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(45,42,38,0.03) 24px), repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(45,42,38,0.03) 24px), #F3EEE4",
                border: "1px solid rgba(45,42,38,0.08)",
              }}
            >
              {map.backgroundImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={map.backgroundImage}
                  alt={map.backgroundName || "Story basemap"}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                />
              ) : null}
            </div>

            {/* Soft feature washes — territory / mountains / water */}
            {map.regions.map((r) => {
              const kind = r.kind ?? "territory";
              const shape = r.shape ?? "rect";
              const rotation = r.rotation ?? 0;
              const outline = regionOutlineStyle(shape);
              const style = territoryStyle(r.color, kind);
              const active = selectedRegionId === r.id;
              return (
                <div
                  key={r.id}
                  data-map-region
                  onPointerDown={(e) => startRegionMove(e, r)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRegionId(r.id);
                    setSelectedPinId(null);
                  }}
                  className={cn(
                    "absolute transition-[box-shadow] duration-200",
                    active ? "z-[5]" : "z-[1]",
                    drawKind
                      ? "pointer-events-none"
                      : "cursor-grab active:cursor-grabbing",
                  )}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{
                      background: style.fill,
                      border: `1.5px solid ${style.stroke}`,
                      borderRadius: outline.borderRadius,
                      boxShadow: active
                        ? "0 0 0 2px rgba(45,42,38,0.18), inset 0 0 0 1px rgba(255,255,255,0.25)"
                        : undefined,
                    }}
                  >
                    <RegionFeatureGlyphs
                      kind={kind}
                      regionId={r.id}
                      w={r.w}
                      h={r.h}
                    />
                    <span className="pointer-events-none absolute left-3 top-2.5 z-[1] max-w-[80%] truncate font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                      {r.name}
                    </span>
                  </div>
                  {active && !drawKind ? (
                    <>
                      <button
                        type="button"
                        aria-label="Rotate feature"
                        title="Drag to rotate"
                        data-map-region
                        onPointerDown={(e) => startRegionRotate(e, r)}
                        className="absolute left-1/2 top-0 z-[2] flex h-5 w-5 -translate-x-1/2 -translate-y-[140%] cursor-grab items-center justify-center rounded-full border border-[rgba(45,42,38,0.25)] bg-[rgba(247,243,234,0.95)] shadow-sm active:cursor-grabbing"
                      >
                        <RotateCw
                          className="h-3 w-3 text-[var(--ink-muted)]"
                          strokeWidth={1.6}
                        />
                      </button>
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-0 z-[1] h-3 w-px -translate-x-1/2 -translate-y-full bg-[rgba(45,42,38,0.25)]"
                      />
                      {RESIZE_HANDLES.map((handle) => (
                        <button
                          key={handle.id}
                          type="button"
                          aria-label={`Resize ${handle.id}`}
                          data-map-region
                          onPointerDown={(e) =>
                            startRegionResize(e, r, handle.id)
                          }
                          className="absolute z-[2] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[rgba(45,42,38,0.3)] bg-[rgba(247,243,234,0.95)] shadow-sm"
                          style={{
                            left: handle.left,
                            top: handle.top,
                            cursor: handle.cursor,
                          }}
                        />
                      ))}
                    </>
                  ) : null}
                </div>
              );
            })}

            {draftRegion && draftRegion.w > 0.01 && draftRegion.h > 0.01 && drawKind ? (
              <div
                className="pointer-events-none absolute z-[2] rounded-[1.75rem] border border-dashed"
                style={{
                  left: `${draftRegion.x * 100}%`,
                  top: `${draftRegion.y * 100}%`,
                  width: `${draftRegion.w * 100}%`,
                  height: `${draftRegion.h * 100}%`,
                  background: MAP_REGION_KIND_META[drawKind].fill,
                  borderColor: MAP_REGION_KIND_META[drawKind].stroke,
                }}
              />
            ) : null}

            <svg
              className="pointer-events-none absolute inset-0 z-[3]"
              width={map.width}
              height={map.height}
            >
              {connections.map((line) => (
                <line
                  key={line.key}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(45,42,38,0.18)"
                  strokeWidth={1.5}
                  strokeDasharray="5 6"
                />
              ))}
            </svg>

            {map.labels.map((label) => (
              <div
                key={label.id}
                className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2 font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink-faint)]"
                style={{
                  left: `${label.x * 100}%`,
                  top: `${label.y * 100}%`,
                }}
              >
                {label.text}
              </div>
            ))}

            {map.pins.map((pin) => {
              const loc = locById.get(pin.locationId);
              if (!loc) return null;
              const active = selectedPinId === loc.id;
              const color = povColor(loc.name);
              return (
                <motion.button
                  key={pin.id}
                  type="button"
                  data-map-pin
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onPointerDown={(e) => startPinDrag(e, pin)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    router.push(`/locations/${loc.id}`);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPinId(loc.id);
                    setSelectedRegionId(null);
                  }}
                  className={cn(
                    "absolute z-10 flex -translate-x-1/2 -translate-y-full cursor-grab flex-col items-center active:cursor-grabbing",
                    active && "z-20",
                    drawKind && "pointer-events-none",
                  )}
                  style={{
                    left: `${pin.x * 100}%`,
                    top: `${pin.y * 100}%`,
                  }}
                >
                  <span
                    className={cn(
                      "mb-1 max-w-[9rem] truncate rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs shadow-[0_4px_14px_rgba(45,42,38,0.1)]",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[#F7F3EA] text-[var(--ink)]",
                    )}
                  >
                    {loc.name || pin.label}
                  </span>
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <span
                      className="absolute h-3 w-3 rotate-45 rounded-[2px] border border-[rgba(45,42,38,0.12)] shadow-sm"
                      style={{ background: color || "var(--accent)" }}
                    />
                    <span className="absolute -bottom-1 h-0 w-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[rgba(45,42,38,0.25)]" />
                  </span>
                </motion.button>
              );
            })}

            {map.pins.length === 0 && map.regions.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="max-w-xs text-center font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-faint)]">
                  {locations.length === 0
                    ? "Add places in Locations, then pin them here."
                    : map.backgroundImage
                      ? "Pin places onto your uploaded map from the rail."
                      : "Upload a real map, or paint territory, mountains, or water."}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="folio-chrome absolute bottom-5 right-5 flex items-center gap-1 rounded-full border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.9)] p-1 shadow-[0_8px_24px_rgba(45,42,38,0.08)] backdrop-blur-xl">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.9))}
            className="rounded-full p-2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <span className="min-w-[2.5rem] text-center font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.1))}
            className="rounded-full p-2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Expand places"
            title="Expand places — spread and zoom to city scale"
            onClick={expandPlaces}
            disabled={map.pins.length === 0}
            className="rounded-full p-2 text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="Reset view"
            onClick={resetView}
            className="rounded-full p-2 text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {selectedRegion ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="folio-chrome absolute bottom-5 left-5 right-20 max-w-sm rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.95)] p-4 shadow-[0_16px_40px_rgba(45,42,38,0.1)] backdrop-blur-xl sm:right-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  {
                    MAP_REGION_KIND_META[selectedRegion.kind ?? "territory"]
                      .label
                  }
                </p>
                <input
                  value={selectedRegion.name}
                  onChange={(e) =>
                    upsertMapRegion({
                      ...selectedRegion,
                      name: e.target.value,
                    })
                  }
                  className="mt-1 w-full bg-transparent font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] outline-none"
                />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedRegionId(null)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Kind
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DRAW_KINDS.map((kind) => {
                const meta = MAP_REGION_KIND_META[kind];
                const Icon =
                  kind === "mountains"
                    ? Mountain
                    : kind === "water"
                      ? Waves
                      : Square;
                const active = (selectedRegion.kind ?? "territory") === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      upsertMapRegion({
                        ...selectedRegion,
                        kind,
                        color:
                          selectedRegion.color ||
                          MAP_REGION_KIND_META[kind].defaultColor,
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs transition-colors",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[rgba(45,42,38,0.06)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Shape
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REGION_SHAPES.map((shape) => {
                const meta = MAP_REGION_SHAPE_META[shape];
                const Icon =
                  shape === "ellipse"
                    ? Circle
                    : shape === "soft"
                      ? Waves
                      : Square;
                const active = (selectedRegion.shape ?? "rect") === shape;
                return (
                  <button
                    key={shape}
                    type="button"
                    title={meta.hint}
                    onClick={() =>
                      upsertMapRegion({ ...selectedRegion, shape })
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs transition-colors",
                      active
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "bg-[rgba(45,42,38,0.06)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
                    )}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Rotation
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                aria-label="Rotate left"
                onClick={() =>
                  upsertMapRegion({
                    ...selectedRegion,
                    rotation: normalizeDeg(
                      (selectedRegion.rotation ?? 0) - 15,
                    ),
                  })
                }
                className="rounded-full border border-[rgba(45,42,38,0.12)] p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={Math.round(selectedRegion.rotation ?? 0)}
                onChange={(e) =>
                  upsertMapRegion({
                    ...selectedRegion,
                    rotation: normalizeDeg(Number(e.target.value)),
                  })
                }
                className="h-1.5 flex-1 cursor-pointer accent-[var(--ink)]"
              />
              <button
                type="button"
                aria-label="Rotate right"
                onClick={() =>
                  upsertMapRegion({
                    ...selectedRegion,
                    rotation: normalizeDeg(
                      (selectedRegion.rotation ?? 0) + 15,
                    ),
                  })
                }
                className="rounded-full border border-[rgba(45,42,38,0.12)] p-1.5 text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                <RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <span className="min-w-[2.75rem] text-right font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                {Math.round(selectedRegion.rotation ?? 0)}°
              </span>
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Wash
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MAP_TERRITORY_PALETTE.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  title={swatch.label}
                  aria-label={swatch.label}
                  onClick={() =>
                    upsertMapRegion({ ...selectedRegion, color: swatch.id })
                  }
                  className={cn(
                    "h-6 w-6 rounded-md border transition-transform",
                    selectedRegion.color === swatch.id
                      ? "scale-110 border-[var(--ink)]"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ background: swatch.fill }}
                />
              ))}
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.65rem] leading-relaxed text-[var(--ink-faint)]">
              Drag to move · corner handles reshape · top handle rotates
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  removeMapRegion(selectedRegion.id);
                  setSelectedRegionId(null);
                }}
              >
                Remove
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  upsertMapRegion({
                    ...selectedRegion,
                    rotation: 0,
                  })
                }
              >
                Reset angle
              </Button>
            </div>
          </motion.div>
        ) : null}

        {selectedPin && !selectedRegion ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="folio-chrome absolute bottom-5 left-5 right-20 max-w-sm rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.95)] p-4 shadow-[0_16px_40px_rgba(45,42,38,0.1)] backdrop-blur-xl sm:right-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  {LOCATION_KIND_META[selectedPin.kind]?.label ??
                    selectedPin.kind}
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)]">
                  {selectedPin.name}
                </h2>
                {selectedPin.shortBio || selectedPin.place?.region ? (
                  <p className="mt-2 line-clamp-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    {selectedPin.shortBio || selectedPin.place.region}
                  </p>
                ) : null}
                {selectedMapPin?.rationale ? (
                  <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--accent)]">
                    {selectedMapPin.rationale}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedPinId(null)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => router.push(`/locations/${selectedPin.id}`)}
              >
                Open wiki
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  removeMapPin(selectedPin.id);
                  setSelectedPinId(null);
                }}
              >
                Unpin
              </Button>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
