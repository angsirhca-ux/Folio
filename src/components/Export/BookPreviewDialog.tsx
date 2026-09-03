"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { compileOptionsForBook } from "@/lib/export/compile";
import { buildBookPreviewSections } from "@/lib/export/preview";
import { previewStylesheet } from "@/lib/format/tokens";
import { cn } from "@/lib/utils";

export function BookPreviewDialog({
  open,
  onClose,
  onOpenExport,
}: {
  open: boolean;
  onClose: () => void;
  onOpenExport?: () => void;
}) {
  const { book } = useBook();
  const options = useMemo(() => compileOptionsForBook(book), [book]);
  const sections = useMemo(
    () => buildBookPreviewSections(book, options),
    [book, options],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveId(sections[0]?.id ?? null);
  }, [open, sections]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!activeId) return;
    document
      .getElementById(`preview-${activeId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeId]);

  const presetLabel =
    options.preset === "submission" ? "Submission draft" : "Reading copy";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col bg-[var(--paper)]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
                Book preview
              </p>
              <h2 className="truncate font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--ink)]">
                {book.title.trim() || "Untitled Manuscript"}
              </h2>
              <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {presetLabel} · {sections.filter((s) => s.kind === "chapter").length}{" "}
                chapters
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onOpenExport ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onOpenExport();
                  }}
                  className="gap-1.5"
                >
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Export
                </Button>
              ) : null}
              <button
                type="button"
                aria-label="Close preview"
                onClick={onClose}
                className="rounded-full p-2 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <aside className="folio-scroll hidden w-56 shrink-0 overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar)] p-3 sm:block">
              <p className="mb-2 px-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Contents
              </p>
              <ul className="space-y-0.5">
                {sections.map((section) => {
                  const active = section.id === activeId;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(section.id)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left font-[family-name:var(--font-ui)] text-sm transition-colors",
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                            : "text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                        )}
                      >
                        {section.kind === "chapter" ? (
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 shrink-0 opacity-40",
                              active && "text-[var(--accent)] opacity-100",
                            )}
                            strokeWidth={1.5}
                          />
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                        <span className="truncate">{section.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div
              data-folio-scroll
              className="folio-scroll min-h-0 flex-1 overflow-y-auto bg-[#f7f3ea]"
            >
              {sections.length === 0 ? (
                <p className="px-6 py-12 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  No chapters selected for preview. Open compile settings and
                  include at least one chapter.
                </p>
              ) : (
                <div className="mx-auto max-w-[42rem] bg-[#fffdf8] shadow-[0_0_0_1px_rgba(45,42,38,0.06),0_24px_48px_rgba(45,42,38,0.08)]">
                  <style>{previewStylesheet(options.preset)}</style>
                  <div className="book-preview-root">
                    {sections.map((section) => (
                      <div
                        key={section.id}
                        id={`preview-${section.id}`}
                        onClick={() => setActiveId(section.id)}
                        dangerouslySetInnerHTML={{ __html: section.html }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
