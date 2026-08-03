"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useBook } from "@/providers/BookProvider";
import {
  daysUntilDeadline,
  wordsWrittenToday,
  writingStreak,
} from "@/lib/goals";
import { formatWordCount } from "@/lib/utils";

export function GoalsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { book, wordCount, sessionWords, updateGoals } = useBook();
  const goals = book.goals;
  const today = wordsWrittenToday(goals, wordCount);
  const streak = writingStreak(goals);
  const daysLeft = daysUntilDeadline(goals.deadline);
  const dailyPct =
    goals.dailyTarget > 0
      ? Math.min(100, Math.round((today / goals.dailyTarget) * 100))
      : 0;
  const manuscriptPct =
    goals.manuscriptTarget > 0
      ? Math.min(100, Math.round((wordCount / goals.manuscriptTarget) * 100))
      : 0;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close goals"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-[rgba(45,42,38,0.12)] backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(100vw,22rem)] flex-col border-l border-[var(--border)] bg-[var(--sidebar)] px-6 py-8 shadow-[-12px_0_40px_var(--shadow)]"
          >
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                  Goals
                </p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                  {book.title?.trim() || "This manuscript"}
                </h2>
                <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                  Soft targets for literary pace — not a streak app. Zero turns a
                  target off.
                </p>
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

            <div className="folio-scroll min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
              <label className="block">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Today’s intention
                </span>
                <textarea
                  value={goals.sessionIntention}
                  onChange={(e) =>
                    updateGoals({ sessionIntention: e.target.value })
                  }
                  rows={2}
                  placeholder="Finish the confrontation…"
                  className="mt-2 w-full resize-none rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] focus:outline-none"
                />
              </label>

              <div className="rounded-2xl border border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.4)] px-4 py-4">
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  This session
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-2xl tabular-nums text-[var(--ink)]">
                  {formatWordCount(sessionWords)}
                </p>
                <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  Words since you opened this book
                  {streak > 0
                    ? ` · ${streak} day${streak === 1 ? "" : "s"} with writing`
                    : ""}
                </p>
              </div>

              <label className="block">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Daily target
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={goals.dailyTarget || ""}
                    placeholder="Off"
                    onChange={(e) =>
                      updateGoals({
                        dailyTarget: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="h-10 w-28 rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3 font-[family-name:var(--font-ui)] text-sm tabular-nums text-[var(--ink)] focus:outline-none"
                  />
                  <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    {formatWordCount(today)} today
                    {goals.dailyTarget > 0 ? ` · ${dailyPct}%` : ""}
                  </span>
                </div>
                {goals.dailyTarget > 0 ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(45,42,38,0.08)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
                      style={{ width: `${dailyPct}%` }}
                    />
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Manuscript target
                </span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={goals.manuscriptTarget || ""}
                    placeholder="Off"
                    onChange={(e) =>
                      updateGoals({
                        manuscriptTarget:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="h-10 w-28 rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3 font-[family-name:var(--font-ui)] text-sm tabular-nums text-[var(--ink)] focus:outline-none"
                  />
                  <span className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    {formatWordCount(wordCount)} total
                    {goals.manuscriptTarget > 0 ? ` · ${manuscriptPct}%` : ""}
                  </span>
                </div>
                {goals.manuscriptTarget > 0 ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgba(45,42,38,0.08)]">
                    <div
                      className="h-full rounded-full bg-[color-mix(in_srgb,var(--accent)_70%,var(--ink))] transition-[width] duration-500"
                      style={{ width: `${manuscriptPct}%` }}
                    />
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Deadline
                </span>
                <input
                  type="date"
                  value={goals.deadline}
                  onChange={(e) => updateGoals({ deadline: e.target.value })}
                  className="mt-2 h-10 w-full rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
                />
                {daysLeft != null ? (
                  <p className="mt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    {daysLeft < 0
                      ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} past`
                      : daysLeft === 0
                        ? "Due today"
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                  </p>
                ) : null}
              </label>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
