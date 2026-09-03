import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

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
): boolean {
  if (!editor || editor.isDestroyed) return false;
  const docSize = editor.state.doc.content.size;
  const start = Math.max(0, Math.min(from, docSize));
  const end = Math.max(start, Math.min(to, docSize));
  if (start === end && !text) return false;

  try {
    // Plain insertText only — TipTap’s insertContentAt parses strings as HTML
    // and wraps them in a paragraph, which cannot land mid-sentence.
    editor.view.focus();
    let tr = editor.state.tr.insertText(text, start, end);
    const caret = Math.min(start + text.length, tr.doc.content.size);
    try {
      tr = tr.setSelection(TextSelection.create(tr.doc, caret));
    } catch {
      try {
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(caret)));
      } catch {
        /* replace still counts even if caret can’t land */
      }
    }
    editor.view.dispatch(tr);
    return true;
  } catch {
    return false;
  }
}

function isWordBoundary(ch: string | undefined): boolean {
  return !ch || !/[\p{L}\p{N}'’]/u.test(ch);
}

/**
 * Find a misspelling anywhere in the doc, preferring the occurrence closest to
 * `nearPos` (from the right-click or caret).
 */
export function findMisspellingInDoc(
  editor: Editor,
  needle: string,
  nearPos: number,
): { word: string; from: number; to: number } | null {
  const target = normalizeLookupWord(needle);
  if (!target) return null;
  const want = target.toLowerCase();
  type Match = { word: string; from: number; to: number; dist: number };
  const hits: Match[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textContent;
    const lower = text.toLowerCase();
    let idx = 0;
    while (idx <= lower.length) {
      const found = lower.indexOf(want, idx);
      if (found < 0) break;
      const before = found > 0 ? text[found - 1] : undefined;
      const after =
        found + want.length < text.length
          ? text[found + want.length]
          : undefined;
      if (!isWordBoundary(before) || !isWordBoundary(after)) {
        idx = found + 1;
        continue;
      }
      const from = pos + 1 + found;
      const to = from + target.length;
      hits.push({
        word: text.slice(found, found + target.length),
        from,
        to,
        dist: Math.abs(from - nearPos),
      });
      idx = found + target.length;
    }
  });

  if (hits.length === 0) return null;
  hits.sort((a, b) => a.dist - b.dist);
  const best = hits[0];
  return { word: best.word, from: best.from, to: best.to };
}

/**
 * Find `needle` in the textblock under viewport coords (case-insensitive).
 * Used when spellcheck names a misspelling but the caret isn't on it.
 */
export function findWordNearCoords(
  editor: Editor,
  needle: string,
  clientX: number,
  clientY: number,
): { word: string; from: number; to: number } | null {
  const target = normalizeLookupWord(needle);
  if (!target) return null;
  const hit = editor.view.posAtCoords({ left: clientX, top: clientY });
  const pos = hit?.pos ?? editor.state.selection.from;
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock) return null;
  const parentStart = $pos.start();
  const text = parent.textContent;
  const lower = text.toLowerCase();
  const want = target.toLowerCase();
  let idx = lower.indexOf(want);
  if (idx < 0) return null;
  // Prefer the occurrence closest to the click offset.
  const offset = $pos.parentOffset;
  let best = idx;
  let bestDist = Math.abs(idx - offset);
  while (idx >= 0) {
    const dist = Math.abs(idx - offset);
    if (dist < bestDist) {
      best = idx;
      bestDist = dist;
    }
    idx = lower.indexOf(want, idx + want.length);
  }
  return {
    word: text.slice(best, best + target.length),
    from: parentStart + best,
    to: parentStart + best + target.length,
  };
}

/**
 * Prefer matching the source word’s capitalization when the replacement is
 * a single plain word (Quiet → Still, QUIET → STILL).
 */
export function matchReplacementCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  if (source === source.toUpperCase() && source.length > 1) {
    return replacement.toUpperCase();
  }
  if (
    source[0] === source[0].toUpperCase() &&
    source.slice(1) === source.slice(1).toLowerCase()
  ) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
