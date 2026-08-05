"use client";

import { useEffect, useId, useRef } from "react";
import type { ThesaurusHit } from "@/lib/thesaurus";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  query: string;
  loading: boolean;
  error: string | null;
  synonyms: ThesaurusHit[];
  related: ThesaurusHit[];
  /** Viewport coordinates for the popover anchor */
  x: number;
  y: number;
  onPick: (word: string) => void;
  onClose: () => void;
};

export function ThesaurusPopover({
  open,
  query,
  loading,
  error,
  synonyms,
  related,
  x,
  y,
  onPick,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const left = Math.min(Math.max(12, x), window.innerWidth - 280);
  const top = Math.min(Math.max(12, y + 12), window.innerHeight - 320);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed z-[80] w-[16.5rem] overflow-hidden rounded-sm border border-[rgba(45,42,38,0.12)] bg-[var(--paper,#F7F3EA)] shadow-[0_18px_40px_rgba(45,42,38,0.12)]"
      style={{ left, top }}
    >
      <div className="border-b border-[rgba(45,42,38,0.08)] px-3.5 py-2.5">
        <p
          id={titleId}
          className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]"
        >
          Synonyms
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {query}
        </p>
      </div>

      <div className="folio-scroll max-h-64 overflow-y-auto px-2 py-2">
        {loading ? (
          <p className="px-2 py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
            Looking up…
          </p>
        ) : error ? (
          <p className="px-2 py-3 font-[family-name:var(--font-ui)] text-sm text-[#6B3A2A]">
            {error}
          </p>
        ) : synonyms.length === 0 && related.length === 0 ? (
          <p className="px-2 py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
            No close matches.
          </p>
        ) : (
          <>
            {synonyms.length > 0 ? (
              <WordList words={synonyms} onPick={onPick} />
            ) : null}
            {related.length > 0 ? (
              <div className={cn(synonyms.length > 0 && "mt-3")}>
                <p className="px-2 pb-1 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Related
                </p>
                <WordList words={related} onPick={onPick} />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-[rgba(45,42,38,0.08)] px-3.5 py-2">
        <button
          type="button"
          onClick={onClose}
          className="font-[family-name:var(--font-ui)] text-[0.7rem] text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)]"
        >
          Esc to close
        </button>
      </div>
    </div>
  );
}

function WordList({
  words,
  onPick,
}: {
  words: ThesaurusHit[];
  onPick: (word: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {words.map((hit) => (
        <li key={hit.word}>
          <button
            type="button"
            onClick={() => onPick(hit.word)}
            className="w-full rounded-sm px-2 py-1.5 text-left font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] transition-colors hover:bg-[rgba(176,141,87,0.12)]"
          >
            {hit.word}
          </button>
        </li>
      ))}
    </ul>
  );
}
