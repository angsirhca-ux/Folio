import type { Book, Chapter } from "@/lib/types";
import {
  applySceneBreakStyle,
  chaptersForCompile,
  compileOptionsForBook,
  frontMatterSections,
  type CompileOptions,
} from "./compile";
import {
  blockPlainText,
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
} from "./manuscript";

function blockToPlain(block: ManuscriptBlock): string {
  if (block.type === "scene-break") return block.text ? `\n${block.text}\n` : "\n";
  if (block.type === "heading") return blockPlainText(block).toUpperCase();
  return blockPlainText(block);
}

function chapterToPlain(chapter: Chapter, options: CompileOptions): string {
  const blocks = applySceneBreakStyle(
    parseChapterBlocks(chapter.content),
    options.sceneBreak,
  );
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
      if (block.text) lines.push(block.text);
      lines.push("");
    } else if (block.type === "blockquote") {
      lines.push(`    ${block.text}`);
      lines.push("");
    } else {
      if (previous === "paragraph" || previous === "blockquote") {
        lines.push("");
      }
      lines.push(block.text);
    }
    previous = block.type;
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildTxt(
  book: Book,
  options: CompileOptions = compileOptionsForBook(book),
): string {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const chapters = chaptersForCompile(book, options);
  const parts: string[] = [];

  if (options.includeTitlePage) {
    parts.push(title);
    if (author) parts.push(`by ${author}`);
    parts.push("");
    parts.push("—".repeat(Math.min(40, title.length + 8)));
    parts.push("");
  }

  for (const section of frontMatterSections(book, options)) {
    parts.push(section.title.toUpperCase());
    parts.push("");
    parts.push(...section.paragraphs);
    if (section.attribution) parts.push(section.attribution);
    parts.push("");
    parts.push("—".repeat(24));
    parts.push("");
  }

  chapters.forEach((chapter, index) => {
    if (index > 0) {
      parts.push("");
      parts.push("");
      parts.push("*".repeat(3));
      parts.push("");
      parts.push("");
    }
    parts.push(chapterToPlain(chapter, options));
  });

  parts.push("");
  parts.push("");
  parts.push("— end —");
  parts.push("");

  return parts.join("\n");
}

export async function exportTxt(
  book: Book,
  options?: CompileOptions,
): Promise<void> {
  const opts = options ?? compileOptionsForBook(book);
  const text = buildTxt(book, opts);
  const blob = new Blob(["\uFEFF" + text], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, bookFilename(book, "txt"));
}
