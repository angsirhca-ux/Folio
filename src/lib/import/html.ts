import type { ImportBlock } from "./types";
import {
  isChapterHeading,
  isSceneBreakLine,
  normalizeHeadingText,
} from "./split";

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

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(strong|b|em|i|span|a|u)[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert HTML manuscript markup into typed blocks. */
export function htmlToBlocks(html: string): ImportBlock[] {
  const blocks: ImportBlock[] = [];
  const cleaned = html
    .replace(/<\/?(div|section|article|header|main)[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "</p><p>");

  const tagRe =
    /<(h[1-6]|p|blockquote)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase();
    const text = stripTags(match[3]);
    if (!text) continue;

    if (tag.startsWith("h")) {
      const rawLevel = Number(tag[1]);
      const level = Math.min(3, Math.max(1, rawLevel)) as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        level,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    if (tag === "blockquote") {
      blocks.push({ type: "blockquote", text });
      continue;
    }

    if (isSceneBreakLine(text)) {
      blocks.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    // Promote chapter-like paragraphs (common in exported Word HTML)
    if (
      isChapterHeading(text) &&
      text.length < 100 &&
      !text.includes(". ")
    ) {
      blocks.push({
        type: "heading",
        level: 1,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    blocks.push({ type: "paragraph", text });
  }

  if (blocks.length === 0) {
    const plain = stripTags(cleaned.replace(/<\/p>/gi, "\n\n"));
    for (const para of plain.split(/\n\n+/)) {
      const t = para.trim();
      if (!t) continue;
      if (isSceneBreakLine(t)) {
        blocks.push({ type: "scene-break", text: "* * *" });
      } else if (isChapterHeading(t) && t.length < 100 && !t.includes(". ")) {
        blocks.push({
          type: "heading",
          level: 1,
          text: normalizeHeadingText(t),
        });
      } else {
        blocks.push({ type: "paragraph", text: t });
      }
    }
  }

  return blocks;
}
