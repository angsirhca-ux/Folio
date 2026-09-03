import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import type { Book, Chapter } from "@/lib/types";
import {
  applySceneBreakStyle,
  chaptersForCompile,
  compileOptionsForBook,
  frontMatterSections,
  partDividerForChapter,
  type CompileOptions,
  type FrontMatterSection,
} from "./compile";
import {
  blockPlainText,
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
  type ManuscriptInlineRun,
} from "./manuscript";

import { typographyForPreset } from "@/lib/format/tokens";

function runsToTextRuns(
  runs: ManuscriptInlineRun[] | undefined,
  fallbackText: string,
  style: {
    font: string;
    size: number;
    color: string;
    italics?: boolean;
  },
): TextRun[] {
  const source = runs?.length ? runs : [{ text: fallbackText }];
  return source.map(
    (run) =>
      new TextRun({
        text: run.text,
        font: style.font,
        size: style.size,
        color: style.color,
        bold: run.bold,
        italics: run.italic ?? style.italics,
      }),
  );
}

function frontMatterParagraphs(
  sections: FrontMatterSection[],
  options: CompileOptions,
): Paragraph[] {
  const submission = options.preset === "submission";
  const font = typographyForPreset(options.preset).bodyFontDocx;
  const size = submission ? 24 : 22;
  const line = submission ? 480 : 360;
  const paras: Paragraph[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    if (i > 0) {
      paras.push(new Paragraph({ children: [new PageBreak()] }));
    }
    for (const paragraph of section.paragraphs) {
      paras.push(
        new Paragraph({
          alignment:
            section.variant === "copyright"
              ? AlignmentType.LEFT
              : AlignmentType.CENTER,
          spacing: { after: 160, line },
          children: runsToTextRuns(undefined, paragraph, {
            font,
            size: section.variant === "copyright" ? 20 : size,
            color: "2D2A26",
            italics: section.id === "epigraph",
          }),
        }),
      );
    }
    if (section.attribution) {
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 240, line },
          children: runsToTextRuns(undefined, section.attribution, {
            font,
            size: 20,
            color: "6B645C",
            italics: true,
          }),
        }),
      );
    }
  }

  return paras;
}

function titlePageReading(title: string, author: string): Paragraph[] {
  const t = typographyForPreset("reading");
  const paras: Paragraph[] = [
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: title,
          font: t.bodyFontDocx,
          size: 48,
          bold: true,
          color: t.ink.replace("#", "").toUpperCase(),
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      children: [
        new TextRun({
          text: "*  *  *",
          font: t.bodyFontDocx,
          size: 22,
          color: t.accent.replace("#", "").toUpperCase(),
        }),
      ],
    }),
  ];

  if (author) {
    paras.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: author,
            font: t.bodyFontDocx,
            size: 26,
            italics: true,
            color: t.muted.replace("#", "").toUpperCase(),
          }),
        ],
      }),
    );
  }

  return paras;
}

/** Simple name / title / word-count style front page for agents. */
function titlePageSubmission(title: string, author: string): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      spacing: { after: 0, line: 480 },
      children: [
        new TextRun({
          text: author || "Author",
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240, line: 480 },
      children: [
        new TextRun({
          text: title,
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 480 },
      children: [
        new TextRun({
          text: "a novel",
          font: "Times New Roman",
          size: 24,
        }),
      ],
    }),
  ];
  return paras;
}

function headingLevel(level: 1 | 2 | 3) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function partDividerParagraphs(label: string, options: CompileOptions): Paragraph[] {
  const t = typographyForPreset(options.preset);
  const ink = t.ink.replace("#", "").toUpperCase();
  return [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360 },
      children: [
        new TextRun({
          text: label,
          font: t.bodyFontDocx,
          size: t.heading1SizeDocx,
          color: ink,
        }),
      ],
    }),
  ];
}

function blocksToParagraphs(
  blocks: ManuscriptBlock[],
  chapterTitle: string,
  options: CompileOptions,
  suppressTitle?: boolean,
): Paragraph[] {
  const submission = options.preset === "submission";
  const t = typographyForPreset(options.preset);
  const font = t.bodyFontDocx;
  const ink = t.ink.replace("#", "").toUpperCase();
  const muted = t.muted.replace("#", "").toUpperCase();
  const bodySize = t.bodySizeDocx;
  const line = submission ? 480 : 360;
  const paras: Paragraph[] = [];
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  let previous: ManuscriptBlock["type"] | null = null;

  if (!hasH1 && !suppressTitle) {
    paras.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: submission ? 0 : 480, after: 360, line },
        children: [
          new TextRun({
            text: chapterTitle,
            font,
            size: submission ? 24 : t.heading1SizeDocx,
            bold: !submission,
            color: ink,
          }),
        ],
      }),
    );
    previous = "heading";
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      const size = submission ? 24 : level === 1 ? t.heading1SizeDocx : level === 2 ? 26 : 24;
      paras.push(
        new Paragraph({
          heading: headingLevel(level),
          alignment: AlignmentType.CENTER,
          spacing: {
            before: level === 1 ? (submission ? 0 : 480) : 280,
            after: level === 1 ? 360 : 200,
            line,
          },
          children: block.runs?.some((r) => r.bold || r.italic)
            ? runsToTextRuns(block.runs, blockPlainText(block), {
                font,
                size,
                color: ink,
              })
            : [
                new TextRun({
                  text: blockPlainText(block),
                  font,
                  size,
                  bold: !submission && level === 1,
                  color: ink,
                }),
              ],
        }),
      );
    } else if (block.type === "scene-break") {
      const text =
        options.sceneBreak === "blank"
          ? ""
          : block.text || (options.sceneBreak === "hash" ? "#" : "*  *  *");
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 280, after: 280, line },
          children: text
            ? [
                new TextRun({
                  text,
                  font,
                  size: bodySize,
                  color: submission ? ink : muted,
                }),
              ]
            : [],
        }),
      );
    } else if (block.type === "blockquote") {
      paras.push(
        new Paragraph({
          spacing: { before: 160, after: 160, line },
          indent: { left: convertInchesToTwip(0.4) },
          children: runsToTextRuns(block.runs, blockPlainText(block), {
            font,
            size: submission ? 24 : 21,
            color: submission ? ink : muted,
            italics: true,
          }),
        }),
      );
    } else {
      const indentFirst =
        previous === "paragraph" || previous === "blockquote";
      paras.push(
        new Paragraph({
          alignment: submission ? AlignmentType.LEFT : AlignmentType.BOTH,
          spacing: { after: 0, line },
          indent: indentFirst
            ? { firstLine: convertInchesToTwip(0.5) }
            : undefined,
          children: runsToTextRuns(block.runs, blockPlainText(block), {
            font,
            size: bodySize,
            color: ink,
          }),
        }),
      );
    }
    previous = block.type;
  }

  return paras;
}

function chapterParagraphs(
  chapter: Chapter,
  isFirst: boolean,
  options: CompileOptions,
  chapters: Chapter[],
  index: number,
): Paragraph[] {
  const blocks = applySceneBreakStyle(
    parseChapterBlocks(chapter.content),
    options.sceneBreak,
  );
  const body = blocksToParagraphs(
    blocks,
    chapter.title || "Chapter",
    options,
    chapter.compile?.suppressTitle,
  );

  const prefix: Paragraph[] = [];
  const part = partDividerForChapter(chapters, index);
  if (part) {
    prefix.push(...partDividerParagraphs(part, options));
  } else if (!isFirst || chapter.compile?.pageBreakBefore) {
    prefix.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );
  }

  if (prefix.length === 0) return body;
  return [...prefix, ...body];
}

export async function buildDocx(
  book: Book,
  options: CompileOptions = compileOptionsForBook(book),
): Promise<Blob> {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const chapters = chaptersForCompile(book, options);
  const submission = options.preset === "submission";
  const t = typographyForPreset(options.preset);
  const ink = t.ink.replace("#", "").toUpperCase();

  const children: Paragraph[] = [];

  if (options.includeTitlePage) {
    children.push(
      ...(submission
        ? titlePageSubmission(title, author)
        : titlePageReading(title, author)),
    );
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      }),
    );
  }

  const fm = frontMatterSections(book, options);
  if (fm.length) {
    children.push(...frontMatterParagraphs(fm, options));
  }

  chapters.forEach((chapter, index) => {
    children.push(
      ...chapterParagraphs(
        chapter,
        index === 0 && !fm.length,
        options,
        chapters,
        index,
      ),
    );
  });

  const doc = new Document({
    creator: author || "Folio",
    title,
    description: "Manuscript exported from Folio",
    styles: {
      default: {
        document: {
          run: {
            font: t.bodyFontDocx,
            size: t.bodySizeDocx,
            color: ink,
          },
          paragraph: {
            spacing: { line: submission ? 480 : 360 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: submission
              ? {
                  width: convertInchesToTwip(8.5),
                  height: convertInchesToTwip(11),
                }
              : {
                  width: convertInchesToTwip(6),
                  height: convertInchesToTwip(9),
                },
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportDocx(
  book: Book,
  options?: CompileOptions,
): Promise<void> {
  const opts = options ?? compileOptionsForBook(book);
  const blob = await buildDocx(book, opts);
  downloadBlob(blob, bookFilename(book, "docx"));
}
