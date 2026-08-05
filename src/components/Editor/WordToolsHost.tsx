"use client";

import { useCallback, useEffect, useState } from "react";
import { useManuscriptEditor } from "@/providers/ManuscriptEditorContext";
import {
  normalizeLookupWord,
  replaceEditorRange,
  wordAtEditorCoords,
  wordAtEditorSelection,
  type ThesaurusHit,
  type ThesaurusResult,
} from "@/lib/thesaurus";
import {
  EditorContextMenu,
  type EditorContextMenuState,
} from "@/components/Editor/EditorContextMenu";

/**
 * Spellcheck + thesaurus for the manuscript.
 * Folio Desk: in-app context menu (not the OS chrome menu).
 * Browser: same Folio menu on right-click in the editor.
 */
export function WordToolsHost() {
  const { editor } = useManuscriptEditor();
  const [menu, setMenu] = useState<EditorContextMenuState | null>(null);
  const [thesaurusOpen, setThesaurusOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<ThesaurusHit[]>([]);
  const [related, setRelated] = useState<ThesaurusHit[]>([]);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setThesaurusOpen(false);
    setError(null);
    setSynonyms([]);
    setRelated([]);
    setLoading(false);
  }, []);

  const fetchThesaurus = useCallback(async (word: string) => {
    const q = normalizeLookupWord(word);
    if (!q) return;
    setThesaurusOpen(true);
    setLoading(true);
    setError(null);
    setSynonyms([]);
    setRelated([]);
    try {
      const res = await fetch(`/api/thesaurus?q=${encodeURIComponent(q)}`);
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
  }, []);

  const resolveSpan = useCallback(
    (payload: {
      x: number;
      y: number;
      selectionText?: string;
      misspelledWord?: string;
      word?: string;
    }) => {
      if (!editor || editor.isDestroyed) return null;
      if (!editor.state.selection.empty) {
        return wordAtEditorSelection(editor);
      }
      return (
        wordAtEditorCoords(editor, payload.x, payload.y) ||
        wordAtEditorSelection(editor)
      );
    },
    [editor],
  );

  const openMenuFromPayload = useCallback(
    (payload: {
      x: number;
      y: number;
      selectionText?: string;
      misspelledWord?: string;
      dictionarySuggestions?: string[];
      isEditable?: boolean;
      word?: string;
    }) => {
      const span = resolveSpan(payload);
      const word =
        span?.word ||
        normalizeLookupWord(payload.word || "") ||
        normalizeLookupWord(
          (payload.selectionText || payload.misspelledWord || "")
            .trim()
            .split(/\s+/)[0] || "",
        );
      const hasSelection = Boolean(
        (payload.selectionText && payload.selectionText.length > 0) ||
          (editor && !editor.isDestroyed && !editor.state.selection.empty),
      );

      setThesaurusOpen(false);
      setError(null);
      setSynonyms([]);
      setRelated([]);
      setLoading(false);
      setMenu({
        x: payload.x,
        y: payload.y,
        word,
        wordFrom: span?.from ?? null,
        wordTo: span?.to ?? null,
        misspelledWord: (payload.misspelledWord || "").trim(),
        suggestions: payload.dictionarySuggestions ?? [],
        isEditable: payload.isEditable !== false,
        hasSelection,
      });
    },
    [editor, resolveSpan],
  );

  // ⌘⇧T — open menu on the word and expand synonyms
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
      setMenu({
        x: coords.left,
        y: coords.bottom,
        word: span.word,
        wordFrom: span.from,
        wordTo: span.to,
        misspelledWord: "",
        suggestions: [],
        isEditable: true,
        hasSelection: !editor.state.selection.empty,
      });
      void fetchThesaurus(span.word);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, fetchThesaurus]);

  // Intercept manuscript right-click — Folio paper menu, not OS chrome.
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".manuscript-editor .ProseMirror")) return;
      if (!editor || editor.isDestroyed) return;
      e.preventDefault();
      e.stopPropagation();
      const span =
        wordAtEditorCoords(editor, e.clientX, e.clientY) ||
        wordAtEditorSelection(editor);
      openMenuFromPayload({
        x: e.clientX,
        y: e.clientY,
        selectionText: editor.state.doc.textBetween(
          editor.state.selection.from,
          editor.state.selection.to,
          " ",
        ),
        word: span?.word,
        isEditable: editor.isEditable,
        dictionarySuggestions: [],
        misspelledWord: "",
      });
    };
    document.addEventListener("contextmenu", onContext, true);
    return () => document.removeEventListener("contextmenu", onContext, true);
  }, [editor, openMenuFromPayload]);

  // Folio Desk: merge Electron spell suggestions; legacy thesaurus IPC.
  useEffect(() => {
    const unsub = window.folioDesk?.onEditorContextMenu?.((payload) => {
      setMenu((prev) => {
        if (!prev) {
          // Renderer may not have opened yet (non-manuscript click) — open now.
          queueMicrotask(() => openMenuFromPayload(payload));
          return prev;
        }
        const near =
          Math.abs(payload.x - prev.x) < 64 &&
          Math.abs(payload.y - prev.y) < 64;
        if (!near) {
          queueMicrotask(() => openMenuFromPayload(payload));
          return prev;
        }
        return {
          ...prev,
          misspelledWord:
            (payload.misspelledWord || "").trim() || prev.misspelledWord,
          suggestions:
            (payload.dictionarySuggestions?.length
              ? payload.dictionarySuggestions
              : prev.suggestions) ?? [],
          word:
            prev.word ||
            normalizeLookupWord(payload.word || "") ||
            normalizeLookupWord(
              (payload.selectionText || payload.misspelledWord || "")
                .trim()
                .split(/\s+/)[0] || "",
            ),
        };
      });
    });
    const unsubLegacy = window.folioDesk?.onThesaurus?.((payload) => {
      openMenuFromPayload({
        x: payload.x ?? window.innerWidth / 2 - 120,
        y: payload.y ?? window.innerHeight / 3,
        word: payload.word,
        isEditable: true,
      });
      void fetchThesaurus(payload.word);
    });
    return () => {
      unsub?.();
      unsubLegacy?.();
    };
  }, [fetchThesaurus, openMenuFromPayload]);

  const replaceSpelling = useCallback(
    (suggestion: string) => {
      if (!editor || editor.isDestroyed) return;
      if (window.folioDesk?.replaceMisspelling) {
        void window.folioDesk.replaceMisspelling(suggestion);
        return;
      }
      const misspelled = menu?.misspelledWord;
      if (
        menu?.wordFrom != null &&
        menu.wordTo != null &&
        menu.wordFrom < menu.wordTo
      ) {
        replaceEditorRange(editor, menu.wordFrom, menu.wordTo, suggestion);
        return;
      }
      const span = wordAtEditorSelection(editor);
      if (span) {
        replaceEditorRange(editor, span.from, span.to, suggestion);
        return;
      }
      if (misspelled) {
        const $from = editor.state.selection.$from;
        const parent = $from.parent;
        if (!parent.isTextblock) return;
        const start = $from.start();
        const text = parent.textContent;
        const idx = text.toLowerCase().indexOf(misspelled.toLowerCase());
        if (idx < 0) return;
        replaceEditorRange(
          editor,
          start + idx,
          start + idx + misspelled.length,
          suggestion,
        );
      }
    },
    [editor, menu],
  );

  const pickSynonym = useCallback(
    (word: string) => {
      if (!editor || editor.isDestroyed) return;
      if (
        menu?.wordFrom != null &&
        menu.wordTo != null &&
        menu.wordFrom < menu.wordTo
      ) {
        replaceEditorRange(editor, menu.wordFrom, menu.wordTo, word);
        return;
      }
      const span = wordAtEditorSelection(editor);
      if (span) replaceEditorRange(editor, span.from, span.to, word);
    },
    [editor, menu],
  );

  const addToDictionary = useCallback(() => {
    const w = menu?.misspelledWord;
    if (!w) return;
    void window.folioDesk?.addToSpellCheckerDictionary?.(w);
  }, [menu?.misspelledWord]);

  const runEdit = useCallback(
    (cmd: "cut" | "copy" | "paste" | "selectAll") => {
      if (!editor || editor.isDestroyed) return;
      editor.view.focus();
      if (cmd === "selectAll") {
        editor.commands.selectAll();
        return;
      }
      document.execCommand(cmd);
    },
    [editor],
  );

  return (
    <EditorContextMenu
      state={menu}
      onClose={closeMenu}
      onReplaceSpelling={replaceSpelling}
      onAddToDictionary={addToDictionary}
      onPickSynonym={pickSynonym}
      onRequestSynonyms={() => {
        if (!menu?.word) return;
        void fetchThesaurus(menu.word);
      }}
      thesaurusOpen={thesaurusOpen}
      thesaurusLoading={loading}
      thesaurusError={error}
      synonyms={synonyms}
      related={related}
      onCut={() => runEdit("cut")}
      onCopy={() => runEdit("copy")}
      onPaste={() => runEdit("paste")}
      onSelectAll={() => runEdit("selectAll")}
    />
  );
}
