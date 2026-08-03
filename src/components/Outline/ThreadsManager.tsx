"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { PLOT_THREAD_PALETTE } from "@/lib/plotThreads";
import { cn } from "@/lib/utils";

export function ThreadsManager({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted?: (threadId: string) => void;
}) {
  const { book, addPlotThread, updatePlotThread, deletePlotThread } = useBook();
  const threads = book.plotThreads ?? [];
  const [draftName, setDraftName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!open) return null;

  function removeThread(threadId: string) {
    deletePlotThread(threadId);
    onDeleted?.(threadId);
    setConfirmId(null);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(45,42,38,0.28)] px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Manage plot threads"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--paper)] shadow-[0_24px_80px_rgba(45,42,38,0.18)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
              Plot threads
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Tracks
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="folio-scroll max-h-[min(60vh,28rem)] space-y-3 px-5 py-4">
          {threads.length === 0 ? (
            <p className="py-6 text-center font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              No threads yet. Add romance, mystery, or any arc you want to
              track across scenes.
            </p>
          ) : (
            threads.map((t) => {
              const confirming = confirmId === t.id;
              return (
                <div
                  key={t.id}
                  className="space-y-2 rounded-xl border border-[rgba(45,42,38,0.06)] px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    <input
                      value={t.name}
                      onChange={(e) =>
                        updatePlotThread(t.id, { name: e.target.value })
                      }
                      className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent pb-0.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                    {confirming ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeThread(t.id)}
                          className="rounded-md px-2 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[#6B3A2A] hover:bg-[rgba(107,58,42,0.08)]"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-md px-2 py-1 font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)] hover:bg-[rgba(45,42,38,0.06)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        title="Delete thread"
                        onClick={() => setConfirmId(t.id)}
                        className="rounded-lg p-1.5 text-[var(--ink-faint)] hover:bg-[rgba(107,58,42,0.08)] hover:text-[#6B3A2A]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {PLOT_THREAD_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        onClick={() => updatePlotThread(t.id, { color: c })}
                        className={cn(
                          "h-4 w-4 rounded-full",
                          t.color === c
                            ? "ring-2 ring-[var(--ink)] ring-offset-1"
                            : "opacity-70 hover:opacity-100",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] px-5 py-4">
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="New thread name…"
            className="min-w-0 flex-1 rounded-lg border border-[rgba(45,42,38,0.1)] bg-[var(--sidebar)] px-3 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addPlotThread({ name: draftName || "New thread" });
                setDraftName("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              addPlotThread({ name: draftName || "New thread" });
              setDraftName("");
            }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
