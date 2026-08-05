"use client";

import { useCallback, useEffect, useState } from "react";
import { useManuscriptEditor } from "@/providers/ManuscriptEditorContext";
import {
  replaceEditorRange,
  wordAtEditorSelection,
  type ThesaurusHit,
  type ThesaurusResult,
} from "@/lib/thesaurus";
import { ThesaurusPopover } from "@/components/Editor/ThesaurusPopover";

type OpenState = {
  query: string;
  from: number;
  to: number;
  x: number;
  y: number;
};

/**
 * Spellcheck is native (browser / Electron). This host adds the thesaurus:
 * ⌘⇧T on a word, or Folio Desk right-click → Synonyms.
 */
export function WordToolsHost() {
  const { editor } = useManuscriptEditor();
  const [open, setOpen] = useState<OpenState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<ThesaurusHit[]>([]);
  const [related, setRelated] = useState<ThesaurusHit[]>([]);

  const close = useCallback(() => {
    setOpen(null);
    setError(null);
    setSynonyms([]);
    setRelated([]);
    setLoading(false);
  }, []);

  const lookup = useCallback(
    async (opts: {
      word: string;
      from?: number;
      to?: number;
      x: number;
      y: number;
    }) => {
      if (!editor || editor.isDestroyed) return;
      const span =
        opts.from != null && opts.to != null
          ? { word: opts.word, from: opts.from, to: opts.to }
          : wordAtEditorSelection(editor);
      const word = (span?.word || opts.word).trim();
      if (!word) return;

      const from = span?.from ?? editor.state.selection.from;
      const to = span?.to ?? editor.state.selection.to;

      setOpen({ query: word, from, to, x: opts.x, y: opts.y });
      setLoading(true);
      setError(null);
      setSynonyms([]);
      setRelated([]);

      try {
        const res = await fetch(
          `/api/thesaurus?q=${encodeURIComponent(word)}`,
        );
        const data = (await res.json()) as ThesaurusResult & { error?: string };
        if (!res.ok) {
          throw new Error(data.error || "Lookup failed.");
        }
        setSynonyms(data.synonyms ?? []);
        setRelated(data.related ?? []);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Thesaurus is unreachable right now.",
        );
      } finally {
        setLoading(false);
      }
    },
    [editor],
  );

  // ⌘⇧T — synonyms for the word at the caret / selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "t") return;
      if (!editor || editor.isDestroyed || !editor.isFocused) return;
      e.preventDefault();
      const span = wordAtEditorSelection(editor);
      if (!span) return;
      const coords = editor.view.coordsAtPos(span.from);
      void lookup({
        word: span.word,
        from: span.from,
        to: span.to,
        x: coords.left,
        y: coords.bottom,
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, lookup]);

  // Folio Desk native context menu → Synonyms
  useEffect(() => {
    const unsub = window.folioDesk?.onThesaurus?.((payload) => {
      if (!editor || editor.isDestroyed) return;
      const span = wordAtEditorSelection(editor);
      void lookup({
        word: payload.word,
        from: span?.from,
        to: span?.to,
        x: payload.x ?? window.innerWidth / 2 - 120,
        y: payload.y ?? window.innerHeight / 3,
      });
    });
    return () => unsub?.();
  }, [editor, lookup]);

  const onPick = useCallback(
    (word: string) => {
      if (!editor || editor.isDestroyed || !open) return;
      replaceEditorRange(editor, open.from, open.to, word);
      close();
    },
    [editor, open, close],
  );

  return (
    <ThesaurusPopover
      open={Boolean(open)}
      query={open?.query ?? ""}
      loading={loading}
      error={error}
      synonyms={synonyms}
      related={related}
      x={open?.x ?? 0}
      y={open?.y ?? 0}
      onPick={onPick}
      onClose={close}
    />
  );
}
