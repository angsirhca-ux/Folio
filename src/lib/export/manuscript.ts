import type { Book, Chapter } from "@/lib/types";

export interface ManuscriptBlock {
  type: "heading" | "paragraph" | "scene-break" | "blockquote";
  level?: 1 | 2 | 3;
  text: string;
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

function decodeEntities(text: string): string {
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

function stripInline(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(strong|b|em|i|span|a)[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  ).trim();
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
    const text = stripInline(inner);

    if (!text && tag === "p") continue;

    if (tag.startsWith("h")) {
      const level = Number(tag[1]) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text });
      continue;
    }

    if (tag === "blockquote") {
      blocks.push({ type: "blockquote", text });
      continue;
    }

    if (classAttr.includes("scene-break") || isSceneBreak(text)) {
      blocks.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    blocks.push({ type: "paragraph", text });
  }

  // Fallback if parser found nothing but content exists
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

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert chapter HTML into clean XHTML body fragment for EPUB. */
export function chapterToXhtmlBody(chapter: Chapter): string {
  const blocks = parseChapterBlocks(chapter.content);
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      parts.push(
        `<h${level}>${escapeXml(block.text)}</h${level}>`,
      );
    } else if (block.type === "scene-break") {
      parts.push(`<p class="scene-break">* * *</p>`);
    } else if (block.type === "blockquote") {
      parts.push(`<blockquote><p>${escapeXml(block.text)}</p></blockquote>`);
    } else {
      parts.push(`<p>${escapeXml(block.text)}</p>`);
    }
  }

  // Ensure chapter has at least a title heading if content had none
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  if (!hasH1) {
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
