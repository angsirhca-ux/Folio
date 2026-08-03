import type { ImportBlock } from "./types";
import { isChapterHeading, isSceneBreakLine, normalizeHeadingText } from "./split";

/**
 * Parse plain text / markdown into manuscript blocks.
 * Recognizes ATX headings, Setext underlines, and chapter-like lines.
 */
export function textToBlocks(raw: string): ImportBlock[] {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const blocks: ImportBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
    paragraph = [];
    if (!joined) return;
    if (isSceneBreakLine(joined)) {
      blocks.push({ type: "scene-break", text: "* * *" });
      return;
    }
    // Standalone chapter-like paragraph becomes a heading
    if (isChapterHeading(joined) && joined.length < 80) {
      blocks.push({ type: "heading", level: 1, text: normalizeHeadingText(joined) });
      return;
    }
    blocks.push({ type: "paragraph", text: joined });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (isSceneBreakLine(trimmed)) {
      flushParagraph();
      blocks.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    // ATX markdown headings
    const atx = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (atx) {
      flushParagraph();
      const level = Math.min(3, atx[1].length) as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        level,
        text: normalizeHeadingText(atx[2].replace(/#+\s*$/, "")),
      });
      continue;
    }

    // Setext H1 / H2 (line then === or ---)
    const next = lines[i + 1]?.trim() ?? "";
    if (/^=+$/.test(next) && trimmed.length < 100) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: 1,
        text: normalizeHeadingText(trimmed),
      });
      i += 1;
      continue;
    }
    if (/^-+$/.test(next) && trimmed.length < 100 && !/^--+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: 2,
        text: normalizeHeadingText(trimmed),
      });
      i += 1;
      continue;
    }

    // Bare chapter heading on its own line
    if (
      paragraph.length === 0 &&
      isChapterHeading(trimmed) &&
      trimmed.length < 90
    ) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: 1,
        text: normalizeHeadingText(trimmed),
      });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}
