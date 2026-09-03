"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Users, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import { CLARENCE } from "@/lib/clarence";
import {
  BETA_CRAFT_QUESTIONS,
  DEFAULT_BETA_READERS,
  MANUSCRIPT_BETA_CHAPTER_ID,
  MANUSCRIPT_BETA_TITLE,
  craftQuestionsForStoredReview,
  isLastChapterInBook,
  latestBetaReview,
  latestManuscriptBetaReview,
  memoryForReader,
  partitionManuscriptBetaWindows,
} from "@/lib/betaReaders";
import { AI_CHAPTER_TIMEOUT_MS, AI_WINDOW_TIMEOUT_MS } from "@/lib/ai/timeouts";
import { formatRelativeDate } from "@/lib/scenes";
import {
  BETA_EMOTION_META,
  type BetaEmotion,
  type BetaMemoryNote,
  type BetaReaderPersona,
  type BetaReview,
  type BetaReaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type BetaBookSlice = {
  title: string;
  author: string;
  characters: unknown[];
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    summary?: string;
  }>;
};

async function runBetaReadChapter(args: {
  book: BetaBookSlice;
  chapter: {
    id: string;
    title: string;
    content: string;
    summary: string;
  };
  previousChapter?: {
    id: string;
    title: string;
    content: string;
  } | null;
  reader: BetaReaderPersona;
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
  signal?: AbortSignal;
}): Promise<{ review: BetaReview; memoryUpdates: BetaMemoryNote[] }> {
  const res = await fetch("/api/editor/beta-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "chapter", ...args }),
    signal: args.signal,
  });
  const data = (await res.json()) as {
    review?: BetaReview;
    memoryUpdates?: BetaMemoryNote[];
    error?: string;
  };
  if (!res.ok || !data.review) {
    throw new Error(data.error || "Beta read failed.");
  }
  return {
    review: data.review,
    memoryUpdates: data.memoryUpdates ?? [],
  };
}

async function runManuscriptBetaRead(args: {
  book: BetaBookSlice;
  reader: BetaReaderPersona;
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
  onWindow?: (info: { index: number; total: number; label: string }) => void;
  outerSignal?: AbortSignal;
}): Promise<{ review: BetaReview; memoryUpdates: BetaMemoryNote[] }> {
  const windows = partitionManuscriptBetaWindows(
    args.book.chapters.map((c) => ({
      title: c.title,
      content: c.content,
    })),
  );
  if (windows.length === 0) {
    throw new Error("No readable chapters found in this manuscript.");
  }

  let stretchReactions: BetaReaction[] = [];
  let previousWindowEnding = "";
  let memory = args.memory;
  const allMemoryUpdates: BetaMemoryNote[] = [];

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
      const res = await fetch("/api/editor/beta-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manuscript",
          manuscriptStep: {
            windowIndex,
            stretchReactions,
            previousWindowEnding: previousWindowEnding || undefined,
          },
          book: args.book,
          reader: args.reader,
          memory,
          reviews: args.reviews,
        }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        done?: boolean;
        review?: BetaReview;
        memoryUpdates?: BetaMemoryNote[];
        stretchReactions?: BetaReaction[];
        previousWindowEnding?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Manuscript beta read failed.");
      }

      if (data.memoryUpdates?.length) {
        allMemoryUpdates.push(...data.memoryUpdates);
        memory = [...data.memoryUpdates, ...memory];
      }

      if (data.done && data.review) {
        return { review: data.review, memoryUpdates: allMemoryUpdates };
      }

      stretchReactions = data.stretchReactions ?? stretchReactions;
      previousWindowEnding = data.previousWindowEnding ?? previousWindowEnding;
    } finally {
      globalThis.clearTimeout(timeoutId);
      args.outerSignal?.removeEventListener("abort", onOuterAbort);
    }
  }

  throw new Error("Manuscript beta read did not finish.");
}

type BetaPanelTab = "chapter" | "manuscript" | "memory";

const EMOTION_TONE: Partial<Record<BetaEmotion, string>> = {
  surprised: "text-[#6B4A2A]",
  bored: "text-[var(--ink-faint)]",
  shocked: "text-[#6B3A2A]",
  moved: "text-[#3A4A6B]",
  confused: "text-[#5A4A6B]",
  delighted: "text-[#3A5A3A]",
  tense: "text-[#6B4A2A]",
  detached: "text-[var(--ink-muted)]",
  curious: "text-[#3A4A6B]",
  skeptical: "text-[#5A4A3A]",
  anxious: "text-[#6B3A2A]",
  amused: "text-[#3A5A4A]",
  heartbroken: "text-[#6B3A4A]",
  hopeful: "text-[#3A5A4A]",
};

export function BetaReadersPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    book,
    activeChapter,
    applyBetaReview,
    clearBetaMemory,
    clearBetaReviewForChapter,
    clearBetaReviews,
  } = useBook();
  const claude = useClaudeStatus();
  const state = book.betaReaders ?? {
    readers: [],
    memory: [],
    reviews: [],
  };
  const readers =
    state.readers.length > 0
      ? state.readers
      : DEFAULT_BETA_READERS.map((r) => ({ ...r }));

  const [selectedId, setSelectedId] = useState(readers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<"chapter" | "manuscript" | null>(
    null,
  );
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [busyProgress, setBusyProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BetaPanelTab>("chapter");
  const [runsOpen, setRunsOpen] = useState(true);

  const selected =
    readers.find((r) => r.id === selectedId) ?? readers[0] ?? null;

  const chapterReview = useMemo(
    () =>
      selected
        ? latestBetaReview(state, selected.id, activeChapter.id)
        : undefined,
    [state, selected, activeChapter.id],
  );

  const manuscriptReview = useMemo(
    () => (selected ? latestManuscriptBetaReview(state, selected.id) : undefined),
    [state, selected],
  );

  const review = activeTab === "manuscript" ? manuscriptReview : chapterReview;

  const closedBookReview = useMemo(() => {
    if (!review || activeTab === "manuscript") return activeTab === "manuscript";
    return (
      review.terminalChapter === true ||
      review.chapterId === book.chapters.at(-1)?.id
    );
  }, [review, activeTab, book.chapters]);

  const isLastChapter = useMemo(
    () => isLastChapterInBook(book.chapters, activeChapter.id),
    [book.chapters, activeChapter.id],
  );

  const readerMemory = useMemo(
    () => (selected ? memoryForReader(state, selected.id) : []),
    [state, selected],
  );

  const chapterMemoryCount = useMemo(
    () =>
      readerMemory.filter((m) => m.chapterId === activeChapter.id).length,
    [readerMemory, activeChapter.id],
  );

  function clearThisChapterFresh() {
    if (!selected) return;
    clearBetaMemory({
      readerId: selected.id,
      chapterId: activeChapter.id,
    });
    clearBetaReviewForChapter(selected.id, activeChapter.id);
  }

  function clearManuscriptFresh() {
    if (!selected) return;
    clearBetaReviewForChapter(selected.id, MANUSCRIPT_BETA_CHAPTER_ID);
  }

  async function runSelected(mode: "chapter" | "manuscript") {
    if (!selected || busy) return;
    setBusy(true);
    setBusyMode(mode);
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
    const chapterIndex = book.chapters.findIndex(
      (c) => c.id === activeChapter.id,
    );
    const previous =
      chapterIndex > 0 ? book.chapters[chapterIndex - 1] : null;
    const bookSlice = {
      title: book.title,
      author: book.author,
      characters: book.characters ?? [],
      chapters: book.chapters.map((c) => ({
        id: c.id,
        title: c.title,
        summary: c.summary ?? "",
        content: c.content,
      })),
    };
    try {
      const { review: next, memoryUpdates } =
        mode === "manuscript"
          ? await runManuscriptBetaRead({
              book: bookSlice,
              reader: selected,
              memory: readerMemory,
              reviews: (state.reviews ?? []).filter(
                (r) => r.readerId === selected.id,
              ),
              onWindow: ({ index, total, label }) => {
                setBusyProgress(
                  total > 1
                    ? `Part ${index + 1} of ${total} · ${label}`
                    : label,
                );
              },
              outerSignal: controller.signal,
            })
          : await runBetaReadChapter({
              book: bookSlice,
              chapter: {
                id: activeChapter.id,
                title: activeChapter.title,
                content: activeChapter.content,
                summary: activeChapter.summary ?? "",
              },
              previousChapter: previous
                ? {
                    id: previous.id,
                    title: previous.title,
                    content: previous.content,
                  }
                : null,
              reader: selected,
              memory: readerMemory.filter(
                (m) => m.chapterId !== activeChapter.id,
              ),
              reviews: (state.reviews ?? []).filter(
                (r) =>
                  r.readerId === selected.id &&
                  r.chapterId !== activeChapter.id &&
                  r.chapterId !== MANUSCRIPT_BETA_CHAPTER_ID,
              ),
              signal: controller.signal,
            });
      applyBetaReview(next, memoryUpdates);
      setActiveTab(mode);
      setRunsOpen(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          mode === "manuscript"
            ? "That full-manuscript read took too long and was stopped. Try again — very long books read in several windows."
            : "That beta read took too long and was stopped. Try again on a shorter chapter.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Beta read failed.");
      }
    } finally {
      if (chapterTimeout != null) globalThis.clearTimeout(chapterTimeout);
      globalThis.clearInterval(tick);
      setBusy(false);
      setBusyMode(null);
      setBusyElapsedSec(0);
      setBusyProgress(null);
    }
  }

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
                    Beta readers
                  </p>
                  <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                    {activeTab === "manuscript"
                      ? MANUSCRIPT_BETA_TITLE
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
                    {selected?.name ?? "Pick a reader"} · memory across chapters
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
                    key="beta-runs"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                      They read this as the next stretch of the book — did it
                      follow, stall, or give them the page they wanted after
                      last chapter. They will not agree. Never rewrites.
                    </p>

                    <div className="mt-3 grid gap-2">
                      {readers.map((r) => {
                        const active = selected?.id === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setSelectedId(r.id);
                              setActiveTab("chapter");
                              setError(null);
                            }}
                            className={cn(
                              "rounded-xl border px-3 py-2.5 text-left transition-colors",
                              active
                                ? "border-[rgba(176,141,87,0.35)] bg-[rgba(247,243,234,0.65)]"
                                : "border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.3)] hover:border-[rgba(176,141,87,0.22)]",
                            )}
                          >
                            <span className="block font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {r.name}
                            </span>
                            <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                              {r.blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          busy || !selected || claude?.configured === false
                        }
                        onClick={() => void runSelected("chapter")}
                        className="gap-1.5"
                      >
                        {busy && busyMode === "chapter" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                        {busy && busyMode === "chapter"
                          ? `${selected?.name ?? "Reader"} is reading…${busyElapsedSec ? ` ${busyElapsedSec}s` : ""}`
                          : chapterReview
                            ? isLastChapter
                              ? `Re-read final chapter`
                              : `Re-read chapter`
                            : isLastChapter
                              ? `Read final chapter`
                              : `Read this chapter`}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={
                          busy || !selected || claude?.configured === false
                        }
                        onClick={() => void runSelected("manuscript")}
                        className="gap-1.5"
                      >
                        {busy && busyMode === "manuscript" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                        {busy && busyMode === "manuscript"
                          ? `Reading book…${busyProgress ? ` ${busyProgress}` : ""}${busyElapsedSec ? ` (${busyElapsedSec}s)` : ""}`
                          : manuscriptReview
                            ? `Re-read full book`
                            : `Read full book`}
                      </Button>
                    </div>

                    {isLastChapter && activeTab !== "manuscript" ? (
                      <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                        Last chapter in the book — the reader will close the book
                        here, not wait for more.
                      </p>
                    ) : null}

                    {busy && busyMode === "manuscript" ? (
                      <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                        {busyProgress
                          ? busyProgress
                          : "Starting full-book read…"}
                        {busyElapsedSec ? ` (${busyElapsedSec}s)` : ""}
                      </p>
                    ) : null}

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
                onClick={() => setActiveTab("chapter")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "chapter"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                {isLastChapter ? "Final chapter" : "This chapter"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("manuscript")}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  activeTab === "manuscript"
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Full book
                {manuscriptReview ? (
                  <span className="ml-1 text-[var(--accent)]">·</span>
                ) : null}
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
                Memory ({readerMemory.length})
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-1 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
                  >
                    Clear memory
                    <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem]">
                  <DropdownMenuLabel>Clear memory</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!selected}
                    onSelect={() => {
                      if (!selected) return;
                      if (
                        window.confirm(
                          `Clear ${selected.name}’s memory notes from this chapter${review ? " and their review of it" : ""}? Prior chapters stay. Re-run for a fresh take.`,
                        )
                      ) {
                        clearThisChapterFresh();
                      }
                    }}
                  >
                    <span className="flex flex-col gap-0.5 text-left">
                      <span>This chapter</span>
                      <span className="text-[0.7rem] font-normal text-[var(--ink-faint)]">
                        {selected
                          ? `${selected.name} · ${chapterMemoryCount} note${chapterMemoryCount === 1 ? "" : "s"} here`
                          : "Pick a reader first"}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onSelect={() => {
                      if (
                        window.confirm(
                          "Clear all beta-reader memory for this book?",
                        )
                      ) {
                        clearBetaMemory();
                      }
                    }}
                  >
                    <span className="flex flex-col gap-0.5 text-left">
                      <span>Entire book</span>
                      <span className="text-[0.7rem] font-normal text-[var(--ink-faint)]">
                        All readers · all chapters
                      </span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {activeTab === "memory" ? (
                readerMemory.length === 0 ? (
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    No memory yet. After a read, durable impressions land here
                    so the next chapter remembers what mattered.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {readerMemory.map((m) => (
                      <li
                        key={m.id}
                        className="border-b border-[rgba(45,42,38,0.06)] pb-3 last:border-0"
                      >
                        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                          {m.kind}
                          {m.chapterId === MANUSCRIPT_BETA_CHAPTER_ID
                            ? " · full book"
                            : m.chapterId === activeChapter.id
                              ? " · this chapter"
                              : m.chapterId
                                ? " · earlier"
                                : ""}
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                          {m.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : !review ? (
                <div className="py-8 text-center">
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    {selected
                      ? activeTab === "manuscript"
                        ? `${selected.name} hasn’t read the full manuscript yet.`
                        : `${selected.name} hasn’t read this chapter yet.`
                      : "Pick a reader to begin."}
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
                      {selected?.name} · {formatRelativeDate(review.createdAt)}
                    </p>
                    {review.wouldContinue ? (
                      <p className="mt-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                        {activeTab === "manuscript"
                          ? review.wouldContinue === "yes"
                            ? "I’d recommend this book."
                            : review.wouldContinue === "maybe"
                              ? "I’m on the fence about recommending it."
                              : "I wouldn’t recommend it as-is."
                          : closedBookReview
                            ? review.wouldContinue === "yes"
                              ? "I’d recommend the book as it stands."
                              : review.wouldContinue === "maybe"
                                ? "I’m on the fence about how it lands."
                                : "I’d have stopped / feel let down here."
                            : review.wouldContinue === "yes"
                              ? "I’d keep going tonight."
                              : review.wouldContinue === "maybe"
                                ? "I might pick it up later."
                                : "I’d put it down here."}
                      </p>
                    ) : null}
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                      {review.summary}
                    </p>
                  </div>

                  <section>
                    <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                      Along the way
                    </h3>
                    <p className="mt-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                      {review.reactions.length} beat
                      {review.reactions.length === 1 ? "" : "s"}
                    </p>
                    <ul className="mt-3 space-y-3">
                      {review.reactions.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.35)] px-3 py-2.5"
                        >
                          <p
                            className={cn(
                              "font-[family-name:var(--font-ui)] text-[0.7rem] font-medium uppercase tracking-[0.14em]",
                              EMOTION_TONE[r.emotion] ?? "text-[var(--ink)]",
                            )}
                          >
                            {BETA_EMOTION_META[r.emotion]?.label ?? r.emotion}
                          </p>
                          {r.excerpt ? (
                            <p className="mt-1.5 border-l-2 border-[rgba(176,141,87,0.35)] pl-2 font-[family-name:var(--font-serif)] text-sm italic leading-relaxed text-[var(--ink-muted)]">
                              “{r.excerpt}”
                            </p>
                          ) : null}
                          <p className="mt-1.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                            {r.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                      {closedBookReview
                        ? "When I closed the book"
                        : "When I finished"}
                    </h3>
                    <ul className="mt-3 space-y-4">
                      {(review
                        ? craftQuestionsForStoredReview(review, book.chapters)
                        : BETA_CRAFT_QUESTIONS
                      ).map((q) => {
                        const answer =
                          review.craftAnswers.find(
                            (a) => a.questionId === q.id,
                          )?.answer ?? "";
                        return (
                          <li key={q.id}>
                            <p className="font-[family-name:var(--font-ui)] text-xs font-medium text-[var(--ink-muted)]">
                              {q.prompt}
                            </p>
                            <p className="mt-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                              {answer}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {review.readerWish?.trim() ? (
                    <section className="rounded-xl border border-[rgba(176,141,87,0.22)] bg-[rgba(247,243,234,0.55)] px-3.5 py-3">
                      <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                        As a reader, I’d want…
                      </h3>
                      <p className="mt-1 font-[family-name:var(--font-ui)] text-[0.7rem] leading-relaxed text-[var(--ink-faint)]">
                        Emotional wish — or an honest “leave it as-is.”
                      </p>
                      <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                        {review.readerWish}
                      </p>
                    </section>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          activeTab === "manuscript"
                            ? `Clear ${selected?.name ?? "this reader"}’s full-manuscript review? Chapter reads stay.`
                            : "Clear all beta reviews for this book? Memory stays unless you clear it separately.",
                        )
                      ) {
                        if (activeTab === "manuscript") {
                          clearManuscriptFresh();
                        } else {
                          clearBetaReviews();
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
