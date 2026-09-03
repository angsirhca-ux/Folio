import { jsPDF } from "jspdf";
import type { Book, Chapter } from "@/lib/types";
import {
  applySceneBreakStyle,
  chaptersForCompile,
  compileOptionsForBook,
  frontMatterSections,
  partDividerForChapter,
  type CompileOptions,
} from "./compile";
import {
  blockPlainText,
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
} from "./manuscript";

/** Trade paperback–ish page in points (1 pt = 1/72"). 5.5 × 8.5" */
const PAGE = {
  width: 396,
  height: 612,
  marginTop: 64,
  marginBottom: 56,
  marginLeft: 54,
  marginRight: 54,
};

const COLORS = {
  ink: [45, 42, 38] as [number, number, number],
  muted: [107, 100, 92] as [number, number, number],
  accent: [176, 141, 87] as [number, number, number],
};

function contentWidth(): number {
  return PAGE.width - PAGE.marginLeft - PAGE.marginRight;
}

function wrapLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text, maxWidth) as string[];
}

/**
 * Split paragraph into lines with a true first-line indent:
 * first line uses a narrower measure; remaining uses full measure.
 */
function linesWithFirstIndent(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  indent: number,
  fontSize: number,
): { text: string; x: number }[] {
  doc.setFontSize(fontSize);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const result: { text: string; x: number }[] = [];
  let line = "";
  let isFirst = true;

  const flush = () => {
    if (!line) return;
    result.push({
      text: line,
      x: PAGE.marginLeft + (result.length === 0 ? indent : 0),
    });
    line = "";
    isFirst = false;
  };

  for (const word of words) {
    const measure = isFirst ? maxWidth - indent : maxWidth;
    const trial = line ? `${line} ${word}` : word;
    if (doc.getTextWidth(trial) > measure && line) {
      flush();
      line = word;
      // after flush, subsequent lines are not first
    } else {
      line = trial;
    }
  }
  if (line) {
    result.push({
      text: line,
      x: PAGE.marginLeft + (result.length === 0 ? indent : 0),
    });
  }

  return result;
}

class NovelPdf {
  doc: jsPDF;
  y: number;
  pageNumber: number;

  constructor() {
    this.doc = new jsPDF({
      unit: "pt",
      format: [PAGE.width, PAGE.height],
      compress: true,
    });
    this.y = PAGE.marginTop;
    this.pageNumber = 1;
  }

  ensureSpace(needed: number) {
    if (this.y + needed > PAGE.height - PAGE.marginBottom) {
      this.addPage();
    }
  }

  addPage() {
    this.drawFooter();
    this.doc.addPage([PAGE.width, PAGE.height]);
    this.pageNumber += 1;
    this.y = PAGE.marginTop;
  }

  drawFooter() {
    if (this.pageNumber <= 1) return;
    const label = String(this.pageNumber - 1);
    this.doc.setFont("times", "normal");
    this.doc.setFontSize(9);
    this.doc.setTextColor(...COLORS.muted);
    const w = this.doc.getTextWidth(label);
    this.doc.text(
      label,
      (PAGE.width - w) / 2,
      PAGE.height - PAGE.marginBottom / 2,
    );
    this.doc.setTextColor(...COLORS.ink);
  }

  titlePage(title: string, author: string) {
    this.doc.setTextColor(...COLORS.ink);

    const midY = PAGE.height * 0.38;
    this.doc.setFont("times", "bold");
    this.doc.setFontSize(22);
    const titleLines = wrapLines(this.doc, title, contentWidth() * 0.9, 22);
    let ty = midY;
    for (const line of titleLines) {
      const w = this.doc.getTextWidth(line);
      this.doc.text(line, (PAGE.width - w) / 2, ty);
      ty += 28;
    }

    this.doc.setTextColor(...COLORS.accent);
    this.doc.setFont("times", "normal");
    this.doc.setFontSize(14);
    const ornament = "*";
    // Use spaced asterisks for broader font support
    const orn = "*  *  *";
    void ornament;
    const ow = this.doc.getTextWidth(orn);
    this.doc.text(orn, (PAGE.width - ow) / 2, ty + 28);

    if (author) {
      this.doc.setTextColor(...COLORS.muted);
      this.doc.setFont("times", "italic");
      this.doc.setFontSize(13);
      const aw = this.doc.getTextWidth(author);
      this.doc.text(author, (PAGE.width - aw) / 2, ty + 60);
    }

    this.doc.setTextColor(...COLORS.ink);
  }

  renderHeading(text: string, level: 1 | 2 | 3) {
    const sizes = { 1: 18, 2: 14, 3: 12 } as const;
    const size = sizes[level];
    const gapBefore = level === 1 ? 40 : 22;
    const gapAfter = level === 1 ? 30 : 16;

    this.ensureSpace(gapBefore + size * 2.5 + gapAfter);
    this.y += gapBefore;

    this.doc.setFont("times", level === 1 ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...COLORS.ink);

    const lines = wrapLines(this.doc, text, contentWidth() * 0.92, size);
    for (const line of lines) {
      this.ensureSpace(size * 1.35);
      const w = this.doc.getTextWidth(line);
      this.doc.text(line, (PAGE.width - w) / 2, this.y);
      this.y += size * 1.35;
    }
    this.y += gapAfter;
  }

  renderParagraph(text: string, indent: boolean, leftAlign = false) {
    const fontSize = 11;
    const lineHeight = fontSize * 1.7;
    const maxW = contentWidth();

    this.doc.setFont("times", "normal");
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...COLORS.ink);

    const lines = indent
      ? linesWithFirstIndent(this.doc, text, maxW, fontSize * 1.5, fontSize)
      : wrapLines(this.doc, text, maxW, fontSize).map((t) => ({
          text: t,
          x: PAGE.marginLeft,
        }));

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      if (leftAlign) {
        this.doc.text(line.text, PAGE.marginLeft, this.y);
      } else {
        this.doc.text(line.text, line.x, this.y);
      }
      this.y += lineHeight;
    }
  }

  renderSceneBreak(text: string) {
    this.ensureSpace(44);
    this.y += 18;
    if (text) {
      this.doc.setFont("times", "normal");
      this.doc.setFontSize(11);
      this.doc.setTextColor(...COLORS.muted);
      const w = this.doc.getTextWidth(text);
      this.doc.text(text, (PAGE.width - w) / 2, this.y);
      this.doc.setTextColor(...COLORS.ink);
    }
    this.y += 26;
  }

  renderBlockquote(text: string) {
    const fontSize = 10.5;
    const lineHeight = fontSize * 1.65;
    const pad = 18;
    const maxW = contentWidth() - pad;

    this.doc.setFont("times", "italic");
    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(...COLORS.muted);

    const lines = wrapLines(this.doc, text, maxW, fontSize);
    this.ensureSpace(lines.length * lineHeight + 16);
    this.y += 8;
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.doc.text(line, PAGE.marginLeft + pad, this.y);
      this.y += lineHeight;
    }
    this.y += 8;
    this.doc.setTextColor(...COLORS.ink);
  }

  renderFrontMatterSection(section: {
    title: string;
    paragraphs: string[];
    attribution?: string;
    variant?: "copyright";
  }) {
    this.addPage();
    if (section.variant !== "copyright") {
      this.renderHeading(section.title, 2);
    }
    for (const paragraph of section.paragraphs) {
      this.renderParagraph(
        paragraph,
        false,
        section.variant === "copyright",
      );
    }
    if (section.attribution) {
      this.renderBlockquote(section.attribution);
    }
  }

  renderPartDivider(label: string) {
    this.addPage();
    this.renderHeading(label, 1);
  }

  renderBlocks(blocks: ManuscriptBlock[]) {
    let previous: ManuscriptBlock["type"] | null = null;

    for (const block of blocks) {
      const text = blockPlainText(block);
      if (block.type === "heading") {
        this.renderHeading(text, block.level ?? 1);
      } else if (block.type === "scene-break") {
        this.renderSceneBreak(text);
      } else if (block.type === "blockquote") {
        this.renderBlockquote(text);
      } else {
        const shouldIndent =
          previous === "paragraph" || previous === "blockquote";
        this.renderParagraph(text, shouldIndent);
      }
      previous = block.type;
    }
  }

  renderChapter(
    chapter: Chapter,
    options: CompileOptions,
    startNewPage: boolean,
    chapters: Chapter[],
    index: number,
  ) {
    const part = partDividerForChapter(chapters, index);
    if (part) {
      this.renderPartDivider(part);
    } else if (startNewPage || chapter.compile?.pageBreakBefore) {
      this.addPage();
    }

    const blocks = applySceneBreakStyle(
      parseChapterBlocks(chapter.content),
      options.sceneBreak,
    );
    const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
    if (!hasH1 && !chapter.compile?.suppressTitle) {
      this.renderHeading(chapter.title || "Chapter", 1);
    }
    this.renderBlocks(blocks);
  }

  finalize(): Blob {
    this.drawFooter();
    return this.doc.output("blob");
  }
}

export async function buildPdf(
  book: Book,
  options: CompileOptions = compileOptionsForBook(book),
): Promise<Blob> {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const chapters = chaptersForCompile(book, options);
  const pdf = new NovelPdf();
  const fm = frontMatterSections(book, options);

  if (options.includeTitlePage) {
    pdf.titlePage(title, author);
  }

  for (const section of fm) {
    pdf.renderFrontMatterSection(section);
  }

  chapters.forEach((chapter, index) => {
    const startNewPage =
      options.includeTitlePage || fm.length > 0 || index > 0;
    pdf.renderChapter(chapter, options, startNewPage, chapters, index);
  });

  return pdf.finalize();
}

export async function exportPdf(
  book: Book,
  options?: CompileOptions,
): Promise<void> {
  const opts = options ?? compileOptionsForBook(book);
  const blob = await buildPdf(book, opts);
  downloadBlob(blob, bookFilename(book, "pdf"));
}
