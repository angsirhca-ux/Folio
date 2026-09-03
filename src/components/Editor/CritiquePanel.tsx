"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import {
  ChevronDown,
  ClipboardCheck,
  Gauge,
  Loader2,
  StickyNote,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import { CLARENCE } from "@/lib/clarence";
import {
  CRITIQUE_SECTION_META,
  MANUSCRIPT_CRITIQUE_CHAPTER_ID,
  MANUSCRIPT_CRITIQUE_TITLE,
  PRESSURE_CRITIQUE_PACK,
  SMART_CRITIQUE_PACK,
  SMART_CRITIQUE_SECTIONS,
  critiqueVerdictSummary,
  formatCritiqueNoteBlock,
  groupCritiqueItems,
  isManuscriptCritiqueReview,
  latestCritiqueReview,
  latestManuscriptCritiqueReview,
  memoryForPack,
  mergeCritiqueWindowItems,
  openCritiqueIssues,
  packById,
  partitionManuscriptCritiqueWindows,
  questionsForCritiqueRun,
  visibleCritiqueItems,
  type OpenCritiqueIssue,
} from "@/lib/critique";
import { AI_CHAPTER_TIMEOUT_MS, AI_WINDOW_TIMEOUT_MS } from "@/lib/ai/timeouts";
import { createId } from "@/lib/utils";
import { focusEditorExcerpt } from "@/lib/editorNavigate";
import { formatRelativeDate } from "@/lib/scenes";
import type {
  CritiqueItemResult,
  CritiqueMemoryNote,
  CritiquePackId,
  CritiqueReview,
  CritiqueSectionId,
  CritiqueVerdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CritiqueBookSlice = {
  title: string;
  author: string;
  characters: unknown[];
  locations: unknown[];
  encyclopedia: unknown[];
  research: unknown[];
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    summary?: string;
    scenes?: unknown[];
  }>;
};

async function runCritiqueChapter(args: {
  packId: CritiquePackId;
  sections?: CritiqueSectionId[];
  book: CritiqueBookSlice;
  chapter: {
    id: string;
    title: string;
    content: string;
    summary: string;
    scenes?: unknown[];
  };
  previousChapter?: {
    id: string;
    title: string;
    content: string;
  } | null;
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
  signal?: AbortSignal;
}): Promise<{ review: CritiqueReview; memoryUpdates: CritiqueMemoryNote[] }> {
  const res = await fetch("/api/editor/critique", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chapter", ...args }),
    signal: args.signal,
  });
  const data = (await res.json()) as {
    review?: CritiqueReview;
    memoryUpdates?: CritiqueMemoryNote[];
    error?: string;
  };
  if (!res.ok || !data.review) {
    throw new Error(data.error || "Critique failed.");
  }
  return {
    review: data.review,
    memoryUpdates: data.memoryUpdates ?? [],
  };
}

async function runManuscriptCritique(args: {
  packId: CritiquePackId;
  sections?: CritiqueSectionId[];
  book: CritiqueBookSlice;
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
  onWindow?: (info: { index: number; total: number; label: string }) => void;
  outerSignal?: AbortSignal;
}): Promise<{ review: CritiqueReview; memoryUpdates: CritiqueMemoryNote[] }> {
  const pack = packById(args.packId);
  if (!pack) {
    throw new Error("Unknown critique pack.");
  }

  const windows = partitionManuscriptCritiqueWindows(
    args.book.chapters.map((c) => ({
      title: c.title,
      content: c.content,
    })),
  );
  if (windows.length === 0) {
    throw new Error("No readable chapters found in this manuscript.");
  }

  const scopedQuestions = questionsForCritiqueRun(pack, args.sections);
  const windowItemSets: CritiqueItemResult[][] = [];
  const summaries: string[] = [];
  const allMemoryUpdates: CritiqueMemoryNote[] = [];
  let memory = args.memory;
  let previousWindowEnding = "";

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex++) {
    if (args.outerSignal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const reviewWindow = windows[windowIndex]!;
    args.onWindow?.({
      index: windowIndex,
      total: windows.length,
      label: reviewWindow.label,
    });

    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    args.outerSignal?.addEventListener("abort", onOuterAbort);
    const timeoutId = globalThis.setTimeout(
      () => controller.abort(),
      AI_WINDOW_TIMEOUT_MS,
    );

    try {
      const res = await fetch("/api/editor/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manuscript",
          manuscriptStep: {
            windowIndex,
            previousWindowEnding: previousWindowEnding || undefined,
          },
          packId: args.packId,
          sections: args.sections,
          book: args.book,
          memory,
          reviews: args.reviews,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        items?: CritiqueItemResult[];
        memoryUpdates?: CritiqueMemoryNote[];
        summaryPart?: string;
        previousWindowEnding?: string;
        done?: boolean;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Manuscript critique failed.");
      }

      if (data.items) {
        windowItemSets.push(data.items);
      }
      if (data.summaryPart?.trim()) {
        summaries.push(
          windows.length > 1
            ? `[Part ${windowIndex + 1}] ${data.summaryPart.trim()}`
            : data.summaryPart.trim(),
        );
      }
      if (data.memoryUpdates?.length) {
        allMemoryUpdates.push(...data.memoryUpdates);
        memory = [...data.memoryUpdates, ...memory];
      }
      previousWindowEnding = data.previousWindowEnding ?? previousWindowEnding;

      if (data.done) {
        const mergedItems = mergeCritiqueWindowItems(
          scopedQuestions,
          windowItemSets,
        );
        return {
          review: {
            id: createId(),
            packId: pack.id,
            chapterId: MANUSCRIPT_CRITIQUE_CHAPTER_ID,
            chapterTitle: MANUSCRIPT_CRITIQUE_TITLE,
            createdAt: Date.now(),
            summary: summaries.join("\n\n").slice(0, 1600),
            items: mergedItems,
          },
          memoryUpdates: allMemoryUpdates,
        };
      }
    } finally {
      globalThis.clearTimeout(timeoutId);
      args.outerSignal?.removeEventListener("abort", onOuterAbort);
    }
  }

  throw new Error("Manuscript critique did not finish.");
}

type CritiqueTab = CritiquePackId | "memory" | "open";
type CritiqueScope = "chapter" | "manuscript";

const VERDICT_STYLES: Record<
  CritiqueVerdict,
  { label: string; className: string }
> = {
  yes: {
    label: "Yes",
    className: "bg-[rgba(58,90,58,0.12)] text-[#3A5A3A]",
  },
  partial: {
    label: "Partial",
    className: "bg-[rgba(107,74,42,0.12)] text-[#6B4A2A]",
  },
  no: {
    label: "No",
    className: "bg-[rgba(107,58,42,0.12)] text-[#6B3A2A]",
  },
  "n/a": {
    label: "N/A",
    className: "bg-[rgba(45,42,38,0.08)] text-[var(--ink-faint)]",
  },
};

export function CritiquePanel({
  open,
  onClose,
  editor,
}: {
  open: boolean;
  onClose: () => void;
  editor: Editor | null;
}) {
  const {
    book,
    activeChapter,
    selectChapter,
    applyCritiqueReview,
    appendChapterNotes,
    clearCritiqueMemory,
    clearCritiqueReviewForChapter,
    clearCritiqueReviews,
  } = useBook();
  const claude = useClaudeStatus();
  const state = book.critique ?? { memory: [], reviews: [] };

  const [viewPackId, setViewPackId] = useState<CritiquePackId>("smart");
  const [activeTab, setActiveTab] = useState<CritiqueTab>("smart");
  const [critiqueScope, setCritiqueScope] = useState<CritiqueScope>("chapter");
  const [busyPack, setBusyPack] = useState<CritiquePackId | null>(null);
  const [busyScope, setBusyScope] = useState<CritiqueScope | null>(null);
  const [busySection, setBusySection] = useState<CritiqueSectionId | "all" | null>(
    null,
  );
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [busyProgress, setBusyProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNa, setShowNa] = useState(false);
  const [runsOpen, setRunsOpen] = useState(true);
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);
  const [pinFlashId, setPinFlashId] = useState<string | null>(null);

  const viewPack = packById(viewPackId) ?? SMART_CRITIQUE_PACK;
  const busy = busyPack != null;

  const review = useMemo(() => {
    const chapterId =
      critiqueScope === "manuscript"
        ? MANUSCRIPT_CRITIQUE_CHAPTER_ID
        : activeChapter.id;
    return latestCritiqueReview(state, viewPackId, chapterId);
  }, [state, viewPackId, critiqueScope, activeChapter.id]);

  const allMemory = useMemo(
    () => memoryForPack(state, viewPackId),
    [state, viewPackId],
  );
  const verdictSummary = useMemo(
    () => (review ? critiqueVerdictSummary(review.items) : null),
    [review],
  );

  const activeChapterIndex = book.chapters.findIndex(
    (c) => c.id === activeChapter.id,
  );
  const previousChapter =
    activeChapterIndex > 0 ? book.chapters[activeChapterIndex - 1] : null;

  const openIssues = useMemo(
    () => openCritiqueIssues(state, book.chapters),
    [state, book.chapters],
  );

  useEffect(() => {
    if (!focusQuestionId || activeTab === "memory" || activeTab === "open") {
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-critique-item="${focusQuestionId}"]`,
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusQuestionId, activeTab, review?.id]);

  function pinCritiqueItem(args: {
    chapterId: string;
    packName: string;
    prompt: string;
    item: Pick<
      CritiqueItemResult,
      "verdict" | "note" | "excerpt" | "suggestion"
    >;
    flashId: string;
  }) {
    appendChapterNotes(
      args.chapterId,
      formatCritiqueNoteBlock({
        packName: args.packName,
        prompt: args.prompt,
        verdict: args.item.verdict,
        note: args.item.note,
        excerpt: args.item.excerpt,
        suggestion: args.item.suggestion,
      }),
    );
    setPinFlashId(args.flashId);
    window.setTimeout(() => setPinFlashId(null), 1200);
  }

  function jumpToIssue(issue: OpenCritiqueIssue) {
    if (issue.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID) {
      setCritiqueScope("manuscript");
    } else if (issue.chapterId !== activeChapter.id) {
      selectChapter(issue.chapterId);
      setCritiqueScope("chapter");
    } else {
      setCritiqueScope("chapter");
    }
    setViewPackId(issue.packId);
    setActiveTab(issue.packId);
    setFocusQuestionId(issue.questionId);
  }

  const smartReview = useMemo(
    () => latestCritiqueReview(state, "smart", activeChapter.id),
    [state, activeChapter.id],
  );
  const smartManuscriptReview = useMemo(
    () => latestManuscriptCritiqueReview(state, "smart"),
    [state],
  );
  const pressureReview = useMemo(
    () => latestCritiqueReview(state, "pressure", activeChapter.id),
    [state, activeChapter.id],
  );
  const pressureManuscriptReview = useMemo(
    () => latestManuscriptCritiqueReview(state, "pressure"),
    [state],
  );

  async function runPack(
    packId: CritiquePackId,
    sections?: CritiqueSectionId[],
    mode: CritiqueScope = critiqueScope,
  ) {
    if (busy) return;
    setBusyPack(packId);
    setBusyScope(mode);
    setBusySection(
      packId === "smart"
        ? sections?.length === SMART_CRITIQUE_SECTIONS.length
          ? "all"
          : (sections?.[0] ?? "all")
        : null,
    );
    setViewPackId(packId);
    setActiveTab(packId);
    setBusyElapsedSec(0);
    setBusyProgress(null);
    setError(null);
    const controller = new AbortController();
    let chapterTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    if (mode === "chapter") {
      chapterTimeout = globalThis.setTimeout(
        () => controller.abort(),
        AI_CHAPTER_TIMEOUT_MS,
      );
    }
    const tick = globalThis.setInterval(() => {
      setBusyElapsedSec((s) => s + 1);
    }, 1000);
    const mergeItems = Boolean(
      packId === "smart" && sections?.length && sections.length < SMART_CRITIQUE_SECTIONS.length,
    );
    const bookSlice: CritiqueBookSlice = {
      title: book.title,
      author: book.author,
      characters: book.characters ?? [],
      locations: book.locations ?? [],
      encyclopedia: book.encyclopedia ?? [],
      research: book.research ?? [],
      chapters: book.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary ?? "",
        content: c.content,
        scenes: c.scenes ?? [],
      })),
    };
    try {
      const { review: next, memoryUpdates } =
        mode === "manuscript"
          ? await runManuscriptCritique({
              packId,
              sections,
              book: bookSlice,
              memory: memoryForPack(state, packId),
              reviews: (state.reviews ?? []).filter((r) => r.packId === packId),
              onWindow: ({ index, total, label }) => {
                setBusyProgress(
                  total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label,
                );
              },
              outerSignal: controller.signal,
            })
          : await runCritiqueChapter({
              packId,
              sections,
              book: bookSlice,
              chapter: {
                id: activeChapter.id,
                title: activeChapter.title,
                content: activeChapter.content,
                summary: activeChapter.summary ?? "",
                scenes: activeChapter.scenes ?? [],
              },
              previousChapter: previousChapter
                ? {
                    id: previousChapter.id,
                    title: previousChapter.title,
                    content: previousChapter.content,
                  }
                : null,
              memory: memoryForPack(state, packId),
              reviews: (state.reviews ?? []).filter(
                (r) =>
                  r.packId === packId &&
                  r.chapterId !== MANUSCRIPT_CRITIQUE_CHAPTER_ID,
              ),
              signal: controller.signal,
            });
      applyCritiqueReview(next, memoryUpdates, { mergeItems });
      setCritiqueScope(mode);
      setActiveTab(packId);
      setRunsOpen(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          mode === "manuscript"
            ? "That full-manuscript critique took too long and was stopped. Try again — very long books run in several windows."
            : "That critique took too long and was stopped. Try again on a shorter chapter.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Critique failed.");
      }
    } finally {
      if (chapterTimeout != null) globalThis.clearTimeout(chapterTimeout);
      globalThis.clearInterval(tick);
      setBusyPack(null);
      setBusyScope(null);
      setBusySection(null);
      setBusyElapsedSec(0);
      setBusyProgress(null);
    }
  }

  const displayItems = review
    ? visibleCritiqueItems(review.items, showNa)
    : [];
  const groups = review
    ? groupCritiqueItems(displayItems, viewPack)
    : [];
  const questionById = new Map(
    viewPack.questions.map((q) => [q.id, q] as const),
  );

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
                    Critique
                  </p>
                  <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                    {critiqueScope === "manuscript"
                      ? MANUSCRIPT_CRITIQUE_TITLE
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
                aria-expanded={runsOpen}
                onClick={() => setRunsOpen((v) => !v)}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.45)] px-3 py-2.5 text-left transition-colors hover:border-[rgba(176,141,87,0.28)]"
              >
                <span className="min-w-0">
                  <span className="block font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                    Runs
                  </span>
                  <span className="mt-0.5 block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                    Smart pack · Pressure
                  </span>
                  <span className="mt-0.5 block truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                    Broad craft checklist · stakes & pace heat-check
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--ink-faint)] transition-transform duration-300",
                    runsOpen && "rotate-180",
                  )}
                  strokeWidth={1.5}
                />
              </button>

              <AnimatePresence initial={false}>
                {runsOpen ? (
                  <motion.div
                    key="critique-runs"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                      Checklist only — never rewrites. Run by chapter or the
                      full book. Memory carries forward so settled patterns
                      aren’t re-lectured.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCritiqueScope("chapter")}
                        className={cn(
                          "rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] transition-colors",
                          critiqueScope === "chapter"
                            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                            : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                        )}
                      >
                        This chapter
                      </button>
                      <button
                        type="button"
                        onClick={() => setCritiqueScope("manuscript")}
                        className={cn(
                          "rounded-full px-2.5 py-1 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] transition-colors",
                          critiqueScope === "manuscript"
                            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                            : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                        )}
                      >
                        Full book
                        {smartManuscriptReview || pressureManuscriptReview ? (
                          <span className="ml-1 text-[var(--accent)]">·</span>
                        ) : null}
                      </button>
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.35)] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                            {SMART_CRITIQUE_PACK.name}
                          </p>
                          <p className="mt-0.5 font-[family-name:var(--font-ui)] text-[0.7rem] leading-relaxed text-[var(--ink-muted)]">
                            {SMART_CRITIQUE_PACK.blurb}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {SMART_CRITIQUE_SECTIONS.map((sectionId) => (
                            <Button
                              key={sectionId}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || claude?.configured === false}
                              onClick={() =>
                                void runPack("smart", [sectionId], critiqueScope)
                              }
                              className="gap-1.5"
                            >
                              {busyPack === "smart" &&
                              busySection === sectionId &&
                              busyScope === critiqueScope ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : null}
                              {CRITIQUE_SECTION_META[sectionId].label}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy || claude?.configured === false}
                            onClick={() =>
                              void runPack(
                                "smart",
                                [...SMART_CRITIQUE_SECTIONS],
                                critiqueScope,
                              )
                            }
                            className="gap-1.5"
                          >
                            {busyPack === "smart" &&
                            busySection === "all" &&
                            busyScope === critiqueScope ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ClipboardCheck
                                className="h-3.5 w-3.5"
                                strokeWidth={1.5}
                              />
                            )}
                            {busyPack === "smart" &&
                            busySection === "all" &&
                            busyScope === critiqueScope
                              ? `${critiqueScope === "manuscript" ? "Book" : "All"}…${busyProgress ? ` ${busyProgress}` : ""}${busyElapsedSec ? ` (${busyElapsedSec}s)` : ""}`
                              : critiqueScope === "manuscript"
                                ? smartManuscriptReview
                                  ? "Re-run full book"
                                  : "Run full book"
                                : smartReview
                                  ? "Re-run all"
                                  : "Run all"}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.35)] px-3 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {PRESSURE_CRITIQUE_PACK.name}
                            </p>
                            <p className="mt-0.5 font-[family-name:var(--font-ui)] text-[0.7rem] leading-relaxed text-[var(--ink-muted)]">
                              {PRESSURE_CRITIQUE_PACK.blurb}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy || claude?.configured === false}
                            onClick={() =>
                              void runPack("pressure", undefined, critiqueScope)
                            }
                            className="gap-1.5 shrink-0"
                          >
                            {busyPack === "pressure" &&
                            busyScope === critiqueScope ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : critiqueScope === "manuscript" ? (
                              <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                            ) : (
                              <Gauge className="h-3.5 w-3.5" strokeWidth={1.5} />
                            )}
                            {busyPack === "pressure" &&
                            busyScope === critiqueScope
                              ? `Running…${busyProgress ? ` ${busyProgress}` : ""}${busyElapsedSec ? ` (${busyElapsedSec}s)` : ""}`
                              : critiqueScope === "manuscript"
                                ? pressureManuscriptReview
                                  ? "Re-run book"
                                  : "Run full book"
                                : pressureReview
                                  ? "Re-run"
                                  : "Run"}
                          </Button>
                        </div>
                      </div>
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
              <button
                type="button"
                onClick={() => {
                  setViewPackId("smart");
                  setActiveTab("smart");
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "smart"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Smart
                {critiqueScope === "manuscript" && smartManuscriptReview ? (
                  <span className="ml-1 text-[var(--accent)]">·</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewPackId("pressure");
                  setActiveTab("pressure");
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "pressure"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Pressure
                {critiqueScope === "manuscript" && pressureManuscriptReview ? (
                  <span className="ml-1 text-[var(--accent)]">·</span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("open")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "open"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Open ({openIssues.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("memory")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "memory"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Memory ({allMemory.length})
              </button>
              {activeTab === "memory" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Clear ${viewPack.name} memory for this book?`,
                      )
                    ) {
                      clearCritiqueMemory(viewPackId);
                    }
                  }}
                  className="ml-auto font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {activeTab === "memory" ? (
                allMemory.length === 0 ? (
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    No {viewPack.name.toLowerCase()} memory yet. After a run,
                    durable notes land here so later chapters remember what
                    already held.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {allMemory.map((m) => {
                      const chapterTitle = m.chapterId
                        ? m.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID
                          ? MANUSCRIPT_CRITIQUE_TITLE
                          : book.chapters.find((c) => c.id === m.chapterId)
                              ?.title
                        : null;
                      return (
                        <li
                          key={m.id}
                          className="border-b border-[rgba(45,42,38,0.06)] pb-3 last:border-0"
                        >
                          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                            {m.kind}
                            {chapterTitle ? ` · ${chapterTitle}` : ""}
                          </p>
                          <p className="mt-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                            {m.text}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : activeTab === "open" ? (
                openIssues.length === 0 ? (
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    No open critique items across the manuscript. Run Smart or
                    Pressure on chapters or the full book — partial and no
                    verdicts land here.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {openIssues.map((issue) => (
                      <li
                        key={`${issue.chapterId}:${issue.packId}:${issue.questionId}`}
                        className="rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.35)] p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => jumpToIssue(issue)}
                            className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] text-[var(--accent)] hover:underline"
                          >
                            {issue.chapterTitle}
                          </button>
                          <span className="text-[var(--ink-faint)]">·</span>
                          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                            {issue.packName} · {issue.sectionLabel}
                          </span>
                        </div>
                        <CritiqueItemCard
                          item={{
                            questionId: issue.questionId,
                            sectionId: issue.sectionId,
                            verdict: issue.verdict,
                            note: issue.note,
                            excerpt: issue.excerpt,
                            suggestion: issue.suggestion,
                          }}
                          prompt={issue.prompt}
                          editor={editor}
                          highlighted={
                            focusQuestionId === issue.questionId &&
                            issue.chapterId === activeChapter.id
                          }
                          pinFlash={
                            pinFlashId ===
                            `${issue.chapterId}:${issue.questionId}`
                          }
                          onPin={() =>
                            pinCritiqueItem({
                              chapterId:
                                issue.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID
                                  ? activeChapter.id
                                  : issue.chapterId,
                              packName:
                                issue.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID
                                  ? `${issue.packName} (full book)`
                                  : issue.packName,
                              prompt: issue.prompt,
                              item: issue,
                              flashId: `${issue.chapterId}:${issue.questionId}`,
                            })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )
              ) : !review ? (
                <div className="py-8 text-center">
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    {critiqueScope === "manuscript"
                      ? viewPackId === "smart"
                        ? "No smart-pack critique for the full manuscript yet."
                        : "No pressure run for the full manuscript yet."
                      : viewPackId === "smart"
                        ? "No smart-pack critique for this chapter yet."
                        : "No pressure run for this chapter yet."}
                  </p>
                  <p className="mx-auto mt-2 max-w-[18rem] font-[family-name:var(--font-ui)] text-[0.7rem] leading-relaxed text-[var(--ink-faint)]">
                    {viewPack.blurb}
                  </p>
                  {!runsOpen ? (
                    <button
                      type="button"
                      onClick={() => setRunsOpen(true)}
                      className="mt-4 font-[family-name:var(--font-ui)] text-sm text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      Open Runs
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      {viewPack.name} · {formatRelativeDate(review.createdAt)}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-ui)] text-[0.7rem] leading-relaxed text-[var(--ink-faint)]">
                      {viewPack.blurb}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                      {review.summary}
                    </p>
                    {verdictSummary ? (
                      <p className="mt-3 flex flex-wrap gap-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.1em]">
                        {verdictSummary.open > 0 ? (
                          <span className="rounded-full bg-[rgba(107,58,42,0.12)] px-2 py-0.5 text-[#6B3A2A]">
                            {verdictSummary.open} to address
                          </span>
                        ) : null}
                        <span className="rounded-full bg-[rgba(58,90,58,0.12)] px-2 py-0.5 text-[#3A5A3A]">
                          {verdictSummary.yes} yes
                        </span>
                        <span className="rounded-full bg-[rgba(107,74,42,0.12)] px-2 py-0.5 text-[#6B4A2A]">
                          {verdictSummary.partial} partial
                        </span>
                        <span className="rounded-full bg-[rgba(107,58,42,0.12)] px-2 py-0.5 text-[#6B3A2A]">
                          {verdictSummary.no} no
                        </span>
                        {verdictSummary.na > 0 ? (
                          <span className="rounded-full bg-[rgba(45,42,38,0.08)] px-2 py-0.5 text-[var(--ink-faint)]">
                            {verdictSummary.na} n/a
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {viewPackId === "smart" ? (
                      <button
                        type="button"
                        onClick={() => setShowNa((v) => !v)}
                        className="mt-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
                      >
                        {showNa ? "Hide skipped (n/a)" : "Show skipped (n/a)"}
                      </button>
                    ) : null}
                  </div>

                  {groups.map((group) => (
                    <section key={group.sectionId}>
                      <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                        {group.label}
                      </h3>
                      <ul className="mt-3 space-y-4">
                        {group.items.map((item) => {
                          const q = questionById.get(item.questionId);
                          return (
                            <li
                              key={item.questionId}
                              data-critique-item={item.questionId}
                              className={cn(
                                focusQuestionId === item.questionId &&
                                  "rounded-xl bg-[rgba(176,141,87,0.08)] px-2 py-1",
                              )}
                            >
                              <CritiqueItemCard
                                item={item}
                                prompt={q?.prompt ?? item.questionId}
                                redFlag={q?.redFlag}
                                editor={editor}
                          highlighted={
                            focusQuestionId === item.questionId &&
                            (critiqueScope === "manuscript"
                              ? review
                                ? isManuscriptCritiqueReview(review)
                                : false
                              : true)
                          }
                          pinFlash={
                            pinFlashId ===
                            `${critiqueScope === "manuscript" ? MANUSCRIPT_CRITIQUE_CHAPTER_ID : activeChapter.id}:${item.questionId}`
                          }
                          onPin={() =>
                            pinCritiqueItem({
                              chapterId: activeChapter.id,
                              packName: `${viewPack.name}${critiqueScope === "manuscript" ? " (full book)" : ""}`,
                              prompt: q?.prompt ?? item.questionId,
                              item,
                              flashId: `${critiqueScope === "manuscript" ? MANUSCRIPT_CRITIQUE_CHAPTER_ID : activeChapter.id}:${item.questionId}`,
                            })
                          }
                              />
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}

                  {groups.length === 0 ? (
                    <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                      All items were marked n/a{critiqueScope === "manuscript" ? " for this book" : " for this chapter"}.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setShowNa(true)}
                      >
                        Show skipped
                      </button>
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          critiqueScope === "manuscript"
                            ? `Clear ${viewPack.name} full-manuscript review? Chapter critiques stay.`
                            : "Clear all critique reviews for this book? Memory stays unless you clear it separately.",
                        )
                      ) {
                        if (critiqueScope === "manuscript") {
                          clearCritiqueReviewForChapter(
                            viewPackId,
                            MANUSCRIPT_CRITIQUE_CHAPTER_ID,
                          );
                        } else {
                          clearCritiqueReviews();
                        }
                      }
                    }}
                    className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
                  >
                    Clear reviews
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function CritiqueItemCard({
  item,
  prompt,
  redFlag,
  editor,
  highlighted,
  pinFlash,
  onPin,
}: {
  item: CritiqueItemResult;
  prompt: string;
  redFlag?: string;
  editor: Editor | null;
  highlighted?: boolean;
  pinFlash?: boolean;
  onPin: () => void;
}) {
  const verdict = VERDICT_STYLES[item.verdict];
  const showRedFlag = item.verdict === "no" || item.verdict === "partial";

  return (
    <div className={cn(highlighted && "ring-1 ring-[var(--accent)]/25")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] font-medium uppercase tracking-[0.08em]",
              verdict.className,
            )}
          >
            {verdict.label}
          </span>
          <p className="font-[family-name:var(--font-ui)] text-xs font-medium text-[var(--ink-muted)]">
            {prompt}
          </p>
        </div>
        <button
          type="button"
          onClick={onPin}
          title="Add to chapter notes"
          className={cn(
            "shrink-0 rounded-md p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]",
            pinFlash && "text-[var(--accent)]",
          )}
        >
          <StickyNote className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
      {showRedFlag && redFlag ? (
        <p className="mt-1.5 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
          Red flag: {redFlag}
        </p>
      ) : null}
      <p className="mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
        {item.note}
      </p>
      {item.excerpt ? (
        <button
          type="button"
          onClick={() => {
            if (editor) {
              focusEditorExcerpt(editor, item.excerpt!);
            }
          }}
          className="mt-1.5 block w-full border-l-2 border-[rgba(176,141,87,0.35)] pl-2 text-left font-[family-name:var(--font-serif)] text-sm italic leading-relaxed text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          “{item.excerpt}”
        </button>
      ) : null}
      {item.suggestion && item.verdict !== "n/a" ? (
        <p className="mt-1.5 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
          Watch for: {item.suggestion}
        </p>
      ) : null}
    </div>
  );
}
