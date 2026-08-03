"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

export function DumpSidebar() {
  const {
    book,
    activeDumpPage,
    selectDumpPage,
    addDumpPage,
    deleteDumpPage,
    updateDumpPageTitle,
    reorderDumpPages,
  } = useBook();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const pages = book.dump?.pages ?? [];
  const pending = pages.find((p) => p.id === pendingDeleteId);
  const isLast = pages.length <= 1;

  return (
    <>
      <aside
        className="folio-chrome folio-scroll flex w-[15.5rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-8"
        aria-label="Dump pages"
      >
        <div className="mb-8 px-2">
          <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]">
            Dump
          </p>
          <p className="mt-2 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
            Scraps, spare scenes, name lists — anything not ready for the
            manuscript yet.
          </p>
        </div>

        <div className="mb-3 flex items-center justify-between px-2">
          <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
            Pages
          </span>
          <button
            type="button"
            onClick={() => addDumpPage()}
            aria-label="Add dump page"
            title="Add page"
            className="rounded-lg p-1 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)]"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <ul className="flex flex-1 flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {pages.map((page, index) => {
              const active = page.id === activeDumpPage.id;
              const editing = editingId === page.id;
              return (
                <motion.li
                  key={page.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  draggable={!editing}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === index) {
                      setOverIndex(null);
                      return;
                    }
                    setOverIndex(index);
                  }}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== index) {
                      reorderDumpPages(dragIndex, index);
                    }
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={cn(
                    "group relative rounded-xl transition-colors",
                    active
                      ? "bg-[rgba(176,141,87,0.14)]"
                      : "hover:bg-[rgba(45,42,38,0.04)]",
                    overIndex === index && dragIndex !== null
                      ? "ring-1 ring-[rgba(176,141,87,0.35)]"
                      : "",
                  )}
                >
                  <div className="flex items-center gap-1 px-2 py-2">
                    {editing ? (
                      <input
                        autoFocus
                        defaultValue={page.title}
                        className="min-w-0 flex-1 bg-transparent font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none"
                        onBlur={(e) => {
                          updateDumpPageTitle(page.id, e.target.value);
                          setEditingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectDumpPage(page.id)}
                        onDoubleClick={() => setEditingId(page.id)}
                        className="min-w-0 flex-1 truncate text-left font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]"
                      >
                        {page.title}
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Delete ${page.title}`}
                      disabled={isLast}
                      onClick={() => setPendingDeleteId(page.id)}
                      className={cn(
                        "rounded-md p-1 text-[var(--ink-faint)] opacity-0 transition-opacity group-hover:opacity-100",
                        isLast && "invisible",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </aside>

      <ConfirmDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete dump page?"
        description={
          pending
            ? `“${pending.title}” will be removed from this dump. This can’t be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDeleteId) deleteDumpPage(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </>
  );
}
