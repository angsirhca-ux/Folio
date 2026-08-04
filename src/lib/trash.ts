import type {
  Book,
  Chapter,
  Character,
  Location,
  ResearchEntry,
  TrashItem,
  TrashKind,
  TrashPayload,
  TrashedBook,
} from "./types";
import { createId } from "./utils";
import { insertSceneHtmlAt, extractSceneHtmlAt } from "./manuscriptScenes";
import {
  createScene,
  findScene,
  removeSceneFromChapter,
  syncScenesFromManuscript,
} from "./scenes";
import { pruneCharacterFromFamilyTrees } from "./familyTrees";

export function createTrashItem(
  partial: {
    kind: TrashKind;
    title: string;
    subtitle?: string;
    payload: TrashPayload;
    deletedAt?: number;
    id?: string;
  },
): TrashItem {
  return {
    id: partial.id ?? createId(),
    kind: partial.kind,
    title: partial.title.trim() || "Untitled",
    subtitle: partial.subtitle ?? "",
    deletedAt: partial.deletedAt ?? Date.now(),
    payload: partial.payload,
  };
}

export function ensureBookTrash(
  book: Omit<Book, "trash" | "developmentalEditor" | "betaReaders" | "dump"> & {
    trash?: TrashItem[];
    developmentalEditor?: Book["developmentalEditor"];
    betaReaders?: Book["betaReaders"];
    critique?: Book["critique"];
    dump?: Book["dump"];
  },
): Book {
  return {
    ...book,
    trash: Array.isArray(book.trash) ? book.trash : [],
    developmentalEditor: book.developmentalEditor ?? {
      memory: [],
      passes: [],
    },
    betaReaders: book.betaReaders ?? {
      readers: [],
      memory: [],
      reviews: [],
    },
    critique: book.critique ?? {
      memory: [],
      reviews: [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
  };
}

export function bookWordCount(book: Book): number {
  return book.chapters.reduce((sum, ch) => {
    const text = ch.content
      .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return sum;
    return sum + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

export function bookSceneCount(book: Book): number {
  return book.chapters.reduce((n, ch) => n + (ch.scenes?.length ?? 0), 0);
}

export function trashSceneFromBook(book: Book, sceneId: string): Book {
  const found = findScene(book.chapters, sceneId);
  if (!found) return book;

  const extracted = extractSceneHtmlAt(
    found.chapter.content,
    found.sceneIndex,
  );
  const item = createTrashItem({
    kind: "scene",
    title: found.scene.title || "Untitled scene",
    subtitle: found.chapter.title,
    payload: {
      kind: "scene",
      scene: found.scene,
      html: extracted?.part ?? "<p></p>",
      chapterId: found.chapter.id,
      chapterTitle: found.chapter.title,
      sceneIndex: found.sceneIndex,
    },
  });

  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    chapters: book.chapters.map((c) =>
      c.scenes.some((s) => s.id === sceneId)
        ? removeSceneFromChapter(c, sceneId)
        : c,
    ),
    updatedAt: Date.now(),
  };
}

/**
 * Soft-delete a chapter. The last chapter is cleared in place but its prior
 * content is still shelved in trash so it can be recovered.
 */
export function trashChapterFromBook(book: Book, chapterId: string): Book {
  const chapter = book.chapters.find((c) => c.id === chapterId);
  if (!chapter) return book;

  const item = createTrashItem({
    kind: "chapter",
    title: chapter.title || "Untitled chapter",
    subtitle: `${chapter.scenes?.length ?? 0} scene${(chapter.scenes?.length ?? 0) === 1 ? "" : "s"}`,
    payload: { kind: "chapter", chapter: structuredClone(chapter) },
  });

  if (book.chapters.length <= 1) {
    const only = book.chapters[0];
    const scene = createScene({ title: "Untitled Scene", status: "outline" });
    return {
      ...book,
      trash: [item, ...(book.trash ?? [])],
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
  }

  const chapters = book.chapters.filter((c) => c.id !== chapterId);
  const activeChapterId =
    book.activeChapterId === chapterId
      ? chapters[0].id
      : book.activeChapterId;

  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    chapters,
    activeChapterId,
    updatedAt: Date.now(),
  };
}

export function trashCharacterFromBook(
  book: Book,
  characterId: string,
): Book {
  const character = (book.characters ?? []).find((c) => c.id === characterId);
  if (!character) return book;
  const item = createTrashItem({
    kind: "character",
    title: character.name || "Unnamed",
    subtitle: character.shortBio || character.role,
    payload: { kind: "character", character: structuredClone(character) },
  });
  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    characters: (book.characters ?? []).filter((c) => c.id !== characterId),
    familyTrees: pruneCharacterFromFamilyTrees(
      book.familyTrees ?? [],
      characterId,
    ),
    updatedAt: Date.now(),
  };
}

export function trashLocationFromBook(book: Book, locationId: string): Book {
  const location = (book.locations ?? []).find((l) => l.id === locationId);
  if (!location) return book;
  const item = createTrashItem({
    kind: "location",
    title: location.name || "Unnamed",
    subtitle: location.shortBio || location.kind,
    payload: { kind: "location", location: structuredClone(location) },
  });
  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    locations: (book.locations ?? []).filter((l) => l.id !== locationId),
    updatedAt: Date.now(),
  };
}

export function trashResearchFromBook(book: Book, entryId: string): Book {
  const entry = (book.research ?? []).find((e) => e.id === entryId);
  if (!entry) return book;
  const item = createTrashItem({
    kind: "research",
    title: entry.title || "Untitled",
    subtitle: entry.shortBio || entry.kind,
    payload: { kind: "research", entry: structuredClone(entry) },
  });
  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    research: (book.research ?? []).filter((e) => e.id !== entryId),
    updatedAt: Date.now(),
  };
}

export function trashEncyclopediaFromBook(book: Book, entryId: string): Book {
  const entry = (book.encyclopedia ?? []).find((e) => e.id === entryId);
  if (!entry) return book;
  const item = createTrashItem({
    kind: "encyclopedia",
    title: entry.title || "Untitled",
    subtitle:
      entry.shortBio ||
      (book.encyclopediaStacks ?? []).find((s) => s.id === entry.stackId)?.name ||
      "Encyclopedia",
    payload: { kind: "encyclopedia", entry: structuredClone(entry) },
  });
  return {
    ...book,
    trash: [item, ...(book.trash ?? [])],
    encyclopedia: (book.encyclopedia ?? []).filter((e) => e.id !== entryId),
    updatedAt: Date.now(),
  };
}

function restoreScene(book: Book, item: TrashItem): Book {
  const payload = item.payload;
  if (payload.kind !== "scene") return book;

  const targetExists = book.chapters.some((c) => c.id === payload.chapterId);

  if (targetExists) {
    return {
      ...book,
      chapters: book.chapters.map((c) => {
        if (c.id !== payload.chapterId) return c;
        const insertAt = Math.min(payload.sceneIndex, c.scenes.length);
        const content = insertSceneHtmlAt(c.content, payload.html, insertAt);
        const scenes = [...c.scenes];
        scenes.splice(insertAt, 0, {
          ...payload.scene,
          updatedAt: Date.now(),
        });
        return syncScenesFromManuscript({ ...c, content, scenes });
      }),
      trash: (book.trash ?? []).filter((t) => t.id !== item.id),
      updatedAt: Date.now(),
    };
  }

  const targetId = book.activeChapterId || book.chapters[0]?.id;
  if (!targetId) return book;

  return {
    ...book,
    chapters: book.chapters.map((c) => {
      if (c.id !== targetId) return c;
      const content = insertSceneHtmlAt(
        c.content,
        payload.html,
        c.scenes.length,
      );
      const scenes = [
        ...c.scenes,
        { ...payload.scene, updatedAt: Date.now() },
      ];
      return syncScenesFromManuscript({ ...c, content, scenes });
    }),
    trash: (book.trash ?? []).filter((t) => t.id !== item.id),
    updatedAt: Date.now(),
  };
}

function restoreChapter(book: Book, item: TrashItem): Book {
  const payload = item.payload;
  if (payload.kind !== "chapter") return book;
  let chapter: Chapter = {
    ...payload.chapter,
    updatedAt: Date.now(),
  };

  const existingIdx = book.chapters.findIndex((c) => c.id === chapter.id);
  if (existingIdx >= 0 && book.chapters.length === 1) {
    const chapters = [...book.chapters];
    chapters[existingIdx] = chapter;
    return {
      ...book,
      chapters,
      activeChapterId: chapter.id,
      trash: (book.trash ?? []).filter((t) => t.id !== item.id),
      updatedAt: Date.now(),
    };
  }
  if (book.chapters.some((c) => c.id === chapter.id)) {
    chapter = { ...chapter, id: createId() };
  }
  return {
    ...book,
    chapters: [...book.chapters, chapter],
    activeChapterId: chapter.id,
    trash: (book.trash ?? []).filter((t) => t.id !== item.id),
    updatedAt: Date.now(),
  };
}

export function restoreTrashItem(book: Book, itemId: string): Book {
  const item = (book.trash ?? []).find((t) => t.id === itemId);
  if (!item) return book;

  switch (item.payload.kind) {
    case "scene":
      return restoreScene(book, item);
    case "chapter":
      return restoreChapter(book, item);
    case "character": {
      const character = item.payload.character;
      const exists = (book.characters ?? []).some((c) => c.id === character.id);
      return {
        ...book,
        characters: exists
          ? book.characters
          : [...(book.characters ?? []), character],
        trash: (book.trash ?? []).filter((t) => t.id !== itemId),
        updatedAt: Date.now(),
      };
    }
    case "location": {
      const location = item.payload.location;
      const exists = (book.locations ?? []).some((l) => l.id === location.id);
      return {
        ...book,
        locations: exists
          ? book.locations
          : [...(book.locations ?? []), location],
        trash: (book.trash ?? []).filter((t) => t.id !== itemId),
        updatedAt: Date.now(),
      };
    }
    case "research": {
      const entry = item.payload.entry;
      const exists = (book.research ?? []).some((e) => e.id === entry.id);
      return {
        ...book,
        research: exists ? book.research : [...(book.research ?? []), entry],
        trash: (book.trash ?? []).filter((t) => t.id !== itemId),
        updatedAt: Date.now(),
      };
    }
    case "encyclopedia": {
      const entry = item.payload.entry;
      const exists = (book.encyclopedia ?? []).some((e) => e.id === entry.id);
      return {
        ...book,
        encyclopedia: exists
          ? book.encyclopedia
          : [...(book.encyclopedia ?? []), entry],
        trash: (book.trash ?? []).filter((t) => t.id !== itemId),
        updatedAt: Date.now(),
      };
    }
    default:
      return book;
  }
}

export function purgeTrashItem(book: Book, itemId: string): Book {
  return {
    ...book,
    trash: (book.trash ?? []).filter((t) => t.id !== itemId),
    updatedAt: Date.now(),
  };
}

export function emptyBookTrash(book: Book): Book {
  if (!(book.trash ?? []).length) return book;
  return { ...book, trash: [], updatedAt: Date.now() };
}

export function createTrashedBook(book: Book): TrashedBook {
  return {
    id: createId(),
    deletedAt: Date.now(),
    book: structuredClone(book),
  };
}
