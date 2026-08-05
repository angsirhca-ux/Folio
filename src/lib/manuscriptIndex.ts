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
import {
  matchExistingThreadName,
  normalizeThreadKey,
} from "./plotThreadEnrichment";
import { getSceneHtmlParts } from "./manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
  partitionChapterWindows,
  type ChapterWindow,
} from "./manuscriptContext";
import { PLOT_THREAD_PALETTE } from "./plotThreads";
import {
  namesLikelySamePerson,
  preferCanonicalName,
  suggestNameAliases,
} from "./nameContinuity";

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
    "Extract bible seeds from this manuscript window: cast who are PRESENT on-stage, places, research topics, encyclopedia canon, world-history chronicle events, and plot threads with scene assignments. Do not invent duplicate people under slight name variants.",
  input_schema: {
    type: "object" as const,
    properties: {
      characters: {
        type: "array",
        description:
          "People. Prefer ONE entry per person using their fullest name. Set presence carefully.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Fullest stable name for this person (e.g. Lily Chen, not Lily).",
            },
            aliases: {
              type: "array",
              items: { type: "string" },
              description: "Other forms used in prose (Lily, Chen, Ms. Chen).",
            },
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
            presence: {
              type: "string",
              enum: ["present", "mentioned"],
              description:
                "present = on-stage in this window (acts, speaks, occupies the scene). mentioned = only spoken about, remembered, or narrated — NOT physically in the scene.",
            },
          },
          required: ["name", "presence"],
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

export function emptyManuscriptIndex(
  sourceHash: string,
  seed?: { plotThreads?: DiscoveredPlotThread[] },
): ManuscriptIndex {
  return {
    generatedAt: Date.now(),
    sourceHash,
    characters: [],
    locations: [],
    research: [],
    encyclopedia: [],
    chronicle: [],
    plotThreads: (seed?.plotThreads ?? [])
      .map((t) => ({
        name: t.name?.trim() ?? "",
        color: t.color,
        summary: t.summary?.trim() ?? "",
      }))
      .filter((t) => t.name.length > 1)
      .slice(0, 12),
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
  for (const c of part.characters ?? []) {
    const name = c.name?.trim() ?? "";
    if (name.length < 2) continue;
    // Skip pure "mentioned" seeds unless we already track the person —
    // cast populate is for people who are on-stage.
    const presence = c.presence ?? "present";
    const i = characters.findIndex((x) => namesLikelySamePerson(x.name, name));
    if (i >= 0) {
      const prev = characters[i]!;
      const canonical = preferCanonicalName(prev.name, name);
      const aliasSet = new Set(
        [...(prev.aliases ?? []), ...(c.aliases ?? []), name, prev.name]
          .map((a) => a.trim())
          .filter((a) => a && a.toLowerCase() !== canonical.toLowerCase()),
      );
      for (const tip of suggestNameAliases(canonical)) aliasSet.add(tip);
      characters[i] = {
        ...prev,
        name: canonical,
        aliases: [...aliasSet],
        role: c.role && c.role !== "unspecified" ? c.role : prev.role,
        shortBio:
          (c.shortBio?.trim().length ?? 0) > (prev.shortBio?.trim().length ?? 0)
            ? c.shortBio
            : prev.shortBio,
        evidence: c.evidence || prev.evidence,
        // Upgrade mentioned → present if any pass saw them on-stage
        presence:
          prev.presence === "present" || presence === "present"
            ? "present"
            : "mentioned",
      };
      continue;
    }
    if (presence === "mentioned") continue;
    const aliases = [
      ...new Set(
        [...(c.aliases ?? []), ...suggestNameAliases(name)]
          .map((a) => a.trim())
          .filter((a) => a && a.toLowerCase() !== name.toLowerCase()),
      ),
    ];
    characters.push({ ...c, name, aliases, presence: "present" });
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
  const lockedNames = plotThreads.map((t) => t.name);
  const lockThreads = lockedNames.length > 0;
  const threadKeys = new Set(plotThreads.map((t) => normalizeThreadKey(t.name)));

  for (const t of part.plotThreads ?? []) {
    const name = t.name?.trim() ?? "";
    if (name.length < 2) continue;

    if (lockThreads) {
      const matched = matchExistingThreadName(name, lockedNames);
      if (!matched) continue;
      const i = plotThreads.findIndex(
        (x) => normalizeThreadKey(x.name) === normalizeThreadKey(matched),
      );
      if (i >= 0) {
        plotThreads[i] = {
          ...plotThreads[i],
          color: t.color ?? plotThreads[i].color,
          summary: t.summary?.trim() || plotThreads[i].summary,
        };
      }
      continue;
    }

    const key = normalizeThreadKey(name);
    if (threadKeys.has(key)) {
      const i = plotThreads.findIndex(
        (x) => normalizeThreadKey(x.name) === key,
      );
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

  const resolveAssignmentName = (raw: string): string | null => {
    const n = raw.trim();
    if (!n) return null;
    if (!lockThreads) return n;
    return matchExistingThreadName(n, lockedNames);
  };

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
      const resolved = resolveAssignmentName(n);
      if (resolved) set.add(resolved);
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
    | "clarenceContext"
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

  const existingThreads = book.plotThreads ?? [];
  const lockedThreadLine =
    existingThreads.length > 0
      ? `LOCKED plot threads — use ONLY these exact names in plotThreads and plotAssignments.threadNames (do not invent new tracks): ${existingThreads.map((t) => t.name).join(", ")}. You may echo them with short summaries.`
      : `No plot threads yet — propose clear tracks and assign scenes.`;

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Pass ${passMeta.pass}/${passMeta.passCount} — chapters ${window.fromChapter + 1}–${window.toChapter} of ${chapters.length}.`,
    `Read this window FULLY. Extract only what appears in these chapters (plus continuity with prior finds).`,
    `Do not invent. Do not rewrite manuscript prose.`,
    `CAST RULES: One entry per person — reuse the fullest name from prior passes / bible (Lily Chen, not a second card for Lily).`,
    `presence=present only if they are ON-STAGE in this window (act, speak, occupy the scene). If they are only talked about, remembered, or narrated, use presence=mentioned (or omit them).`,
    `Do not invent duplicate people from nicknames or surname-only variants.`,
    book.clarenceContext?.narratorName?.trim()
      ? `AUTHOR: First-person narrator / protagonist is “${book.clarenceContext.narratorName.trim()}”. Map “I/me/my” to that person; mark them protagonist and presence=present in first-person scenes.`
      : "",
    book.clarenceContext?.authorNotes?.trim()
      ? `AUTHOR NOTES: ${book.clarenceContext.authorNotes.trim()}`
      : "",
    `Chronicle = world lore history (ages, wars, founding) — NOT present plot beats.`,
    `plotAssignments must use exact sceneId values from the blocks below.`,
    `Plot thread colors only from: ${PLOT_THREAD_PALETTE.join(", ")}.`,
    lockedThreadLine,
    "",
    `Already in bible cast: ${(book.characters ?? []).map((c) => c.name).slice(0, 40).join(", ") || "(none)"}`,
    `Already in bible places: ${(book.locations ?? []).map((l) => l.name).slice(0, 40).join(", ") || "(none)"}`,
    `Already in encyclopedia: ${(book.encyclopedia ?? []).map((e) => e.title).slice(0, 30).join(", ") || "(none)"}`,
    `Already in chronicle: ${(book.chronicle ?? []).map((e) => e.title).slice(0, 20).join(", ") || "(none)"}`,
    `Existing plot threads: ${existingThreads.map((t) => t.name).join(", ") || "(none)"}`,
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
