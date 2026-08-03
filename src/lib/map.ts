import type {
  Book,
  Location,
  StoryMap,
  StoryMapLabel,
  StoryMapPin,
  StoryMapRegion,
  StoryMapRegionKind,
  StoryMapRegionShape,
} from "./types";
import { createId } from "./utils";

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
  }
> = {
  territory: {
    label: "Territory",
    defaultName: "Territory",
    defaultColor: "sage",
    fill: "rgba(122,138,112,0.32)",
    stroke: "rgba(95,115,90,0.42)",
  },
  mountains: {
    label: "Mountains",
    defaultName: "Range",
    defaultColor: "slate",
    fill: "rgba(138,142,146,0.28)",
    stroke: "rgba(88,94,100,0.48)",
  },
  water: {
    label: "Water",
    defaultName: "Water",
    defaultColor: "mist",
    fill: "rgba(92,148,178,0.36)",
    stroke: "rgba(60,118,150,0.5)",
  },
};

export const MAP_REGION_SHAPE_META: Record<
  StoryMapRegionShape,
  { label: string; hint: string }
> = {
  rect: { label: "Box", hint: "Straight sides" },
  ellipse: { label: "Oval", hint: "Rounded body — lakes, bays" },
  soft: { label: "Organic", hint: "Irregular edge — ranges, coasts" },
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

export function emptyStoryMap(name = "Map"): StoryMap {
  return {
    id: createId(),
    name: name.trim() || "Map",
    width: DEFAULT_MAP_WIDTH,
    height: DEFAULT_MAP_HEIGHT,
    pins: [],
    labels: [],
    regions: [],
  };
}

export function normalizeMap(partial?: Partial<StoryMap> | null): StoryMap {
  const base = emptyStoryMap();
  if (!partial) return base;
  const backgroundImage = normalizeBackgroundImage(partial.backgroundImage);
  const backgroundName = partial.backgroundName?.trim() || undefined;
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
    ...(backgroundImage
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

/**
 * Read an uploaded image, resize, and encode as JPEG data URL for the basemap.
 */
export async function prepareMapBackground(
  file: File,
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
  ctx.fillStyle = "#F3EEE4";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmapClose(bitmap);

  let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  // If still huge, try a stronger compress pass.
  if (dataUrl.length > 2_800_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.68);
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
  return {
    ...map,
    width: prepared.width,
    height: prepared.height,
    backgroundImage: prepared.dataUrl,
    backgroundName: prepared.name,
  };
}

export function clearMapBackground(map: StoryMap): StoryMap {
  const { backgroundImage: _img, backgroundName: _name, ...rest } = map;
  return {
    ...rest,
    width: rest.width || DEFAULT_MAP_WIDTH,
    height: rest.height || DEFAULT_MAP_HEIGHT,
  };
}

/**
 * Fetch a packaged basemap (e.g. /basemaps/london-bw.jpg) and prepare it
 * the same way as a user upload.
 */
export async function prepareMapBackgroundFromUrl(
  url: string,
  name: string,
): Promise<MapBackgroundPrepareResult> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Could not load that basemap.");
  }
  const blob = await res.blob();
  const file = new File([blob], `${name}.jpg`, {
    type: blob.type || "image/jpeg",
  });
  const prepared = await prepareMapBackground(file);
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

function normalizeKind(kind: unknown): StoryMapRegionKind {
  if (kind === "mountains" || kind === "water" || kind === "territory") {
    return kind;
  }
  return "territory";
}

function normalizeShape(
  shape: unknown,
  kind: StoryMapRegionKind,
): StoryMapRegionShape {
  if (shape === "rect" || shape === "ellipse" || shape === "soft") return shape;
  return defaultShapeForKind(kind);
}

function normalizeRotation(rotation: unknown): number {
  if (typeof rotation !== "number" || !Number.isFinite(rotation)) return 0;
  let r = rotation % 360;
  if (r < 0) r += 360;
  return Math.round(r * 10) / 10;
}

function normalizeRegion(r: Partial<StoryMapRegion>): StoryMapRegion | null {
  if (!r?.name?.trim() && !r?.id) return null;
  const kind = normalizeKind(r.kind);
  const w = Math.min(1, Math.max(0.04, r.w ?? 0.2));
  const h = Math.min(1, Math.max(0.04, r.h ?? 0.15));
  const fallbackColor = MAP_REGION_KIND_META[kind].defaultColor;
  const color =
    MAP_TERRITORY_PALETTE.find((c) => c.id === r.color)?.id ?? fallbackColor;
  const source =
    r.source === "claude" || r.source === "author" ? r.source : "author";
  return {
    id: r.id ?? createId(),
    name:
      (r.name ?? MAP_REGION_KIND_META[kind].defaultName).trim() ||
      MAP_REGION_KIND_META[kind].defaultName,
    kind,
    x: clamp01(r.x ?? 0.1),
    y: clamp01(r.y ?? 0.1),
    w,
    h,
    rotation: normalizeRotation(r.rotation),
    shape: normalizeShape(r.shape, kind),
    color,
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
  const n = (partial?.name ?? meta.defaultName).trim() || meta.defaultName;
  const color =
    MAP_TERRITORY_PALETTE.find((c) => c.id === partial?.color)?.id ??
    meta.defaultColor;
  return {
    id: partial?.id ?? createId(),
    name: n,
    kind,
    x: clamp01(partial?.x ?? 0.2),
    y: clamp01(partial?.y ?? 0.2),
    w: Math.min(1, Math.max(0.04, partial?.w ?? 0.28)),
    h: Math.min(1, Math.max(0.04, partial?.h ?? 0.22)),
    rotation: normalizeRotation(partial?.rotation),
    shape: normalizeShape(partial?.shape, kind),
    color,
    source: partial?.source === "claude" ? "claude" : "author",
  };
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
