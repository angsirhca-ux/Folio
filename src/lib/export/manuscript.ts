import type { Book, Chapter } from "@/lib/types";
import {
  applySceneBreakStyle,
  type SceneBreakStyle,
} from "./compile";

export type ManuscriptInlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export interface ManuscriptBlock {
  type: "heading" | "paragraph" | "scene-break" | "blockquote";
  level?: 1 | 2 | 3;
  /** Plain text (concatenation of runs). */
  text: string;
  runs?: ManuscriptInlineRun[];
}

/** Strip tags and decode common entities for plain text. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function mergeAdjacentRuns(runs: ManuscriptInlineRun[]): ManuscriptInlineRun[] {
  const merged: ManuscriptInlineRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = merged[merged.length - 1];
    if (
      prev &&
      Boolean(prev.bold) === Boolean(run.bold) &&
      Boolean(prev.italic) === Boolean(run.italic)
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged;
}

/** Parse inline strong/em from Tiptap HTML into styled runs. */
export function parseInlineRuns(html: string): ManuscriptInlineRun[] {
  const normalized = html.replace(/<br\s*\/?>/gi, " ");
  const tokens = normalized.split(/(<\/?(?:strong|b|em|i)>)/gi);
  const runs: ManuscriptInlineRun[] = [];
  let bold = false;
  let italic = false;

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === "<strong>" || lower === "<b>") {
      bold = true;
      continue;
    }
    if (lower === "</strong>" || lower === "</b>") {
      bold = false;
      continue;
    }
    if (lower === "<em>" || lower === "<i>") {
      italic = true;
      continue;
    }
    if (lower === "</em>" || lower === "</i>") {
      italic = false;
      continue;
    }

    const text = decodeEntities(token.replace(/<[^>]+>/g, ""));
    if (!text) continue;
    runs.push({
      text,
      bold: bold || undefined,
      italic: italic || undefined,
    });
  }

  return mergeAdjacentRuns(runs);
}

export function runsPlainText(runs: ManuscriptInlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

export function blockPlainText(block: ManuscriptBlock): string {
  return block.runs?.length ? runsPlainText(block.runs) : block.text;
}

function isSceneBreak(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return (
    t === "* * *" ||
    t === "***" ||
    t === "• • •" ||
    t === "⁂" ||
    /^(\*\s*){3,}$/.test(t)
  );
}

function blockFromInner(
  tag: string,
  inner: string,
  classAttr: string,
): ManuscriptBlock | null {
  const runs = parseInlineRuns(inner);
  const text = runsPlainText(runs);

  if (!text && tag === "p") return null;

  if (tag.startsWith("h")) {
    const level = Number(tag[1]) as 1 | 2 | 3;
    return { type: "heading", level, text, runs: runs.length ? runs : undefined };
  }

  if (tag === "blockquote") {
    return {
      type: "blockquote",
      text,
      runs: runs.length ? runs : undefined,
    };
  }

  if (classAttr.includes("scene-break") || isSceneBreak(text)) {
    return { type: "scene-break", text: "* * *" };
  }

  return {
    type: "paragraph",
    text,
    runs: runs.length ? runs : undefined,
  };
}

/** Parse Tiptap/chapter HTML into typed manuscript blocks. */
export function parseChapterBlocks(html: string): ManuscriptBlock[] {
  const blocks: ManuscriptBlock[] = [];
  const tagRe =
    /<(h[123]|p|blockquote)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[3];
    const classAttr = match[2] ?? "";
    const block = blockFromInner(tag, inner, classAttr);
    if (block) blocks.push(block);
  }

  if (blocks.length === 0 && htmlToPlainText(html)) {
    const plain = htmlToPlainText(html);
    for (const para of plain.split(/\n\n+/)) {
      const t = para.trim();
      if (!t) continue;
      if (isSceneBreak(t)) blocks.push({ type: "scene-break", text: "* * *" });
      else blocks.push({ type: "paragraph", text: t });
    }
  }

  return blocks;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function runsToXhtml(runs: ManuscriptInlineRun[]): string {
  return runs
    .map((run) => {
      let text = escapeXml(run.text);
      if (run.bold) text = `<strong>${text}</strong>`;
      if (run.italic) text = `<em>${text}</em>`;
      return text;
    })
    .join("");
}

export function blockToXhtmlInner(block: ManuscriptBlock): string {
  if (block.runs?.length) return runsToXhtml(block.runs);
  return escapeXml(block.text);
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Untitled Manuscript";
}

export function bookFilename(book: Book, ext: string): string {
  const base = sanitizeFilename(book.title);
  return `${base}.${ext}`;
}

export function frontMatterSectionToXhtml(section: {
  id: string;
  paragraphs: string[];
  attribution?: string;
  variant?: "copyright";
}): string {
  const className =
    section.variant === "copyright"
      ? "front-matter copyright"
      : "front-matter";
  const paras = section.paragraphs
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join("\n");
  const attr = section.attribution
    ? `<p class="attribution">${escapeXml(section.attribution)}</p>`
    : "";
  return `<section class="${className}" epub:type="${section.id}">
${paras}
${attr}
</section>`;
}

export function partDividerXhtml(label: string): string {
  return `<section class="part-divider" epub:type="part"><h1>${escapeXml(label)}</h1></section>`;
}

export type ChapterXhtmlOptions = {
  sceneBreak?: SceneBreakStyle;
  suppressTitle?: boolean;
};

/** Convert chapter HTML into clean XHTML body fragment for EPUB. */
export function chapterToXhtmlBody(
  chapter: Chapter,
  options?: ChapterXhtmlOptions,
): string {
  const style = options?.sceneBreak ?? "asterisks";
  const suppressTitle = options?.suppressTitle ?? chapter.compile?.suppressTitle;
  const blocks = applySceneBreakStyle(
    parseChapterBlocks(chapter.content),
    style,
  );
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      parts.push(`<h${level}>${blockToXhtmlInner(block)}</h${level}>`);
    } else if (block.type === "scene-break") {
      if (style === "blank") {
        parts.push(`<p class="scene-break scene-break-blank">&#160;</p>`);
      } else {
        parts.push(
          `<p class="scene-break"><span class="scene-break-mark">${escapeXml(block.text || "* * *")}</span></p>`,
        );
      }
    } else if (block.type === "blockquote") {
      parts.push(
        `<blockquote><p>${blockToXhtmlInner(block)}</p></blockquote>`,
      );
    } else {
      parts.push(`<p>${blockToXhtmlInner(block)}</p>`);
    }
  }

  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  if (!hasH1 && !suppressTitle) {
    parts.unshift(`<h1>${escapeXml(chapter.title)}</h1>`);
  }

  return parts.join("\n");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
