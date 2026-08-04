import type { Book, Chapter, PlotThread, Scene } from "./types";
import { getSceneHtmlParts } from "./manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "./manuscriptContext";
import {
  createPlotThread,
  PLOT_THREAD_PALETTE,
} from "./plotThreads";

function scenePlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export type DiscoveredPlotThread = {
  name: string;
  /** Prefer a color from the Folio palette. */
  color?: string;
  summary?: string;
};

export type DiscoveredThreadAssignment = {
  sceneId: string;
  threadNames: string[];
};

export type PlotThreadDiscoverPayload = {
  threads: DiscoveredPlotThread[];
  assignments: DiscoveredThreadAssignment[];
};

export const PLOT_THREAD_DISCOVER_TOOL_NAME = "save_plot_threads";

export const discoverPlotThreadsTool = {
  name: PLOT_THREAD_DISCOVER_TOOL_NAME,
  description:
    "Assign scenes to plot threads on a novel timeline. If the book already lists threads, use those exact names only — do not invent new tracks.",
  input_schema: {
    type: "object" as const,
    properties: {
      threads: {
        type: "array",
        description:
          "When existing threads are listed in the prompt, echo those exact names (optional short summaries). When none exist, propose 3–8 distinct threads.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Short track label — must match locked names when provided.",
            },
            color: {
              type: "string",
              description: `Hex color from this palette only: ${PLOT_THREAD_PALETTE.join(", ")}`,
              enum: [...PLOT_THREAD_PALETTE],
            },
            summary: {
              type: "string",
              description: "One sentence on what this thread tracks.",
            },
          },
          required: ["name", "color"],
        },
      },
      assignments: {
        type: "array",
        description:
          "For each scene that meaningfully advances one or more threads, list sceneId and thread names (exact names from threads / locked list).",
        items: {
          type: "object",
          properties: {
            sceneId: {
              type: "string",
              description: "Exact sceneId from the manuscript context.",
            },
            threadNames: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["sceneId", "threadNames"],
        },
      },
    },
    required: ["threads", "assignments"],
  },
};

/** Manuscript context with sceneIds so Claude can assign tracks. */
export function buildPlotThreadDiscoveryContext(
  book: Pick<Book, "title" | "chapters" | "plotThreads">,
): string {
  const existingList = book.plotThreads ?? [];
  const existing =
    existingList.map((t) => t.name).join(", ") || "(none)";
  const lockNote =
    existingList.length > 0
      ? [
          `LOCKED THREADS — use ONLY these exact names in threads[] and assignments.threadNames: ${existing}.`,
          `Do not invent new thread names. Assign scenes onto these tracks. You may return the same names with short summaries.`,
        ].join("\n")
      : [
          `No tracks yet — propose 3–8 distinct plot threads (subplots/arcs), pick palette colors, and mark which scenes advance each.`,
        ].join("\n");

  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Existing plot threads: ${existing}`,
    lockNote,
    `Each scene block includes sceneId — use those exact ids in assignments.`,
    `Do not invent scenes. Prefer evidence from prose, synopsis, and labels.`,
    "",
    "Scenes:",
  ].join("\n");

  const byChapter: string[][] = book.chapters.map((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    const blocks: string[] = [];
    const scenes = chapter.scenes ?? [];
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
          `Act: ${scene?.act || "—"}`,
          `Labels: ${(scene?.labels ?? []).join(", ") || "—"}`,
          `Synopsis: ${scene?.synopsis?.trim() || "—"}`,
          prose ? `Prose: ${prose}` : "Prose: (empty)",
          "",
        ].join("\n"),
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

function normalizeHex(color: string | undefined, index: number): string {
  const c = (color ?? "").trim();
  if ((PLOT_THREAD_PALETTE as readonly string[]).includes(c)) return c;
  const match = PLOT_THREAD_PALETTE.find(
    (p) => p.toLowerCase() === c.toLowerCase(),
  );
  if (match) return match;
  return PLOT_THREAD_PALETTE[index % PLOT_THREAD_PALETTE.length];
}

/** Collapse punctuation so “Hero’s arc” ≈ “Heros arc” ≈ “Hero arc”. */
export function normalizeThreadKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a Clarence / freeform label onto an existing track name.
 * Exact → contains → shared tokens. Returns the canonical existing name.
 */
export function matchExistingThreadName(
  query: string,
  existingNames: string[],
): string | null {
  const q = normalizeThreadKey(query);
  if (!q || existingNames.length === 0) return null;

  for (const name of existingNames) {
    if (normalizeThreadKey(name) === q) return name;
  }

  for (const name of existingNames) {
    const ck = normalizeThreadKey(name);
    if (ck.length < 4 || q.length < 4) continue;
    if (ck.includes(q) || q.includes(ck)) return name;
  }

  const qTokens = q.split(" ").filter((t) => t.length > 2);
  if (qTokens.length === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const name of existingNames) {
    const cTokens = normalizeThreadKey(name)
      .split(" ")
      .filter((t) => t.length > 2);
    if (cTokens.length === 0) continue;
    const overlap = cTokens.filter((t) => qTokens.includes(t)).length;
    if (overlap === 0) continue;
    const score = overlap / Math.max(cTokens.length, qTokens.length);
    if (score > bestScore && score >= 0.45) {
      bestScore = score;
      best = name;
    }
  }
  return best;
}

/**
 * Merge Clarence threads into the book.
 * When the book already has tracks (starter pack or hand-made), lock to those:
 * assign scenes onto them — do not invent parallel threads.
 * Only create new threads when the book has none yet.
 */
export function applyPlotThreadDiscovery(
  book: Book,
  payload: PlotThreadDiscoverPayload,
): Book {
  const incoming = (payload.threads ?? [])
    .map((t) => ({
      name: (t.name ?? "").trim(),
      color: t.color,
      summary: t.summary?.trim() ?? "",
    }))
    .filter((t) => t.name.length > 1)
    .slice(0, 12);

  const existing = [...(book.plotThreads ?? [])];
  const lockToExisting = existing.length > 0;

  if (incoming.length === 0 && lockToExisting) {
    // Assignments-only payload still useful
  } else if (incoming.length === 0) {
    return book;
  }

  const existingNames = existing.map((t) => t.name);
  const nameToId = new Map(
    existing.map((t) => [normalizeThreadKey(t.name), t.id]),
  );
  const nextThreads: PlotThread[] = [...existing];

  if (!lockToExisting) {
    incoming.forEach((t, i) => {
      const key = normalizeThreadKey(t.name);
      const foundId = nameToId.get(key);
      const color = normalizeHex(t.color, nextThreads.length + i);
      if (foundId) {
        const idx = nextThreads.findIndex((x) => x.id === foundId);
        if (idx >= 0) {
          nextThreads[idx] = {
            ...nextThreads[idx],
            color,
            updatedAt: Date.now(),
          };
        }
      } else {
        const thread = createPlotThread(
          { name: t.name, color },
          nextThreads.length,
        );
        nextThreads.push(thread);
        nameToId.set(key, thread.id);
      }
    });
  } else {
    // Refresh colors on fuzzy-matched existing tracks; never add new ones.
    for (const t of incoming) {
      const matched = matchExistingThreadName(t.name, existingNames);
      if (!matched) continue;
      const key = normalizeThreadKey(matched);
      const foundId = nameToId.get(key);
      if (!foundId) continue;
      const idx = nextThreads.findIndex((x) => x.id === foundId);
      if (idx < 0) continue;
      const color = normalizeHex(t.color, idx);
      nextThreads[idx] = {
        ...nextThreads[idx],
        color,
        updatedAt: Date.now(),
      };
    }
  }

  const resolveNameToId = (raw: string): string | undefined => {
    const exact = nameToId.get(normalizeThreadKey(raw));
    if (exact) return exact;
    if (!lockToExisting) return undefined;
    const matched = matchExistingThreadName(raw, existingNames);
    if (!matched) return undefined;
    return nameToId.get(normalizeThreadKey(matched));
  };

  const claudeThreadIds = new Set<string>();
  if (lockToExisting) {
    for (const t of nextThreads) claudeThreadIds.add(t.id);
  } else {
    for (const t of incoming) {
      const id = nameToId.get(normalizeThreadKey(t.name));
      if (id) claudeThreadIds.add(id);
    }
  }

  const assignmentMap = new Map<string, string[]>();
  for (const a of payload.assignments ?? []) {
    const sceneId = a.sceneId?.trim();
    if (!sceneId) continue;
    const ids = (a.threadNames ?? [])
      .map((n) => resolveNameToId(n.trim()))
      .filter((id): id is string => Boolean(id));
    if (ids.length) assignmentMap.set(sceneId, [...new Set(ids)]);
  }

  const chapters = book.chapters.map((ch) => ({
    ...ch,
    scenes: (ch.scenes ?? []).map((s: Scene) => {
      const fromClaude = assignmentMap.get(s.id);
      if (!fromClaude) {
        return s;
      }
      const preserved = (s.threadIds ?? []).filter(
        (id) => !claudeThreadIds.has(id),
      );
      return {
        ...s,
        threadIds: [...new Set([...preserved, ...fromClaude])],
        updatedAt: Date.now(),
      };
    }),
  }));

  return {
    ...book,
    plotThreads: nextThreads,
    chapters,
    updatedAt: Date.now(),
  };
}

export function chaptersHavePlottableProse(chapters: Chapter[]): boolean {
  return chapters.some((ch) => {
    if ((ch.scenes ?? []).some((s) => (s.synopsis ?? "").trim().length > 20)) {
      return true;
    }
    return scenePlain(ch.content).length > 80;
  });
}
