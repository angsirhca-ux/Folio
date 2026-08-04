"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Circle,
  Clock,
  ImagePlus,
  List,
  MapPin,
  Maximize2,
  Minus,
  Mountain,
  Pentagon,
  Plus,
  RotateCcw,
  RotateCw,
  Route,
  Sparkles,
  Square,
  Type,
  Waves,
  X,
} from "lucide-react";
import { CityVectorBasemap } from "@/components/Map/CityVectorBasemap";
import { MapFeatureIcon } from "@/components/Map/MapFeatureIcon";
import { MapSwitcher } from "@/components/Map/MapSwitcher";
import { SeriesBibleStrip } from "@/components/Series/SeriesBibleStrip";
import { Button } from "@/components/ui/button";
import { ClaudeDeepenButton } from "@/components/Characters/ClaudeDeepenButton";
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
  createMapLabel,
  createMapPath,
  createMapPin,
  createMapRegion,
  emptyStoryMap,
  expandMapPins,
  isMapFeatureIcon,
  isPolygonRegion,
  MAP_PATH_KIND_META,
  MAP_REGION_KIND_META,
  MAP_REGION_SHAPE_META,
  MAP_REGION_STROKE_META,
  MAP_STARTERS,
  MAP_LINE_ART_PAPER,
  MAP_TERRITORY_PALETTE,
  featureMarkerStyle,
  mapHasBasemap,
  movePolygonVertex,
  organicClipPath,
  pinBounds,
  translatePolygonRegion,
  prepareMapBackground,
  prepareMapStarter,
  regionOutlineStyle,
  territoryStrokeStyle,
  territoryStyle,
  unplacedLocations,
} from "@/lib/map";
import {
  LOCATION_KIND_META,
  povColor,
  type ChronicleEvent,
  type Location,
  type StoryMapLabel,
  type StoryMapPathKind,
  type StoryMapPin,
  type StoryMapRegion,
  type StoryMapRegionKind,
  type StoryMapRegionShape,
  type StoryMapRegionStroke,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DRAW_KINDS: StoryMapRegionKind[] = [
  "territory",
  "mountains",
  "water",
  "building",
];
const PATH_KINDS: StoryMapPathKind[] = ["road", "path", "river"];
const REGION_SHAPES: StoryMapRegionShape[] = [
  "rect",
  "ellipse",
  "soft",
  "polygon",
];
const REGION_STROKES: StoryMapRegionStroke[] = ["none", "soft", "ink"];
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

function polygonWashFill(fill: string): string {
  if (fill.startsWith("rgba(")) {
    return fill.replace(/,\s*[\d.]+\)$/, ", 0.04)");
  }
  if (fill.startsWith("rgb(")) {
    return fill.replace("rgb(", "rgba(").replace(")", ", 0.04)");
  }
  return fill;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 6;

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
      origPoints?: Array<{ x: number; y: number }>;
    }
  | {
      kind: "vertex-region";
      regionId: string;
      vertexIndex: number;
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
    }
  | {
      kind: "label";
      labelId: string;
      startX: number;
      startY: number;
      origLabelX: number;
      origLabelY: number;
    };

export function MapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    book,
    hydrated,
    upsertMapPin,
    removeMapPin,
    upsertMapRegion,
    removeMapRegion,
    upsertMapLabel,
    removeMapLabel,
    upsertMapPath,
    removeMapPath,
    autoPlaceMapPins,
    updateStoryMap,
    takeBookSnapshot,
    upsertLocations,
    replaceLocation,
    promoteMapToSeriesBible,
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
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [drawKind, setDrawKind] = useState<StoryMapRegionKind | null>(null);
  const [pathDrawKind, setPathDrawKind] = useState<StoryMapPathKind | null>(null);
  const [pathDraftPoints, setPathDraftPoints] = useState<
    Array<{ x: number; y: number }>
  >([]);
  const [labelTool, setLabelTool] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [dismissedEmptyWelcome, setDismissedEmptyWelcome] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedChronicleId, setSelectedChronicleId] = useState<string | null>(
    null,
  );
  const [draftRegion, setDraftRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Local mirror while dragging so we don't spam React on every move for regions. */
  const regionDragLive = useRef<StoryMapRegion | null>(null);
  const focusAppliedRef = useRef<string | null>(null);

  const focusId = searchParams.get("focus");

  const chronicleMarkers = useMemo(() => {
    return (book.chronicle ?? []).filter(
      (e) => e.mapMarker?.mapId === map.id,
    );
  }, [book.chronicle, map.id]);

  const legendItems = useMemo(() => {
    const regionKinds = new Set<StoryMapRegionKind>();
    for (const r of map.regions) {
      regionKinds.add(r.kind ?? "territory");
    }
    const pathKinds = new Set<StoryMapPathKind>();
    for (const p of map.paths ?? []) {
      pathKinds.add(p.kind);
    }
    return {
      regionKinds: [...regionKinds],
      pathKinds: [...pathKinds],
    };
  }, [map.regions, map.paths]);

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
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
    setDrawKind(null);
    setPathDrawKind(null);
    setPathDraftPoints([]);
    setLabelTool(false);
    setDraftRegion(null);
    setDismissedEmptyWelcome(false);
    setZoom(1);
    focusAppliedRef.current = null;
    const el = viewportRef.current;
    if (!el) return;
    setPan({
      x: (el.clientWidth - map.width) / 2,
      y: (el.clientHeight - map.height) / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.activeMapId]);

  useEffect(() => {
    if (!hydrated || !focusId) return;
    if (focusAppliedRef.current === focusId) return;
    const pin = map.pins.find((p) => p.locationId === focusId);
    if (!pin) return;
    focusAppliedRef.current = focusId;
    setSelectedPinId(focusId);
    setSelectedRegionId(null);
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
    const el = viewportRef.current;
    if (!el) return;
    const cx = pin.x * map.width;
    const cy = pin.y * map.height;
    setPan({
      x: el.clientWidth / 2 - cx * zoom,
      y: el.clientHeight / 2 - cy * zoom,
    });
  }, [hydrated, focusId, map.pins, map.width, map.height, zoom]);

  useEffect(() => {
    if (!pathDrawKind && pathDraftPoints.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPathDraftPoints([]);
        setPathDrawKind(null);
      }
      if (e.key === "Enter" && pathDraftPoints.length >= 2 && pathDrawKind) {
        finishPath(pathDrawKind, pathDraftPoints);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathDrawKind, pathDraftPoints]);

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

  function finishPath(
    kind: StoryMapPathKind,
    points: Array<{ x: number; y: number }>,
  ) {
    if (points.length < 2) return;
    const n =
      (map.paths ?? []).filter((p) => p.kind === kind).length + 1;
    const path = createMapPath({
      kind,
      points,
      name: `${MAP_PATH_KIND_META[kind].label} ${n}`,
    });
    upsertMapPath(path);
    setSelectedPathId(path.id);
    setSelectedPinId(null);
    setSelectedRegionId(null);
    setSelectedLabelId(null);
    setSelectedChronicleId(null);
    setPathDraftPoints([]);
    setPathDrawKind(null);
  }

  function onViewportPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-map-pin]")) return;
    if (target.closest("[data-map-region]")) return;
    if (target.closest("[data-map-label]")) return;
    if (target.closest("[data-map-path]")) return;
    if (target.closest("[data-chronicle-marker]")) return;

    if (pathDrawKind) {
      const pos = clientToMap(e.clientX, e.clientY);
      setPathDraftPoints((prev) => [...prev, pos]);
      setSelectedPinId(null);
      setSelectedRegionId(null);
      setSelectedLabelId(null);
      setSelectedPathId(null);
      setSelectedChronicleId(null);
      return;
    }

    if (labelTool) {
      const pos = clientToMap(e.clientX, e.clientY);
      const label = createMapLabel({ text: "Label", x: pos.x, y: pos.y });
      upsertMapLabel(label);
      setSelectedLabelId(label.id);
      setSelectedPinId(null);
      setSelectedRegionId(null);
      return;
    }

    if (drawKind) {
      const start = clientToMap(e.clientX, e.clientY);
      if (isMapFeatureIcon(drawKind)) {
        const meta = MAP_REGION_KIND_META[drawKind];
        const n =
          map.regions.filter((r) => (r.kind ?? "territory") === drawKind)
            .length + 1;
        const region = createMapRegion({
          name: `${meta.defaultName} ${n}`,
          kind: drawKind,
          x: start.x,
          y: start.y,
        });
        upsertMapRegion(region);
        setSelectedRegionId(region.id);
        setSelectedPinId(null);
        setSelectedLabelId(null);
        return;
      }
      dragRef.current = {
        kind: "draw-region",
        startMapX: start.x,
        startMapY: start.y,
      };
      setDraftRegion({ x: start.x, y: start.y, w: 0, h: 0 });
      setSelectedPinId(null);
      setSelectedRegionId(null);
      setSelectedLabelId(null);
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
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
  }

  function onViewportDoubleClick(e: ReactMouseEvent) {
    if (pathDrawKind && pathDraftPoints.length >= 2) {
      e.preventDefault();
      finishPath(pathDrawKind, pathDraftPoints);
    }
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

    if (drag.kind === "label") {
      const deltaX = (e.clientX - drag.startX) / (zoom * map.width);
      const deltaY = (e.clientY - drag.startY) / (zoom * map.height);
      const label = map.labels.find((l) => l.id === drag.labelId);
      if (!label) return;
      upsertMapLabel({
        ...label,
        x: Math.min(1, Math.max(0, drag.origLabelX + deltaX)),
        y: Math.min(1, Math.max(0, drag.origLabelY + deltaY)),
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
      const next =
        isPolygonRegion(region) || drag.origPoints
          ? translatePolygonRegion(
              {
                ...region,
                points: drag.origPoints ?? region.points,
              },
              deltaX,
              deltaY,
            )
          : {
              ...region,
              x: Math.min(1 - region.w, Math.max(0, drag.origX + deltaX)),
              y: Math.min(1 - region.h, Math.max(0, drag.origY + deltaY)),
            };
      regionDragLive.current = next;
      upsertMapRegion(next);
      return;
    }

    if (drag.kind === "vertex-region") {
      const pos = clientToMap(e.clientX, e.clientY);
      const region =
        regionDragLive.current ??
        map.regions.find((r) => r.id === drag.regionId);
      if (!region) return;
      const next = movePolygonVertex(
        region,
        drag.vertexIndex,
        pos.x,
        pos.y,
      );
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
    if (drawKind || labelTool) return;
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
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startLabelDrag(e: ReactPointerEvent, label: StoryMapLabel) {
    e.stopPropagation();
    if (drawKind) return;
    dragRef.current = {
      kind: "label",
      labelId: label.id,
      startX: e.clientX,
      startY: e.clientY,
      origLabelX: label.x,
      origLabelY: label.y,
    };
    setSelectedLabelId(label.id);
    setSelectedPinId(null);
    setSelectedRegionId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startRegionMove(e: ReactPointerEvent, region: StoryMapRegion) {
    e.stopPropagation();
    if (drawKind || labelTool) return;
    dragRef.current = {
      kind: "move-region",
      regionId: region.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: region.x,
      origY: region.y,
      ...(isPolygonRegion(region) && region.points
        ? { origPoints: region.points.map((p) => ({ ...p })) }
        : {}),
    };
    regionDragLive.current = region;
    setSelectedRegionId(region.id);
    setSelectedPinId(null);
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function startVertexMove(
    e: ReactPointerEvent,
    region: StoryMapRegion,
    index: number,
  ) {
    e.stopPropagation();
    if (drawKind || labelTool) return;
    dragRef.current = {
      kind: "vertex-region",
      regionId: region.id,
      vertexIndex: index,
    };
    regionDragLive.current = region;
    setSelectedRegionId(region.id);
    setSelectedPinId(null);
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
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
    setSelectedLabelId(null);
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
    setSelectedLabelId(null);
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
    setSelectedLabelId(null);
    setSelectedPathId(null);
    setSelectedChronicleId(null);
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

  async function onApplyStarter(starterId: string) {
    setBasemapError(null);
    setBasemapBusy(true);
    try {
      const next = await prepareMapStarter(map, starterId);
      updateStoryMap(next);
      setZoom(1);
      requestAnimationFrame(() => {
        const el = viewportRef.current;
        if (!el) return;
        setPan({
          x: (el.clientWidth - next.width) / 2,
          y: (el.clientHeight - next.height) / 2,
        });
      });
    } catch (err) {
      setBasemapError(
        err instanceof Error ? err.message : "Could not open that map starter.",
      );
    } finally {
      setBasemapBusy(false);
    }
  }

  const selectedPin = selectedPinId ? locById.get(selectedPinId) : null;
  const selectedMapPin = selectedPinId
    ? map.pins.find((p) => p.locationId === selectedPinId)
    : null;
  const selectedRegion =
    selectedRegionId != null
      ? map.regions.find((r) => r.id === selectedRegionId) ?? null
      : null;
  const selectedLabel =
    selectedLabelId != null
      ? map.labels.find((l) => l.id === selectedLabelId) ?? null
      : null;
  const selectedPath =
    selectedPathId != null
      ? (map.paths ?? []).find((p) => p.id === selectedPathId) ?? null
      : null;
  const selectedChronicle: ChronicleEvent | null =
    selectedChronicleId != null
      ? (book.chronicle ?? []).find((e) => e.id === selectedChronicleId) ?? null
      : null;
  const selectedIsIcon = selectedRegion
    ? isMapFeatureIcon(selectedRegion.kind ?? "territory")
    : false;
  const selectedIsPolygon = selectedRegion
    ? isPolygonRegion(selectedRegion)
    : false;
  const isEmptyBoard =
    !mapHasBasemap(map) &&
    map.pins.length === 0 &&
    map.regions.length === 0 &&
    map.labels.length === 0 &&
    (map.paths ?? []).length === 0;
  const placingTool = Boolean(drawKind || labelTool || pathDrawKind);
  const hasLegendContent =
    legendItems.regionKinds.length > 0 || legendItems.pathKinds.length > 0;

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
          <SeriesBibleStrip kind="maps" />
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            Territory paints a wash; Mountain, Water, and Building place icons;
            Roads & paths trace routes. Upload a basemap or pin places onto the
            corkboard.
          </p>
          {book.seriesId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 rounded-full text-xs"
              onClick={() => promoteMapToSeriesBible(map.id)}
            >
              Promote to series
            </Button>
          ) : null}
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
            variant={mapHasBasemap(map) ? "subtle" : "outline"}
            disabled={basemapBusy || layoutBusy}
            onClick={() => basemapInputRef.current?.click()}
            title="Upload a real map (city streets, floor plan…)"
          >
            <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
            {basemapBusy
              ? "Uploading…"
              : mapHasBasemap(map)
                ? "Replace map"
                : "Upload map"}
          </Button>
          {mapHasBasemap(map) ? (
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
                  : kind === "building"
                    ? Building2
                    : Square;
            const active = drawKind === kind;
            const iconPlacement = isMapFeatureIcon(kind);
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={layoutBusy}
                onClick={() => {
                  setDrawKind((v) => (v === kind ? null : kind));
                  setPathDrawKind(null);
                  setPathDraftPoints([]);
                  setLabelTool(false);
                  setDraftRegion(null);
                  setSelectedPinId(null);
                  setSelectedLabelId(null);
                }}
                title={
                  iconPlacement
                    ? `Click the board to place a ${meta.label.toLowerCase()} icon`
                    : `Drag on the board to paint a ${meta.label.toLowerCase()} wash`
                }
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {active
                  ? iconPlacement
                    ? "Placing…"
                    : "Drawing…"
                  : meta.label}
              </Button>
            );
          })}
          <Button
            type="button"
            size="sm"
            variant={labelTool ? "default" : "outline"}
            disabled={layoutBusy}
            onClick={() => {
              setLabelTool((v) => !v);
              setDrawKind(null);
              setPathDrawKind(null);
              setPathDraftPoints([]);
              setDraftRegion(null);
              setSelectedPinId(null);
              setSelectedRegionId(null);
            }}
            title="Click the board to place a text label"
          >
            <Type className="h-3.5 w-3.5" strokeWidth={1.5} />
            {labelTool ? "Labeling…" : "Label"}
          </Button>
          {PATH_KINDS.map((kind) => {
            const meta = MAP_PATH_KIND_META[kind];
            const Icon =
              kind === "road" ? Route : kind === "river" ? Waves : Route;
            const active = pathDrawKind === kind;
            return (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={layoutBusy}
                onClick={() => {
                  setPathDrawKind((v) => (v === kind ? null : kind));
                  setPathDraftPoints([]);
                  setDrawKind(null);
                  setLabelTool(false);
                  setDraftRegion(null);
                  setSelectedPinId(null);
                  setSelectedRegionId(null);
                  setSelectedLabelId(null);
                  setSelectedPathId(null);
                }}
                title={`Click to add points · double-click or Enter to finish a ${meta.label.toLowerCase()}`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {active ? "Tracing…" : meta.label}
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
            {isMapFeatureIcon(drawKind)
              ? `Click the board to place a ${MAP_REGION_KIND_META[drawKind].label.toLowerCase()} icon.`
              : `Drag across the board to paint a ${MAP_REGION_KIND_META[drawKind].label.toLowerCase()} wash.`}
          </p>
        ) : pathDrawKind ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] lg:px-6">
            Click to add points · double-click or Enter to finish · Escape to
            cancel.
          </p>
        ) : labelTool ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs text-[var(--accent)] lg:px-6">
            Click the board to place a label.
          </p>
        ) : null}
        {mapHasBasemap(map) ? (
          <p className="px-5 pb-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)] lg:px-6">
            {map.backgroundVector === "city"
              ? "OpenStreetMap city — real streets & buildings; pin places on top."
              : `Basemap · ${map.backgroundName || "Uploaded"} — pin places on top.`}
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
              None yet — paint a Territory wash, or click to place Mountain /
              Water / Building icons.
            </p>
          ) : (
            <ul className="mb-5 space-y-1">
              {map.regions.map((r) => {
                const kind = r.kind ?? "territory";
                const style = territoryStyle(r.color, kind);
                const marker =
                  kind === "building"
                    ? featureMarkerStyle(r.color, kind)
                    : null;
                const KindIcon =
                  kind === "mountains"
                    ? Mountain
                    : kind === "water"
                      ? Waves
                      : kind === "building"
                        ? Building2
                        : Square;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRegionId(r.id);
                        setSelectedPinId(null);
                        setSelectedLabelId(null);
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
                          background: marker?.fill ?? style.fill,
                          borderColor: marker?.border ?? style.stroke,
                          color: marker?.ink,
                        }}
                      >
                        <KindIcon
                          className={cn(
                            "h-3 w-3",
                            !marker && "text-[rgba(45,42,38,0.45)]",
                          )}
                          strokeWidth={1.5}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                          {r.name.trim() || "Unnamed"}
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

          <p className="mb-2 mt-6 px-2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Routes · {(map.paths ?? []).length}
          </p>
          {(map.paths ?? []).length === 0 ? (
            <p className="mb-5 px-2 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
              None yet — trace a road, path, or river on the board.
            </p>
          ) : (
            <ul className="mb-5 space-y-1">
              {(map.paths ?? []).map((p) => {
                const meta = MAP_PATH_KIND_META[p.kind];
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPathId(p.id);
                        setSelectedPinId(null);
                        setSelectedRegionId(null);
                        setSelectedLabelId(null);
                        setSelectedChronicleId(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                        selectedPathId === p.id
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[rgba(45,42,38,0.05)]",
                      )}
                    >
                      <span
                        className="h-0.5 w-5 shrink-0 rounded-full"
                        style={{ background: meta.stroke }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                          {p.name.trim() || "Unnamed"}
                        </span>
                        <span className="block font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
                          {meta.label}
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
                          setSelectedLabelId(null);
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
            placingTool
              ? "cursor-crosshair"
              : "cursor-grab active:cursor-grabbing",
          )}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
          onDoubleClick={onViewportDoubleClick}
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
                background: mapHasBasemap(map)
                  ? MAP_LINE_ART_PAPER
                  : "#F3EEE4",
                border: "1px solid rgba(45,42,38,0.08)",
              }}
            >
              {map.backgroundVector === "city" ? (
                <CityVectorBasemap />
              ) : map.backgroundImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={map.backgroundImage}
                  alt={map.backgroundName || "Story basemap"}
                  draggable={false}
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                />
              ) : null}
            </div>

            {/* Soft feature washes & point icons */}
            {map.regions.map((r) => {
              const kind = r.kind ?? "territory";
              const isIcon = isMapFeatureIcon(kind);
              const isPoly = isPolygonRegion(r);
              const shape = r.shape ?? "rect";
              const rotation = r.rotation ?? 0;
              const outline = regionOutlineStyle(shape);
              const style = territoryStyle(r.color, kind);
              const edgeStyle = territoryStrokeStyle(r.stroke, style.stroke);
              const active = selectedRegionId === r.id;

              if (isPoly && r.points) {
                const polyPoints = r.points
                  .map((p) => `${p.x * map.width},${p.y * map.height}`)
                  .join(" ");
                return (
                  <div
                    key={r.id}
                    data-map-region
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRegionId(r.id);
                      setSelectedPinId(null);
                      setSelectedLabelId(null);
                    }}
                    className={cn(
                      "absolute inset-0 transition-[filter] duration-200",
                      active ? "z-[5]" : "z-[1]",
                      placingTool && "pointer-events-none",
                    )}
                  >
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${map.width} ${map.height}`}
                      preserveAspectRatio="none"
                    >
                      <polygon
                        points={polyPoints}
                        fill={polygonWashFill(style.fill)}
                        stroke="rgba(45,42,38,0.82)"
                        strokeWidth={active ? 3 : 2.25}
                        strokeLinejoin="round"
                        className={cn(
                          !placingTool &&
                            "cursor-grab active:cursor-grabbing",
                        )}
                        onPointerDown={(e) => startRegionMove(e, r)}
                      />
                    </svg>
                    {r.name.trim() ? (
                      <span
                        className="pointer-events-none absolute z-[1] max-w-[40%] truncate font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]"
                        style={{
                          left: `${r.x * 100}%`,
                          top: `${r.y * 100}%`,
                        }}
                      >
                        {r.name}
                      </span>
                    ) : null}
                    {active && !placingTool
                      ? r.points.map((p, i) => (
                          <button
                            key={i}
                            type="button"
                            aria-label={`Reshape point ${i + 1}`}
                            title="Drag to reshape"
                            data-map-region
                            onPointerDown={(e) => startVertexMove(e, r, i)}
                            className="absolute z-[2] h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-[1px] border border-[rgba(45,42,38,0.3)] bg-[rgba(247,243,234,0.95)] shadow-sm active:cursor-grabbing"
                            style={{
                              left: `${p.x * 100}%`,
                              top: `${p.y * 100}%`,
                            }}
                          />
                        ))
                      : null}
                  </div>
                );
              }

              return (
                <div
                  key={r.id}
                  data-map-region
                  onPointerDown={(e) => startRegionMove(e, r)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRegionId(r.id);
                    setSelectedPinId(null);
                    setSelectedLabelId(null);
                  }}
                  className={cn(
                    "absolute transition-[box-shadow] duration-200",
                    active ? "z-[5]" : "z-[1]",
                    placingTool
                      ? "pointer-events-none"
                      : "cursor-grab active:cursor-grabbing",
                  )}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                    transform: isIcon ? undefined : `rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                >
                  {isIcon ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <MapFeatureIcon
                        kind={kind as Exclude<StoryMapRegionKind, "territory">}
                        active={active}
                        name={r.name}
                        color={r.color}
                      />
                    </div>
                  ) : (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        background: style.fill,
                        borderRadius:
                          shape === "soft" ? undefined : outline.borderRadius,
                        clipPath:
                          shape === "soft"
                            ? organicClipPath(r.id)
                            : undefined,
                        border: edgeStyle?.border ?? "none",
                        boxShadow: active
                          ? "0 0 0 2px rgba(45,42,38,0.14), 0 8px 20px rgba(45,42,38,0.08)"
                          : edgeStyle?.boxShadow,
                      }}
                    >
                      <span className="pointer-events-none absolute left-3 top-2.5 z-[1] max-w-[80%] truncate font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                        {r.name.trim() ? r.name : null}
                      </span>
                    </div>
                  )}
                  {active && !placingTool && !isIcon ? (
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

            {draftRegion &&
            draftRegion.w > 0.01 &&
            draftRegion.h > 0.01 &&
            drawKind &&
            !isMapFeatureIcon(drawKind) ? (
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
              className="absolute inset-0 z-[2]"
              width={map.width}
              height={map.height}
            >
              {(map.paths ?? []).map((path) => {
                const meta = MAP_PATH_KIND_META[path.kind];
                const pts = path.points
                  .map((p) => `${p.x * map.width},${p.y * map.height}`)
                  .join(" ");
                const active = selectedPathId === path.id;
                return (
                  <polyline
                    key={path.id}
                    data-map-path
                    points={pts}
                    fill="none"
                    stroke={meta.stroke}
                    strokeWidth={active ? meta.width + 1.5 : meta.width}
                    strokeDasharray={meta.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cn(
                      placingTool && !pathDrawKind
                        ? "pointer-events-none"
                        : "cursor-pointer",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPathId(path.id);
                      setSelectedPinId(null);
                      setSelectedRegionId(null);
                      setSelectedLabelId(null);
                      setSelectedChronicleId(null);
                    }}
                  />
                );
              })}
              {pathDraftPoints.length > 0 && pathDrawKind ? (
                <>
                  <polyline
                    points={pathDraftPoints
                      .map(
                        (p) =>
                          `${p.x * map.width},${p.y * map.height}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={MAP_PATH_KIND_META[pathDrawKind].stroke}
                    strokeWidth={MAP_PATH_KIND_META[pathDrawKind].width}
                    strokeDasharray={MAP_PATH_KIND_META[pathDrawKind].dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.75}
                  />
                  {pathDraftPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x * map.width}
                      cy={p.y * map.height}
                      r={4}
                      fill="rgba(247,243,234,0.95)"
                      stroke={MAP_PATH_KIND_META[pathDrawKind].stroke}
                      strokeWidth={1.5}
                    />
                  ))}
                </>
              ) : null}
            </svg>

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

            {map.labels.map((label) => {
              const active = selectedLabelId === label.id;
              return (
                <button
                  key={label.id}
                  type="button"
                  data-map-label
                  onPointerDown={(e) => startLabelDrag(e, label)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLabelId(label.id);
                    setSelectedPinId(null);
                    setSelectedRegionId(null);
                  }}
                  className={cn(
                    "absolute z-[4] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-md px-1.5 py-0.5 font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink-muted)] active:cursor-grabbing",
                    active &&
                      "bg-[rgba(247,243,234,0.9)] text-[var(--ink)] shadow-[0_4px_14px_rgba(45,42,38,0.1)] ring-1 ring-[rgba(45,42,38,0.12)]",
                    placingTool && !labelTool && "pointer-events-none",
                  )}
                  style={{
                    left: `${label.x * 100}%`,
                    top: `${label.y * 100}%`,
                  }}
                >
                  {label.text}
                </button>
              );
            })}

            {map.pins.map((pin) => {
              const loc = locById.get(pin.locationId);
              if (!loc) return null;
              const active = selectedPinId === loc.id;
              const focused = focusId === loc.id;
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
                    setSelectedLabelId(null);
                    setSelectedPathId(null);
                    setSelectedChronicleId(null);
                  }}
                  className={cn(
                    "absolute z-10 flex -translate-x-1/2 -translate-y-full cursor-grab flex-col items-center active:cursor-grabbing",
                    active && "z-20",
                    placingTool && "pointer-events-none",
                  )}
                  style={{
                    left: `${pin.x * 100}%`,
                    top: `${pin.y * 100}%`,
                  }}
                >
                  {focused ? (
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-1/2 h-8 w-8 -translate-x-1/2 translate-y-1/4 animate-pulse rounded-full border-2 border-[var(--accent)] opacity-60"
                    />
                  ) : null}
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

            {chronicleMarkers.map((event) => {
              const marker = event.mapMarker;
              if (!marker) return null;
              const active = selectedChronicleId === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  data-chronicle-marker
                  title={event.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedChronicleId(event.id);
                    setSelectedPinId(null);
                    setSelectedRegionId(null);
                    setSelectedLabelId(null);
                    setSelectedPathId(null);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    router.push("/chronicle");
                  }}
                  className={cn(
                    "absolute z-[6] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
                    active && "z-[7]",
                    placingTool && "pointer-events-none",
                  )}
                  style={{
                    left: `${marker.x * 100}%`,
                    top: `${marker.y * 100}%`,
                  }}
                >
                  {active ? (
                    <span className="mb-1 max-w-[8rem] truncate rounded-md bg-[rgba(247,243,234,0.92)] px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)] shadow-sm ring-1 ring-[rgba(45,42,38,0.1)]">
                      {event.title}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "flex h-3 w-3 items-center justify-center rounded-full border",
                      active
                        ? "border-[var(--accent)] bg-[rgba(176,141,87,0.35)]"
                        : "border-[rgba(45,42,38,0.2)] bg-[rgba(247,243,234,0.85)]",
                    )}
                  >
                    <Clock
                      className="h-2 w-2 text-[var(--ink-faint)]"
                      strokeWidth={2}
                    />
                  </span>
                </button>
              );
            })}

            {map.pins.length === 0 &&
            map.regions.length === 0 &&
            map.labels.length === 0 &&
            mapHasBasemap(map) ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="max-w-xs text-center font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-faint)]">
                  {locations.length === 0
                    ? "Add places in Locations, then pin them here."
                    : "Pin places from the rail, paint a Territory wash, or place Mountain / Water / Building icons."}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {isEmptyBoard && !dismissedEmptyWelcome ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center p-6"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.96)] p-5 shadow-[0_16px_40px_rgba(45,42,38,0.12)] backdrop-blur-xl">
              <p className="font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)]">
                Choose a board
              </p>
              <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                City builds a minimal street board you can zoom cleanly. New
                world drops a hard outline to reshape. Or stay blank and build
                your own.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {MAP_STARTERS.filter((s) => s.id !== "blank").map((starter) => (
                  <button
                    key={starter.id}
                    type="button"
                    disabled={basemapBusy || layoutBusy}
                    onClick={() => void onApplyStarter(starter.id)}
                    className="rounded-2xl border border-[rgba(45,42,38,0.1)] bg-[rgba(252,249,243,0.85)] px-4 py-3 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,rgba(45,42,38,0.1))] disabled:opacity-50"
                  >
                    <span className="block font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                      {starter.label}
                    </span>
                    <span className="mt-1 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                      {starter.hint}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[rgba(45,42,38,0.08)] pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={basemapBusy || layoutBusy}
                  onClick={() => setDismissedEmptyWelcome(true)}
                >
                  Start blank
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={basemapBusy || layoutBusy}
                  onClick={() => basemapInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Upload map
                </Button>
                {unplaced.length > 0 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={layoutBusy}
                    onClick={() => autoPlaceMapPins()}
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Place all
                  </Button>
                ) : null}
                <ClaudeDeepenButton
                  configured={claude?.configured ?? null}
                  busy={layoutBusy}
                  label="Build from story"
                  title="Read the manuscript and lay out geography"
                  onClick={() => void buildMapFromStory()}
                  className="rounded-full"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="folio-chrome absolute bottom-5 right-5 flex items-center gap-1 rounded-full border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.9)] p-1 shadow-[0_8px_24px_rgba(45,42,38,0.08)] backdrop-blur-xl">
          {hasLegendContent ? (
            <button
              type="button"
              aria-label="Toggle legend"
              title="Toggle legend"
              onClick={() => setShowLegend((v) => !v)}
              className={cn(
                "rounded-full p-2 transition-colors",
                showLegend
                  ? "text-[var(--ink)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
              )}
            >
              <List className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          ) : null}
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

        {showLegend && hasLegendContent ? (
          <div className="folio-chrome pointer-events-auto absolute right-5 top-5 max-w-[11rem] rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.88)] px-3 py-2.5 shadow-[0_8px_24px_rgba(45,42,38,0.08)] backdrop-blur-xl">
            <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              Legend
            </p>
            {legendItems.regionKinds.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {legendItems.regionKinds.map((kind) => {
                  const meta = MAP_REGION_KIND_META[kind];
                  return (
                    <li
                      key={kind}
                      className="flex items-center gap-2 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)]"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ background: meta.fill }}
                      />
                      {meta.label}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {legendItems.pathKinds.length > 0 ? (
              <ul
                className={cn(
                  "space-y-1",
                  legendItems.regionKinds.length > 0 ? "mt-2" : "mt-2",
                )}
              >
                {legendItems.pathKinds.map((kind) => {
                  const meta = MAP_PATH_KIND_META[kind];
                  return (
                    <li
                      key={kind}
                      className="flex items-center gap-2 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)]"
                    >
                      <span
                        className="h-0.5 w-4 shrink-0 rounded-full"
                        style={{ background: meta.stroke }}
                      />
                      {meta.label}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

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
                      : kind === "building"
                        ? Building2
                        : Square;
                const active = (selectedRegion.kind ?? "territory") === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      const fromIcon = isMapFeatureIcon(
                        selectedRegion.kind ?? "territory",
                      );
                      const toIcon = isMapFeatureIcon(kind);
                      const cx =
                        selectedRegion.x + selectedRegion.w / 2;
                      const cy =
                        selectedRegion.y + selectedRegion.h / 2;
                      if (toIcon) {
                        upsertMapRegion(
                          createMapRegion({
                            id: selectedRegion.id,
                            name: selectedRegion.name,
                            kind,
                            x: cx,
                            y: cy,
                            color:
                              selectedRegion.color ||
                              MAP_REGION_KIND_META[kind].defaultColor,
                            source: selectedRegion.source,
                          }),
                        );
                        return;
                      }
                      if (fromIcon) {
                        const w = 0.28;
                        const h = 0.22;
                        upsertMapRegion(
                          createMapRegion({
                            id: selectedRegion.id,
                            name: selectedRegion.name,
                            kind,
                            x: Math.max(0, Math.min(1 - w, cx - w / 2)),
                            y: Math.max(0, Math.min(1 - h, cy - h / 2)),
                            w,
                            h,
                            color:
                              selectedRegion.color ||
                              MAP_REGION_KIND_META[kind].defaultColor,
                            source: selectedRegion.source,
                          }),
                        );
                        return;
                      }
                      upsertMapRegion({
                        ...selectedRegion,
                        kind,
                        color:
                          selectedRegion.color ||
                          MAP_REGION_KIND_META[kind].defaultColor,
                      });
                    }}
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
            {!selectedIsIcon ? (
              <>
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
                          : shape === "polygon"
                            ? Pentagon
                            : Square;
                    const active = (selectedRegion.shape ?? "rect") === shape;
                    return (
                      <button
                        key={shape}
                        type="button"
                        title={meta.hint}
                        onClick={() => {
                          if (shape === "polygon") {
                            const { x, y, w, h } = selectedRegion;
                            upsertMapRegion({
                              ...selectedRegion,
                              shape: "polygon",
                              stroke: "ink",
                              rotation: 0,
                              points: [
                                { x, y },
                                { x: x + w, y },
                                { x: x + w, y: y + h },
                                { x, y: y + h },
                              ],
                            });
                            return;
                          }
                          if (isPolygonRegion(selectedRegion)) {
                            const { points: _points, ...rest } = selectedRegion;
                            upsertMapRegion({ ...rest, shape, points: undefined });
                            return;
                          }
                          upsertMapRegion({ ...selectedRegion, shape });
                        }}
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
                  Edge
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REGION_STROKES.map((stroke) => {
                    const meta = MAP_REGION_STROKE_META[stroke];
                    const active = (selectedRegion.stroke ?? "none") === stroke;
                    return (
                      <button
                        key={stroke}
                        type="button"
                        title={meta.hint}
                        onClick={() =>
                          upsertMapRegion({ ...selectedRegion, stroke })
                        }
                        className={cn(
                          "rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-xs transition-colors",
                          active
                            ? "bg-[var(--ink)] text-[var(--paper)]"
                            : "bg-[rgba(45,42,38,0.06)] text-[var(--ink-muted)] hover:text-[var(--ink)]",
                        )}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                {!selectedIsPolygon ? (
                  <>
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
                  </>
                ) : (
                  <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                    Drag the outline points to reshape · drag the fill to move
                  </p>
                )}
              </>
            ) : null}
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              {(selectedRegion.kind ?? "territory") === "building"
                ? "Color"
                : selectedIsIcon
                  ? "Color"
                  : "Wash"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MAP_TERRITORY_PALETTE.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  title={swatch.label}
                  aria-label={swatch.label}
                  onClick={() =>
                    upsertMapRegion({
                      ...selectedRegion,
                      color: swatch.id,
                    })
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
              {selectedRegion.kind === "building"
                ? "Drag to move · color-code buildings from the swatches"
                : selectedIsIcon
                ? "Drag to move · change Kind to Territory for area controls"
                : selectedIsPolygon
                  ? "Drag the outline points to reshape · drag the fill to move"
                  : "Drag to move · corner handles reshape · top handle rotates"}
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
              {!selectedIsIcon && !selectedIsPolygon ? (
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
              ) : null}
            </div>
          </motion.div>
        ) : null}

        {selectedPath && !selectedRegion && !selectedPin && !selectedLabel ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="folio-chrome absolute bottom-5 left-5 right-20 max-w-sm rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.95)] p-4 shadow-[0_16px_40px_rgba(45,42,38,0.1)] backdrop-blur-xl sm:right-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  {MAP_PATH_KIND_META[selectedPath.kind].label}
                </p>
                <input
                  value={selectedPath.name}
                  onChange={(e) =>
                    upsertMapPath({ ...selectedPath, name: e.target.value })
                  }
                  className="mt-1 w-full bg-transparent font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] outline-none"
                />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedPathId(null)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.65rem] leading-relaxed text-[var(--ink-faint)]">
              {selectedPath.points.length} points · click another route to edit
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  removeMapPath(selectedPath.id);
                  setSelectedPathId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </motion.div>
        ) : null}

        {selectedChronicle &&
        selectedChronicle.mapMarker &&
        !selectedRegion &&
        !selectedPin &&
        !selectedLabel &&
        !selectedPath ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="folio-chrome absolute bottom-5 left-5 right-20 max-w-sm rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.95)] p-4 shadow-[0_16px_40px_rgba(45,42,38,0.1)] backdrop-blur-xl sm:right-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Chronicle
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)]">
                  {selectedChronicle.title}
                </h2>
                {selectedChronicle.whenLabel ? (
                  <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                    {selectedChronicle.whenLabel}
                  </p>
                ) : null}
                {selectedChronicle.summary ? (
                  <p className="mt-2 line-clamp-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    {selectedChronicle.summary}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedChronicleId(null)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push("/chronicle")}>
                Open chronicle
              </Button>
            </div>
          </motion.div>
        ) : null}

        {selectedLabel && !selectedRegion && !selectedPin ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="folio-chrome absolute bottom-5 left-5 right-20 max-w-sm rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.95)] p-4 shadow-[0_16px_40px_rgba(45,42,38,0.1)] backdrop-blur-xl sm:right-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Label
                </p>
                <input
                  value={selectedLabel.text}
                  onChange={(e) =>
                    upsertMapLabel({
                      ...selectedLabel,
                      text: e.target.value,
                    })
                  }
                  className="mt-1 w-full bg-transparent font-[family-name:var(--font-display)] text-xl font-medium tracking-wide text-[var(--ink)] outline-none"
                />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedLabelId(null)}
                className="rounded-lg p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.65rem] leading-relaxed text-[var(--ink-faint)]">
              Drag to move on the board
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  removeMapLabel(selectedLabel.id);
                  setSelectedLabelId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </motion.div>
        ) : null}

        {selectedPin && !selectedRegion && !selectedLabel ? (
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
