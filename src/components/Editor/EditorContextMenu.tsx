"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { ThesaurusHit } from "@/lib/thesaurus";
import { cn } from "@/lib/utils";

export type EditorContextMenuState = {
  x: number;
  y: number;
  word: string;
  wordFrom: number | null;
  wordTo: number | null;
  misspelledWord: string;
  suggestions: string[];
  isEditable: boolean;
  hasSelection: boolean;
};

type Props = {
  state: EditorContextMenuState | null;
  onClose: () => void;
  onReplaceSpelling: (suggestion: string) => void;
  onAddToDictionary: () => void;
  onPickSynonym: (word: string) => void;
  /** Expand synonyms in-menu (parent fetches). */
  onRequestSynonyms: () => void;
  thesaurusOpen: boolean;
  thesaurusLoading: boolean;
  thesaurusError: string | null;
  synonyms: ThesaurusHit[];
  related: ThesaurusHit[];
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
};

/**
 * In-app right-click menu for the manuscript — paper, ink, display type.
 * Synonyms expand inside this panel (no separate popover that can vanish).
 */
export function EditorContextMenu({
  state,
  onClose,
  onReplaceSpelling,
  onAddToDictionary,
  onPickSynonym,
  onRequestSynonyms,
  thesaurusOpen,
  thesaurusLoading,
  thesaurusError,
  synonyms,
  related,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 100);
    const onPointer = (e: MouseEvent) => {
      if (!armed) return;
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.clearTimeout(arm);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [state, onClose]);

  if (!state) return null;

  const width = thesaurusOpen ? 17 : 14.5;
  const left = Math.min(
    Math.max(12, state.x),
    window.innerWidth - width * 16 - 12,
  );
  const top = Math.min(Math.max(12, state.y), window.innerHeight - 420);
  const showSpelling =
    state.suggestions.length > 0 || Boolean(state.misspelledWord);
  const showThesaurus = Boolean(state.word) && state.isEditable;

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-labelledby={labelId}
      className="folio-chrome fixed z-[90] overflow-hidden rounded-2xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.96)] shadow-[0_16px_40px_rgba(45,42,38,0.12)] backdrop-blur-xl"
      style={{ left, top, width: `${width}rem` }}
    >
      <div className="border-b border-[rgba(45,42,38,0.06)] px-4 py-3">
        <p
          id={labelId}
          className="font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.2em] text-[var(--ink-faint)]"
        >
          Writing
        </p>
        {state.word ? (
          <p className="mt-0.5 truncate font-[family-name:var(--font-display)] text-[1.35rem] leading-tight tracking-wide text-[var(--ink)]">
            {state.word}
          </p>
        ) : null}
      </div>

      {showSpelling ? (
        <section className="border-b border-[rgba(45,42,38,0.08)] py-2">
          <SectionLabel>Spelling</SectionLabel>
          {state.suggestions.length > 0 ? (
            state.suggestions.slice(0, 5).map((s) => (
              <MenuButton
                key={s}
                onClick={() => {
                  onReplaceSpelling(s);
                  onClose();
                }}
              >
                {s}
              </MenuButton>
            ))
          ) : (
            <p className="px-4 py-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
              No suggestions
            </p>
          )}
          {state.misspelledWord ? (
            <MenuButton
              muted
              onClick={() => {
                onAddToDictionary();
                onClose();
              }}
            >
              Add to dictionary
            </MenuButton>
          ) : null}
        </section>
      ) : null}

      {showThesaurus ? (
        <section className="border-b border-[rgba(45,42,38,0.08)] py-2">
          <SectionLabel>Thesaurus</SectionLabel>
          {!thesaurusOpen ? (
            <MenuButton onClick={onRequestSynonyms}>Show synonyms</MenuButton>
          ) : (
            <div className="folio-scroll max-h-52 overflow-y-auto px-1.5 pb-1">
              {thesaurusLoading ? (
                <p className="px-2.5 py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  Looking up…
                </p>
              ) : thesaurusError ? (
                <p className="px-2.5 py-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[#6B3A2A]">
                  {thesaurusError}
                </p>
              ) : synonyms.length === 0 && related.length === 0 ? (
                <p className="px-2.5 py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
                  No close matches.
                </p>
              ) : (
                <>
                  {synonyms.map((hit) => (
                    <MenuButton
                      key={`syn-${hit.word}`}
                      onClick={() => {
                        onPickSynonym(hit.word);
                        onClose();
                      }}
                    >
                      {hit.word}
                    </MenuButton>
                  ))}
                  {related.length > 0 ? (
                    <>
                      <p className="px-2.5 pb-1 pt-2 font-[family-name:var(--font-ui)] text-[0.58rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                        Related
                      </p>
                      {related.map((hit) => (
                        <MenuButton
                          key={`rel-${hit.word}`}
                          muted
                          onClick={() => {
                            onPickSynonym(hit.word);
                            onClose();
                          }}
                        >
                          {hit.word}
                        </MenuButton>
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>
      ) : null}

      {state.isEditable || state.hasSelection ? (
        <section className="py-2">
          <SectionLabel>Edit</SectionLabel>
          {state.isEditable ? (
            <>
              <MenuButton
                disabled={!state.hasSelection}
                onClick={() => {
                  onCut();
                  onClose();
                }}
              >
                Cut
              </MenuButton>
              <MenuButton
                disabled={!state.hasSelection}
                onClick={() => {
                  onCopy();
                  onClose();
                }}
              >
                Copy
              </MenuButton>
              <MenuButton
                onClick={() => {
                  onPaste();
                  onClose();
                }}
              >
                Paste
              </MenuButton>
              <MenuButton
                onClick={() => {
                  onSelectAll();
                  onClose();
                }}
              >
                Select all
              </MenuButton>
            </>
          ) : (
            <MenuButton
              onClick={() => {
                onCopy();
                onClose();
              }}
            >
              Copy
            </MenuButton>
          )}
        </section>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-1 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
      {children}
    </p>
  );
}

function MenuButton({
  children,
  onClick,
  muted,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onPointerDown={(e) => {
        // Keep the manuscript selection / TipTap range until we replace.
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full rounded-lg px-4 py-2 text-left font-[family-name:var(--font-ui)] text-sm transition-colors",
        muted ? "text-[var(--ink-muted)]" : "text-[var(--ink)]",
        disabled
          ? "cursor-default opacity-35"
          : "hover:bg-[var(--accent-soft)]",
      )}
    >
      {children}
    </button>
  );
}
