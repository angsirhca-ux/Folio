"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useManuscriptEditor } from "@/providers/ManuscriptEditorContext";
import {
  findMisspellingInDoc,
  findWordNearCoords,
  matchReplacementCase,
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

type ReplaceSpan = { from: number; to: number; word: string };

/**
 * Spellcheck + thesaurus for the manuscript.
 * Folio Desk: in-app context menu (not the OS chrome menu).
 * Browser: native spellcheck menu (no Electron dictionary bridge).
 */
export function WordToolsHost({
  editor: editorProp = null,
}: {
  /** Prefer WritingApp’s live editor when context is stale. */
  editor?: Editor | null;
}) {
  const { editor: editorCtx } = useManuscriptEditor();
  const editor = editorProp ?? editorCtx;
  const editorRef = useRef<Editor | null>(editor);
  editorRef.current = editor;

  const [menu, setMenu] = useState<EditorContextMenuState | null>(null);
  const [thesaurusOpen, setThesaurusOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<ThesaurusHit[]>([]);
  const [related, setRelated] = useState<ThesaurusHit[]>([]);
  /** Stable span for replace — survives focus steal before click. */
  const replaceSpanRef = useRef<ReplaceSpan | null>(null);
  const menuCoordsRef = useRef<{ x: number; y: number } | null>(null);
  /** Latest misspelled word from Electron — kept out of React timing. */
  const misspelledRef = useRef("");

  const closeMenu = useCallback(() => {
    setMenu(null);
    setThesaurusOpen(false);
    setError(null);
    setSynonyms([]);
    setRelated([]);
    setLoading(false);
    menuCoordsRef.current = null;
    misspelledRef.current = "";
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

  const rememberSpan = useCallback((span: ReplaceSpan | null) => {
    replaceSpanRef.current =
      span && span.from < span.to
        ? { from: span.from, to: span.to, word: span.word }
        : null;
  }, []);

  const resolveSpan = useCallback(
    (payload: {
      x: number;
      y: number;
      selectionText?: string;
      misspelledWord?: string;
      word?: string;
    }): ReplaceSpan | null => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return null;

      const misspelled = (payload.misspelledWord || "").trim();
      if (misspelled) {
        const near =
          findWordNearCoords(ed, misspelled, payload.x, payload.y) ||
          findMisspellingInDoc(ed, misspelled, ed.state.selection.from);
        if (near) return near;
      }

      if (!ed.state.selection.empty) {
        return wordAtEditorSelection(ed);
      }
      return (
        wordAtEditorCoords(ed, payload.x, payload.y) ||
        wordAtEditorSelection(ed)
      );
    },
    [],
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
      const ed = editorRef.current;
      const span = resolveSpan(payload);
      rememberSpan(span);
      menuCoordsRef.current = { x: payload.x, y: payload.y };
      const misspelled = (payload.misspelledWord || "").trim();
      misspelledRef.current = misspelled;
      // Do NOT setTextSelection here — it clears Electron’s misspelling
      // context and can race the TipTap replace path.
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
          (ed && !ed.isDestroyed && !ed.state.selection.empty),
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
        misspelledWord: misspelled,
        suggestions: payload.dictionarySuggestions ?? [],
        isEditable: payload.isEditable !== false,
        hasSelection,
      });
    },
    [rememberSpan, resolveSpan],
  );

  // ⌘⇧T — open menu on the word and expand synonyms
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "t") return;
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed || !ed.isFocused) return;
      e.preventDefault();
      const span = wordAtEditorSelection(ed);
      if (!span) return;
      rememberSpan(span);
      misspelledRef.current = "";
      const coords = ed.view.coordsAtPos(span.from);
      menuCoordsRef.current = { x: coords.left, y: coords.bottom };
      setMenu({
        x: coords.left,
        y: coords.bottom,
        word: span.word,
        wordFrom: span.from,
        wordTo: span.to,
        misspelledWord: "",
        suggestions: [],
        isEditable: true,
        hasSelection: !ed.state.selection.empty,
      });
      void fetchThesaurus(span.word);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fetchThesaurus, rememberSpan]);

  // Desk only: Folio paper menu. Browser keeps Chromium’s native spell menu.
  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.(".manuscript-editor .ProseMirror")) return;
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      if (!window.folioDesk?.isDesktop) return;
      e.preventDefault();
      e.stopPropagation();
      const span =
        wordAtEditorCoords(ed, e.clientX, e.clientY) ||
        wordAtEditorSelection(ed);
      openMenuFromPayload({
        x: e.clientX,
        y: e.clientY,
        selectionText: ed.state.doc.textBetween(
          ed.state.selection.from,
          ed.state.selection.to,
          " ",
        ),
        word: span?.word,
        isEditable: ed.isEditable,
        dictionarySuggestions: [],
        misspelledWord: "",
      });
    };
    document.addEventListener("contextmenu", onContext, true);
    return () => document.removeEventListener("contextmenu", onContext, true);
  }, [openMenuFromPayload]);

  // Folio Desk: merge Electron spell suggestions; legacy thesaurus IPC.
  useEffect(() => {
    const unsub = window.folioDesk?.onEditorContextMenu?.((payload) => {
      const ed = editorRef.current;
      const misspelled = (payload.misspelledWord || "").trim();
      if (misspelled) misspelledRef.current = misspelled;

      setMenu((prev) => {
        if (!prev) {
          queueMicrotask(() => openMenuFromPayload(payload));
          return prev;
        }
        const near =
          Math.abs(payload.x - prev.x) < 120 &&
          Math.abs(payload.y - prev.y) < 120;
        if (!near) {
          queueMicrotask(() => openMenuFromPayload(payload));
          return prev;
        }

        if (ed && !ed.isDestroyed && misspelled) {
          const found =
            findWordNearCoords(ed, misspelled, prev.x, prev.y) ||
            findWordNearCoords(ed, misspelled, payload.x, payload.y) ||
            findMisspellingInDoc(
              ed,
              misspelled,
              ed.view.posAtCoords({ left: prev.x, top: prev.y })?.pos ??
                ed.state.selection.from,
            );
          if (found) rememberSpan(found);
        }

        const span = replaceSpanRef.current;
        return {
          ...prev,
          misspelledWord: misspelled || prev.misspelledWord,
          suggestions:
            (payload.dictionarySuggestions?.length
              ? payload.dictionarySuggestions
              : prev.suggestions) ?? [],
          word:
            span?.word ||
            prev.word ||
            normalizeLookupWord(payload.word || "") ||
            normalizeLookupWord(
              (payload.selectionText || payload.misspelledWord || "")
                .trim()
                .split(/\s+/)[0] || "",
            ),
          wordFrom: span?.from ?? prev.wordFrom,
          wordTo: span?.to ?? prev.wordTo,
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
  }, [fetchThesaurus, openMenuFromPayload, rememberSpan]);

  const resolveReplaceRange = useCallback((): ReplaceSpan | null => {
    const ed = editorRef.current;
    if (!ed || ed.isDestroyed) return null;

    const remembered = replaceSpanRef.current;
    if (remembered && remembered.from < remembered.to) {
      const live = ed.state.doc.textBetween(remembered.from, remembered.to, "");
      const hint = remembered.word || misspelledRef.current;
      if (
        !hint ||
        normalizeLookupWord(live).toLowerCase() ===
          normalizeLookupWord(hint).toLowerCase()
      ) {
        return { ...remembered, word: live || remembered.word };
      }
    }

    const coords = menuCoordsRef.current;
    const misspelled = (
      misspelledRef.current ||
      menu?.misspelledWord ||
      ""
    ).trim();
    const nearPos =
      (coords
        ? ed.view.posAtCoords({ left: coords.x, top: coords.y })?.pos
        : null) ?? ed.state.selection.from;

    if (misspelled) {
      const found =
        (coords
          ? findWordNearCoords(ed, misspelled, coords.x, coords.y)
          : null) || findMisspellingInDoc(ed, misspelled, nearPos);
      if (found) return found;
    }

    if (
      menu?.wordFrom != null &&
      menu.wordTo != null &&
      menu.wordFrom < menu.wordTo
    ) {
      return {
        from: menu.wordFrom,
        to: menu.wordTo,
        word: menu.word || misspelled || "",
      };
    }

    if (menu?.word && coords) {
      const found = findWordNearCoords(ed, menu.word, coords.x, coords.y);
      if (found) return found;
    }

    return wordAtEditorSelection(ed);
  }, [menu]);

  const replaceSpelling = useCallback(
    (suggestion: string) => {
      const ed = editorRef.current;
      const next = suggestion.trim();
      if (!next) {
        closeMenu();
        return;
      }

      // 1) TipTap plain-text replace (source of truth for Folio).
      if (ed && !ed.isDestroyed) {
        const range = resolveReplaceRange();
        if (range && range.from < range.to) {
          const replaced = matchReplacementCase(range.word || next, next);
          // Select first so Electron’s replaceMisspelling also has a target.
          try {
            ed.chain()
              .focus()
              .setTextSelection({ from: range.from, to: range.to })
              .run();
          } catch {
            ed.view.focus();
          }
          if (replaceEditorRange(ed, range.from, range.to, replaced)) {
            replaceSpanRef.current = null;
            misspelledRef.current = "";
            closeMenu();
            return;
          }
        }
      }

      // 2) Desk fallback — Chromium still knows the misspelling from right-click.
      if (window.folioDesk?.replaceMisspelling) {
        void window.folioDesk.replaceMisspelling(next).finally(() => {
          replaceSpanRef.current = null;
          misspelledRef.current = "";
          closeMenu();
        });
        return;
      }

      closeMenu();
    },
    [closeMenu, resolveReplaceRange],
  );

  const pickSynonym = useCallback(
    (word: string) => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      const range = resolveReplaceRange();
      if (!range) {
        closeMenu();
        return;
      }
      const next = matchReplacementCase(range.word, word);
      if (replaceEditorRange(ed, range.from, range.to, next)) {
        replaceSpanRef.current = null;
      }
      closeMenu();
    },
    [closeMenu, resolveReplaceRange],
  );

  const addToDictionary = useCallback(() => {
    const w = misspelledRef.current || menu?.misspelledWord;
    if (!w) return;
    void window.folioDesk?.addToSpellCheckerDictionary?.(w);
  }, [menu?.misspelledWord]);

  const runEdit = useCallback(
    (cmd: "cut" | "copy" | "paste" | "selectAll") => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return;
      ed.view.focus();
      if (cmd === "selectAll") {
        ed.commands.selectAll();
        return;
      }
      document.execCommand(cmd);
    },
    [],
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
