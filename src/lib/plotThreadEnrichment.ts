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
    "Propose named plot threads (subplots / arcs) for a novel timeline and assign which scenes touch each thread.",
  input_schema: {
    type: "object" as const,
    properties: {
      threads: {
        type: "array",
        description:
          "3–8 distinct plot threads (main conflict, romance, mystery, character arc, etc.). Prefer fewer sharp threads over many vague ones.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Short track label — e.g. Romance, Inheritance, War.",
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
          "For each scene that meaningfully advances one or more threads, list sceneId and thread names (exact names from threads).",
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
  const existing =
    (book.plotThreads ?? []).map((t) => t.name).join(", ") || "(none)";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Existing plot threads: ${existing}`,
    `Each scene block includes sceneId — use those exact ids in assignments.`,
    `Propose distinct narrative threads (subplots/arcs), pick palette colors, and mark which scenes advance each thread.`,
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

/**
 * Merge Claude threads into the book: reuse same-named threads, add new ones,
 * and set scene threadIds from assignments (union with any threads not in the
 * Claude set so manual strands are preserved).
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
    .slice(0, 10);

  if (incoming.length === 0) return book;

  const existing = [...(book.plotThreads ?? [])];
  const nameToId = new Map(
    existing.map((t) => [t.name.trim().toLowerCase(), t.id]),
  );
  const nextThreads: PlotThread[] = [...existing];

  incoming.forEach((t, i) => {
    const key = t.name.toLowerCase();
    const color = normalizeHex(t.color, nextThreads.length + i);
    const foundId = nameToId.get(key);
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

  const claudeThreadIds = new Set(
    incoming
      .map((t) => nameToId.get(t.name.toLowerCase()))
      .filter((id): id is string => Boolean(id)),
  );

  const assignmentMap = new Map<string, string[]>();
  for (const a of payload.assignments ?? []) {
    const sceneId = a.sceneId?.trim();
    if (!sceneId) continue;
    const ids = (a.threadNames ?? [])
      .map((n) => nameToId.get(n.trim().toLowerCase()))
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

  // Scenes without Claude assignments keep their existing threadIds.
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
