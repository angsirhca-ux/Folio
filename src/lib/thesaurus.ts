import type { Editor } from "@tiptap/react";

export type ThesaurusHit = {
  word: string;
  score?: number;
  tags?: string[];
};

export type ThesaurusResult = {
  query: string;
  synonyms: ThesaurusHit[];
  related: ThesaurusHit[];
};

/** Strip punctuation so “quiet,” → quiet */
export function normalizeLookupWord(raw: string): string {
  return raw
    .trim()
    .replace(/^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu, "")
    .replace(/’/g, "'");
}

function wordAroundPos(
  editor: Editor,
  pos: number,
): { word: string; from: number; to: number } | null {
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;
  const parentStart = $pos.start();
  const text = parent.textContent;
  const offset = $pos.parentOffset;
  let start = offset;
  let end = offset;
  const isWordChar = (ch: string | undefined) =>
    Boolean(ch && /[\p{L}\p{N}'’]/u.test(ch));
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  const raw = text.slice(start, end);
  const word = normalizeLookupWord(raw);
  if (!word) return null;
  return { word, from: parentStart + start, to: parentStart + end };
}

/**
 * Word under a viewport point (right-click). Prefer this over the caret —
 * context menu often does not move the selection.
 */
export function wordAtEditorCoords(
  editor: Editor,
  clientX: number,
  clientY: number,
): { word: string; from: number; to: number } | null {
  const hit = editor.view.posAtCoords({ left: clientX, top: clientY });
  if (!hit) return null;
  return wordAroundPos(editor, hit.pos);
}

/**
 * Word (or short selection) under the caret / selection for thesaurus lookup.
 * Returns document positions so a synonym can replace in place.
 */
export function wordAtEditorSelection(
  editor: Editor,
): { word: string; from: number; to: number } | null {
  const { from, to, empty } = editor.state.selection;
  if (!empty) {
    const text = editor.state.doc.textBetween(from, to, " ");
    const trimmed = text.trim();
    if (!trimmed) return null;
    // Multi-word selection → look up the first word, replace only that span if short
    if (/\s/.test(trimmed)) {
      const first = normalizeLookupWord(trimmed.split(/\s+/)[0] ?? "");
      if (!first) return null;
      const offsetInSelection = text.indexOf(first);
      if (offsetInSelection < 0) return { word: first, from, to };
      return {
        word: first,
        from: from + offsetInSelection,
        to: from + offsetInSelection + first.length,
      };
    }
    const word = normalizeLookupWord(trimmed);
    return word ? { word, from, to } : null;
  }

  return wordAroundPos(editor, from);
}

export function replaceEditorRange(
  editor: Editor,
  from: number,
  to: number,
  text: string,
) {
  editor.chain().focus().insertContentAt({ from, to }, text).run();
}
