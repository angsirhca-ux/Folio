"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleCheck,
  Feather,
  Loader2,
  Pin,
  ScanSearch,
  Waypoints,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import { CLARENCE } from "@/lib/clarence";
import {
  appendPrivateNote,
  dedupeDevelopmentalFlags,
  formatTryNextPin,
  latestPassForChapter,
  partitionChapterReviewWindows,
  splitEditorMemory,
  type ReviewTextWindow,
} from "@/lib/developmentalEditor";
import { createId, cn } from "@/lib/utils";
import { focusEditorExcerpt } from "@/lib/editorNavigate";
import { formatRelativeDate } from "@/lib/scenes";
import {
  DEVELOPMENTAL_CATEGORY_META,
  DEVELOPMENTAL_PASS_META,
  type DevelopmentalMemoryNote,
  type DevelopmentalPass,
  type DevelopmentalPassKind,
  type DevelopmentalSeverity,
  type DevelopmentalFlag,
  type Scene,
} from "@/lib/types";

/** Per-window timeout — long enough for one Claude tool call. */
const AI_WINDOW_TIMEOUT_MS = 210_000;
/** Continuity is one big call — allow up to ~8 minutes. */
const AI_CONTINUITY_TIMEOUT_MS = 480_000;

type ReviewBookSlice = {
  title: string;
  author: string;
  characters: unknown[];
  locations: unknown[];
  chapters: unknown[];
};

type ReviewChapterSlice = {
  id: string;
  title: string;
  content: string;
  scenes: unknown[];
};

async function reviewChapterWindow(
  kind: "style" | "story" | "action",
  book: ReviewBookSlice,
  chapter: ReviewChapterSlice,
  memory: DevelopmentalMemoryNote[],
  passes: DevelopmentalPass[],
  reviewWindow: ReviewTextWindow,
  signal?: AbortSignal,
): Promise<{
  pass: DevelopmentalPass;
  memoryUpdates: DevelopmentalMemoryNote[];
}> {
  const res = await fetch("/api/editor/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      book,
      chapter,
      memory,
      passes,
      window: reviewWindow,
    }),
    signal,
  });
  const data = (await res.json()) as {
    pass?: DevelopmentalPass;
    memoryUpdates?: DevelopmentalMemoryNote[];
    error?: string;
  };
  if (!res.ok || !data.pass) {
    throw new Error(data.error || "Review failed.");
  }
  return {
    pass: data.pass,
    memoryUpdates: data.memoryUpdates ?? [],
  };
}

async function reviewChapter(
  kind: "style" | "story" | "action",
  book: ReviewBookSlice,
  chapter: ReviewChapterSlice,
  memory: DevelopmentalMemoryNote[],
  passes: DevelopmentalPass[],
  onWindow?: (info: { index: number; total: number; label: string }) => void,
  outerSignal?: AbortSignal,
): Promise<{
  pass: DevelopmentalPass;
  memoryUpdates: DevelopmentalMemoryNote[];
}> {
  const windows = partitionChapterReviewWindows({
    title: chapter.title,
    content: chapter.content,
    scenes: (chapter.scenes ?? []) as Scene[],
  });

  const allFlags: DevelopmentalFlag[] = [];
  const summaries: string[] = [];
  const allMemory: DevelopmentalMemoryNote[] = [];

  for (const reviewWindow of windows) {
    if (outerSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    onWindow?.({
      index: reviewWindow.index,
      total: reviewWindow.total,
      label: reviewWindow.label,
    });

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    outerSignal?.addEventListener("abort", onOuterAbort);
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      AI_WINDOW_TIMEOUT_MS,
    );
    try {
      const { pass, memoryUpdates } = await reviewChapterWindow(
        kind,
        book,
        chapter,
        memory,
        passes,
        reviewWindow,
        controller.signal,
      );
      allFlags.push(...(Array.isArray(pass.flags) ? pass.flags : []));
      if (pass.summary.trim()) summaries.push(pass.summary.trim());
      allMemory.push(...(memoryUpdates ?? []));
    } finally {
      globalThis.clearTimeout(timeoutId);
      outerSignal?.removeEventListener("abort", onOuterAbort);
    }
  }

  const seenMem = new Set<string>();
  const memoryUpdates = allMemory
    .filter((n) => {
      const key = n.text.toLowerCase().slice(0, 120);
      if (seenMem.has(key)) return false;
      seenMem.add(key);
      return true;
    })
    .slice(0, 12);

  return {
    pass: {
      id: createId(),
      kind,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      createdAt: Date.now(),
      summary: summaries.join("\n\n").slice(0, 1600),
      flags: dedupeDevelopmentalFlags(allFlags),
    },
    memoryUpdates,
  };
}

async function reviewContinuity(
  book: {
    title: string;
    author: string;
    chapters: unknown[];
    characters: unknown[];
    locations: unknown[];
    research: unknown[];
  },
  memory: DevelopmentalMemoryNote[],
  series?: {
    title: string;
    synopsis: string;
    notes: string;
    characters: unknown[];
    locations: unknown[];
  } | null,
  signal?: AbortSignal,
): Promise<{
  pass: DevelopmentalPass;
  memoryUpdates: DevelopmentalMemoryNote[];
}> {
  const res = await fetch("/api/editor/continuity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ book, memory, series }),
    signal,
  });
  const data = (await res.json()) as {
    pass?: DevelopmentalPass;
    memoryUpdates?: DevelopmentalMemoryNote[];
    error?: string;
  };
  if (!res.ok || !data.pass) {
    throw new Error(data.error || "Continuity review failed.");
  }
  return {
    pass: data.pass,
    memoryUpdates: data.memoryUpdates ?? [],
  };
}

function aiAbortErrorMessage(err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return "That part of the pass took too long and was stopped. Try again — long chapters run in smaller pieces now, so a second attempt often finishes.";
  }
  if (err instanceof Error) return err.message;
  return "Review failed.";
}

const PASS_TABS: DevelopmentalPassKind[] = [
  "style",
  "story",
  "action",
  "continuity",
];

const SEVERITY_LABEL: Record<DevelopmentalSeverity, string> = {
  note: "Note",
  watch: "Watch",
  issue: "Issue",
};

export function DevelopmentalPanel({
  open,
  onClose,
  editor,
  activeFlagId = null,
  onActiveFlagChange,
  passKind,
  onPassKindChange,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
  activeFlagId?: string | null;
  onActiveFlagChange?: (id: string | null) => void;
  passKind: DevelopmentalPassKind;
  onPassKindChange: (kind: DevelopmentalPassKind) => void;
}) {
  const {
    book,
    activeChapter,
    applyDevelopmentalReview,
    updateDevelopmentalFlag,
    clearDevelopmentalMemory,
    focusScene,
    selectChapter,
    librarySeries,
    updateChapterNotes,
    updateScene,
    sceneFocus,
  } = useBook();
  const claude = useClaudeStatus();
  const [busyKind, setBusyKind] = useState<DevelopmentalPassKind | null>(null);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [busyProgress, setBusyProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewKind = passKind;
  const setViewKind = onPassKindChange;
  const [showMemory, setShowMemory] = useState(false);
  const [passesOpen, setPassesOpen] = useState(true);
  const [activeSuggestionKey, setActiveSuggestionKey] = useState<string | null>(
    null,
  );
  const [pinFlashKey, setPinFlashKey] = useState<string | null>(null);
  const pendingRevealRef = useRef<{
    flagId: string;
    excerpt: string;
    chapterId: string;
  } | null>(null);

  const editorState = book.developmentalEditor ?? { memory: [], passes: [] };

  const focusedScene = useMemo(() => {
    if (
      !sceneFocus ||
      sceneFocus.chapterId !== activeChapter.id ||
      sceneFocus.sceneIndex < 0
    ) {
      return null;
    }
    return activeChapter.scenes[sceneFocus.sceneIndex] ?? null;
  }, [sceneFocus, activeChapter]);

  function pinTryNext(flag: DevelopmentalFlag, suggestion: string, key: string) {
    const block = formatTryNextPin({
      suggestion,
      excerpt: flag.excerpt,
      note: flag.note,
    });
    if (focusedScene) {
      updateScene(focusedScene.id, {
        notes: appendPrivateNote(focusedScene.notes ?? "", block),
      });
    } else {
      updateChapterNotes(appendPrivateNote(activeChapter.notes ?? "", block));
    }
    setPinFlashKey(key);
    window.setTimeout(() => {
      setPinFlashKey((k) => (k === key ? null : k));
    }, 1600);
  }

  const activePass = useMemo(
    () => latestPassForChapter(editorState, activeChapter.id, viewKind),
    [editorState, activeChapter.id, viewKind],
  );

  const anyPassForChapter = useMemo(
    () => latestPassForChapter(editorState, activeChapter.id),
    [editorState, activeChapter.id],
  );

  const chapterTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const ch of book.chapters) map.set(ch.id, ch.title);
    return map;
  }, [book.chapters]);

  const applyReveal = useCallback(
    (flagId: string, excerpt: string) => {
      onActiveFlagChange?.(flagId);
      if (!editor || editor.isDestroyed) return;

      editor.commands.setActiveReviewHighlight(flagId);

      if (excerpt.trim() && focusEditorExcerpt(editor, excerpt)) return;

      requestAnimationFrame(() => {
        const mark = editor.view.dom.querySelector<HTMLElement>(
          `[data-review-flag="${flagId}"]`,
        );
        if (!mark) return;
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [editor, onActiveFlagChange],
  );

  useEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending) return;
    if (activeChapter.id !== pending.chapterId) return;
    if (!editor || editor.isDestroyed) return;

    pendingRevealRef.current = null;
    const { flagId, excerpt } = pending;
    // Wait a beat for the remounted editor + scene focus to settle.
    const t = window.setTimeout(() => applyReveal(flagId, excerpt), 80);
    return () => window.clearTimeout(t);
  }, [activeChapter.id, editor, applyReveal]);

  const runPass = useCallback(
    async (kind: DevelopmentalPassKind) => {
      setBusyKind(kind);
      setBusyElapsedSec(0);
      setBusyProgress(null);
      setError(null);
      setViewKind(kind);
      setPassesOpen(true);
      setShowMemory(false);
      const controller = new AbortController();
      const timeout =
        kind === "continuity"
          ? window.setTimeout(
              () => controller.abort(),
              AI_CONTINUITY_TIMEOUT_MS,
            )
          : null;
      const tick = window.setInterval(() => {
        setBusyElapsedSec((s) => s + 1);
      }, 1000);
      try {
        if (kind === "continuity") {
          const series = librarySeries.find((s) => s.id === book.seriesId);
          const { pass, memoryUpdates } = await reviewContinuity(
            {
              title: book.title,
              author: book.author,
              chapters: book.chapters,
              characters: book.characters ?? [],
              locations: book.locations ?? [],
              research: book.research ?? [],
            },
            editorState.memory,
            series
              ? {
                  title: series.title,
                  synopsis: series.synopsis,
                  notes: series.notes,
                  characters: series.characters,
                  locations: series.locations,
                }
              : null,
            controller.signal,
          );
          applyDevelopmentalReview(pass, memoryUpdates);
        } else {
          const { pass, memoryUpdates } = await reviewChapter(
            kind,
            {
              title: book.title,
              author: book.author,
              characters: book.characters ?? [],
              locations: book.locations ?? [],
              chapters: book.chapters.map((c) => ({
                id: c.id,
                title: c.title,
                summary: c.summary ?? "",
              })),
            },
            {
              id: activeChapter.id,
              title: activeChapter.title,
              content: activeChapter.content,
              scenes: activeChapter.scenes ?? [],
            },
            editorState.memory,
            editorState.passes ?? [],
            ({ index, total }) => {
              setBusyProgress(
                total > 1 ? `Part ${index + 1} of ${total}` : null,
              );
            },
            controller.signal,
          );
          applyDevelopmentalReview(pass, memoryUpdates);
        }
        setPassesOpen(false);
      } catch (e) {
        setError(aiAbortErrorMessage(e));
      } finally {
        if (timeout != null) window.clearTimeout(timeout);
        window.clearInterval(tick);
        setBusyKind(null);
        setBusyElapsedSec(0);
        setBusyProgress(null);
      }
    },
    [
      book.title,
      book.author,
      book.chapters,
      book.characters,
      book.locations,
      book.research,
      book.seriesId,
      librarySeries,
      activeChapter.id,
      activeChapter.title,
      activeChapter.content,
      activeChapter.scenes,
      editorState.memory,
      editorState.passes,
      applyDevelopmentalReview,
    ],
  );

  function revealInManuscript(flag: DevelopmentalFlag) {
    const targetChapterId = flag.chapterId ?? activeChapter.id;
    onActiveFlagChange?.(flag.id);

    if (targetChapterId !== activeChapter.id) {
      pendingRevealRef.current = {
        flagId: flag.id,
        excerpt: flag.excerpt,
        chapterId: targetChapterId,
      };
      if (typeof flag.sceneIndex === "number") {
        focusScene(targetChapterId, flag.sceneIndex);
      } else {
        selectChapter(targetChapterId);
      }
      return;
    }

    applyReveal(flag.id, flag.excerpt);
  }

  const grouped = useMemo(() => {
    if (!activePass) return [];
    const map = new Map<string, DevelopmentalFlag[]>();
    const flags = Array.isArray(activePass.flags) ? activePass.flags : [];
    for (const f of flags) {
      if (f.closed) continue;
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return [...map.entries()];
  }, [activePass]);

  const openFlagCount = useMemo(() => {
    const flags = Array.isArray(activePass?.flags) ? activePass.flags : [];
    return flags.filter((f) => !f.closed).length;
  }, [activePass]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="pointer-events-none fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,26rem)] flex-col"
        >
          <div className="pointer-events-auto flex h-full flex-col border-l border-[var(--border)] bg-[var(--sidebar)] shadow-[-12px_0_40px_var(--shadow)]">
            <div className="shrink-0 border-b border-[rgba(45,42,38,0.08)] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                    Developmental editor
                  </p>
                  <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                    {viewKind === "continuity"
                      ? book.title?.trim() || "Whole book"
                      : activeChapter.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>

              <button
                type="button"
                aria-expanded={passesOpen}
                onClick={() => setPassesOpen((v) => !v)}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-3 py-2.5 text-left transition-colors hover:border-[rgba(176,141,87,0.28)]"
              >
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                    Runs
                  </span>
                  <span className="mt-0.5 block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                    Style & Line · Story · Action · Continuity
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform duration-300",
                    passesOpen && "rotate-180",
                  )}
                  strokeWidth={1.5}
                />
              </button>

              <AnimatePresence initial={false}>
                {passesOpen ? (
                  <motion.div
                    key="passes"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                      Suggestions stay here — pin a try-next into private notes,
                      ✓/✕ teaches the next pass. Collapse this bar to read the
                      full list.
                    </p>

                    <div className="mt-3 grid gap-2">
                      <PassButton
                        kind="style"
                        icon={
                          <Feather className="h-3.5 w-3.5" strokeWidth={1.5} />
                        }
                        busy={busyKind === "style"}
                        elapsedSec={busyKind === "style" ? busyElapsedSec : 0}
                        progress={busyKind === "style" ? busyProgress : null}
                        disabled={
                          busyKind != null || claude?.configured === false
                        }
                        configured={claude?.configured ?? null}
                        onClick={() => void runPass("style")}
                      />
                      <PassButton
                        kind="story"
                        icon={
                          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                        }
                        busy={busyKind === "story"}
                        elapsedSec={busyKind === "story" ? busyElapsedSec : 0}
                        progress={busyKind === "story" ? busyProgress : null}
                        disabled={
                          busyKind != null || claude?.configured === false
                        }
                        configured={claude?.configured ?? null}
                        onClick={() => void runPass("story")}
                      />
                      <PassButton
                        kind="action"
                        icon={
                          <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />
                        }
                        busy={busyKind === "action"}
                        elapsedSec={busyKind === "action" ? busyElapsedSec : 0}
                        progress={busyKind === "action" ? busyProgress : null}
                        disabled={
                          busyKind != null || claude?.configured === false
                        }
                        configured={claude?.configured ?? null}
                        onClick={() => void runPass("action")}
                      />
                      <PassButton
                        kind="continuity"
                        icon={
                          <Waypoints
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                          />
                        }
                        busy={busyKind === "continuity"}
                        elapsedSec={
                          busyKind === "continuity" ? busyElapsedSec : 0
                        }
                        progress={null}
                        disabled={
                          busyKind != null || claude?.configured === false
                        }
                        configured={claude?.configured ?? null}
                        onClick={() => void runPass("continuity")}
                      />
                    </div>

                    {claude?.configured === false ? (
                      <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                        {CLARENCE.needsKeyHint}
                      </p>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {error ? (
                <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1 border-b border-[rgba(45,42,38,0.08)] px-4 py-2">
              {PASS_TABS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setViewKind(kind);
                    setShowMemory(false);
                    onActiveFlagChange?.(null);
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                    viewKind === kind && !showMemory
                      ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                  )}
                >
                  {kind === "style"
                    ? "Style & Line"
                    : kind === "story"
                      ? "Story"
                      : kind === "action"
                        ? "Action"
                        : "Continuity"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowMemory((v) => !v)}
                className={cn(
                  "ml-auto rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  showMemory
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Memory ({editorState.memory.length})
              </button>
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {busyKind ? (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-[rgba(176,141,87,0.28)] bg-[rgba(247,243,234,0.55)] px-3 py-3">
                  <Loader2
                    className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--accent)]"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                      {busyKind === "continuity"
                        ? "Reading the whole book…"
                        : "Reading this chapter…"}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                      Longer chapters can take a few minutes
                      {busyElapsedSec > 0 ? ` · ${busyElapsedSec}s` : ""}. Stay
                      on this chapter until it finishes.
                    </p>
                  </div>
                </div>
              ) : null}
              {showMemory ? (
                <MemoryList
                  notes={editorState.memory}
                  onClear={() => clearDevelopmentalMemory()}
                />
              ) : activePass ? (
                <div className="space-y-6">
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      {DEVELOPMENTAL_PASS_META[activePass.kind].label} ·{" "}
                      {formatRelativeDate(activePass.createdAt)}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                      {openFlagCount} open moment
                      {openFlagCount === 1 ? "" : "s"}
                      {openFlagCount > 0
                        ? " · highlighted in the manuscript"
                        : ""}
                    </p>
                    {activePass.summary ? (
                      <details
                        className="mt-3 group"
                        open={openFlagCount === 0}
                      >
                        <summary className="cursor-pointer list-none font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.14em] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]">
                          <span className="underline-offset-2 group-open:underline">
                            Overview
                          </span>
                        </summary>
                        <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                          {activePass.summary}
                        </p>
                      </details>
                    ) : null}
                  </div>

                  {openFlagCount === 0 ? (
                    <p className="font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
                      {Array.isArray(activePass.flags) &&
                      activePass.flags.length === 0
                        ? activePass.summary
                          ? "Overview only — no page moments were flagged. Re-run Action if you expected kinetic excerpts."
                          : "No moments flagged on this pass."
                        : "No open moments — everything here was dismissed."}
                    </p>
                  ) : (
                    grouped.map(([category, flags]) => (
                      <section key={category}>
                        <h3 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          {DEVELOPMENTAL_CATEGORY_META[
                            category as DevelopmentalFlag["category"]
                          ]?.label ?? category}
                        </h3>
                        <ul className="mt-3 space-y-4">
                          {flags.map((flag) => (
                            <FlagCard
                              key={flag.id}
                              flag={flag}
                              chapterLabel={
                                viewKind === "continuity" && flag.chapterId
                                  ? chapterTitleById.get(flag.chapterId)
                                  : undefined
                              }
                              active={activeFlagId === flag.id}
                              activeSuggestionKey={activeSuggestionKey}
                              pinFlashKey={pinFlashKey}
                              pinTarget={
                                focusedScene
                                  ? "scene notes"
                                  : "chapter notes"
                              }
                              onReveal={() => revealInManuscript(flag)}
                              onSuggestionClick={(index) => {
                                setActiveSuggestionKey(`${flag.id}:${index}`);
                                revealInManuscript(flag);
                              }}
                              onPinSuggestion={(index) => {
                                const s = flag.suggestions?.[index];
                                if (!s) return;
                                pinTryNext(flag, s, `${flag.id}:pin:${index}`);
                              }}
                              onPinNote={() => {
                                pinTryNext(
                                  flag,
                                  flag.note,
                                  `${flag.id}:pin:note`,
                                );
                              }}
                              onLike={() =>
                                updateDevelopmentalFlag(activePass.id, flag.id, {
                                  verdict:
                                    flag.verdict === "liked" ? null : "liked",
                                })
                              }
                              onDislike={() =>
                                updateDevelopmentalFlag(activePass.id, flag.id, {
                                  verdict:
                                    flag.verdict === "disliked"
                                      ? null
                                      : "disliked",
                                })
                              }
                              onMarkHandled={() => {
                                updateDevelopmentalFlag(activePass.id, flag.id, {
                                  closed: true,
                                });
                                if (activeFlagId === flag.id) {
                                  onActiveFlagChange?.(null);
                                }
                              }}
                            />
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <ScanSearch
                    className="mx-auto h-6 w-6 text-[var(--ink-faint)]"
                    strokeWidth={1.25}
                  />
                  <p className="mt-4 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
                    {viewKind === "continuity"
                      ? "No continuity pass yet"
                      : anyPassForChapter
                        ? `No ${
                            viewKind === "style"
                              ? "style & line"
                              : viewKind === "action"
                                ? "action"
                                : "story"
                          } pass yet`
                        : "Ready when you are"}
                  </p>
                  <p className="mx-auto mt-2 max-w-[16rem] font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    {viewKind === "continuity"
                      ? "Run Continuity to scan the whole manuscript for name slips, cast gaps, place jumps, and timeline cracks — flags only."
                      : viewKind === "style"
                        ? "Run Style & Line on this chapter for mechanics, rhythm, diction, and dialogue polish — flags only, never rewrites."
                        : viewKind === "action"
                          ? "Run Action to highlight moments that want dramatized doing — flags and try-nexts only, never rewrites."
                          : "Expand Runs above, then start Style, Story, or Action. The editor will flag issues without touching your words."}
                  </p>
                  {!passesOpen ? (
                    <button
                      type="button"
                      onClick={() => setPassesOpen(true)}
                      className="mt-4 font-[family-name:var(--font-ui)] text-sm text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Open Runs
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function FlagCard({
  flag,
  chapterLabel,
  active,
  activeSuggestionKey,
  pinFlashKey,
  pinTarget,
  onReveal,
  onSuggestionClick,
  onPinSuggestion,
  onPinNote,
  onLike,
  onDislike,
  onMarkHandled,
}: {
  flag: DevelopmentalFlag;
  chapterLabel?: string;
  active: boolean;
  activeSuggestionKey: string | null;
  pinFlashKey: string | null;
  pinTarget: string;
  onReveal: () => void;
  onSuggestionClick: (index: number) => void;
  onPinSuggestion: (index: number) => void;
  onPinNote: () => void;
  onLike: () => void;
  onDislike: () => void;
  onMarkHandled: () => void;
}) {
  return (
    <li
      className={cn(
        "rounded-xl border px-3 py-3 transition-colors",
        active
          ? "border-[rgba(176,141,87,0.35)] bg-[rgba(176,141,87,0.08)]"
          : "border-[rgba(45,42,38,0.06)] bg-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          {SEVERITY_LABEL[flag.severity]}
          {chapterLabel ? ` · ${chapterLabel}` : ""}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Liked this note"
            title="Liked — teaches the next pass"
            onClick={onLike}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              flag.verdict === "liked"
                ? "bg-[rgba(176,141,87,0.2)] text-[var(--accent)]"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]",
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Did not like this note"
            title="Not useful — softens similar flags next time"
            onClick={onDislike}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              flag.verdict === "disliked"
                ? "bg-[rgba(107,58,42,0.12)] text-[#6B3A2A]"
                : "text-[var(--ink-faint)] hover:text-[var(--ink)]",
            )}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Mark handled"
            title="Mark handled — after you revise by hand"
            onClick={onMarkHandled}
            className="rounded-full p-1.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
          >
            <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onReveal}
        className="mt-1.5 w-full text-left font-[family-name:var(--font-body)] text-sm italic leading-relaxed text-[var(--ink)] transition-colors hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]"
        title="Jump to this passage"
      >
        “{flag.excerpt}”
      </button>
      <button
        type="button"
        onClick={onReveal}
        className="mt-2 w-full text-left font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        title="Jump to this passage"
      >
        {flag.note}
      </button>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onPinNote}
          title={`Pin note to ${pinTarget}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 font-[family-name:var(--font-ui)] text-[0.65rem] transition-colors",
            pinFlashKey === `${flag.id}:pin:note`
              ? "bg-[rgba(176,141,87,0.18)] text-[var(--accent)]"
              : "text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink-muted)]",
          )}
        >
          <Pin className="h-3 w-3" strokeWidth={1.5} />
          {pinFlashKey === `${flag.id}:pin:note` ? "Pinned" : "Pin note"}
        </button>
      </div>
      {(flag.suggestions?.length ?? 0) > 0 ? (
        <div className="mt-3 rounded-lg border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.45)] px-3 py-3">
          <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Suggestions · panel only
          </p>
          <ol className="mt-2 space-y-2.5">
            {(flag.suggestions ?? []).slice(0, 2).map((s, i) => {
              const key = `${flag.id}:${i}`;
              const pinKey = `${flag.id}:pin:${i}`;
              const selected = activeSuggestionKey === key;
              const pinned = pinFlashKey === pinKey;
              const roleLabel = i === 0 ? "Direction" : "Example";
              return (
                <li key={key} className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onSuggestionClick(i)}
                    className={cn(
                      "flex min-w-0 flex-1 gap-2 rounded-lg px-2 py-1.5 text-left font-[family-name:var(--font-ui)] text-sm leading-relaxed transition-colors",
                      selected
                        ? "bg-[rgba(176,141,87,0.14)] text-[var(--ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                    )}
                  >
                    <span className="w-16 shrink-0 pt-0.5 font-[family-name:var(--font-ui)] text-[0.58rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                      {roleLabel}
                    </span>
                    <span className={i === 1 ? "italic text-[var(--ink)]" : undefined}>
                      {s}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Pin suggestion ${i + 1} to ${pinTarget}`}
                    title={`Pin to ${pinTarget} — never inserts into the manuscript`}
                    onClick={() => onPinSuggestion(i)}
                    className={cn(
                      "shrink-0 self-start rounded-lg p-1.5 transition-colors",
                      pinned
                        ? "bg-[rgba(176,141,87,0.18)] text-[var(--accent)]"
                        : "text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                    )}
                  >
                    <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </li>
  );
}

function PassButton({
  kind,
  icon,
  busy,
  elapsedSec = 0,
  progress = null,
  disabled,
  configured,
  onClick,
}: {
  kind: DevelopmentalPassKind;
  icon: React.ReactNode;
  busy: boolean;
  elapsedSec?: number;
  progress?: string | null;
  disabled: boolean;
  configured: boolean | null;
  onClick: () => void;
}) {
  const meta = DEVELOPMENTAL_PASS_META[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        configured === false
          ? CLARENCE.needsKey
          : meta.blurb
      }
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.55)] px-4 py-3 text-left transition-colors",
        "hover:border-[rgba(176,141,87,0.35)] hover:bg-[rgba(247,243,234,0.9)]",
        "disabled:cursor-not-allowed disabled:opacity-55",
      )}
    >
      <span className="mt-0.5 text-[var(--accent)]">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
        ) : (
          icon
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
          {busy
            ? kind === "continuity"
              ? `Reading the whole book…${elapsedSec ? ` ${elapsedSec}s` : ""}`
              : `${progress ? `${progress} · ` : ""}Reading this chapter…${elapsedSec ? ` ${elapsedSec}s` : ""}`
            : meta.label}
        </span>
        <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
          {busy
            ? CLARENCE.draftingFlags
            : meta.blurb}
        </span>
      </span>
    </button>
  );
}

function MemoryList({
  notes,
  onClear,
}: {
  notes: DevelopmentalMemoryNote[];
  onClear: () => void;
}) {
  const { preferences, general } = splitEditorMemory(notes);

  if (notes.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-sm italic leading-relaxed text-[var(--ink-faint)]">
        Empty for now. ✓ liked and ✕ not useful on flags teach the next pass;
        recurring habits from reviews gather here too — never for rewriting.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
          ✓/✕ verdicts become preferences that shape later passes. Other notes
          carry craft and continuity — never manuscript rewrites.
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 rounded-full text-xs text-[var(--ink-faint)]"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
      {preferences.length > 0 ? (
        <section className="mb-6">
          <h3 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Preferences from verdicts
          </h3>
          <ul className="mt-3 space-y-3">
            {preferences.map((n) => (
              <li
                key={n.id}
                className="border-b border-[rgba(45,42,38,0.06)] pb-3 last:border-0"
              >
                <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {n.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {general.length > 0 ? (
        <section>
          <h3 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            Editor memory
          </h3>
          <ul className="mt-3 space-y-3">
            {general.map((n) => (
              <li
                key={n.id}
                className="border-b border-[rgba(45,42,38,0.06)] pb-3 last:border-0"
              >
                <span className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  {n.kind}
                </span>
                <p className="mt-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {n.text}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
