/**
 * Manuscript find & replace — chapter (TipTap) and whole-draft (HTML) scopes.
 */

import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { Book } from "./types";
import { scrollEditorPosIntoView } from "./editorNavigate";

export type FindMatch = { from: number; to: number };

/** One hit in the manuscript, addressed by chapter + local index. */
export type DraftFindMatch = {
  chapterId: string;
  chapterTitle: string;
  /** 0-based among matches in that chapter. */
  localIndex: number;
};

export type FindOptions = { matchCase?: boolean };

function flattenDoc(doc: ProseMirrorNode): {
  text: string;
  map: number[];
} {
  let text = "";
  const map: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        map.push(pos + i);
        text += node.text[i];
      }
    } else if (node.isBlock && text.length > 0 && !text.endsWith("\n")) {
      map.push(pos);
      text += "\n";
    }
  });

  return { text, map };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findInPlain(
  text: string,
  query: string,
  opts?: FindOptions,
): Array<{ from: number; to: number }> {
  if (!query || !text) return [];
  const flags = opts?.matchCase ? "g" : "gi";
  const re = new RegExp(escapeRegExp(query), flags);
  const matches: Array<{ from: number; to: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex += 1;
      continue;
    }
    matches.push({ from: m.index, to: m.index + m[0].length });
    if (matches.length > 5000) break;
  }
  return matches;
}

export function findMatchesInDoc(
  doc: ProseMirrorNode,
  query: string,
  opts?: FindOptions,
): FindMatch[] {
  const q = query;
  if (!q) return [];

  const { text, map } = flattenDoc(doc);
  if (!text) return [];

  const plain = findInPlain(text, q, opts);
  const matches: FindMatch[] = [];
  for (const p of plain) {
    const start = p.from;
    const end = p.to - 1;
    if (map[start] == null || map[end] == null) continue;
    matches.push({
      from: map[start],
      to: map[end] + 1,
    });
  }
  return matches;
}

export function selectMatch(editor: Editor, match: FindMatch) {
  if (!editor || editor.isDestroyed) return;
  const { state } = editor;
  const from = Math.min(match.from, state.doc.content.size);
  const to = Math.min(match.to, state.doc.content.size);
  const tr = state.tr
    .setSelection(TextSelection.create(state.doc, from, to))
    .scrollIntoView();
  editor.view.dispatch(tr);
  scrollEditorPosIntoView(editor, from);
}

export function replaceMatch(
  editor: Editor,
  match: FindMatch,
  replacement: string,
): boolean {
  if (!editor || editor.isDestroyed) return false;
  const { state } = editor;
  const from = Math.min(match.from, state.doc.content.size);
  const to = Math.min(match.to, state.doc.content.size);
  if (from >= to && replacement === "") return false;
  const tr = state.tr.insertText(replacement, from, to);
  editor.view.dispatch(tr);
  return true;
}

/** Replace from the end so earlier positions stay valid. Returns count replaced. */
export function replaceAllMatches(
  editor: Editor,
  query: string,
  replacement: string,
  opts?: FindOptions,
): number {
  if (!editor || editor.isDestroyed || !query) return 0;
  const matches = findMatchesInDoc(editor.state.doc, query, opts);
  if (matches.length === 0) return 0;

  let { tr } = editor.state;
  const sorted = [...matches].sort((a, b) => b.from - a.from);
  for (const m of sorted) {
    const from = Math.min(m.from, tr.doc.content.size);
    const to = Math.min(m.to, tr.doc.content.size);
    tr = tr.insertText(replacement, from, to);
  }
  editor.view.dispatch(tr);
  return matches.length;
}

/** Collect text nodes in document order (skips script/style). */
function walkTextNodes(root: Node): Text[] {
  const out: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return;
    for (const child of Array.from(node.childNodes)) walk(child);
  };
  walk(root);
  return out;
}

function flattenHtmlText(root: Node): {
  text: string;
  /** Map plain index → { node, offset in node } */
  map: Array<{ node: Text; offset: number }>;
} {
  let text = "";
  const map: Array<{ node: Text; offset: number }> = [];
  for (const node of walkTextNodes(root)) {
    const value = node.nodeValue ?? "";
    for (let i = 0; i < value.length; i++) {
      map.push({ node, offset: i });
      text += value[i];
    }
  }
  return { text, map };
}

function parseHtmlFragment(html: string): {
  doc: Document;
  root: HTMLElement;
} | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(
    `<div id="folio-fr-root">${html}</div>`,
    "text/html",
  );
  const root = doc.getElementById("folio-fr-root");
  if (!root) return null;
  return { doc, root };
}

export function countMatchesInHtml(
  html: string,
  query: string,
  opts?: FindOptions,
): number {
  if (!query || !html) return 0;
  const parsed = parseHtmlFragment(html);
  if (!parsed) return 0;
  const { text } = flattenHtmlText(parsed.root);
  return findInPlain(text, query, opts).length;
}

function applyPlainReplace(
  map: Array<{ node: Text; offset: number }>,
  from: number,
  to: number,
  replacement: string,
) {
  for (let i = to - 1; i >= from; i--) {
    const loc = map[i];
    if (!loc) continue;
    const { node, offset } = loc;
    const v = node.nodeValue ?? "";
    node.nodeValue = v.slice(0, offset) + v.slice(offset + 1);
  }
  const startLoc = map[from];
  if (startLoc && replacement) {
    const node = startLoc.node;
    const v = node.nodeValue ?? "";
    const insertAt = Math.min(startLoc.offset, v.length);
    node.nodeValue = v.slice(0, insertAt) + replacement + v.slice(insertAt);
  }
}

/**
 * Replace the nth match (0-based) in HTML text nodes. Returns null if missing.
 */
export function replaceOccurrenceInHtml(
  html: string,
  query: string,
  replacement: string,
  occurrenceIndex: number,
  opts?: FindOptions,
): string | null {
  if (!query || occurrenceIndex < 0) return null;
  const parsed = parseHtmlFragment(html);
  if (!parsed) return null;
  const { root } = parsed;
  const { text, map } = flattenHtmlText(root);
  const hits = findInPlain(text, query, opts);
  const hit = hits[occurrenceIndex];
  if (!hit) return null;
  applyPlainReplace(map, hit.from, hit.to, replacement);
  return root.innerHTML;
}

export function replaceAllInHtml(
  html: string,
  query: string,
  replacement: string,
  opts?: FindOptions,
): { html: string; count: number } {
  if (!query) return { html, count: 0 };
  const parsed = parseHtmlFragment(html);
  if (!parsed) return { html, count: 0 };
  const { root } = parsed;
  const { text, map } = flattenHtmlText(root);
  const hits = findInPlain(text, query, opts);
  if (hits.length === 0) return { html, count: 0 };

  // From the end so earlier plain-text map entries stay valid.
  for (let h = hits.length - 1; h >= 0; h--) {
    const hit = hits[h]!;
    applyPlainReplace(map, hit.from, hit.to, replacement);
  }

  return { html: root.innerHTML, count: hits.length };
}

export function findDraftMatches(
  book: Book,
  query: string,
  opts?: FindOptions & {
    /** Limit to one chapter when set. */
    chapterId?: string;
    activeEditor?: Editor | null;
    activeChapterId?: string | null;
  },
): DraftFindMatch[] {
  if (!query.trim()) return [];
  const out: DraftFindMatch[] = [];
  const chapters = opts?.chapterId
    ? book.chapters.filter((c) => c.id === opts.chapterId)
    : book.chapters;

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci]!;
    const title = chapter.title?.trim() || `Chapter ${ci + 1}`;
    let count = 0;

    if (
      opts?.activeEditor &&
      !opts.activeEditor.isDestroyed &&
      opts.activeChapterId === chapter.id
    ) {
      count = findMatchesInDoc(
        opts.activeEditor.state.doc,
        query,
        opts,
      ).length;
    } else {
      count = countMatchesInHtml(chapter.content ?? "", query, opts);
    }

    for (let localIndex = 0; localIndex < count; localIndex++) {
      out.push({
        chapterId: chapter.id,
        chapterTitle: title,
        localIndex,
      });
      if (out.length > 5000) return out;
    }
  }
  return out;
}
