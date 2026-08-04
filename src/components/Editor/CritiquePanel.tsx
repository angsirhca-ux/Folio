"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import { ClipboardCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { useClaudeStatus } from "@/hooks/useClaudeEnrichment";
import {
  DEFAULT_CRITIQUE_LENSES,
  latestCritiqueReview,
  memoryForLens,
} from "@/lib/critique";
import { focusEditorExcerpt } from "@/lib/editorNavigate";
import { formatRelativeDate } from "@/lib/scenes";
import type {
  CritiqueLensId,
  CritiqueMemoryNote,
  CritiqueReview,
  CritiqueVerdict,
} from "@/lib/types";
import { cn } from "@/lib/utils";

async function runCritique(args: {
  lensId: CritiqueLensId;
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

const AI_FETCH_TIMEOUT_MS = 110_000;

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
  const lenses = DEFAULT_CRITIQUE_LENSES;
  const state = book.critique ?? { memory: [], reviews: [] };

  const [lensId, setLensId] = useState<CritiqueLensId>(
    lenses[0]?.id ?? "fantasy-worldbuilding",
  );
  const [busy, setBusy] = useState(false);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showMemory, setShowMemory] = useState(false);

  const lens = lenses.find((l) => l.id === lensId) ?? lenses[0] ?? null;

  const review = useMemo(
    () =>
      lens ? latestCritiqueReview(state, lens.id, activeChapter.id) : undefined,
    [state, lens, activeChapter.id],
  );

  const lensMemory = useMemo(
    () => (lens ? memoryForLens(state, lens.id) : []),
    [state, lens],
  );

  async function runSelected() {
    if (!lens || busy) return;
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
      const { review: next, memoryUpdates } = await runCritique({
        lensId: lens.id,
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
        memory: lensMemory,
        reviews: (state.reviews ?? []).filter((r) => r.lensId === lens.id),
        signal: controller.signal,
      });
      applyCritiqueReview(next, memoryUpdates);
      setShowMemory(false);
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

              <p className="mt-3 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                Checklist only — never rewrites. Genre lenses ask whether the
                world holds up, with optional excerpts as evidence.
              </p>

              <div className="mt-4 grid gap-2">
                {lenses.map((l) => {
                  const active = lens?.id === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLensId(l.id);
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
                        {l.name}
                      </span>
                      <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                        {l.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !lens || claude?.configured === false}
                  onClick={() => void runSelected()}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ClipboardCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  {busy
                    ? `Critiquing…${busyElapsedSec ? ` ${busyElapsedSec}s` : ""}`
                    : review
                      ? "Re-run critique"
                      : "Critique this chapter"}
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
                Memory ({lensMemory.length})
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
                Clear memory
              </button>
            </div>

            <div className="folio-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {showMemory ? (
                lensMemory.length === 0 ? (
                  <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                    No memory yet. After a critique, durable lens notes land
                    here so the next chapter remembers what mattered.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {lensMemory.map((m) => (
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
                  {lens
                    ? `No ${lens.name.toLowerCase()} critique for this chapter yet.`
                    : "Pick a lens to begin."}
                </p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                      {lens?.name} · {formatRelativeDate(review.createdAt)}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)]">
                      {review.summary}
                    </p>
                  </div>

                  <section>
                    <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wide text-[var(--ink)]">
                      Checklist
                    </h3>
                    <ul className="mt-3 space-y-4">
                      {(lens?.questions ?? []).map((q) => {
                        const item = review.items.find(
                          (i) => i.questionId === q.id,
                        );
                        if (!item) return null;
                        const verdict = VERDICT_STYLES[item.verdict];
                        const showRedFlag =
                          item.verdict === "no" || item.verdict === "partial";
                        return (
                          <li key={q.id}>
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
                                {q.prompt}
                              </p>
                            </div>
                            {showRedFlag ? (
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
                            {item.suggestion ? (
                              <p className="mt-1.5 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                                Watch for: {item.suggestion}
                              </p>
                            ) : null}
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
