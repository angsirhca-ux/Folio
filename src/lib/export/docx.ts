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
  defaultCompileOptions,
  type CompileOptions,
} from "./compile";
import {
  bookFilename,
  downloadBlob,
  parseChapterBlocks,
  type ManuscriptBlock,
} from "./manuscript";

const INK = "2D2A26";
const MUTED = "6B645C";
const ACCENT = "B08D57";

function titlePageReading(title: string, author: string): Paragraph[] {
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
          size: 48,
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

function blocksToParagraphs(
  blocks: ManuscriptBlock[],
  chapterTitle: string,
  options: CompileOptions,
): Paragraph[] {
  const submission = options.preset === "submission";
  const font = submission ? "Times New Roman" : "Georgia";
  const bodySize = submission ? 24 : 22; // 12pt vs 11pt
  const line = submission ? 480 : 360; // double vs ~1.5
  const paras: Paragraph[] = [];
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  let previous: ManuscriptBlock["type"] | null = null;

  if (!hasH1) {
    paras.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: submission ? 0 : 480, after: 360, line },
        children: [
          new TextRun({
            text: chapterTitle,
            font,
            size: submission ? 24 : 32,
            bold: !submission,
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
      const size = submission ? 24 : level === 1 ? 32 : level === 2 ? 26 : 24;
      paras.push(
        new Paragraph({
          heading: headingLevel(level),
          alignment: AlignmentType.CENTER,
          spacing: {
            before: level === 1 ? (submission ? 0 : 480) : 280,
            after: level === 1 ? 360 : 200,
            line,
          },
          children: [
            new TextRun({
              text: block.text,
              font,
              size,
              bold: !submission && level === 1,
              color: INK,
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
                  color: submission ? INK : MUTED,
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
          children: [
            new TextRun({
              text: block.text,
              font,
              size: submission ? 24 : 21,
              italics: true,
              color: submission ? INK : MUTED,
            }),
          ],
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
          children: [
            new TextRun({
              text: block.text,
              font,
              size: bodySize,
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

function chapterParagraphs(
  chapter: Chapter,
  isFirst: boolean,
  options: CompileOptions,
): Paragraph[] {
  const blocks = applySceneBreakStyle(
    parseChapterBlocks(chapter.content),
    options.sceneBreak,
  );
  const body = blocksToParagraphs(
    blocks,
    chapter.title || "Chapter",
    options,
  );

  if (isFirst) return body;

  return [
    new Paragraph({
      children: [new PageBreak()],
    }),
    ...body,
  ];
}

export async function buildDocx(
  book: Book,
  options: CompileOptions = defaultCompileOptions(book),
): Promise<Blob> {
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const chapters = chaptersForCompile(book, options);
  const submission = options.preset === "submission";

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

  chapters.forEach((chapter, index) => {
    children.push(...chapterParagraphs(chapter, index === 0, options));
  });

  const doc = new Document({
    creator: author || "Folio",
    title,
    description: "Manuscript exported from Folio",
    styles: {
      default: {
        document: {
          run: {
            font: submission ? "Times New Roman" : "Georgia",
            size: submission ? 24 : 22,
            color: INK,
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
  const opts = options ?? defaultCompileOptions(book);
  const blob = await buildDocx(book, opts);
  downloadBlob(blob, bookFilename(book, "docx"));
}
