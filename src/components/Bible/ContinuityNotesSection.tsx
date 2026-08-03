"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContinuityNote } from "@/lib/types";
import { createContinuityNote } from "@/lib/continuity";

export function ContinuityNotesSection({
  notes,
  onChange,
  className,
}: {
  notes: ContinuityNote[];
  onChange: (notes: ContinuityNote[]) => void;
  className?: string;
}) {
  function patch(id: string, partial: Partial<ContinuityNote>) {
    onChange(
      notes.map((n) =>
        n.id === id ? { ...n, ...partial, updatedAt: Date.now() } : n,
      ),
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
            As-of notes
          </p>
          <p className="mt-1 max-w-md font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
            Continuity crumbs — “as of Ch. 12: believes X.” Not a full
            progression system.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 rounded-full"
          onClick={() =>
            onChange([
              ...notes,
              createContinuityNote({ asOf: "", note: "" }),
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          Add note
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="mt-4 font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
          No as-of notes yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="border-b border-[rgba(45,42,38,0.08)] pb-5 last:border-0"
            >
              <div className="flex flex-wrap items-start gap-3">
                <label className="min-w-[8rem] flex-1">
                  <span className="font-[family-name:var(--font-ui)] text-[0.62rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                    As of
                  </span>
                  <input
                    value={n.asOf}
                    onChange={(e) => patch(n.id, { asOf: e.target.value })}
                    placeholder="Ch. 12, After the fire…"
                    className="mt-1 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove note"
                  onClick={() => onChange(notes.filter((x) => x.id !== n.id))}
                  className="mt-5 rounded-full p-1.5 text-[var(--ink-faint)] hover:text-[#6B3A2A]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <textarea
                value={n.note}
                onChange={(e) => patch(n.id, { note: e.target.value })}
                rows={2}
                placeholder="What is true at this point…"
                className="mt-3 w-full resize-none bg-transparent font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)] placeholder:text-[var(--ink-faint)] focus:outline-none"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
