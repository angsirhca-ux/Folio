"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Chapter, OutlineScale } from "@/lib/types";
import { chapterProgress, chapterWordCount } from "@/lib/scenes";
import { readingMinutes } from "@/lib/types";
import { cn, formatWordCount } from "@/lib/utils";
import { ProgressIndicator } from "@/components/Outline/ProgressIndicator";

export function ChapterMarker({
  chapter,
  index,
  scale,
  sceneCount,
  isFirst,
  onRename,
  onSummaryChange,
}: {
  chapter: Chapter;
  index: number;
  scale: OutlineScale;
  sceneCount: number;
  isFirst: boolean;
  onRename: (title: string) => void;
  onSummaryChange: (summary: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(chapter.title);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(chapter.summary ?? "");
  const words = chapterWordCount(chapter);
  const progress = chapterProgress(chapter);
  const mins = readingMinutes(words);
  const summary = (chapter.summary ?? "").trim();

  useEffect(() => {
    if (!editingTitle) setTitleDraft(chapter.title);
  }, [chapter.title, editingTitle]);

  useEffect(() => {
    if (!editingSummary) setSummaryDraft(chapter.summary ?? "");
  }, [chapter.summary, editingSummary]);

  function commitTitle() {
    setEditingTitle(false);
    const next = titleDraft.trim() || chapter.title;
    setTitleDraft(next);
    if (next !== chapter.title) onRename(next);
  }

  function commitSummary() {
    setEditingSummary(false);
    const next = summaryDraft.trim();
    setSummaryDraft(next);
    if (next !== (chapter.summary ?? "").trim()) onSummaryChange(next);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
      className={cn(
        "grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[1.5rem_minmax(0,1fr)] sm:gap-x-6",
        isFirst ? "pt-0" : scale === "compact" ? "pt-6" : "pt-10",
      )}
    >
      {/* Chapter waypoint on the spine */}
      <div className="relative flex justify-center">
        {!isFirst ? (
          <div
            aria-hidden
            className="absolute bottom-full left-1/2 h-6 w-px -translate-x-1/2 bg-[rgba(45,42,38,0.12)] sm:h-8"
          />
        ) : null}
        <div className="relative z-[1] flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(176,141,87,0.35)] bg-[#EDE8E0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </div>
      </div>

      <div className="min-w-0 pb-2">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-[rgba(45,42,38,0.08)] pb-3">
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
              Chapter {String(index + 1).padStart(2, "0")}
            </p>
            <div className="mt-1 flex min-w-0 flex-col gap-2 lg:flex-row lg:items-baseline lg:gap-6">
              {editingTitle ? (
                <input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") {
                      setTitleDraft(chapter.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="w-full shrink-0 bg-transparent font-[family-name:var(--font-display)] text-2xl font-medium tracking-wide text-[var(--ink)] outline-none sm:text-3xl lg:w-auto lg:max-w-[14rem]"
                />
              ) : (
                <h2
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setTitleDraft(chapter.title);
                    setEditingTitle(true);
                  }}
                  className="shrink-0 cursor-default font-[family-name:var(--font-display)] text-2xl font-medium tracking-wide text-[var(--ink)] sm:text-3xl lg:max-w-[14rem]"
                >
                  {chapter.title}
                </h2>
              )}
              {editingSummary ? (
                <input
                  autoFocus
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitSummary}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSummary();
                    if (e.key === "Escape") {
                      setSummaryDraft(chapter.summary ?? "");
                      setEditingSummary(false);
                    }
                  }}
                  placeholder="Gemma woke up here."
                  className={cn(
                    "min-w-0 flex-1 bg-transparent font-[family-name:var(--font-ui)] leading-relaxed text-[var(--ink-muted)] outline-none placeholder:italic placeholder:text-[var(--ink-faint)]",
                    scale === "compact" ? "text-[0.8rem]" : "text-sm",
                  )}
                />
              ) : summary ? (
                <p
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setSummaryDraft(chapter.summary ?? "");
                    setEditingSummary(true);
                  }}
                  title="Double-click to edit summary"
                  className={cn(
                    "min-w-0 flex-1 cursor-text font-[family-name:var(--font-ui)] leading-relaxed text-[var(--ink-muted)]",
                    scale === "compact"
                      ? "line-clamp-1 text-[0.8rem]"
                      : "line-clamp-2 text-sm",
                  )}
                >
                  {summary}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSummaryDraft("");
                    setEditingSummary(true);
                  }}
                  className={cn(
                    "min-w-0 flex-1 text-left font-[family-name:var(--font-ui)] italic leading-relaxed text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]",
                    scale === "compact" ? "text-[0.8rem]" : "text-sm",
                  )}
                >
                  Add a chapter summary…
                </button>
              )}
            </div>
          </div>

          {scale !== "compact" ? (
            <div className="flex flex-wrap items-center gap-3 pb-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)]">
              <span>
                {sceneCount} {sceneCount === 1 ? "beat" : "beats"}
              </span>
              <span>{formatWordCount(words)} words</span>
              <span>~{mins < 1 ? "<1" : mins} min</span>
              <ProgressIndicator value={progress} />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
