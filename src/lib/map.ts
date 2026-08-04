import type {
  Book,
  Location,
  StoryMap,
  StoryMapLabel,
  StoryMapPath,
  StoryMapPathKind,
  StoryMapPin,
  StoryMapRegion,
  StoryMapRegionKind,
  StoryMapRegionShape,
  StoryMapRegionStroke,
} from "./types";
import { createId } from "./utils";
import {
  CITY_VECTOR_HEIGHT,
  CITY_VECTOR_WIDTH,
} from "./cityVector";

export const DEFAULT_MAP_WIDTH = 1200;
export const DEFAULT_MAP_HEIGHT = 800;

/** Feature kinds for the author map — practical markers, not ornate cartography. */
export const MAP_REGION_KIND_META: Record<
  StoryMapRegionKind,
  {
    label: string;
    defaultName: string;
    defaultColor: string;
    fill: string;
    stroke: string;
    /** Territory is a wash; mountains/water are placed icons. */
    placement: "area" | "icon";
  }
> = {
  territory: {
    label: "Territory",
    defaultName: "Territory",
    defaultColor: "sage",
    fill: "rgba(122,138,112,0.32)",
    stroke: "rgba(95,115,90,0.42)",
    placement: "area",
  },
  mountains: {
    label: "Mountain",
    defaultName: "Peak",
    defaultColor: "slate",
    fill: "rgba(138,142,146,0.28)",
    stroke: "rgba(88,94,100,0.48)",
    placement: "icon",
  },
  water: {
    label: "Water",
    defaultName: "Water",
    defaultColor: "mist",
    fill: "rgba(92,148,178,0.36)",
    stroke: "rgba(60,118,150,0.5)",
    placement: "icon",
  },
  building: {
    label: "Building",
    defaultName: "Building",
    defaultColor: "clay",
    fill: "rgba(168,130,118,0.28)",
    stroke: "rgba(120,95,85,0.48)",
    placement: "icon",
  },
};

/** Hit-box size (0–1) for mountain / water icons on the corkboard. */
export const MAP_FEATURE_ICON_SIZE = 0.052;

export function isMapFeatureIcon(kind: StoryMapRegionKind): boolean {
  return MAP_REGION_KIND_META[kind].placement === "icon";
}

/** Packaged basemaps shipped with Folio (under /public/basemaps). */
export const MAP_BASEMAP_PRESETS: Array<{
  id: string;
  label: string;
  hint: string;
  url: string;
  name: string;
}> = [];

export const MAP_REGION_SHAPE_META: Record<
  StoryMapRegionShape,
  { label: string; hint: string }
> = {
  rect: { label: "Box", hint: "Straight sides" },
  ellipse: { label: "Oval", hint: "Rounded body — lakes, bays" },
  soft: { label: "Organic", hint: "Irregular edge — ranges, coasts" },
  polygon: { label: "Outline", hint: "Drag vertices to reshape" },
};

export const MAP_REGION_STROKE_META: Record<
  StoryMapRegionStroke,
  { label: string; hint: string }
> = {
  none: { label: "None", hint: "Fill only — no edge" },
  soft: { label: "Soft", hint: "Faint wash edge" },
  ink: { label: "Ink", hint: "Thin corkboard line" },
};

export const MAP_PATH_KIND_META: Record<
  StoryMapPathKind,
  { label: string; stroke: string; dash?: string; width: number }
> = {
  road: {
    label: "Road",
    stroke: "rgba(90,78,62,0.55)",
    width: 2.5,
  },
  path: {
    label: "Path",
    stroke: "rgba(110,95,75,0.42)",
    dash: "4 5",
    width: 1.75,
  },
  river: {
    label: "River",
    stroke: "rgba(60,118,150,0.55)",
    width: 2.25,
  },
};

export function defaultShapeForKind(
  kind: StoryMapRegionKind,
): StoryMapRegionShape {
  if (kind === "water") return "ellipse";
  if (kind === "mountains") return "soft";
  return "rect";
}

export function regionOutlineStyle(shape: StoryMapRegionShape = "rect"): {
  borderRadius: string;
} {
  if (shape === "ellipse") return { borderRadius: "50%" };
  if (shape === "soft") {
    return { borderRadius: "48% 52% 42% 58% / 42% 58% 42% 58%" };
  }
  return { borderRadius: "1.75rem" };
}

/**
 * Organic clip-path for soft territories — deterministic from id so the
 * silhouette stays stable across renders.
 */
export function organicClipPath(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const points: string[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const wobble = 0.78 + ((h >> (i % 8)) % 7) * 0.028 + (i % 3) * 0.015;
    const x = 50 + Math.cos(angle) * 48 * wobble;
    const y = 50 + Math.sin(angle) * 46 * wobble;
    points.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
    h = (h * 17 + 23) >>> 0;
  }
  return `polygon(${points.join(", ")})`;
}

export function territoryStrokeStyle(
  stroke: StoryMapRegionStroke | undefined,
  colorStroke: string,
): { border?: string; boxShadow?: string } | null {
  const kind = stroke ?? "none";
  if (kind === "none") return null;
  if (kind === "soft") {
    return {
      boxShadow: `inset 0 0 0 1.5px ${colorStroke.replace(/[\d.]+\)$/, "0.22)")}`,
    };
  }
  return {
    border: `1.5px solid ${colorStroke.replace(/[\d.]+\)$/, "0.45)")}`,
  };
}

/**
 * Map board starters — same idea as encyclopedia stack packs.
 * City uses a real OpenStreetMap SVG board; other starters seed unlabeled geometry.
 */
export const MAP_STARTERS: Array<{
  id: string;
  label: string;
  hint: string;
  /** Suggested map title when the board is still named “Map”. */
  defaultName: string;
  /** Packaged vector board id (City). */
  vector?: "city";
}> = [
  {
    id: "blank",
    label: "Blank",
    hint: "Empty corkboard — pin and paint yourself",
    defaultName: "Map",
  },
  {
    id: "city",
    label: "City",
    hint: "Real OpenStreetMap streets — zoom and pin places",
    defaultName: "City",
    vector: "city",
  },
  {
    id: "new-world",
    label: "New world",
    hint: "Hard outline — drag the boundary points",
    defaultName: "New world",
  },
  {
    id: "region",
    label: "Region",
    hint: "A few territories, a river, peaks",
    defaultName: "Region",
  },
  {
    id: "coast",
    label: "Coast",
    hint: "Shoreline wash and shallows",
    defaultName: "Coast",
  },
];

function unlabeledRegion(
  partial: Partial<Omit<StoryMapRegion, "id" | "name">> & {
    name?: string;
  },
): StoryMapRegion {
  return createMapRegion({ ...partial, name: partial.name ?? "" });
}

function unlabeledPath(
  partial: Partial<Omit<StoryMapPath, "id" | "name">> & { name?: string },
): StoryMapPath {
  return createMapPath({ ...partial, name: partial.name ?? "" });
}

/**
 * Bounding box for polygon points in 0–1 map space.
 */
export function boundsFromPoints(
  points: Array<{ x: number; y: number }>,
): { x: number; y: number; w: number; h: number } {
  if (points.length === 0) {
    return { x: 0.2, y: 0.2, w: 0.28, h: 0.22 };
  }
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = Math.max(0.04, maxX - minX);
  const h = Math.max(0.04, maxY - minY);
  return {
    x: clamp01(minX),
    y: clamp01(minY),
    w: Math.min(1, w),
    h: Math.min(1, h),
  };
}

export function normalizePolygonPoints(
  points: Array<{ x: number; y: number }> | undefined,
): Array<{ x: number; y: number }> | undefined {
  if (!points || points.length < 3) return undefined;
  return points.map((p) => ({
    x: clamp01(p.x),
    y: clamp01(p.y),
  }));
}

export function isPolygonRegion(region: Pick<StoryMapRegion, "shape" | "points">): boolean {
  return (
    region.shape === "polygon" &&
    Array.isArray(region.points) &&
    region.points.length >= 3
  );
}

/**
 * Translate every polygon vertex (and refresh bbox). Used when dragging the fill.
 */
export function translatePolygonRegion(
  region: StoryMapRegion,
  dx: number,
  dy: number,
): StoryMapRegion {
  const pts = region.points;
  if (!pts || pts.length < 3) {
    return {
      ...region,
      x: Math.min(1 - region.w, Math.max(0, region.x + dx)),
      y: Math.min(1 - region.h, Math.max(0, region.y + dy)),
    };
  }
  // Keep the shape on the board — clamp translation so all points stay in 0–1.
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const adx = Math.min(1 - maxX, Math.max(-minX, dx));
  const ady = Math.min(1 - maxY, Math.max(-minY, dy));
  const nextPoints = pts.map((p) => ({
    x: clamp01(p.x + adx),
    y: clamp01(p.y + ady),
  }));
  const box = boundsFromPoints(nextPoints);
  return {
    ...region,
    ...box,
    points: nextPoints,
    shape: "polygon",
    rotation: 0,
  };
}

export function movePolygonVertex(
  region: StoryMapRegion,
  index: number,
  x: number,
  y: number,
): StoryMapRegion {
  const pts = [...(region.points ?? [])];
  if (index < 0 || index >= pts.length) return region;
  pts[index] = { x: clamp01(x), y: clamp01(y) };
  const box = boundsFromPoints(pts);
  return {
    ...region,
    ...box,
    points: pts,
    shape: "polygon",
    rotation: 0,
  };
}

/**
 * Simplified island outline (map 0–1) — hard coast to reshape.
 * Clockwise, recognizable silhouette — not GIS-perfect.
 */
export const NEW_WORLD_BRITAIN_OUTLINE: Array<{ x: number; y: number }> = [
  // Northern Scotland / Orkney cue
  { x: 0.54, y: 0.09 },
  { x: 0.58, y: 0.07 },
  { x: 0.61, y: 0.1 },
  { x: 0.62, y: 0.15 },
  { x: 0.6, y: 0.2 },
  { x: 0.61, y: 0.26 },
  { x: 0.63, y: 0.32 },
  // NE England
  { x: 0.66, y: 0.38 },
  { x: 0.7, y: 0.44 },
  { x: 0.73, y: 0.5 },
  { x: 0.74, y: 0.56 },
  // SE / Kent
  { x: 0.76, y: 0.62 },
  { x: 0.74, y: 0.68 },
  { x: 0.7, y: 0.72 },
  { x: 0.66, y: 0.76 },
  // South coast
  { x: 0.62, y: 0.8 },
  { x: 0.58, y: 0.82 },
  { x: 0.54, y: 0.8 },
  // Cornwall
  { x: 0.5, y: 0.78 },
  { x: 0.46, y: 0.8 },
  { x: 0.44, y: 0.76 },
  { x: 0.46, y: 0.7 },
  // Wales west
  { x: 0.44, y: 0.62 },
  { x: 0.4, y: 0.56 },
  { x: 0.38, y: 0.5 },
  { x: 0.4, y: 0.44 },
  // NW England / SW Scotland
  { x: 0.42, y: 0.38 },
  { x: 0.44, y: 0.3 },
  { x: 0.46, y: 0.24 },
  { x: 0.48, y: 0.18 },
  { x: 0.5, y: 0.13 },
];

export const NEW_WORLD_IRELAND_OUTLINE: Array<{ x: number; y: number }> = [
  { x: 0.26, y: 0.34 },
  { x: 0.3, y: 0.3 },
  { x: 0.34, y: 0.32 },
  { x: 0.36, y: 0.38 },
  { x: 0.37, y: 0.44 },
  { x: 0.36, y: 0.5 },
  { x: 0.34, y: 0.55 },
  { x: 0.3, y: 0.58 },
  { x: 0.26, y: 0.56 },
  { x: 0.24, y: 0.5 },
  { x: 0.23, y: 0.44 },
  { x: 0.24, y: 0.38 },
];

/**
 * New-world landmass — hard outline polygons to reshape.
 * Drag vertices to reshape; drag fill to move the whole island.
 */
export function seedNewWorldMapGeometry(): {
  regions: StoryMapRegion[];
  paths: StoryMapPath[];
} {
  const regions = [
    unlabeledRegion({
      kind: "territory",
      shape: "polygon",
      stroke: "ink",
      color: "sage",
      points: NEW_WORLD_BRITAIN_OUTLINE,
    }),
    unlabeledRegion({
      kind: "territory",
      shape: "polygon",
      stroke: "ink",
      color: "mist",
      points: NEW_WORLD_IRELAND_OUTLINE,
    }),
  ];
  return { regions, paths: [] };
}

/** Mid-scale region — a few movable territories with a river and peaks. */
export function seedRegionMapGeometry(): {
  regions: StoryMapRegion[];
  paths: StoryMapPath[];
} {
  const regions = [
    unlabeledRegion({
      kind: "territory",
      shape: "soft",
      stroke: "soft",
      color: "sage",
      x: 0.08,
      y: 0.18,
      w: 0.32,
      h: 0.42,
    }),
    unlabeledRegion({
      kind: "territory",
      shape: "soft",
      stroke: "soft",
      color: "clay",
      x: 0.36,
      y: 0.12,
      w: 0.3,
      h: 0.36,
    }),
    unlabeledRegion({
      kind: "territory",
      shape: "soft",
      stroke: "soft",
      color: "mist",
      x: 0.58,
      y: 0.36,
      w: 0.3,
      h: 0.4,
    }),
    unlabeledRegion({ kind: "mountains", x: 0.28, y: 0.22 }),
    unlabeledRegion({ kind: "mountains", x: 0.62, y: 0.2 }),
    unlabeledRegion({ kind: "water", x: 0.72, y: 0.58 }),
  ];
  const paths = [
    unlabeledPath({
      kind: "river",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.35, y: 0.4 },
        { x: 0.55, y: 0.55 },
        { x: 0.78, y: 0.62 },
      ],
    }),
    unlabeledPath({
      kind: "path",
      points: [
        { x: 0.18, y: 0.55 },
        { x: 0.4, y: 0.48 },
        { x: 0.65, y: 0.5 },
      ],
    }),
  ];
  return { regions, paths };
}

/** Coast — land wash meeting a string of water icons. */
export function seedCoastMapGeometry(): {
  regions: StoryMapRegion[];
  paths: StoryMapPath[];
} {
  const regions = [
    unlabeledRegion({
      kind: "territory",
      shape: "soft",
      stroke: "soft",
      color: "sage",
      x: 0.05,
      y: 0.1,
      w: 0.48,
      h: 0.78,
    }),
    unlabeledRegion({ kind: "water", x: 0.58, y: 0.18 }),
    unlabeledRegion({ kind: "water", x: 0.68, y: 0.32 }),
    unlabeledRegion({ kind: "water", x: 0.74, y: 0.48 }),
    unlabeledRegion({ kind: "water", x: 0.66, y: 0.64 }),
    unlabeledRegion({ kind: "water", x: 0.56, y: 0.76 }),
    unlabeledRegion({ kind: "mountains", x: 0.22, y: 0.28 }),
  ];
  const paths = [
    unlabeledPath({
      kind: "river",
      points: [
        { x: 0.2, y: 0.35 },
        { x: 0.35, y: 0.45 },
        { x: 0.48, y: 0.52 },
        { x: 0.58, y: 0.55 },
      ],
    }),
  ];
  return { regions, paths };
}

/**
 * Apply a geometry map starter onto a board (region / coast / new-world).
 * City uses {@link applyCityVectorBoard} / {@link prepareMapStarter}.
 */
export function applyMapStarter(map: StoryMap, starterId: string): StoryMap {
  const starter = MAP_STARTERS.find((s) => s.id === starterId);
  if (!starter || starter.id === "blank") return map;
  if (starter.vector === "city") return applyCityVectorBoard(map);

  let geometry: { regions: StoryMapRegion[]; paths: StoryMapPath[] };
  switch (starter.id) {
    case "new-world":
      geometry = seedNewWorldMapGeometry();
      break;
    case "region":
      geometry = seedRegionMapGeometry();
      break;
    case "coast":
      geometry = seedCoastMapGeometry();
      break;
    default:
      return map;
  }

  const keepDefaultName =
    !map.name.trim() || map.name.trim().toLowerCase() === "map";

  return {
    ...map,
    name: keepDefaultName ? starter.defaultName : map.name,
    regions: geometry.regions,
    paths: geometry.paths,
    labels: [],
  };
}

/** City board — OpenStreetMap SVG basemap, room to zoom. */
export function applyCityVectorBoard(map: StoryMap): StoryMap {
  const starter = MAP_STARTERS.find((s) => s.id === "city");
  const keepDefaultName =
    !map.name.trim() || map.name.trim().toLowerCase() === "map";
  const next: StoryMap = {
    ...map,
    name: keepDefaultName
      ? (starter?.defaultName ?? "City")
      : map.name,
    width: CITY_VECTOR_WIDTH,
    height: CITY_VECTOR_HEIGHT,
    backgroundVector: "city",
    regions: [],
    paths: [],
    labels: [],
  };
  delete next.backgroundImage;
  delete next.backgroundName;
  return next;
}

/**
 * Apply any starter, including City (OSM SVG board — fetched in the basemap).
 */
export async function prepareMapStarter(
  map: StoryMap,
  starterId: string,
): Promise<StoryMap> {
  return applyMapStarter(map, starterId);
}

/** Muted washes — soft paper tones for territories (and overrides). */
export const MAP_TERRITORY_PALETTE = [
  {
    id: "sage",
    label: "Sage",
    fill: "rgba(122,138,112,0.32)",
    stroke: "rgba(95,115,90,0.42)",
  },
  {
    id: "mist",
    label: "Mist",
    fill: "rgba(92,148,178,0.36)",
    stroke: "rgba(60,118,150,0.5)",
  },
  {
    id: "sand",
    label: "Sand",
    fill: "rgba(186,160,120,0.30)",
    stroke: "rgba(150,125,90,0.40)",
  },
  {
    id: "clay",
    label: "Clay",
    fill: "rgba(168,130,118,0.28)",
    stroke: "rgba(140,105,95,0.38)",
  },
  {
    id: "lilac",
    label: "Lilac",
    fill: "rgba(148,138,158,0.28)",
    stroke: "rgba(120,110,135,0.38)",
  },
  {
    id: "olive",
    label: "Olive",
    fill: "rgba(140,142,100,0.28)",
    stroke: "rgba(110,115,80,0.38)",
  },
  {
    id: "slate",
    label: "Slate",
    fill: "rgba(138,142,146,0.28)",
    stroke: "rgba(88,94,100,0.48)",
  },
  {
    id: "rose",
    label: "Rose",
    fill: "rgba(168,128,138,0.26)",
    stroke: "rgba(140,100,112,0.36)",
  },
] as const;

export function territoryStyle(
  colorId: string | undefined,
  kind: StoryMapRegionKind = "territory",
) {
  const palette = MAP_TERRITORY_PALETTE.find((c) => c.id === colorId);
  if (palette) return palette;
  const meta = MAP_REGION_KIND_META[kind];
  return {
    id: meta.defaultColor,
    label: meta.label,
    fill: meta.fill,
    stroke: meta.stroke,
  };
}

/** Stronger colors for feature icons (buildings, etc.) — readable at pin size. */
export function featureMarkerStyle(
  colorId: string | undefined,
  kind: StoryMapRegionKind = "building",
): { border: string; ink: string; fill: string } {
  const style = territoryStyle(colorId, kind);
  return {
    border: bumpRgbaAlpha(style.stroke, 0.55),
    ink: bumpRgbaAlpha(style.stroke, 0.95),
    fill: bumpRgbaAlpha(style.fill, 0.55),
  };
}

function bumpRgbaAlpha(color: string, alpha: number): string {
  if (color.startsWith("rgba(")) {
    return color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  }
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
  return color;
}

export function emptyStoryMap(name = "Map"): StoryMap {
  return {
    id: createId(),
    name: name.trim() || "Map",
    width: DEFAULT_MAP_WIDTH,
    height: DEFAULT_MAP_HEIGHT,
    pins: [],
    labels: [],
    regions: [],
    paths: [],
  };
}

export function normalizeMap(partial?: Partial<StoryMap> | null): StoryMap {
  const base = emptyStoryMap();
  if (!partial) return base;
  const backgroundImage = normalizeBackgroundImage(partial.backgroundImage);
  const backgroundName = partial.backgroundName?.trim() || undefined;
  const backgroundVector =
    partial.backgroundVector === "city" ? ("city" as const) : undefined;
  const name = (partial.name ?? base.name).trim() || "Map";
  return {
    id: partial.id?.trim() || base.id,
    name,
    width: partial.width ?? base.width,
    height: partial.height ?? base.height,
    pins: (partial.pins ?? []).map(normalizePin).filter(Boolean) as StoryMapPin[],
    labels: (partial.labels ?? []).map(normalizeLabel).filter(Boolean) as StoryMapLabel[],
    regions: (partial.regions ?? [])
      .map(normalizeRegion)
      .filter(Boolean) as StoryMapRegion[],
    paths: (partial.paths ?? [])
      .map(normalizePath)
      .filter(Boolean) as StoryMapPath[],
    ...(backgroundVector
      ? { backgroundVector }
      : backgroundImage
        ? { backgroundImage, backgroundName: backgroundName || "Basemap" }
        : {}),
  };
}

function normalizeBackgroundImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/")) return undefined;
  // Cap runaway payloads (localStorage books).
  if (trimmed.length > 4_500_000) return undefined;
  return trimmed;
}

/** Longest edge after resize — keeps basemaps usable in localStorage. */
export const MAP_BACKGROUND_MAX_EDGE = 2200;

export type MapBackgroundPrepareResult = {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
};

/** Folio paper + deep olive ink — for line-art city basemaps. */
export const MAP_LINE_ART_PAPER = "#F7F3EA";
export const MAP_LINE_ART_INK = { r: 0x2f, g: 0x35, b: 0x28 };

/**
 * Remap a B&W (or any) basemap onto Folio cream paper + deep olive roads.
 */
export function recolorLineArtBasemap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const br = 0xf7;
  const bg = 0xf3;
  const bb = 0xea;
  const { r: fr, g: fg, b: fb } = MAP_LINE_ART_INK;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a < 0.02) {
      d[i] = br;
      d[i + 1] = bg;
      d[i + 2] = bb;
      d[i + 3] = 255;
      continue;
    }
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    d[i] = Math.round(fr + (br - fr) * lum);
    d[i + 1] = Math.round(fg + (bg - fg) * lum);
    d[i + 2] = Math.round(fb + (bb - fb) * lum);
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Read an uploaded image, resize, and encode as JPEG data URL for the basemap.
 */
export async function prepareMapBackground(
  file: File,
  options?: { folioLineArt?: boolean },
): Promise<MapBackgroundPrepareResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (PNG, JPEG, or WebP).");
  }
  if (file.size > 18 * 1024 * 1024) {
    throw new Error("That image is too large — try one under 18 MB.");
  }

  const bitmap = await loadImageElement(file);
  const scale = Math.min(
    1,
    MAP_BACKGROUND_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmapClose(bitmap);
    throw new Error("Could not prepare the map image.");
  }
  ctx.fillStyle = options?.folioLineArt ? MAP_LINE_ART_PAPER : "#F3EEE4";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmapClose(bitmap);

  if (options?.folioLineArt) {
    recolorLineArtBasemap(ctx, width, height);
  }

  let dataUrl = options?.folioLineArt
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", 0.82);
  // If still huge, try a stronger compress pass.
  if (!options?.folioLineArt && dataUrl.length > 2_800_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.68);
  }
  if (options?.folioLineArt && dataUrl.length > 4_000_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  }
  if (dataUrl.length > 4_000_000) {
    throw new Error(
      "That map is still too large after compressing. Try a smaller image.",
    );
  }

  const name = (file.name || "Basemap").replace(/\.[^.]+$/, "") || "Basemap";
  return { dataUrl, width, height, name };
}

function loadImageElement(
  file: File,
): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function bitmapClose(bitmap: HTMLImageElement | ImageBitmap) {
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }
}

export function applyMapBackground(
  map: StoryMap,
  prepared: MapBackgroundPrepareResult,
): StoryMap {
  const next: StoryMap = {
    ...map,
    width: prepared.width,
    height: prepared.height,
    backgroundImage: prepared.dataUrl,
    backgroundName: prepared.name,
  };
  delete next.backgroundVector;
  return next;
}

export function clearMapBackground(map: StoryMap): StoryMap {
  const {
    backgroundImage: _img,
    backgroundName: _name,
    backgroundVector: _vec,
    ...rest
  } = map;
  return {
    ...rest,
    width: rest.width || DEFAULT_MAP_WIDTH,
    height: rest.height || DEFAULT_MAP_HEIGHT,
  };
}

export function mapHasBasemap(map: StoryMap): boolean {
  return Boolean(map.backgroundImage || map.backgroundVector);
}

/**
 * Fetch a packaged basemap and prepare it the same way as a user upload.
 */
export async function prepareMapBackgroundFromUrl(
  url: string,
  name: string,
  options?: { folioLineArt?: boolean },
): Promise<MapBackgroundPrepareResult> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not load that basemap.");
  }
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const file = new File([blob], `${name}.${ext}`, {
    type: blob.type || "image/png",
  });
  const prepared = await prepareMapBackground(file, options);
  return { ...prepared, name };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function normalizePin(p: Partial<StoryMapPin>): StoryMapPin | null {
  if (!p?.locationId) return null;
  return {
    id: p.id ?? createId(),
    locationId: p.locationId,
    x: clamp01(p.x ?? 0.5),
    y: clamp01(p.y ?? 0.5),
    label: p.label?.trim() || undefined,
    rationale: p.rationale?.trim() || undefined,
  };
}

function normalizeLabel(l: Partial<StoryMapLabel>): StoryMapLabel | null {
  if (!l?.text?.trim()) return null;
  return {
    id: l.id ?? createId(),
    text: l.text.trim(),
    x: clamp01(l.x ?? 0.5),
    y: clamp01(l.y ?? 0.5),
  };
}

function normalizeStroke(stroke: unknown): StoryMapRegionStroke {
  if (stroke === "soft" || stroke === "ink" || stroke === "none") return stroke;
  return "none";
}

function normalizePathKind(kind: unknown): StoryMapPathKind {
  if (kind === "road" || kind === "path" || kind === "river") return kind;
  return "road";
}

function normalizePath(p: Partial<StoryMapPath>): StoryMapPath | null {
  const points = (p.points ?? [])
    .map((pt) => ({
      x: clamp01(pt?.x ?? 0.5),
      y: clamp01(pt?.y ?? 0.5),
    }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (points.length < 2) return null;
  const kind = normalizePathKind(p.kind);
  return {
    id: p.id ?? createId(),
    name:
      p.name === undefined
        ? MAP_PATH_KIND_META[kind].label
        : p.name.trim(),
    kind,
    points,
    source: p.source === "claude" ? "claude" : "author",
  };
}

function normalizeKind(kind: unknown): StoryMapRegionKind {
  if (
    kind === "mountains" ||
    kind === "water" ||
    kind === "building" ||
    kind === "territory"
  ) {
    return kind;
  }
  return "territory";
}

function normalizeShape(
  shape: unknown,
  kind: StoryMapRegionKind,
): StoryMapRegionShape {
  if (
    shape === "rect" ||
    shape === "ellipse" ||
    shape === "soft" ||
    shape === "polygon"
  ) {
    return shape;
  }
  return defaultShapeForKind(kind);
}

function normalizeRotation(rotation: unknown): number {
  if (typeof rotation !== "number" || !Number.isFinite(rotation)) return 0;
  let r = rotation % 360;
  if (r < 0) r += 360;
  return Math.round(r * 10) / 10;
}

function normalizeRegion(r: Partial<StoryMapRegion>): StoryMapRegion | null {
  if (!r) return null;
  const kind = normalizeKind(r.kind);
  const hasGeom =
    Boolean(r.id) ||
    r.x != null ||
    r.y != null ||
    r.w != null ||
    r.h != null ||
    (Array.isArray(r.points) && r.points.length >= 3);
  if (!hasGeom && !r.name?.trim()) return null;
  const fallbackColor = MAP_REGION_KIND_META[kind].defaultColor;
  const color =
    MAP_TERRITORY_PALETTE.find((c) => c.id === r.color)?.id ?? fallbackColor;
  const source =
    r.source === "claude" || r.source === "author" ? r.source : "author";
  const name =
    r.name === undefined
      ? MAP_REGION_KIND_META[kind].defaultName
      : r.name.trim();

  if (isMapFeatureIcon(kind)) {
    const rawW = r.w ?? MAP_FEATURE_ICON_SIZE;
    const rawH = r.h ?? MAP_FEATURE_ICON_SIZE;
    const cx = clamp01((r.x ?? 0.5) + rawW / 2);
    const cy = clamp01((r.y ?? 0.5) + rawH / 2);
    const size = MAP_FEATURE_ICON_SIZE;
    return {
      id: r.id ?? createId(),
      name,
      kind,
      x: clamp01(cx - size / 2),
      y: clamp01(cy - size / 2),
      w: size,
      h: size,
      rotation: 0,
      shape: "rect",
      color,
      source,
    };
  }

  const points = normalizePolygonPoints(r.points);
  const shape =
    points && (r.shape === "polygon" || points.length >= 3)
      ? ("polygon" as const)
      : normalizeShape(r.shape, kind);

  if (shape === "polygon" && points) {
    const box = boundsFromPoints(points);
    return {
      id: r.id ?? createId(),
      name,
      kind,
      ...box,
      rotation: 0,
      shape: "polygon",
      color,
      stroke: normalizeStroke(r.stroke ?? "ink"),
      points,
      source,
    };
  }

  const w = Math.min(1, Math.max(0.04, r.w ?? 0.2));
  const h = Math.min(1, Math.max(0.04, r.h ?? 0.15));
  return {
    id: r.id ?? createId(),
    name,
    kind,
    x: clamp01(r.x ?? 0.1),
    y: clamp01(r.y ?? 0.1),
    w,
    h,
    rotation: normalizeRotation(r.rotation),
    shape,
    color,
    stroke: normalizeStroke(r.stroke),
    source,
  };
}

function pruneMapPins(map: StoryMap, locIds: Set<string>): StoryMap {
  const pins = map.pins.filter((p) => locIds.has(p.locationId));
  if (pins.length === map.pins.length) return map;
  return { ...map, pins };
}

function mapsEqual(a: StoryMap, b: StoryMap): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.width === b.width &&
    a.height === b.height &&
    a.pins.length === b.pins.length &&
    a.pins.every(
      (p, i) =>
        p.id === b.pins[i]?.id &&
        p.locationId === b.pins[i]?.locationId &&
        p.x === b.pins[i]?.x &&
        p.y === b.pins[i]?.y &&
        p.label === b.pins[i]?.label,
    ) &&
    a.labels.length === b.labels.length &&
    a.regions.length === b.regions.length &&
    a.regions.every(
      (r, i) =>
        r.id === b.regions[i]?.id &&
        r.kind === b.regions[i]?.kind &&
        r.color === b.regions[i]?.color &&
        r.x === b.regions[i]?.x &&
        r.y === b.regions[i]?.y &&
        r.w === b.regions[i]?.w &&
        r.h === b.regions[i]?.h &&
        (r.rotation ?? 0) === (b.regions[i]?.rotation ?? 0) &&
        (r.shape ?? "rect") === (b.regions[i]?.shape ?? "rect") &&
        r.name === b.regions[i]?.name,
    ) &&
    (a.backgroundName ?? "") === (b.backgroundName ?? "") &&
    (a.backgroundImage?.length ?? 0) === (b.backgroundImage?.length ?? 0)
  );
}

/**
 * Ensure maps[] + activeMapId exist (migrating legacy book.map),
 * prune dead pins, and keep book.map mirrored to the active map.
 */
export function ensureBookMap(book: Book): Book {
  const locIds = new Set((book.locations ?? []).map((l) => l.id));
  let maps: StoryMap[] = [];

  if (Array.isArray(book.maps) && book.maps.length > 0) {
    maps = book.maps.map((m) => pruneMapPins(normalizeMap(m), locIds));
  } else if (book.map) {
    maps = [pruneMapPins(normalizeMap(book.map), locIds)];
    if (!maps[0].name?.trim()) maps[0] = { ...maps[0], name: "Map" };
  } else {
    maps = [emptyStoryMap("Map")];
  }

  // Dedupe ids
  const seen = new Set<string>();
  maps = maps.map((m) => {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      return m;
    }
    const id = createId();
    seen.add(id);
    return { ...m, id };
  });

  let activeMapId = book.activeMapId;
  if (!maps.some((m) => m.id === activeMapId)) {
    activeMapId = maps[0].id;
  }
  const active = maps.find((m) => m.id === activeMapId) ?? maps[0];

  const same =
    book.activeMapId === activeMapId &&
    book.map &&
    mapsEqual(book.map, active) &&
    (book.maps?.length ?? 0) === maps.length &&
    (book.maps ?? []).every((m, i) => mapsEqual(m, maps[i]));

  if (same) return book;
  return { ...book, maps, activeMapId, map: active };
}

/** Replace the active map contents (keeps id/name unless provided). */
export function replaceActiveMap(book: Book, nextMap: StoryMap): Book {
  const ensured = ensureBookMap(book);
  const normalized = normalizeMap({
    ...nextMap,
    id: ensured.activeMapId,
    name: nextMap.name?.trim() || ensured.map.name,
  });
  const maps = ensured.maps.map((m) =>
    m.id === ensured.activeMapId ? normalized : m,
  );
  return ensureBookMap({
    ...ensured,
    maps,
    map: normalized,
    activeMapId: ensured.activeMapId,
  });
}

export function addStoryMap(book: Book, name?: string): Book {
  const ensured = ensureBookMap(book);
  const n = (name ?? `Map ${ensured.maps.length + 1}`).trim() || "Map";
  const created = emptyStoryMap(n);
  return ensureBookMap({
    ...ensured,
    maps: [...ensured.maps, created],
    activeMapId: created.id,
    map: created,
  });
}

export function setActiveStoryMap(book: Book, mapId: string): Book {
  const ensured = ensureBookMap(book);
  if (!ensured.maps.some((m) => m.id === mapId)) return ensured;
  const active = ensured.maps.find((m) => m.id === mapId)!;
  if (ensured.activeMapId === mapId && mapsEqual(ensured.map, active)) {
    return ensured;
  }
  return { ...ensured, activeMapId: mapId, map: active };
}

export function renameStoryMap(
  book: Book,
  mapId: string,
  name: string,
): Book {
  const ensured = ensureBookMap(book);
  const n = name.trim() || "Map";
  const maps = ensured.maps.map((m) =>
    m.id === mapId ? { ...m, name: n } : m,
  );
  const active =
    maps.find((m) => m.id === ensured.activeMapId) ?? maps[0];
  return ensureBookMap({
    ...ensured,
    maps,
    map: active,
  });
}

export function removeStoryMap(book: Book, mapId: string): Book {
  const ensured = ensureBookMap(book);
  if (ensured.maps.length <= 1) return ensured;
  const maps = ensured.maps.filter((m) => m.id !== mapId);
  if (maps.length === ensured.maps.length) return ensured;
  const activeMapId =
    ensured.activeMapId === mapId ? maps[0].id : ensured.activeMapId;
  const active = maps.find((m) => m.id === activeMapId) ?? maps[0];
  return ensureBookMap({
    ...ensured,
    maps,
    activeMapId,
    map: active,
  });
}

export function duplicateStoryMap(book: Book, mapId: string): Book {
  const ensured = ensureBookMap(book);
  const source = ensured.maps.find((m) => m.id === mapId);
  if (!source) return ensured;
  const copy = normalizeMap({
    ...source,
    id: createId(),
    name: `${source.name} copy`,
    pins: source.pins.map((p) => ({ ...p, id: createId() })),
    labels: source.labels.map((l) => ({ ...l, id: createId() })),
    regions: source.regions.map((r) => ({ ...r, id: createId() })),
    paths: (source.paths ?? []).map((p) => ({ ...p, id: createId() })),
  });
  return ensureBookMap({
    ...ensured,
    maps: [...ensured.maps, copy],
    activeMapId: copy.id,
    map: copy,
  });
}

export function createMapPin(
  locationId: string,
  x = 0.5,
  y = 0.5,
  label?: string,
  rationale?: string,
): StoryMapPin {
  return {
    id: createId(),
    locationId,
    x: clamp01(x),
    y: clamp01(y),
    label: label?.trim() || undefined,
    rationale: rationale?.trim() || undefined,
  };
}

export function createMapRegion(
  partial?: Partial<Omit<StoryMapRegion, "id">> & { id?: string },
): StoryMapRegion {
  const kind = normalizeKind(partial?.kind);
  const meta = MAP_REGION_KIND_META[kind];
  const name =
    partial && Object.prototype.hasOwnProperty.call(partial, "name")
      ? (partial.name ?? "").trim()
      : meta.defaultName;
  const color =
    MAP_TERRITORY_PALETTE.find((c) => c.id === partial?.color)?.id ??
    meta.defaultColor;

  if (isMapFeatureIcon(kind)) {
    const size = MAP_FEATURE_ICON_SIZE;
    // Accept either top-left box or center point via x/y + optional w/h.
    const rawW = partial?.w ?? size;
    const rawH = partial?.h ?? size;
    const cx = clamp01((partial?.x ?? 0.5) + (partial?.w != null ? rawW / 2 : 0));
    const cy = clamp01((partial?.y ?? 0.5) + (partial?.h != null ? rawH / 2 : 0));
    // If caller passed center coords (no w/h), x/y are already the center.
    const centerX =
      partial?.w == null && partial?.h == null
        ? clamp01(partial?.x ?? 0.5)
        : cx;
    const centerY =
      partial?.w == null && partial?.h == null
        ? clamp01(partial?.y ?? 0.5)
        : cy;
    return {
      id: partial?.id ?? createId(),
      name,
      kind,
      x: clamp01(centerX - size / 2),
      y: clamp01(centerY - size / 2),
      w: size,
      h: size,
      rotation: 0,
      shape: "rect",
      color,
      source: partial?.source === "claude" ? "claude" : "author",
    };
  }

  const points = normalizePolygonPoints(partial?.points);
  if (partial?.shape === "polygon" && points) {
    const box = boundsFromPoints(points);
    return {
      id: partial?.id ?? createId(),
      name,
      kind,
      ...box,
      rotation: 0,
      shape: "polygon",
      color,
      stroke: normalizeStroke(partial?.stroke ?? "ink"),
      points,
      source: partial?.source === "claude" ? "claude" : "author",
    };
  }

  return {
    id: partial?.id ?? createId(),
    name,
    kind,
    x: clamp01(partial?.x ?? 0.2),
    y: clamp01(partial?.y ?? 0.2),
    w: Math.min(1, Math.max(0.04, partial?.w ?? 0.28)),
    h: Math.min(1, Math.max(0.04, partial?.h ?? 0.22)),
    rotation: normalizeRotation(partial?.rotation),
    shape: normalizeShape(partial?.shape, kind),
    color,
    stroke: normalizeStroke(partial?.stroke),
    source: partial?.source === "claude" ? "claude" : "author",
  };
}

export function createMapLabel(
  partial?: Partial<StoryMapLabel> & { text?: string },
): StoryMapLabel {
  return {
    id: partial?.id ?? createId(),
    text: (partial?.text ?? "Label").trim() || "Label",
    x: clamp01(partial?.x ?? 0.5),
    y: clamp01(partial?.y ?? 0.5),
  };
}

export function upsertLabelOnMap(
  map: StoryMap,
  label: StoryMapLabel,
): StoryMap {
  const normalized = normalizeLabel(label);
  if (!normalized) return map;
  const idx = map.labels.findIndex((l) => l.id === normalized.id);
  const labels = [...map.labels];
  if (idx >= 0) labels[idx] = normalized;
  else labels.push(normalized);
  return { ...map, labels };
}

export function removeLabelFromMap(map: StoryMap, labelId: string): StoryMap {
  return {
    ...map,
    labels: map.labels.filter((l) => l.id !== labelId),
  };
}

export function createMapPath(
  partial?: Partial<Omit<StoryMapPath, "id">> & { id?: string },
): StoryMapPath {
  const kind = normalizePathKind(partial?.kind);
  const points = (partial?.points ?? []).map((pt) => ({
    x: clamp01(pt.x),
    y: clamp01(pt.y),
  }));
  const safePoints =
    points.length >= 2
      ? points
      : [
          { x: 0.25, y: 0.4 },
          { x: 0.75, y: 0.55 },
        ];
  const name =
    partial && Object.prototype.hasOwnProperty.call(partial, "name")
      ? (partial.name ?? "").trim()
      : MAP_PATH_KIND_META[kind].label;
  return {
    id: partial?.id ?? createId(),
    name,
    kind,
    points: safePoints,
    source: partial?.source === "claude" ? "claude" : "author",
  };
}

export function upsertPathOnMap(map: StoryMap, path: StoryMapPath): StoryMap {
  const normalized = normalizePath(path);
  if (!normalized) return map;
  const idx = (map.paths ?? []).findIndex((p) => p.id === normalized.id);
  const paths = [...(map.paths ?? [])];
  if (idx >= 0) paths[idx] = normalized;
  else paths.push(normalized);
  return { ...map, paths };
}

export function removePathFromMap(map: StoryMap, pathId: string): StoryMap {
  return {
    ...map,
    paths: (map.paths ?? []).filter((p) => p.id !== pathId),
  };
}

/** Maps in this book that pin a given location. */
export function mapsPinningLocation(
  book: Pick<Book, "maps" | "map" | "activeMapId">,
  locationId: string,
): StoryMap[] {
  const maps =
    book.maps && book.maps.length > 0
      ? book.maps
      : book.map
        ? [book.map]
        : [];
  return maps.filter((m) => m.pins.some((p) => p.locationId === locationId));
}

export function upsertPinOnMap(map: StoryMap, pin: StoryMapPin): StoryMap {
  const existing = map.pins.findIndex(
    (p) => p.id === pin.id || p.locationId === pin.locationId,
  );
  const pins = [...map.pins];
  const next = {
    ...pin,
    x: clamp01(pin.x),
    y: clamp01(pin.y),
  };
  if (existing >= 0) {
    pins[existing] = { ...pins[existing], ...next, id: pins[existing].id };
  } else {
    pins.push(next);
  }
  return { ...map, pins };
}

export function upsertRegionOnMap(
  map: StoryMap,
  region: StoryMapRegion,
): StoryMap {
  const normalized = normalizeRegion(region);
  if (!normalized) return map;
  const idx = map.regions.findIndex((r) => r.id === normalized.id);
  const regions = [...map.regions];
  if (idx >= 0) regions[idx] = normalized;
  else regions.push(normalized);
  return { ...map, regions };
}

export function removeRegionFromMap(map: StoryMap, regionId: string): StoryMap {
  return {
    ...map,
    regions: map.regions.filter((r) => r.id !== regionId),
  };
}

export function removePinFromMap(
  map: StoryMap,
  locationIdOrPinId: string,
): StoryMap {
  return {
    ...map,
    pins: map.pins.filter(
      (p) => p.id !== locationIdOrPinId && p.locationId !== locationIdOrPinId,
    ),
  };
}

export function pinForLocation(
  map: StoryMap,
  locationId: string,
): StoryMapPin | undefined {
  return map.pins.find((p) => p.locationId === locationId);
}

export function unplacedLocations(
  locations: Location[],
  map: StoryMap,
): Location[] {
  const placed = new Set(map.pins.map((p) => p.locationId));
  return locations.filter((l) => !placed.has(l.id));
}

/** Scatter unplaced locations in a loose grid for a first layout. */
export function autoPlaceUnpinned(
  map: StoryMap,
  locations: Location[],
): StoryMap {
  const unplaced = unplacedLocations(locations, map);
  if (unplaced.length === 0) return map;
  let next = map;
  const cols = Math.ceil(Math.sqrt(unplaced.length));
  unplaced.forEach((loc, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 0.18 + (col / Math.max(1, cols - 1 || 1)) * 0.64;
    const y =
      0.2 +
      (row / Math.max(1, Math.ceil(unplaced.length / cols) - 1 || 1)) * 0.55;
    const jx = ((loc.id.charCodeAt(0) % 7) - 3) * 0.008;
    const jy = ((loc.id.charCodeAt(1) % 7) - 3) * 0.008;
    next = upsertPinOnMap(
      next,
      createMapPin(loc.id, x + jx, y + jy, loc.name.trim() || undefined),
    );
  });
  return next;
}

export function sampleMapForLocations(locations: Location[]): StoryMap {
  const map = emptyStoryMap("Map");
  if (locations.length === 0) return map;
  const presets: [number, number][] = [
    [0.28, 0.32],
    [0.48, 0.42],
    [0.62, 0.28],
    [0.42, 0.62],
    [0.72, 0.55],
    [0.22, 0.58],
  ];
  return locations.reduce((m, loc, i) => {
    const [x, y] = presets[i % presets.length];
    return upsertPinOnMap(m, createMapPin(loc.id, x, y, loc.name.trim() || undefined));
  }, map);
}

/**
 * Spread clustered pins across the board while keeping relative geography.
 * Turns a tight AI cluster into something that reads like a city layout.
 */
export function expandMapPins(
  map: StoryMap,
  options?: { padding?: number },
): StoryMap {
  const pins = map.pins;
  if (pins.length < 2) return map;

  const padding = options?.padding ?? 0.1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pins) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const spanX = Math.max(maxX - minX, 0.012);
  const spanY = Math.max(maxY - minY, 0.012);
  const target = 1 - padding * 2;
  // Uniform scale so north/south/east/west relationships stay true
  const fitScale = Math.min(target / spanX, target / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const nextPins = pins.map((p) => ({
    ...p,
    x: clamp01(0.5 + (p.x - cx) * fitScale),
    y: clamp01(0.5 + (p.y - cy) * fitScale),
  }));

  return { ...map, pins: nextPins };
}

/** Bounding box of pins in 0–1 map space (with padding). */
export function pinBounds(
  pins: { x: number; y: number }[],
  pad = 0.06,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  if (pins.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pins) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return {
    minX: Math.max(0, minX - pad),
    maxX: Math.min(1, maxX + pad),
    minY: Math.max(0, minY - pad),
    maxY: Math.min(1, maxY + pad),
  };
}
