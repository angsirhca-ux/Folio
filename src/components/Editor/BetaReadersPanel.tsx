"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import {
  BETA_CRAFT_QUESTIONS,
  latestBetaReview,
  memoryForReader,
} from "@/lib/betaReaders";
import { formatRelativeDate } from "@/lib/scenes";
import {
  BETA_EMOTION_META,
  type BetaEmotion,
  type BetaMemoryNote,
  type BetaReaderPersona,
  type BetaReview,
} from "@/lib/types";
import { cn } from "@/lib/utils";

async function runBetaRead(args: {
  book: {
    title: string;
    author: string;
    characters: unknown[];
    chapters: unknown[];
  };
  chapter: {
    id: string;
    title: string;
    content: string;
    summary: string;
  };
  reader: BetaReaderPersona;
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
  signal?: AbortSignal;
}): Promise<{ review: BetaReview; memoryUpdates: BetaMemoryNote[] }> {
  const res = await fetch("/api/editor/beta-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
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

const AI_FETCH_TIMEOUT_MS = 110_000;

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
      : ([
          {
            id: "beta-close-reader",
            name: "Mara",
            blurb: "Close literary reader.",
          },
        ] as BetaReaderPersona[]);

  const [selectedId, setSelectedId] = useState(readers[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);

  const selected =
    readers.find((r) => r.id === selectedId) ?? readers[0] ?? null;

  const review = useMemo(
    () =>
      selected
        ? latestBetaReview(state, selected.id, activeChapter.id)
        : undefined,
    [state, selected, activeChapter.id],
  );

  const readerMemory = useMemo(
    () => (selected ? memoryForReader(state, selected.id) : []),
    [state, selected],
  );

  async function runSelected() {
    if (!selected || busy) return;
    setBusy(true);
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
      const { review: next, memoryUpdates } = await runBetaRead({
        book: {
          title: book.title,
          author: book.author,
          characters: book.characters ?? [],
          chapters: book.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            summary: c.summary ?? "",
          })),
        },
        chapter: {
          id: activeChapter.id,
          title: activeChapter.title,
          content: activeChapter.content,
          summary: activeChapter.summary ?? "",
        },
        reader: selected,
        memory: readerMemory,
        reviews: (state.reviews ?? []).filter((r) => r.readerId === selected.id),
        signal: controller.signal,
      });
      applyBetaReview(next, memoryUpdates);
      setShowMemory(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError(
          "That beta read took too long and was stopped. Try again on a shorter chapter.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Beta read failed.");
      }
    } finally {
      window.clearTimeout(timeout);
      window.clearInterval(tick);
      setBusy(false);
      setBusyElapsedSec(0);
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

              <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                Readers keep memory across chapters — reactions and craft
                answers only. Never rewrites your prose.
              </p>

              <div className="mt-4 grid gap-2">
                {readers.map((r) => {
                  const active = selected?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(r.id);
                        setShowMemory(false);
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

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    busy || !selected || claude?.configured === false
                  }
                  onClick={() => void runSelected()}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {busy
                    ? `${selected?.name ?? "Reader"} is reading…${busyElapsedSec ? ` ${busyElapsedSec}s` : ""}`
                    : review
                      ? `Re-read with ${selected?.name ?? "reader"}`
                      : `Read with ${selected?.name ?? "reader"}`}
                </Button>
              </div>

              {claude?.configured === false ? (
                <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                  Add ANTHROPIC_API_KEY to .env.local (see env.example), then
                  restart the server.
                </p>
              ) : null}

              {error ? (
                <p className="mt-3 font-[family-name:var(--font-ui)] text-xs text-[#6B3A2A]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1 border-b border-[rgba(45,42,38,0.08)] px-4 py-2">
              <button
                type="button"
                onClick={() => setShowMemory(false)}
                className={cn(
                  "rounded-full px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs transition-colors",
                  !showMemory
                    ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                )}
              >
                This chapter
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
                Memory ({readerMemory.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all beta-reader memory for this book?",
                    )
                  ) {
                    clearBetaMemory();
                  }
                }}
                className="ml-auto font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)] hover:text-[var(--ink-muted)]"
              >
                Clear memory
              </button>
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {showMemory ? (
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
                        </p>
                        <p className="mt-1 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                          {m.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : !review ? (
                <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  {selected
                    ? `${selected.name} hasn’t read this chapter yet.`
                    : "Pick a reader to begin."}
                </p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      {selected?.name} · {formatRelativeDate(review.createdAt)}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                      {review.summary}
                    </p>
                  </div>

                  <section>
                    <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                      Emotional response
                    </h3>
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
                      Craft answers
                    </h3>
                    <ul className="mt-3 space-y-4">
                      {BETA_CRAFT_QUESTIONS.map((q) => {
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

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Clear all beta reviews for this book? Memory stays unless you clear it separately.",
                        )
                      ) {
                        clearBetaReviews();
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
