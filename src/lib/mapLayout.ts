import type {
  Book,
  Location,
  StoryMap,
  StoryMapPin,
  StoryMapRegion,
  StoryMapRegionKind,
  StoryMapRegionShape,
} from "@/lib/types";
import {
  createLocationConnection,
  findLocationByName,
  locationAppearances,
} from "@/lib/locations";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "@/lib/manuscriptContext";
import {
  createMapPin,
  createMapRegion,
  emptyStoryMap,
  expandMapPins,
  MAP_REGION_KIND_META,
  upsertPinOnMap,
} from "@/lib/map";
import type Anthropic from "@anthropic-ai/sdk";

export const LAYOUT_MAP_TOOL = "layout_story_map";

/** Slightly larger excerpts for geography accuracy. */
const MAP_EXCERPT_CHARS = 1400;

export type MapLayoutPin = {
  locationId: string;
  x: number;
  y: number;
  /** Optional name Claude may send instead of / alongside id. */
  name?: string;
  /** One short sentence: why this spot relative to others. */
  rationale?: string;
};

export type MapLayoutRegion = {
  name: string;
  kind: StoryMapRegionKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  shape?: StoryMapRegionShape;
  color?: string;
};

export type MapLayoutConnection = {
  fromLocationId?: string;
  fromName?: string;
  toLocationId?: string;
  toName?: string;
  label?: string;
  notes?: string;
};

export type MapLayoutPayload = {
  /** Brief overview of the geography Claude inferred (for the UI). */
  summary?: string;
  pins: MapLayoutPin[];
  regions?: MapLayoutRegion[];
  connections?: MapLayoutConnection[];
};

function scenePlain(html: string): string {
  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function clamp01(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0.5;
  return Math.min(0.92, Math.max(0.08, v));
}

function clampSize(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(0.85, Math.max(0.06, v));
}

const SPATIAL_RE =
  /\b(north|south|east|west|northeast|northwest|southeast|southwest|beyond|beside|behind|across|toward|towards|near|above|below|outside|inside|down the|up the|across from|next to|along the|edge of|outskirts|road to|path to|miles?|walk from|days? (?:north|south|east|west)|journey|border|river|mountain|valley|coast|harbor|harbour|forest|desert|island|pass|gate|wall|bridge)\b/i;

/** Build context so Claude can infer relative geography. */
export function buildMapLayoutContext(
  book: Pick<Book, "title" | "chapters" | "locations" | "map">,
): string {
  const locations = book.locations ?? [];
  const map = book.map ?? emptyStoryMap();
  const pinByLoc = new Map(map.pins.map((p) => [p.locationId, p]));

  const atlasLines = locations.map((loc, i) => {
    const pin = pinByLoc.get(loc.id);
    const apps = locationAppearances(book.chapters, loc);
    const links = (loc.connections ?? [])
      .map(
        (c) =>
          `${c.label} → ${c.toName || c.toLocationId}${c.notes ? ` (${c.notes})` : ""}`,
      )
      .join("; ");
    const wiki =
      loc.wiki?.trim() && !loc.wiki.trim().startsWith("Compiled from")
        ? loc.wiki.trim().slice(0, 280)
        : "";
    const digest = loc.storyDigest?.trim().slice(0, 200) || "";
    const sensory = [
      loc.sensory?.sight,
      loc.sensory?.sound,
      loc.sensory?.smell,
    ]
      .filter(Boolean)
      .join("; ")
      .slice(0, 160);
    return [
      `${i + 1}. id=${loc.id}`,
      `name=${loc.name}`,
      loc.kind !== "unspecified" ? `kind=${loc.kind}` : "",
      loc.place?.region ? `region=${loc.place.region}` : "",
      loc.place?.access ? `access=${loc.place.access}` : "",
      loc.place?.landmarks ? `landmarks=${loc.place.landmarks}` : "",
      loc.place?.scale ? `scale=${loc.place.scale}` : "",
      loc.shortBio ? `blurb=${loc.shortBio}` : "",
      wiki ? `wiki=${wiki}` : "",
      digest ? `digest=${digest}` : "",
      sensory ? `sensory=${sensory}` : "",
      links ? `connections=${links}` : "",
      apps.length ? `appears_in=${apps.length} scene(s)` : "",
      pin
        ? `current_pin=x:${pin.x.toFixed(2)},y:${pin.y.toFixed(2)}`
        : "current_pin=unplaced",
    ]
      .filter(Boolean)
      .join(" | ");
  });

  const names = locations
    .flatMap((l) => [l.name, ...l.aliases])
    .map((n) => n.trim())
    .filter((n) => n.length > 1);

  const chapterBlocks = book.chapters.map((ch, ci) => {
    const parts = getSceneHtmlParts(ch.content);
    const blocks: string[] = [];
    parts.forEach((html, si) => {
      const text = scenePlain(html);
      if (text.length < 28) return;
      const lower = text.toLowerCase();
      const mentionsPlace = names.some((n) =>
        lower.includes(n.toLowerCase()),
      );
      const spatial = SPATIAL_RE.test(text);
      if (!mentionsPlace && !spatial && locations.length >= 4) return;
      if (!mentionsPlace && !spatial && text.length < 120) return;
      const excerpt =
        text.length > MAP_EXCERPT_CHARS
          ? `${text.slice(0, MAP_EXCERPT_CHARS)}…`
          : text;
      const sceneLoc =
        (ch.scenes?.[si]?.location ?? "").trim() ||
        (ch.scenes?.[si]?.title ?? "");
      blocks.push(
        `---\nChapter ${ci + 1} “${ch.title}” · scene ${si + 1}${
          sceneLoc ? ` · tagged:${sceneLoc}` : ""
        }\n${excerpt}`,
      );
    });
    return blocks;
  });

  const journeyHints = locations
    .flatMap((loc) =>
      (loc.connections ?? []).map((c) => {
        const to = c.toName || c.toLocationId;
        return `- ${loc.name} —${c.label}${c.notes ? ` (${c.notes})` : ""}→ ${to}`;
      }),
    )
    .slice(0, 40);

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Task: Place each location on a 2D story map (x,y in 0–1) so relative positions match the prose and atlas notes. Also paint terrain regions (territory / mountains / water) when the story implies them.`,
    `Convention: x increases eastward (0=west, 1=east). y increases southward (0=north/top, 1=south/bottom) — like a page.`,
    `Keep related/near places closer; distant/journey-apart places farther. Interiors of the same building may cluster.`,
    `Preserve relative distances carefully — do not flatten the whole atlas into a uniform grid.`,
    "",
    "ATLAS PLACES (use these exact locationId values in your pins):",
    ...atlasLines,
    journeyHints.length
      ? `\nKNOWN CONNECTIONS / JOURNEYS:\n${journeyHints.join("\n")}`
      : "",
    "",
    "MANUSCRIPT EXCERPTS (spatial / place mentions prioritized):",
  ]
    .filter(Boolean)
    .join("\n");

  return packBalancedExcerpts(
    chapterBlocks,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export const layoutMapTool: Anthropic.Tool = {
  name: LAYOUT_MAP_TOOL,
  description:
    "Propose 2D map pin positions and terrain regions for story locations based on how the manuscript and atlas describe geography.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "2–5 sentences describing the geography you inferred (for the author).",
      },
      pins: {
        type: "array",
        items: {
          type: "object",
          properties: {
            locationId: {
              type: "string",
              description:
                "Exact location id from the atlas list (preferred). Place name also accepted.",
            },
            name: {
              type: "string",
              description:
                "Location name from the atlas — used if locationId is missing or wrong.",
            },
            x: {
              type: "number",
              description: "0–1, west→east",
            },
            y: {
              type: "number",
              description: "0–1, north→south (top→bottom)",
            },
            rationale: {
              type: "string",
              description: "Short why relative to other places.",
            },
          },
          required: ["x", "y"],
        },
      },
      regions: {
        type: "array",
        description:
          "Terrain features implied by the story (ranges, water, territories). Optional.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            kind: {
              type: "string",
              enum: ["territory", "mountains", "water"],
            },
            x: { type: "number", description: "Top-left x 0–1" },
            y: { type: "number", description: "Top-left y 0–1" },
            w: { type: "number", description: "Width 0–1" },
            h: { type: "number", description: "Height 0–1" },
            rotation: { type: "number" },
            shape: {
              type: "string",
              enum: ["rect", "ellipse", "soft"],
            },
            color: {
              type: "string",
              description:
                "sage | mist | sand | clay | lilac | olive | slate | rose",
            },
          },
          required: ["name", "kind", "x", "y", "w", "h"],
        },
      },
      connections: {
        type: "array",
        description:
          "Soft adjacency / journey edges between places when prose is clear.",
        items: {
          type: "object",
          properties: {
            fromLocationId: { type: "string" },
            fromName: { type: "string" },
            toLocationId: { type: "string" },
            toName: { type: "string" },
            label: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    required: ["pins"],
  },
};

function resolveLocation(
  locations: Location[],
  rawId: string,
  rawName: string,
): Location | null {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const byName = new Map<string, Location>();
  for (const loc of locations) {
    const keys = [loc.name, ...(loc.aliases ?? [])]
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n.length > 0);
    for (const key of keys) {
      if (!byName.has(key)) byName.set(key, loc);
    }
  }

  let loc =
    (rawId && byId.get(rawId)) ||
    (rawId && byName.get(rawId.toLowerCase())) ||
    (rawName && byName.get(rawName.toLowerCase())) ||
    null;

  if (!loc && rawId) {
    loc =
      locations.find(
        (l) =>
          l.name.toLowerCase() === rawId.toLowerCase() ||
          (l.aliases ?? []).some(
            (a) => a.trim().toLowerCase() === rawId.toLowerCase(),
          ),
      ) ?? null;
  }
  return loc;
}

export function normalizeMapLayoutPayload(
  raw: Partial<MapLayoutPayload> | null | undefined,
  locations: Location[],
): MapLayoutPayload {
  const pins: MapLayoutPin[] = [];
  const seen = new Set<string>();

  for (const p of raw?.pins ?? []) {
    const rawId = String(
      (p as { locationId?: string; id?: string })?.locationId ??
        (p as { id?: string })?.id ??
        "",
    ).trim();
    const rawName = String(
      (p as { name?: string; locationName?: string })?.name ??
        (p as { locationName?: string })?.locationName ??
        "",
    ).trim();

    const loc = resolveLocation(locations, rawId, rawName);
    if (!loc || seen.has(loc.id)) continue;
    seen.add(loc.id);
    pins.push({
      locationId: loc.id,
      name: loc.name,
      x: clamp01(p.x),
      y: clamp01(p.y),
      rationale: p.rationale?.trim() || undefined,
    });
  }

  const regions: MapLayoutRegion[] = [];
  for (const r of raw?.regions ?? []) {
    const kind =
      r.kind === "mountains" || r.kind === "water" || r.kind === "territory"
        ? r.kind
        : null;
    if (!kind) continue;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    regions.push({
      name,
      kind,
      x: clamp01(r.x),
      y: clamp01(r.y),
      w: clampSize(r.w, 0.22),
      h: clampSize(r.h, 0.18),
      rotation: typeof r.rotation === "number" ? r.rotation : 0,
      shape:
        r.shape === "ellipse" || r.shape === "soft" || r.shape === "rect"
          ? r.shape
          : undefined,
      color: r.color?.trim() || undefined,
    });
  }

  const connections: MapLayoutConnection[] = [];
  for (const c of raw?.connections ?? []) {
    connections.push({
      fromLocationId: c.fromLocationId?.trim() || undefined,
      fromName: c.fromName?.trim() || undefined,
      toLocationId: c.toLocationId?.trim() || undefined,
      toName: c.toName?.trim() || undefined,
      label: c.label?.trim() || "Near",
      notes: c.notes?.trim() || undefined,
    });
  }

  return {
    summary: raw?.summary?.trim() || undefined,
    pins,
    regions,
    connections,
  };
}

export type ApplyMapLayoutOptions = {
  /** When true, stretch pins to fill the canvas (author Expand). Default false. */
  expand?: boolean;
  /** When false, skip grid-filling atlas places Claude omitted. Default true. */
  placeMissing?: boolean;
};

/** Merge Claude layout into the story map (upserts pins; replaces Claude regions). */
export function applyMapLayout(
  map: StoryMap | undefined,
  layout: MapLayoutPayload,
  locations: Location[],
  options: ApplyMapLayoutOptions = {},
): StoryMap {
  const expand = options.expand === true;
  const placeMissing = options.placeMissing !== false;

  let next = map ? { ...map } : emptyStoryMap();
  if (map?.id) next = { ...next, id: map.id, name: map.name };
  const byId = new Map(locations.map((l) => [l.id, l]));
  const placed = new Set<string>();

  for (const p of layout.pins) {
    const loc = byId.get(p.locationId);
    if (!loc) continue;
    placed.add(loc.id);
    const existing = next.pins.find((pin) => pin.locationId === loc.id);
    const label = loc.name.trim() || existing?.label;
    const pin: StoryMapPin = existing
      ? {
          ...existing,
          x: p.x,
          y: p.y,
          label,
          rationale: p.rationale ?? existing.rationale,
        }
      : createMapPin(loc.id, p.x, p.y, label, p.rationale);
    next = upsertPinOnMap(next, pin);
  }

  if (placeMissing) {
    const missing = locations.filter((l) => !placed.has(l.id));
    if (missing.length > 0) {
      const cols = Math.ceil(Math.sqrt(missing.length));
      missing.forEach((loc, i) => {
        const already = next.pins.find((pin) => pin.locationId === loc.id);
        if (already) {
          next = upsertPinOnMap(next, {
            ...already,
            label: loc.name.trim() || already.label,
          });
          return;
        }
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.2 + (col / Math.max(1, cols - 1 || 1)) * 0.6;
        const y =
          0.72 +
          (row / Math.max(1, Math.ceil(missing.length / cols) - 1 || 1)) * 0.16;
        next = upsertPinOnMap(
          next,
          createMapPin(loc.id, x, y, loc.name.trim() || undefined),
        );
      });
    }
  }

  const authorRegions = (next.regions ?? []).filter(
    (r) => (r.source ?? "author") !== "claude",
  );
  const claudeRegions: StoryMapRegion[] = (layout.regions ?? []).map((r) =>
    createMapRegion({
      name: r.name,
      kind: r.kind,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      rotation: r.rotation,
      shape: r.shape,
      color: r.color ?? MAP_REGION_KIND_META[r.kind].defaultColor,
      source: "claude",
    }),
  );
  next = { ...next, regions: [...authorRegions, ...claudeRegions] };

  return expand ? expandMapPins(next) : next;
}

/** Apply soft connection edges from a layout onto location wikis. */
export function applyMapLayoutConnections(
  locations: Location[],
  layout: MapLayoutPayload,
): Location[] {
  if (!layout.connections?.length) return locations;
  let next = [...locations];

  for (const edge of layout.connections) {
    const from =
      resolveLocation(
        next,
        edge.fromLocationId ?? "",
        edge.fromName ?? "",
      ) ||
      (edge.fromName ? findLocationByName(next, edge.fromName) : null);
    const to =
      resolveLocation(next, edge.toLocationId ?? "", edge.toName ?? "") ||
      (edge.toName ? findLocationByName(next, edge.toName) : null);
    if (!from || !to || from.id === to.id) continue;

    const already = (from.connections ?? []).some(
      (c) =>
        c.toLocationId === to.id ||
        c.toName.trim().toLowerCase() === to.name.trim().toLowerCase(),
    );
    if (already) continue;

    const connection = createLocationConnection({
      label: edge.label || "Near",
      toLocationId: to.id,
      toName: to.name,
      notes: edge.notes,
    });
    next = next.map((l) =>
      l.id === from.id
        ? {
            ...l,
            connections: [...(l.connections ?? []), connection],
            updatedAt: Date.now(),
          }
        : l,
    );
  }

  return next;
}

export const MAP_LAYOUT_SYSTEM = `You are a literary cartographer for novelists. You never rewrite manuscript prose.
You arrange atlas locations on a 2D story map using evidence from the manuscript and location notes.
You may also paint terrain regions (territory, mountains, water) when the story clearly implies them.

Rules:
- Use exact locationId values from the atlas list — never invent ids.
- You may also send the place name; the app resolves name → id. Prefer locationId.
- Place EVERY listed location (one pin each). The pin label on the map is the location name.
- x: 0 = west, 1 = east. y: 0 = north (top of page), 1 = south (bottom).
- Reflect relative distance and direction from the prose ("beyond the garden", "across town", "down by the river").
- Cluster interiors of the same building; spread settlements that require a journey.
- Prefer story geography over arbitrary aesthetics. Softly respect current_pin only when the story is silent.
- Keep pins inside 0.08–0.92 so labels are not clipped.
- Do NOT pack all pins into a uniform grid — preserve relative scale.
- regions: only when implied (a named range, a river/bay, a claimed territory). Keep boxes away from clipping edges.
- connections: optional soft edges when journeys/adjacency are clear.
- summary: plain language overview for the author (no markdown).
- rationale: one short phrase per pin when helpful.`;
