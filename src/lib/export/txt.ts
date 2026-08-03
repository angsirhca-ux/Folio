import type { Book, Chapter } from "@/lib/types";
import {
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
} from "./manuscript";

function blockToPlain(block: ManuscriptBlock): string {
  if (block.type === "scene-break") return "\n* * *\n";
  if (block.type === "heading") return block.text.toUpperCase();
  return block.text;
}

function chapterToPlain(chapter: Chapter): string {
  const blocks = parseChapterBlocks(chapter.content);
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  const lines: string[] = [];

  if (!hasH1) {
    lines.push(chapter.title.toUpperCase());
    lines.push("");
  }

  let previous: ManuscriptBlock["type"] | null = null;

  for (const block of blocks) {
    if (block.type === "heading") {
      if (lines.length > 0) lines.push("");
      lines.push(blockToPlain(block));
      lines.push("");
    } else if (block.type === "scene-break") {
      lines.push("");
      lines.push("* * *");
      lines.push("");
    } else if (block.type === "blockquote") {
      lines.push(`    ${block.text}`);
      lines.push("");
    } else {
      // Blank line between paragraphs for readability
      if (previous === "paragraph" || previous === "blockquote") {
        lines.push("");
      }
      lines.push(block.text);
    }
    previous = block.type;
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildTxt(book: Book): string {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const parts: string[] = [];

  parts.push(title);
  if (author) parts.push(`by ${author}`);
  parts.push("");
  parts.push("—".repeat(Math.min(40, title.length + 8)));
  parts.push("");

  book.chapters.forEach((chapter, index) => {
    if (index > 0) {
      parts.push("");
      parts.push("");
      parts.push("*".repeat(3));
      parts.push("");
      parts.push("");
    }
    parts.push(chapterToPlain(chapter));
  });

  parts.push("");
  parts.push("");
  parts.push("— end —");
  parts.push("");

  return parts.join("\n");
}

export async function exportTxt(book: Book): Promise<void> {
  const text = buildTxt(book);
  // UTF-8 BOM helps Notepad and some editors detect encoding
  const blob = new Blob(["\uFEFF" + text], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, bookFilename(book, "txt"));
}
