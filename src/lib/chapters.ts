import type { Book, Chapter } from "./types";
import { createId } from "./utils";
import { createScene } from "./scenes";

/** Drop book-scoped editor data for a chapter that no longer lives in this book. */
export function stripChapterMetadataFromBook(
  book: Book,
  chapterId: string,
): Book {
  return {
    ...book,
    developmentalEditor: book.developmentalEditor
      ? {
          ...book.developmentalEditor,
          passes: book.developmentalEditor.passes.filter(
            (p) => p.chapterId !== chapterId,
          ),
        }
      : book.developmentalEditor,
    betaReaders: book.betaReaders
      ? {
          ...book.betaReaders,
          reviews: book.betaReaders.reviews.filter(
            (r) => r.chapterId !== chapterId,
          ),
          memory: book.betaReaders.memory.filter(
            (m) => m.chapterId !== chapterId,
          ),
        }
      : book.betaReaders,
    critique: book.critique
      ? {
          ...book.critique,
          reviews: book.critique.reviews.filter(
            (r) => r.chapterId !== chapterId,
          ),
          memory: book.critique.memory.filter((m) => m.chapterId !== chapterId),
        }
      : book.critique,
  };
}

/** Remove a chapter from a book without shelving it in trash. */
export function extractChapterFromBook(
  book: Book,
  chapterId: string,
): { book: Book; chapter: Chapter | null } {
  const chapter = book.chapters.find((c) => c.id === chapterId);
  if (!chapter) return { book, chapter: null };

  const extracted = structuredClone(chapter);
  let nextBook: Book;

  if (book.chapters.length <= 1) {
    const only = book.chapters[0];
    const scene = createScene({ title: "Untitled Scene", status: "outline" });
    nextBook = {
      ...book,
      chapters: [
        {
          ...only,
          title: "Chapter One",
          summary: "",
          notes: "",
          content: `<h1>Chapter One</h1><p></p>`,
          scenes: [scene],
          updatedAt: Date.now(),
        },
      ],
      activeChapterId: only.id,
      updatedAt: Date.now(),
    };
  } else {
    const chapters = book.chapters.filter((c) => c.id !== chapterId);
    const activeChapterId =
      book.activeChapterId === chapterId
        ? (chapters[0]?.id ?? book.activeChapterId)
        : book.activeChapterId;
    nextBook = {
      ...book,
      chapters,
      activeChapterId,
      updatedAt: Date.now(),
    };
  }

  return {
    book: stripChapterMetadataFromBook(nextBook, chapterId),
    chapter: extracted,
  };
}

export function insertChapterIntoBook(
  book: Book,
  chapter: Chapter,
  insertIndex?: number,
): { book: Book; chapterId: string } {
  let nextChapter = structuredClone(chapter);
  if (book.chapters.some((c) => c.id === nextChapter.id)) {
    nextChapter = { ...nextChapter, id: createId() };
  }

  const index =
    insertIndex == null
      ? book.chapters.length
      : Math.max(0, Math.min(insertIndex, book.chapters.length));

  const chapters = [
    ...book.chapters.slice(0, index),
    nextChapter,
    ...book.chapters.slice(index),
  ];

  return {
    book: { ...book, chapters, updatedAt: Date.now() },
    chapterId: nextChapter.id,
  };
}

export function moveChapterBetweenBooks(
  sourceBook: Book,
  targetBook: Book,
  chapterId: string,
  options?: { insertIndex?: number },
): { source: Book; target: Book; movedChapterId: string } | null {
  if (sourceBook.id === targetBook.id) return null;
  if (!sourceBook.seriesId || sourceBook.seriesId !== targetBook.seriesId) {
    return null;
  }

  const { book: source, chapter } = extractChapterFromBook(
    sourceBook,
    chapterId,
  );
  if (!chapter) return null;

  const { book: target, chapterId: movedChapterId } = insertChapterIntoBook(
    targetBook,
    chapter,
    options?.insertIndex,
  );

  return { source, target, movedChapterId };
}
