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
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
} from "./manuscript";

const INK = "2D2A26";
const MUTED = "6B645C";
const ACCENT = "B08D57";

function titlePage(title: string, author: string): Paragraph[] {
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
          font: "Georgia",
          size: 48, // 24pt
          bold: true,
          color: INK,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      children: [
        new TextRun({
          text: "*  *  *",
          font: "Georgia",
          size: 22,
          color: ACCENT,
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
            font: "Georgia",
            size: 26,
            italics: true,
            color: MUTED,
          }),
        ],
      }),
    );
  }

  return paras;
}

function headingLevel(level: 1 | 2 | 3) {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function blocksToParagraphs(
  blocks: ManuscriptBlock[],
  chapterTitle: string,
): Paragraph[] {
  const paras: Paragraph[] = [];
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  let previous: ManuscriptBlock["type"] | null = null;

  if (!hasH1) {
    paras.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 360 },
        children: [
          new TextRun({
            text: chapterTitle,
            font: "Georgia",
            size: 32,
            bold: true,
            color: INK,
          }),
        ],
      }),
    );
    previous = "heading";
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      const size = level === 1 ? 32 : level === 2 ? 26 : 24;
      paras.push(
        new Paragraph({
          heading: headingLevel(level),
          alignment: AlignmentType.CENTER,
          spacing: {
            before: level === 1 ? 480 : 280,
            after: level === 1 ? 360 : 200,
          },
          children: [
            new TextRun({
              text: block.text,
              font: "Georgia",
              size,
              bold: level === 1,
              color: INK,
            }),
          ],
        }),
      );
    } else if (block.type === "scene-break") {
      paras.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 280, after: 280 },
          children: [
            new TextRun({
              text: "*  *  *",
              font: "Georgia",
              size: 22,
              color: MUTED,
            }),
          ],
        }),
      );
    } else if (block.type === "blockquote") {
      paras.push(
        new Paragraph({
          spacing: { before: 160, after: 160, line: 360 },
          indent: { left: convertInchesToTwip(0.4) },
          children: [
            new TextRun({
              text: block.text,
              font: "Georgia",
              size: 21,
              italics: true,
              color: MUTED,
            }),
          ],
        }),
      );
    } else {
      const indentFirst =
        previous === "paragraph" || previous === "blockquote";
      paras.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 0, line: 360 }, // 1.5 line-ish via 240*1.5
          indent: indentFirst
            ? { firstLine: convertInchesToTwip(0.3) }
            : undefined,
          children: [
            new TextRun({
              text: block.text,
              font: "Georgia",
              size: 22, // 11pt
              color: INK,
            }),
          ],
        }),
      );
    }
    previous = block.type;
  }

  return paras;
}

function chapterParagraphs(chapter: Chapter, isFirst: boolean): Paragraph[] {
  const blocks = parseChapterBlocks(chapter.content);
  const body = blocksToParagraphs(blocks, chapter.title || "Chapter");

  if (isFirst) return body;

  return [
    new Paragraph({
      children: [new PageBreak()],
    }),
    ...body,
  ];
}

export async function buildDocx(book: Book): Promise<Blob> {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();

  const children: Paragraph[] = [
    ...titlePage(title, author),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];

  book.chapters.forEach((chapter, index) => {
    children.push(...chapterParagraphs(chapter, index === 0));
  });

  const doc = new Document({
    creator: author || "Folio",
    title,
    description: "Manuscript exported from Folio",
    styles: {
      default: {
        document: {
          run: {
            font: "Georgia",
            size: 22,
            color: INK,
          },
          paragraph: {
            spacing: { line: 360 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
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

export async function exportDocx(book: Book): Promise<void> {
  const blob = await buildDocx(book);
  downloadBlob(blob, bookFilename(book, "docx"));
}
