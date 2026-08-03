"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Plus, ScrollText, X } from "lucide-react";
import { WikiField } from "@/components/Characters/WikiField";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import {
  RESEARCH_KIND_OPTIONS,
  researchAppearances,
} from "@/lib/research";
import type { ResearchEntry, ResearchKind } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResearchPanelProps {
  open: boolean;
  onClose: () => void;
  entryId: string | null;
  onEntryIdChange: (id: string | null) => void;
}

function kindLabel(kind: ResearchKind): string {
  return RESEARCH_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

export function ResearchPanel({
  open,
  onClose,
  entryId,
  onEntryIdChange,
}: ResearchPanelProps) {
  const { book, addResearch, updateResearch, focusScene } = useBook();
  const [query, setQuery] = useState("");

  const entries = book.research ?? [];
  const entry = entryId
    ? (entries.find((e) => e.id === entryId) ?? null)
    : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...entries].sort((a, b) =>
      (a.title || "").localeCompare(b.title || ""),
    );
    if (!q) return list;
    return list.filter((e) => {
      const hay = [
        e.title,
        e.shortBio,
        e.wiki,
        e.summary,
        ...(e.aliases ?? []),
        ...(e.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  const appearances = useMemo(() => {
    if (!entry) return [];
    return researchAppearances(book.chapters, entry);
  }, [book.chapters, entry]);

  function createAndOpen() {
    const id = addResearch({ title: "New research" });
    onEntryIdChange(id);
  }

  function patch(partial: Partial<Omit<ResearchEntry, "id" | "createdAt">>) {
    if (!entry) return;
    updateResearch(entry.id, partial);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,26rem)] flex-col border-l border-[var(--border)] bg-[var(--sidebar)] shadow-[-12px_0_40px_var(--shadow)]"
        >
          <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-6 py-5">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
                Research
              </p>
              <h2 className="mt-1 truncate font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                {entry ? entry.title?.trim() || "Untitled" : "Commonplace"}
              </h2>
              <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {entry
                  ? kindLabel(entry.kind)
                  : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close research"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          {entry ? (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
                <button
                  type="button"
                  onClick={() => onEntryIdChange(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)] transition-colors hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                  All research
                </button>
              </div>

              <div className="folio-scroll min-h-0 flex-1 space-y-5 px-6 py-5">
                <WikiField
                  label="Title"
                  value={entry.title}
                  onChange={(v) => patch({ title: v })}
                  multiline={false}
                  placeholder="Theme, motif, source…"
                />

                <label className="block">
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                    Kind
                  </span>
                  <select
                    value={entry.kind}
                    onChange={(e) =>
                      patch({ kind: e.target.value as ResearchKind })
                    }
                    className="mt-2 w-full rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {RESEARCH_KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <WikiField
                  label="Notes"
                  hint="Freeform research beside the draft"
                  value={entry.wiki}
                  onChange={(v) => patch({ wiki: v })}
                  rows={6}
                  placeholder="What you’re gathering…"
                />

                <WikiField
                  label="Blurb"
                  value={entry.shortBio}
                  onChange={(v) => patch({ shortBio: v })}
                  rows={2}
                  placeholder="One-line index line"
                />

                <WikiField
                  label="Findings"
                  value={entry.summary}
                  onChange={(v) => patch({ summary: v })}
                  rows={3}
                  placeholder="What you’ve distilled"
                />

                <WikiField
                  label="Open questions"
                  value={entry.questions}
                  onChange={(v) => patch({ questions: v })}
                  rows={2}
                  placeholder="Still chasing…"
                />

                {appearances.length > 0 ? (
                  <div>
                    <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                      In the manuscript
                    </p>
                    <ul className="mt-2 space-y-1">
                      {appearances.slice(0, 8).map((a) => (
                        <li key={`${a.chapterId}-${a.sceneIndex}`}>
                          <button
                            type="button"
                            onClick={() =>
                              focusScene(a.chapterId, a.sceneIndex)
                            }
                            className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-[rgba(45,42,38,0.05)]"
                          >
                            <span className="block truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {a.scene.title?.trim() || "Untitled scene"}
                            </span>
                            <span className="block truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                              {a.chapterTitle}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[var(--border)] px-6 py-4">
                <Link
                  href={`/research/${entry.id}`}
                  className="inline-flex items-center gap-2 font-[family-name:var(--font-ui)] text-sm text-[var(--accent)] transition-opacity hover:opacity-80"
                >
                  <ScrollText className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Open full wiki
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search research…"
                  className="min-w-0 flex-1 rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)]"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={createAndOpen}
                  title="New research entry"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  New
                </Button>
              </div>

              <div className="folio-scroll min-h-0 flex-1">
                {filtered.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
                    <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                      {entries.length === 0
                        ? "No research yet. Keep a theme, motif, or source open beside the draft."
                        : "Nothing matches that search."}
                    </p>
                    {entries.length === 0 ? (
                      <Button type="button" size="sm" onClick={createAndOpen}>
                        <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                        New entry
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <ul className="divide-y divide-[rgba(45,42,38,0.06)]">
                    {filtered.map((e) => {
                      const count = researchAppearances(book.chapters, e)
                        .length;
                      return (
                        <li key={e.id}>
                          <button
                            type="button"
                            onClick={() => onEntryIdChange(e.id)}
                            className={cn(
                              "flex w-full items-start justify-between gap-3 px-6 py-3.5 text-left transition-colors hover:bg-[rgba(45,42,38,0.04)]",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                                {e.title?.trim() || "Untitled"}
                              </p>
                              <p className="mt-0.5 truncate font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
                                {kindLabel(e.kind)}
                                {e.shortBio?.trim()
                                  ? ` · ${e.shortBio.trim()}`
                                  : ""}
                              </p>
                            </div>
                            {count > 0 ? (
                              <span className="shrink-0 font-[family-name:var(--font-ui)] text-[0.65rem] tabular-nums text-[var(--ink-faint)]">
                                {count}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
