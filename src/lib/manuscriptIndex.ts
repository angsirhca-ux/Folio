/**
 * Shared manuscript reading index — one full read, many Populate applies.
 */

import type { Book, Chapter, ManuscriptIndexData } from "./types";
import type { DiscoveredCharacter } from "./characterEnrichment";
import type { DiscoveredLocation } from "./locationEnrichment";
import type { DiscoveredResearch } from "./researchEnrichment";
import type { DiscoveredEncyclopedia } from "./encyclopediaEnrichment";
import type { DiscoveredChronicleEvent } from "./chronicleEnrichment";
import type {
  DiscoveredPlotThread,
  DiscoveredThreadAssignment,
  PlotThreadDiscoverPayload,
} from "./plotThreadEnrichment";
import { getSceneHtmlParts } from "./manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
  partitionChapterWindows,
  type ChapterWindow,
} from "./manuscriptContext";
import { PLOT_THREAD_PALETTE } from "./plotThreads";

/** @deprecated Prefer ManuscriptIndexData from types — alias for local code. */
export type ManuscriptIndex = ManuscriptIndexData;

export type ManuscriptIndexSlice = {
  characters?: DiscoveredCharacter[];
  locations?: DiscoveredLocation[];
  research?: DiscoveredResearch[];
  encyclopedia?: DiscoveredEncyclopedia[];
  chronicle?: DiscoveredChronicleEvent[];
  plotThreads?: DiscoveredPlotThread[];
  plotAssignments?: DiscoveredThreadAssignment[];
};

export const MANUSCRIPT_INDEX_TOOL_NAME = "save_manuscript_index";

export const manuscriptIndexTool = {
  name: MANUSCRIPT_INDEX_TOOL_NAME,
  description:
    "Extract bible seeds from this manuscript window: cast, places, research topics, encyclopedia canon, world-history chronicle events, and plot threads with scene assignments.",
  input_schema: {
    type: "object" as const,
    properties: {
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: {
              type: "string",
              enum: [
                "protagonist",
                "antagonist",
                "deuteragonist",
                "supporting",
                "minor",
                "unspecified",
              ],
            },
            shortBio: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["name"],
        },
      },
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
      research: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            kind: {
              type: "string",
              enum: [
                "theme",
                "motif",
                "period",
                "craft",
                "source",
                "question",
                "unspecified",
              ],
            },
            shortBio: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["title"],
        },
      },
      encyclopedia: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            stackName: { type: "string" },
            shortBio: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["title"],
        },
      },
      chronicle: {
        type: "array",
        description:
          "World-history / lore events (ages, wars, founding) — NOT present-tense plot beats.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            whenLabel: { type: "string" },
            summary: { type: "string" },
            order: { type: "number" },
            linkedCharacterNames: {
              type: "array",
              items: { type: "string" },
            },
            linkedLocationNames: {
              type: "array",
              items: { type: "string" },
            },
            linkedEntryTitles: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["title", "summary"],
        },
      },
      plotThreads: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            color: {
              type: "string",
              enum: [...PLOT_THREAD_PALETTE],
            },
            summary: { type: "string" },
          },
          required: ["name", "color"],
        },
      },
      plotAssignments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sceneId: { type: "string" },
            threadNames: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["sceneId", "threadNames"],
        },
      },
    },
    required: [
      "characters",
      "locations",
      "research",
      "encyclopedia",
      "chronicle",
      "plotThreads",
      "plotAssignments",
    ],
  },
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

/** Stable hash of manuscript prose + scene structure. */
export function manuscriptSourceHash(chapters: Chapter[]): string {
  let h = 2166136261;
  for (const ch of chapters) {
    const sceneIds = (ch.scenes ?? []).map((s) => s.id).join(",");
    const s = `${ch.id}\0${ch.title}\0${ch.content ?? ""}\0${sceneIds}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function emptyManuscriptIndex(sourceHash: string): ManuscriptIndex {
  return {
    generatedAt: Date.now(),
    sourceHash,
    characters: [],
    locations: [],
    research: [],
    encyclopedia: [],
    chronicle: [],
    plotThreads: [],
    plotAssignments: [],
  };
}

export function ensureBookManuscriptIndex(
  book: Omit<Book, "manuscriptIndex"> & {
    manuscriptIndex?: ManuscriptIndex | null;
  },
): Book {
  const idx = book.manuscriptIndex;
  if (!idx || typeof idx !== "object") {
    return { ...(book as Book), manuscriptIndex: undefined };
  }
  return {
    ...(book as Book),
    manuscriptIndex: {
      generatedAt: idx.generatedAt ?? 0,
      sourceHash: idx.sourceHash ?? "",
      characters: Array.isArray(idx.characters) ? idx.characters : [],
      locations: Array.isArray(idx.locations) ? idx.locations : [],
      research: Array.isArray(idx.research) ? idx.research : [],
      encyclopedia: Array.isArray(idx.encyclopedia) ? idx.encyclopedia : [],
      chronicle: Array.isArray(idx.chronicle) ? idx.chronicle : [],
      plotThreads: Array.isArray(idx.plotThreads) ? idx.plotThreads : [],
      plotAssignments: Array.isArray(idx.plotAssignments)
        ? idx.plotAssignments
        : [],
    },
  };
}

export function isManuscriptIndexFresh(
  book: Pick<Book, "chapters" | "manuscriptIndex">,
): boolean {
  const idx = book.manuscriptIndex;
  if (!idx?.sourceHash) return false;
  return idx.sourceHash === manuscriptSourceHash(book.chapters ?? []);
}

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

export function mergeManuscriptIndexSlice(
  acc: ManuscriptIndex,
  part: ManuscriptIndexSlice,
): ManuscriptIndex {
  const characters = [...acc.characters];
  const charKeys = new Set(characters.map((c) => normKey(c.name)));
  for (const c of part.characters ?? []) {
    const name = c.name?.trim() ?? "";
    if (name.length < 2) continue;
    const key = normKey(name);
    if (charKeys.has(key)) {
      const i = characters.findIndex((x) => normKey(x.name) === key);
      if (i >= 0) {
        characters[i] = {
          ...characters[i],
          role: c.role ?? characters[i].role,
          shortBio:
            (c.shortBio?.trim().length ?? 0) >
            (characters[i].shortBio?.trim().length ?? 0)
              ? c.shortBio
              : characters[i].shortBio,
          evidence: c.evidence || characters[i].evidence,
        };
      }
      continue;
    }
    charKeys.add(key);
    characters.push({ ...c, name });
  }

  const locations = [...acc.locations];
  const locKeys = new Set(locations.map((l) => normKey(l.name)));
  for (const l of part.locations ?? []) {
    const name = l.name?.trim() ?? "";
    if (name.length < 2) continue;
    const key = normKey(name);
    if (locKeys.has(key)) {
      const i = locations.findIndex((x) => normKey(x.name) === key);
      if (i >= 0) {
        locations[i] = {
          ...locations[i],
          kind: l.kind ?? locations[i].kind,
          shortBio:
            (l.shortBio?.trim().length ?? 0) >
            (locations[i].shortBio?.trim().length ?? 0)
              ? l.shortBio
              : locations[i].shortBio,
          evidence: l.evidence || locations[i].evidence,
        };
      }
      continue;
    }
    locKeys.add(key);
    locations.push({ ...l, name });
  }

  const research = [...acc.research];
  const resKeys = new Set(research.map((r) => normKey(r.title)));
  for (const r of part.research ?? []) {
    const title = r.title?.trim() ?? "";
    if (title.length < 2) continue;
    const key = normKey(title);
    if (resKeys.has(key)) continue;
    resKeys.add(key);
    research.push({ ...r, title });
  }

  const encyclopedia = [...acc.encyclopedia];
  const encKeys = new Set(encyclopedia.map((e) => normKey(e.title)));
  for (const e of part.encyclopedia ?? []) {
    const title = e.title?.trim() ?? "";
    if (title.length < 2) continue;
    const key = normKey(title);
    if (encKeys.has(key)) continue;
    encKeys.add(key);
    encyclopedia.push({ ...e, title });
  }

  const chronicle = [...acc.chronicle];
  const chronKeys = new Set(chronicle.map((e) => normKey(e.title)));
  for (const e of part.chronicle ?? []) {
    const title = e.title?.trim() ?? "";
    if (!title) continue;
    const key = normKey(title);
    if (chronKeys.has(key)) {
      const i = chronicle.findIndex((x) => normKey(x.title) === key);
      if (i >= 0) {
        chronicle[i] = {
          ...chronicle[i],
          whenLabel: e.whenLabel?.trim() || chronicle[i].whenLabel,
          summary:
            (e.summary?.trim().length ?? 0) >
            (chronicle[i].summary?.trim().length ?? 0)
              ? e.summary
              : chronicle[i].summary,
          order: e.order ?? chronicle[i].order,
          linkedCharacterNames:
            e.linkedCharacterNames?.length
              ? e.linkedCharacterNames
              : chronicle[i].linkedCharacterNames,
          linkedLocationNames:
            e.linkedLocationNames?.length
              ? e.linkedLocationNames
              : chronicle[i].linkedLocationNames,
          linkedEntryTitles:
            e.linkedEntryTitles?.length
              ? e.linkedEntryTitles
              : chronicle[i].linkedEntryTitles,
        };
      }
      continue;
    }
    chronKeys.add(key);
    chronicle.push({ ...e, title });
  }

  const plotThreads = [...acc.plotThreads];
  const threadKeys = new Set(plotThreads.map((t) => normKey(t.name)));
  for (const t of part.plotThreads ?? []) {
    const name = t.name?.trim() ?? "";
    if (name.length < 2) continue;
    const key = normKey(name);
    if (threadKeys.has(key)) {
      const i = plotThreads.findIndex((x) => normKey(x.name) === key);
      if (i >= 0) {
        plotThreads[i] = {
          ...plotThreads[i],
          color: t.color ?? plotThreads[i].color,
          summary: t.summary?.trim() || plotThreads[i].summary,
        };
      }
      continue;
    }
    threadKeys.add(key);
    plotThreads.push({ ...t, name });
  }

  const assignMap = new Map<string, Set<string>>();
  for (const a of acc.plotAssignments) {
    const id = a.sceneId?.trim();
    if (!id) continue;
    assignMap.set(
      id,
      new Set((a.threadNames ?? []).map((n) => n.trim()).filter(Boolean)),
    );
  }
  for (const a of part.plotAssignments ?? []) {
    const id = a.sceneId?.trim();
    if (!id) continue;
    const set = assignMap.get(id) ?? new Set<string>();
    for (const n of a.threadNames ?? []) {
      const t = n.trim();
      if (t) set.add(t);
    }
    assignMap.set(id, set);
  }
  const plotAssignments: DiscoveredThreadAssignment[] = [
    ...assignMap.entries(),
  ].map(([sceneId, names]) => ({
    sceneId,
    threadNames: [...names],
  }));

  return {
    ...acc,
    characters: characters.slice(0, 80),
    locations: locations.slice(0, 80),
    research: research.slice(0, 40),
    encyclopedia: encyclopedia.slice(0, 60),
    chronicle: chronicle.slice(0, 24),
    plotThreads: plotThreads.slice(0, 12),
    plotAssignments,
  };
}

export function buildManuscriptSceneBlocks(
  chapters: Chapter[],
): string[][] {
  return chapters.map((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content ?? "");
    const scenes = chapter.scenes ?? [];
    const blocks: string[] = [];
    for (let i = 0; i < Math.max(htmlParts.length, scenes.length); i++) {
      const scene = scenes[i];
      const prose = scenePlain(htmlParts[i] ?? "");
      if (!scene && !prose) continue;
      const id = scene?.id ?? `missing-${chapter.id}-${i}`;
      blocks.push(
        [
          "---",
          `sceneId: ${id}`,
          `Chapter ${chapterIndex + 1}: ${chapter.title}`,
          `Scene: ${scene?.title ?? `Scene ${i + 1}`}`,
          `POV: ${scene?.pov || "—"}`,
          `Status: ${scene?.status || "—"}`,
          `Labels: ${(scene?.labels ?? []).join(", ") || "—"}`,
          `Synopsis: ${scene?.synopsis?.trim() || "—"}`,
          `Cast tags: ${(scene?.characters ?? []).join(", ") || "—"}`,
          `Location tag: ${scene?.location || "—"}`,
          prose ? `Prose:\n${prose}` : "Prose: (empty)",
          "",
        ].join("\n"),
      );
    }
    return blocks;
  });
}

export function partitionManuscriptWindows(
  chapters: Chapter[],
): ChapterWindow[] {
  const blocks = buildManuscriptSceneBlocks(chapters);
  return partitionChapterWindows(blocks, MANUSCRIPT_CONTEXT_BUDGET, 12_000);
}

export function buildManuscriptIndexContext(
  book: Pick<
    Book,
    | "title"
    | "chapters"
    | "characters"
    | "locations"
    | "research"
    | "encyclopedia"
    | "chronicle"
    | "plotThreads"
  >,
  window: ChapterWindow,
  prior: ManuscriptIndex | null,
  passMeta: { pass: number; passCount: number },
): string {
  const chapters = book.chapters ?? [];
  const slice = chapters.slice(window.fromChapter, window.toChapter);
  const absoluteBlocks = buildManuscriptSceneBlocks(chapters);
  const windowBlocks = absoluteBlocks.slice(
    window.fromChapter,
    window.toChapter,
  );

  const priorDigest = prior
    ? [
        prior.characters.length
          ? `Cast found earlier: ${prior.characters.map((c) => c.name).slice(0, 40).join(", ")}`
          : "",
        prior.locations.length
          ? `Places found earlier: ${prior.locations.map((l) => l.name).slice(0, 40).join(", ")}`
          : "",
        prior.encyclopedia.length
          ? `Encyclopedia earlier: ${prior.encyclopedia.map((e) => e.title).slice(0, 30).join(", ")}`
          : "",
        prior.chronicle.length
          ? `Chronicle earlier: ${prior.chronicle.map((e) => e.title).slice(0, 20).join(", ")}`
          : "",
        prior.plotThreads.length
          ? `Plot threads (reuse these names): ${prior.plotThreads.map((t) => t.name).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Pass ${passMeta.pass}/${passMeta.passCount} — chapters ${window.fromChapter + 1}–${window.toChapter} of ${chapters.length}.`,
    `Read this window FULLY. Extract only what appears in these chapters (plus continuity with prior finds).`,
    `Do not invent. Do not rewrite manuscript prose.`,
    `Chronicle = world lore history (ages, wars, founding) — NOT present plot beats.`,
    `plotAssignments must use exact sceneId values from the blocks below.`,
    `Plot thread colors only from: ${PLOT_THREAD_PALETTE.join(", ")}.`,
    "",
    `Already in bible cast: ${(book.characters ?? []).map((c) => c.name).slice(0, 40).join(", ") || "(none)"}`,
    `Already in bible places: ${(book.locations ?? []).map((l) => l.name).slice(0, 40).join(", ") || "(none)"}`,
    `Already in encyclopedia: ${(book.encyclopedia ?? []).map((e) => e.title).slice(0, 30).join(", ") || "(none)"}`,
    `Already in chronicle: ${(book.chronicle ?? []).map((e) => e.title).slice(0, 20).join(", ") || "(none)"}`,
    `Existing plot threads: ${(book.plotThreads ?? []).map((t) => t.name).join(", ") || "(none)"}`,
    priorDigest ? `\nPrior passes:\n${priorDigest}` : "",
    "",
    "Scenes in this window:",
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  // Remap chapter labels are already absolute in blocks.
  void slice;
  return packBalancedExcerpts(
    windowBlocks,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function indexToPlotPayload(
  index: ManuscriptIndex,
): PlotThreadDiscoverPayload {
  return {
    threads: index.plotThreads,
    assignments: index.plotAssignments,
  };
}

export function formatIndexAge(generatedAt: number): string {
  if (!generatedAt) return "never";
  const mins = Math.round((Date.now() - generatedAt) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
