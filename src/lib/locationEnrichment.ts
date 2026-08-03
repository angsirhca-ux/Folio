import type {
  Book,
  Location,
  LocationKind,
  Chapter,
} from "@/lib/types";
import {
  createLocationConnection,
  locationAppearances,
  locationMatchesName,
  namesMatch,
} from "@/lib/locations";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "@/lib/manuscriptContext";
import type { EnrichApplyMode } from "@/lib/characterEnrichment";

const AUTO_WIKI_PREFIX = "Compiled from the manuscript";

export type LocationEnrichmentPayload = {
  kind?: LocationKind;
  shortBio?: string;
  wiki?: string;
  aliases?: string[];
  tags?: string[];
  sensory?: Partial<Location["sensory"]>;
  place?: Partial<Location["place"]>;
  story?: Partial<Location["story"]>;
  secrets?: string;
  inhabitants?: string[];
  connections?: Array<{
    toName: string;
    label: string;
    notes?: string;
  }>;
};

export type DiscoveredLocation = {
  name: string;
  kind?: LocationKind;
  shortBio?: string;
  evidence?: string;
};

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function isAutoWiki(wiki: string): boolean {
  return wiki.trim().startsWith(AUTO_WIKI_PREFIX);
}

export function shouldFillField(
  current: string | undefined,
  incoming: string | undefined,
  mode: EnrichApplyMode = "fill-empty",
): boolean {
  if (!incoming?.trim()) return false;
  if (mode === "deepen") return true;
  if (!filled(current)) return true;
  if (isAutoWiki(current ?? "")) return true;
  return false;
}

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

export function buildLocationManuscriptContext(
  book: Pick<Book, "title" | "chapters" | "locations">,
  location: Location,
): string {
  const appearances = locationAppearances(book.chapters, location);
  const names = [location.name, ...location.aliases];

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters in manuscript: ${book.chapters.length}`,
    `Location: ${location.name}`,
    location.aliases.length ? `Aliases: ${location.aliases.join(", ")}` : "",
    `Current kind: ${location.kind}`,
    location.shortBio ? `Current blurb: ${location.shortBio}` : "",
    location.wiki && !isAutoWiki(location.wiki)
      ? `Author wiki notes:\n${location.wiki}`
      : "",
    "",
    `Evidence from ${appearances.length} scene(s). Use ALL chapters — do not stop after chapter 1.`,
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const byChapter: string[][] = book.chapters.map(() => []);
  const seen = new Set<string>();

  for (const a of appearances) {
    const chapter = book.chapters.find((c) => c.id === a.chapterId);
    if (!chapter) continue;
    const htmlParts = getSceneHtmlParts(chapter.content);
    const prose = scenePlain(htmlParts[a.sceneIndex] ?? "");
    seen.add(a.scene.id);
    byChapter[a.chapterIndex]?.push(
      [
        `---`,
        `Chapter ${a.chapterIndex + 1}: ${a.chapterTitle}`,
        `Scene: ${a.scene.title}${a.tagged ? " [tagged]" : " [prose mention]"}`,
        `Cast: ${[a.scene.pov, ...(a.scene.characters ?? [])].filter(Boolean).join(", ")}`,
        a.scene.synopsis ? `Synopsis: ${a.scene.synopsis}` : "",
        `Prose:`,
        prose || "(empty)",
        "",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    );
  }

  book.chapters.forEach((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      if (seen.has(scene.id)) return;
      const prose = scenePlain(htmlParts[sceneIndex] ?? "");
      if (!prose) return;
      const hit = names.some((n) =>
        prose.toLowerCase().includes(n.trim().toLowerCase()),
      );
      if (!hit && appearances.length >= 2) return;
      if (!hit) {
        const clipped =
          prose.length > 1400 ? `${prose.slice(0, 1400).trim()}…` : prose;
        byChapter[chapterIndex].push(
          `---\nChapter ${chapterIndex + 1}: ${chapter.title}\nScene: ${scene.title}\nTagged: ${scene.location || "—"}\n${clipped}\n`,
        );
        return;
      }
      byChapter[chapterIndex].push(
        [
          `---`,
          `Chapter ${chapterIndex + 1}: ${chapter.title}`,
          `Scene: ${scene.title} [named in prose]`,
          `Cast: ${[scene.pov, ...(scene.characters ?? [])].filter(Boolean).join(", ")}`,
          scene.synopsis ? `Synopsis: ${scene.synopsis}` : "",
          `Prose:`,
          prose,
          "",
        ]
          .filter((line) => line !== "")
          .join("\n"),
      );
    });
  });

  return packBalancedExcerpts(
    byChapter,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function buildLocationDiscoveryContext(
  book: Pick<Book, "title" | "chapters" | "locations">,
): string {
  const known =
    (book.locations ?? []).map((l) => l.name).join(", ") || "(none)";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters in manuscript: ${book.chapters.length}`,
    `Already in location wiki: ${known}`,
    `Read the FULL manuscript. Discover places from every chapter, not only the opening.`,
    "",
    "Excerpts:",
  ].join("\n");

  const byChapter: string[][] = book.chapters.map((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    const blocks: string[] = [];
    for (let i = 0; i < htmlParts.length; i++) {
      const prose = scenePlain(htmlParts[i] ?? "");
      if (!prose) continue;
      const scene = chapter.scenes?.[i];
      blocks.push(
        `---\nChapter ${chapterIndex + 1}: ${chapter.title} / ${scene?.title ?? `Scene ${i + 1}`}\nTagged location: ${scene?.location || "—"}\n${prose}\n`,
      );
    }
    return blocks;
  });

  return packBalancedExcerpts(
    byChapter,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function locationSnapshotForPrompt(location: Location): string {
  return JSON.stringify(
    {
      name: location.name,
      aliases: location.aliases,
      kind: location.kind,
      shortBio: location.shortBio,
      wiki: isAutoWiki(location.wiki) ? "" : location.wiki,
      sensory: location.sensory,
      place: location.place,
      story: location.story,
      secrets: location.secrets,
      inhabitants: location.inhabitants,
      belongsToIds: location.belongsToIds ?? [],
      continuityNotes: (location.continuityNotes ?? []).map((n) => ({
        asOf: n.asOf,
        note: n.note,
      })),
      tags: location.tags.filter((t) => t !== "from-story"),
      connections: location.connections.map((r) => ({
        toName: r.toName,
        label: r.label,
        notes: r.notes,
      })),
    },
    null,
    2,
  );
}

export function applyLocationEnrichment(
  location: Location,
  payload: LocationEnrichmentPayload,
  roster: Location[],
  mode: EnrichApplyMode = "fill-empty",
): Location {
  let next: Location = { ...location };
  const fill = (current: string, incoming?: string) =>
    shouldFillField(current, incoming, mode);

  if (payload.kind && (next.kind === "unspecified" || mode === "deepen")) {
    next = { ...next, kind: payload.kind };
  }

  if (fill(next.shortBio, payload.shortBio)) {
    next = { ...next, shortBio: payload.shortBio!.trim() };
  }
  if (fill(next.wiki, payload.wiki)) {
    next = { ...next, wiki: payload.wiki!.trim() };
  }
  if (fill(next.secrets, payload.secrets)) {
    next = { ...next, secrets: payload.secrets!.trim() };
  }

  if (payload.aliases?.length) {
    const aliases = new Set(next.aliases.map((a) => a.trim()).filter(Boolean));
    for (const a of payload.aliases) {
      if (a.trim() && !locationMatchesName(next, a)) aliases.add(a.trim());
    }
    next = { ...next, aliases: [...aliases] };
  }

  const tags = new Set(next.tags);
  for (const t of payload.tags ?? []) {
    if (t.trim()) tags.add(t.trim().toLowerCase());
  }
  tags.add("claude");
  next = { ...next, tags: [...tags] };

  if (payload.sensory) {
    const s = payload.sensory;
    next = {
      ...next,
      sensory: {
        sight: fill(next.sensory.sight, s.sight)
          ? s.sight!.trim()
          : next.sensory.sight,
        sound: fill(next.sensory.sound, s.sound)
          ? s.sound!.trim()
          : next.sensory.sound,
        smell: fill(next.sensory.smell, s.smell)
          ? s.smell!.trim()
          : next.sensory.smell,
        atmosphere: fill(next.sensory.atmosphere, s.atmosphere)
          ? s.atmosphere!.trim()
          : next.sensory.atmosphere,
      },
    };
  }

  if (payload.place) {
    const p = payload.place;
    next = {
      ...next,
      place: {
        region: fill(next.place.region, p.region)
          ? p.region!.trim()
          : next.place.region,
        access: fill(next.place.access, p.access)
          ? p.access!.trim()
          : next.place.access,
        landmarks: fill(next.place.landmarks, p.landmarks)
          ? p.landmarks!.trim()
          : next.place.landmarks,
        scale: fill(next.place.scale, p.scale)
          ? p.scale!.trim()
          : next.place.scale,
      },
    };
  }

  if (payload.story) {
    const s = payload.story;
    next = {
      ...next,
      story: {
        function: fill(next.story.function, s.function)
          ? s.function!.trim()
          : next.story.function,
        firstImpression: fill(next.story.firstImpression, s.firstImpression)
          ? s.firstImpression!.trim()
          : next.story.firstImpression,
        changes: fill(next.story.changes, s.changes)
          ? s.changes!.trim()
          : next.story.changes,
      },
    };
  }

  if (payload.inhabitants?.length) {
    const people = new Set<string>();
    if (mode !== "deepen") {
      for (const n of next.inhabitants) people.add(n);
    }
    for (const n of payload.inhabitants) {
      if (n.trim()) people.add(n.trim());
    }
    next = {
      ...next,
      inhabitants: [...people].sort((a, b) => a.localeCompare(b)),
    };
  }

  if (payload.connections?.length) {
    const conns =
      mode === "deepen"
        ? next.connections.filter((r) => !r.notes.includes("(Claude)"))
        : [...next.connections];
    for (const r of payload.connections) {
      if (!r.toName?.trim() || !r.label?.trim()) continue;
      const linked = roster.find(
        (l) =>
          l.id !== location.id &&
          (namesMatch(l.name, r.toName) ||
            l.aliases.some((al) => namesMatch(al, r.toName))),
      );
      const exists = conns.some(
        (x) =>
          namesMatch(x.toName, r.toName) ||
          (linked && x.toLocationId === linked.id),
      );
      if (exists) continue;
      conns.push(
        createLocationConnection({
          toLocationId: linked?.id ?? "",
          toName: linked?.name ?? r.toName.trim(),
          label: r.label.trim(),
          notes: (
            r.notes?.trim() || "Inferred from the manuscript (Claude)"
          ).slice(0, 400),
        }),
      );
    }
    next = { ...next, connections: conns };
  }

  return { ...next, updatedAt: Date.now() };
}

export const ENRICH_LOCATION_TOOL = "save_location_wiki";

export const enrichLocationTool = {
  name: ENRICH_LOCATION_TOOL,
  description:
    "Save an enriched location wiki grounded in the FULL manuscript (all chapters).",
  input_schema: {
    type: "object" as const,
    properties: {
      kind: {
        type: "string",
        enum: [
          "interior",
          "exterior",
          "settlement",
          "landmark",
          "threshold",
          "region",
          "unspecified",
        ],
      },
      shortBio: { type: "string" },
      wiki: {
        type: "string",
        description:
          "2–5 short paragraphs covering this place across the WHOLE manuscript.",
      },
      aliases: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      sensory: {
        type: "object",
        properties: {
          sight: { type: "string" },
          sound: { type: "string" },
          smell: { type: "string" },
          atmosphere: { type: "string" },
        },
      },
      place: {
        type: "object",
        properties: {
          region: { type: "string" },
          access: { type: "string" },
          landmarks: { type: "string" },
          scale: { type: "string" },
        },
      },
      story: {
        type: "object",
        properties: {
          function: { type: "string" },
          firstImpression: { type: "string" },
          changes: {
            type: "string",
            description:
              "How the place changes across early AND later chapters.",
          },
        },
      },
      secrets: { type: "string" },
      inhabitants: { type: "array", items: { type: "string" } },
      connections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            toName: { type: "string" },
            label: { type: "string" },
            notes: { type: "string" },
          },
          required: ["toName", "label"],
        },
      },
    },
  },
};

export const DISCOVER_LOCATIONS_TOOL = "save_discovered_locations";

export const discoverLocationsTool = {
  name: DISCOVER_LOCATIONS_TOOL,
  description:
    "List named places from the FULL manuscript (every chapter) that deserve location wiki entries and are not already listed.",
  input_schema: {
    type: "object" as const,
    properties: {
      locations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            kind: {
              type: "string",
              enum: [
                "interior",
                "exterior",
                "settlement",
                "landmark",
                "threshold",
                "region",
                "unspecified",
              ],
            },
            shortBio: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    required: ["locations"],
  },
};

export function chaptersHaveProse(chapters: Chapter[]): boolean {
  return chapters.some((ch) => scenePlain(ch.content).length > 40);
}
