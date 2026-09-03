import type { Book } from "@/lib/types";
import {
  chaptersForCompile,
  frontMatterSections,
  partDividerForChapter,
  type CompileOptions,
} from "./compile";
import {
  chapterToXhtmlBody,
  escapeXml,
  frontMatterSectionToXhtml,
  partDividerXhtml,
} from "./manuscript";

export type BookPreviewSection = {
  id: string;
  title: string;
  html: string;
  kind: "title" | "front" | "part" | "chapter";
};

export function buildBookPreviewSections(
  book: Book,
  options: CompileOptions,
): BookPreviewSection[] {
  const sections: BookPreviewSection[] = [];
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim();
  const chapters = chaptersForCompile(book, options);

  if (options.includeTitlePage) {
    sections.push({
      id: "title-page",
      title: title,
      kind: "title",
      html: `<section class="title-page" epub:type="titlepage">
  <h1>${escapeXml(title)}</h1>
  <p class="ornament">* * *</p>
  ${author ? `<p class="author">${escapeXml(author)}</p>` : ""}
</section>`,
    });
  }

  for (const fm of frontMatterSections(book, options)) {
    sections.push({
      id: `front-${fm.id}`,
      title: fm.title,
      kind: "front",
      html: frontMatterSectionToXhtml(fm),
    });
  }

  chapters.forEach((chapter, index) => {
    const part = partDividerForChapter(chapters, index);
    if (part) {
      sections.push({
        id: `part-${chapter.id}`,
        title: part,
        kind: "part",
        html: partDividerXhtml(part),
      });
    }

    const pageBreak =
      chapter.compile?.pageBreakBefore && (index > 0 || sections.length > 0);
    const body = chapterToXhtmlBody(chapter, {
      sceneBreak: options.sceneBreak,
      suppressTitle: chapter.compile?.suppressTitle,
    });

    sections.push({
      id: chapter.id,
      title: chapter.title?.trim() || `Chapter ${index + 1}`,
      kind: "chapter",
      html: `<section class="book-chapter${pageBreak ? " page-break-before" : ""}" id="chapter-${escapeXml(chapter.id)}">${body}</section>`,
    });
  });

  return sections;
}

export function buildBookPreviewDocument(
  book: Book,
  options: CompileOptions,
): string {
  return buildBookPreviewSections(book, options)
    .map((s) => s.html)
    .join("\n\n");
}
