"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import {
  ChevronDown,
  ClipboardCheck,
  Gauge,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import { CLARENCE } from "@/lib/clarence";
import {
  SMART_CRITIQUE_PACK,
  groupCritiqueItems,
  latestCritiqueReview,
  memoryForCritique,
  packById,
  visibleCritiqueItems,
} from "@/lib/critique";
import { focusEditorExcerpt } from "@/lib/editorNavigate";
import { formatRelativeDate } from "@/lib/scenes";
import type {
  CritiqueMemoryNote,
  CritiquePackId,
  CritiqueReview,
  CritiqueVerdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";

async function runCritique(args: {
  packId: CritiquePackId;
  book: {
    title: string;
    author: string;
    characters: unknown[];
    locations: unknown[];
    encyclopedia: unknown[];
    research: unknown[];
    chapters: unknown[];
  };
  chapter: {
    id: string;
    title: string;
    content: string;
    summary: string;
  };
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
  signal?: AbortSignal;
}): Promise<{ review: CritiqueReview; memoryUpdates: CritiqueMemoryNote[] }> {
  const res = await fetch("/api/editor/critique", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
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

const AI_FETCH_TIMEOUT_MS = 280_000;

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
    applyCritiqueReview,
    clearCritiqueMemory,
    clearCritiqueReviews,
  } = useBook();
  const claude = useClaudeStatus();
  const state = book.critique ?? { memory: [], reviews: [] };

  const [viewPackId, setViewPackId] = useState<CritiquePackId>("smart");
  const [busyPack, setBusyPack] = useState<CritiquePackId | null>(null);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [showNa, setShowNa] = useState(false);
  const [runsOpen, setRunsOpen] = useState(true);

  const viewPack = packById(viewPackId) ?? SMART_CRITIQUE_PACK;
  const busy = busyPack != null;

  const review = useMemo(
    () => latestCritiqueReview(state, viewPackId, activeChapter.id),
    [state, viewPackId, activeChapter.id],
  );

  const allMemory = useMemo(() => memoryForCritique(state), [state]);

  const smartReview = useMemo(
    () => latestCritiqueReview(state, "smart", activeChapter.id),
    [state, activeChapter.id],
  );
  const pressureReview = useMemo(
    () => latestCritiqueReview(state, "pressure", activeChapter.id),
    [state, activeChapter.id],
  );

  async function runPack(packId: CritiquePackId) {
    if (busy) return;
    setBusyPack(packId);
    setViewPackId(packId);
    setBusyElapsedSec(0);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      AI_FETCH_TIMEOUT_MS,
    );
    const tick = window.setInterval(() => {
      setBusyElapsedSec((s) => s + 1);
    }, 1000);
    try {
      const { review: next, memoryUpdates } = await runCritique({
        packId,
        book: {
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
          })),
        },
        chapter: {
          id: activeChapter.id,
          title: activeChapter.title,
          content: activeChapter.content,
          summary: activeChapter.summary ?? "",
        },
        memory: allMemory,
        reviews: (state.reviews ?? []).filter((r) => r.packId === packId),
        signal: controller.signal,
      });
      applyCritiqueReview(next, memoryUpdates);
      setShowMemory(false);
      setRunsOpen(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "That critique took too long and was stopped. Try again on a shorter chapter.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Critique failed.");
      }
    } finally {
      window.clearTimeout(timeout);
      window.clearInterval(tick);
      setBusyPack(null);
      setBusyElapsedSec(0);
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
                    {activeChapter.title}
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
                      Checklist only — never rewrites. Memory carries prior
                      chapters so settled patterns aren’t re-lectured. Collapse
                      this bar to read the full checklist.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || claude?.configured === false}
                        onClick={() => void runPack("smart")}
                        className="gap-1.5"
                      >
                        {busyPack === "smart" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ClipboardCheck
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                          />
                        )}
                        {busyPack === "smart"
                          ? `Smart pack…${busyElapsedSec ? ` ${busyElapsedSec}s` : ""}`
                          : smartReview
                            ? "Re-run smart pack"
                            : "Smart pack"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || claude?.configured === false}
                        onClick={() => void runPack("pressure")}
                        className="gap-1.5"
                      >
                        {busyPack === "pressure" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Gauge className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                        {busyPack === "pressure"
                          ? `Pressure…${busyElapsedSec ? ` ${busyElapsedSec}s` : ""}`
                          : pressureReview
                            ? "Re-run pressure"
                            : "Pressure"}
                      </Button>
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
                  setShowMemory(false);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  viewPackId === "smart" && !showMemory
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Smart{smartReview ? "" : ""}
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewPackId("pressure");
                  setShowMemory(false);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  viewPackId === "pressure" && !showMemory
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Pressure
              </button>
              <button
                type="button"
                onClick={() => setShowMemory(true)}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  showMemory
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                Memory ({allMemory.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm("Clear all critique memory for this book?")
                  ) {
                    clearCritiqueMemory();
                  }
                }}
                className="ml-auto font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
              >
                Clear
              </button>
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {showMemory ? (
                allMemory.length === 0 ? (
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    No critique memory yet. After a run, durable notes land here
                    so later chapters remember what already held.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {allMemory.map((m) => (
                      <li
                        key={m.id}
                        className="border-b border-[rgba(45,42,38,0.06)] pb-3 last:border-0"
                      >
                        <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                          {m.packId} · {m.kind}
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
                    {viewPackId === "smart"
                      ? "No smart-pack critique for this chapter yet."
                      : "No pressure run for this chapter yet."}
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
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                      {review.summary}
                    </p>
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
                          const verdict = VERDICT_STYLES[item.verdict];
                          const showRedFlag =
                            item.verdict === "no" || item.verdict === "partial";
                          return (
                            <li key={item.questionId}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-[family-name:var(--font-ui)] text-[0.65rem] font-medium uppercase tracking-[0.08em]",
                                    verdict.className,
                                  )}
                                >
                                  {verdict.label}
                                </span>
                                <p className="font-[family-name:var(--font-ui)] text-xs font-medium text-[var(--ink-muted)]">
                                  {q?.prompt ?? item.questionId}
                                </p>
                              </div>
                              {showRedFlag && q ? (
                                <p className="mt-1.5 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                                  Red flag: {q.redFlag}
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
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}

                  {groups.length === 0 ? (
                    <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                      All items were marked n/a for this chapter.{" "}
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
                          "Clear all critique reviews for this book? Memory stays unless you clear it separately.",
                        )
                      ) {
                        clearCritiqueReviews();
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
