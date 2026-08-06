import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { escapeRegExp, foldSearchChar } from "@/lib/textSearch";

function flattenDoc(doc: ProseMirrorNode): {
  text: string;
  map: number[];
} {
  let text = "";
  const map: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        const folded = foldSearchChar(node.text[i]!);
        for (let k = 0; k < folded.length; k++) {
          map.push(pos + i);
          text += folded[k];
        }
      }
    } else if (node.isBlock && text.length > 0 && !text.endsWith("\n")) {
      map.push(pos);
      text += "\n";
    }
  });

  return { text, map };
}

function excerptCandidates(raw: string): string[] {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const folded = cleaned
    .split("")
    .map((c) => foldSearchChar(c))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  const bases = [folded, cleaned].filter(
    (c, i, arr) => c.length >= 2 && arr.indexOf(c) === i,
  );

  const out: string[] = [];
  for (const base of bases) {
    out.push(base);
    // Drop wrapping quotes/punctuation that Claude sometimes adds
    const stripped = base.replace(/^["'`“”‘’]+|["'`“”‘’.,;:!?]+$/g, "").trim();
    if (stripped.length >= 2) out.push(stripped);
    const lengths = [base.length, 96, 64, 40, 24, 16];
    for (const len of lengths) {
      if (base.length > len) out.push(base.slice(0, len).trim());
    }
  }

  return out.filter((c, i, arr) => c.length >= 2 && arr.indexOf(c) === i);
}

/** Locate an AI-flag excerpt in the ProseMirror doc (whitespace + punctuation tolerant). */
export function findExcerptRange(
  doc: ProseMirrorNode,
  excerpt: string,
): { from: number; to: number } | null {
  const raw = excerpt.replace(/\s+/g, " ").trim();
  if (raw.length < 2) return null;

  const { text, map } = flattenDoc(doc);
  if (!text) return null;

  for (const candidate of excerptCandidates(raw)) {
    const pattern = escapeRegExp(candidate).replace(/\\ /g, "\\s+");
    const re = new RegExp(pattern, "i");
    const match = re.exec(text);
    if (!match || match.index == null) continue;
    const start = match.index;
    const end = start + match[0].length - 1;
    if (map[start] == null || map[Math.min(end, map.length - 1)] == null) {
      continue;
    }
    return {
      from: map[start]!,
      to: map[Math.min(end, map.length - 1)]! + 1,
    };
  }

  return null;
}

function findScrollParent(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const oy = style.overflowY;
    if (
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return (
    document.querySelector<HTMLElement>("[data-folio-scroll].folio-scroll") ??
    document.querySelector<HTMLElement>("main.folio-scroll") ??
    null
  );
}

/** Scroll a document position into the manuscript pane (not the window). */
export function scrollEditorPosIntoView(editor: Editor, pos: number) {
  if (!editor || editor.isDestroyed) return;
  const safe = Math.min(Math.max(1, pos), editor.state.doc.content.size);
  try {
    const coords = editor.view.coordsAtPos(safe);
    const scroller =
      findScrollParent(editor.view.dom) ??
      editor.view.dom.closest<HTMLElement>("[data-folio-scroll]");

    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const top =
        scroller.scrollTop +
        coords.top -
        rect.top -
        scroller.clientHeight * 0.28;
      scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }

    window.scrollTo({
      top: Math.max(0, window.scrollY + coords.top - window.innerHeight * 0.28),
      behavior: "smooth",
    });
  } catch {
    /* ignore */
  }
}

/**
 * Jump the manuscript to an AI note's excerpt: highlight, select, and scroll.
 * Does not steal focus from the panel (selection only).
 */
export function focusEditorExcerpt(
  editor: Editor,
  excerpt: string,
): { from: number; to: number } | null {
  if (!editor || editor.isDestroyed || !excerpt.trim()) return null;

  const range = findExcerptRange(editor.state.doc, excerpt);
  if (!range) return null;

  try {
    const selection = TextSelection.create(
      editor.state.doc,
      range.from,
      range.to,
    );
    const tr = editor.state.tr.setSelection(selection).scrollIntoView();
    editor.view.dispatch(tr);
  } catch {
    try {
      editor.commands.setTextSelection({ from: range.from, to: range.to });
    } catch {
      /* ignore */
    }
  }

  requestAnimationFrame(() => {
    scrollEditorPosIntoView(editor, range.from);
    window.setTimeout(() => scrollEditorPosIntoView(editor, range.from), 80);
  });

  return range;
}
