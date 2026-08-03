"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useBook } from "@/providers/BookProvider";

interface NotesPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotesPanel({ open, onClose }: NotesPanelProps) {
  const { activeChapter, updateChapterNotes } = useBook();

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close notes"
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
            <div className="mb-6">
              <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                Notes
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-lg font-medium tracking-wide text-[var(--ink)]">
                {activeChapter.title}
              </h2>
              <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                Private margin notes for this chapter. They never appear in the
                manuscript.
              </p>
            </div>

            <textarea
              value={activeChapter.notes ?? ""}
              onChange={(e) => updateChapterNotes(e.target.value)}
              placeholder="Characters, questions, fragments…"
              className="folio-scroll min-h-0 flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--paper)] px-4 py-4 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[color-mix(in_srgb,var(--accent)_50%,var(--border))]"
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
