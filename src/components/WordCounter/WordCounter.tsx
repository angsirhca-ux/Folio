"use client";

import { motion } from "framer-motion";
import { countWords, formatWordCount } from "@/lib/utils";
import { wordsWrittenToday } from "@/lib/goals";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

export function WordCounter({
  onOpenGoals,
}: {
  onOpenGoals?: () => void;
}) {
  const { wordCount, isSaving, isDirty, activeChapter, book, sessionWords } =
    useBook();
  const chapterWords = countWords(activeChapter.content);
  const status = isSaving ? "Saving…" : isDirty ? "Unsaved" : "Saved";
  const goals = book.goals;
  const today = wordsWrittenToday(goals, wordCount);
  const dailyOn = goals.dailyTarget > 0;
  const dailyPct = dailyOn
    ? Math.min(100, Math.round((today / goals.dailyTarget) * 100))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="folio-chrome pointer-events-none fixed bottom-6 right-6 z-30 flex flex-col items-end gap-1.5 font-[family-name:var(--font-ui)] text-[0.7rem] tracking-wide text-[var(--ink-faint)]"
    >
      {dailyOn || goals.sessionIntention.trim() ? (
        <button
          type="button"
          onClick={onOpenGoals}
          className="pointer-events-auto group flex max-w-[16rem] flex-col items-end gap-1 rounded-xl px-1 py-0.5 text-right transition-colors hover:text-[var(--ink-muted)]"
          title="Open goals (⌘⇧G)"
        >
          {goals.sessionIntention.trim() ? (
            <span className="truncate font-[family-name:var(--font-ui)] text-[0.65rem] italic text-[var(--ink-faint)] group-hover:text-[var(--ink-muted)]">
              {goals.sessionIntention.trim()}
            </span>
          ) : null}
          {dailyOn ? (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">
                {formatWordCount(today)} / {formatWordCount(goals.dailyTarget)}
              </span>
              <span
                className="relative h-1 w-14 overflow-hidden rounded-full bg-[rgba(45,42,38,0.1)]"
                aria-hidden
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full bg-[var(--accent)] transition-[width] duration-500",
                  )}
                  style={{ width: `${dailyPct}%` }}
                />
              </span>
            </span>
          ) : sessionWords > 0 ? (
            <span className="tabular-nums">
              +{formatWordCount(sessionWords)} this session
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpenGoals}
          className="pointer-events-auto rounded-full px-1 py-0.5 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
          title="Set writing goals (⌘⇧G)"
        >
          Goals
        </button>
      )}
      <div className="pointer-events-none flex items-baseline gap-3">
        <span className="tabular-nums">
          {formatWordCount(chapterWords)}, {formatWordCount(wordCount)}
        </span>
        <span className="opacity-30">·</span>
        <span
          className={
            isDirty || isSaving ? "text-[var(--accent)] opacity-90" : "opacity-70"
          }
        >
          {status}
        </span>
      </div>
    </motion.div>
  );
}
