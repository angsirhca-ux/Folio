import type { Book, Chapter, PlotThread, Scene } from "./types";
import { createId } from "./utils";

/** Calm Folio palette for plot threads — not neon dashboard colors. */
export const PLOT_THREAD_PALETTE = [
  "#6B3A2A", // terracotta ink
  "#B08D57", // accent gold
  "#3D5A4C", // moss
  "#4A5B7A", // slate blue
  "#7A5A6E", // dusty rose
  "#5C6B4A", // olive
  "#8B5E3C", // oak
  "#5A6A72", // pewter
] as const;

export const QUIET_GAP_MIN = 3;

/** Genre starter packs — preload tracks; rename freely after. */
export const PLOT_THREAD_STARTERS: Array<{
  id: string;
  label: string;
  hint: string;
  threads: string[];
}> = [
  {
    id: "blank",
    label: "Blank",
    hint: "Start empty — name tracks yourself",
    threads: [],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    hint: "Quest, magic, factions, and the hero’s change",
    threads: [
      "Main quest",
      "Hero’s arc",
      "Magic & world rules",
      "Politics & factions",
      "Antagonist",
      "Companions / found family",
      "Mystery of the past",
    ],
  },
  {
    id: "fiction",
    label: "Fiction",
    hint: "External plot, internal arc, and the B-story",
    threads: [
      "Main plot",
      "Character arc",
      "Relationship / B-story",
      "Opposition",
      "Mystery / reveal",
      "Secondary character",
    ],
  },
  {
    id: "romantasy",
    label: "Romantasy",
    hint: "Co-equal fantasy plot and romance — neither is garnish",
    threads: [
      "Fantasy plot",
      "Romance arc",
      "Magic / bond",
      "Politics & power",
      "Desire vs duty",
      "Rival / second lead",
      "Found family",
    ],
  },
  {
    id: "contemporary",
    label: "Contemporary",
    hint: "Want, work, love, family, and the secret under it",
    threads: [
      "External want",
      "Internal arc",
      "Romance / central relationship",
      "Family",
      "Work / institution",
      "Friendship",
      "Secret / reveal",
    ],
  },
];

/**
 * Add missing starter threads onto a book (idempotent by name).
 * Does not assign scenes — Tracks stay empty until the author or Claude marks them.
 */
export function applyPlotThreadStarter(
  threads: PlotThread[],
  starterId: string,
): PlotThread[] {
  const starter = PLOT_THREAD_STARTERS.find((s) => s.id === starterId);
  if (!starter || starter.threads.length === 0) return threads;

  const existingLower = new Set(
    threads.map((t) => t.name.trim().toLowerCase()),
  );
  let next = [...threads];
  for (const name of starter.threads) {
    const key = name.trim().toLowerCase();
    if (!key || existingLower.has(key)) continue;
    if (next.length >= 12) break;
    existingLower.add(key);
    next.push(createPlotThread({ name }, next.length));
  }
  return next;
}

export function createPlotThread(
  partial?: Partial<Omit<PlotThread, "id" | "createdAt" | "updatedAt">> & {
    id?: string;
  },
  existingCount = 0,
): PlotThread {
  const now = Date.now();
  const color =
    partial?.color ??
    PLOT_THREAD_PALETTE[existingCount % PLOT_THREAD_PALETTE.length];
  return {
    id: partial?.id ?? createId(),
    name: partial?.name?.trim() || "New thread",
    color,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizePlotThread(
  t: Partial<PlotThread> & { id: string },
): PlotThread {
  return {
    id: t.id,
    name: t.name?.trim() || "Untitled thread",
    color: t.color || PLOT_THREAD_PALETTE[0],
    createdAt: t.createdAt ?? Date.now(),
    updatedAt: t.updatedAt ?? Date.now(),
  };
}

export function ensureBookPlotThreads(book: Book): Book {
  const plotThreads = (book.plotThreads ?? []).map((t) =>
    normalizePlotThread(t),
  );
  const validIds = new Set(plotThreads.map((t) => t.id));
  const chapters = book.chapters.map((c) => ({
    ...c,
    scenes: (c.scenes ?? []).map((s) => ({
      ...s,
      threadIds: (s.threadIds ?? []).filter((id) => validIds.has(id)),
    })),
  }));
  return { ...book, plotThreads, chapters };
}

export type FlatSceneColumn = {
  scene: Scene;
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  sceneIndex: number;
  /** Index in reading-order flatten. */
  globalIndex: number;
};

/** Scenes left-to-right in manuscript order. */
export function flattenScenesForTracks(chapters: Chapter[]): FlatSceneColumn[] {
  const out: FlatSceneColumn[] = [];
  let globalIndex = 0;
  chapters.forEach((chapter, chapterIndex) => {
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      out.push({
        scene,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterIndex,
        sceneIndex,
        globalIndex: globalIndex++,
      });
    });
  });
  return out;
}

export type QuietRun = { start: number; end: number };

/**
 * Inclusive index ranges where the thread is absent for ≥ QUIET_GAP_MIN
 * consecutive scenes in reading order.
 */
export function quietRunsForThread(
  threadId: string,
  columns: FlatSceneColumn[],
): QuietRun[] {
  const runs: QuietRun[] = [];
  let runStart: number | null = null;

  const flush = (endExclusive: number) => {
    if (runStart === null) return;
    const length = endExclusive - runStart;
    if (length >= QUIET_GAP_MIN) {
      runs.push({ start: runStart, end: endExclusive - 1 });
    }
    runStart = null;
  };

  columns.forEach((col, i) => {
    const has = (col.scene.threadIds ?? []).includes(threadId);
    if (has) {
      flush(i);
    } else if (runStart === null) {
      runStart = i;
    }
  });
  flush(columns.length);
  return runs;
}

export function sceneHasThread(scene: Scene, threadId: string): boolean {
  return (scene.threadIds ?? []).includes(threadId);
}

export function toggleThreadId(
  threadIds: string[] | undefined,
  threadId: string,
): string[] {
  const list = threadIds ?? [];
  return list.includes(threadId)
    ? list.filter((id) => id !== threadId)
    : [...list, threadId];
}
