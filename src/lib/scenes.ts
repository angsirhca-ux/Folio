import type { Chapter, Scene, SceneStatus } from "./types";
import { createId, countWords, htmlToPlainExcerpt } from "./utils";
import {
  extractSceneHtmlAt,
  getSceneHtmlParts,
  insertSceneHtmlAt,
  isPlaceholderSceneTitle,
  joinSceneHtmlParts,
  replaceSceneHtmlAt,
  rewriteContentFromScenes,
  splitManuscriptScenes,
} from "./manuscriptScenes";

export function createScene(
  partial?: Partial<Omit<Scene, "id" | "createdAt" | "updatedAt">> & {
    id?: string;
  },
): Scene {
  const now = Date.now();
  return {
    id: partial?.id ?? createId(),
    title: partial?.title ?? "Untitled Scene",
    synopsis: partial?.synopsis ?? "",
    status: partial?.status ?? "outline",
    pov: partial?.pov ?? "",
    labels: partial?.labels ?? [],
    characters: partial?.characters ?? [],
    location: partial?.location ?? "",
    notes: partial?.notes ?? "",
    act: partial?.act ?? "",
    threadIds: partial?.threadIds ?? [],
    wordCount: partial?.wordCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Build a default scene from chapter manuscript content. */
export function sceneFromChapterContent(
  chapter: Pick<Chapter, "title" | "content" | "notes">,
): Scene {
  const words = countWords(chapter.content);
  const excerpt = htmlToPlainExcerpt(chapter.content, 160);
  return createScene({
    title:
      chapter.title && chapter.title !== "Chapter One"
        ? chapter.title
        : "Opening",
    synopsis: chapter.notes?.trim() || excerpt,
    status: words > 0 ? "draft" : "outline",
    wordCount: words,
  });
}

/**
 * Align storyboard cards with *** breaks in the manuscript.
 * One break → one extra card; cards stay in a horizontal row per chapter.
 */
export function syncScenesFromManuscript(chapter: Chapter): Chapter {
  const parts = splitManuscriptScenes(chapter.content);
  const existing = (chapter.scenes ?? []).map((s) => normalizeScene(s));

  const scenes: Scene[] = parts.map((part, i) => {
    const words = countWords(part.html);
    const prev = existing[i];
    if (prev) {
      const title = isPlaceholderSceneTitle(prev.title)
        ? part.title
        : prev.title;
      const synopsis = prev.synopsis?.trim() ? prev.synopsis : part.preview;
      return {
        ...prev,
        title,
        synopsis,
        wordCount: words,
      };
    }
    return createScene({
      title: part.title,
      synopsis: part.preview,
      status: words > 0 ? "draft" : "outline",
      wordCount: words,
    });
  });

  return { ...chapter, scenes, updatedAt: Date.now() };
}

export function ensureChapterScenes(chapter: Chapter): Chapter {
  const normalized = {
    ...chapter,
    scenes: (chapter.scenes ?? []).map((s) => normalizeScene(s)),
  };
  return syncScenesFromManuscript(normalized);
}

export function appendSceneToChapter(chapter: Chapter): Chapter {
  const parts = getSceneHtmlParts(chapter.content);
  parts.push("<p></p>");
  return syncScenesFromManuscript({
    ...chapter,
    content: joinSceneHtmlParts(parts),
  });
}

/** Write prose for one storyboard scene back into the chapter manuscript. */
export function replaceSceneHtmlInChapter(
  chapter: Chapter,
  sceneIndex: number,
  html: string,
): Chapter {
  const content = replaceSceneHtmlAt(chapter.content, sceneIndex, html);
  if (content === chapter.content) return chapter;
  return syncScenesFromManuscript({
    ...chapter,
    content,
    updatedAt: Date.now(),
  });
}

export function removeSceneFromChapter(
  chapter: Chapter,
  sceneId: string,
): Chapter {
  const index = chapter.scenes.findIndex((s) => s.id === sceneId);
  if (index < 0) return chapter;

  const parts = getSceneHtmlParts(chapter.content);
  if (parts.length <= 1) {
    const h1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.exec(chapter.content)?.[0];
    const content = h1 ? `${h1}<p></p>` : "<p></p>";
    return syncScenesFromManuscript({
      ...chapter,
      content,
      scenes: [],
    });
  }

  parts.splice(index, 1);
  const remaining = chapter.scenes.filter((s) => s.id !== sceneId);
  return syncScenesFromManuscript({
    ...chapter,
    content: joinSceneHtmlParts(parts),
    scenes: remaining,
  });
}

export function reorderScenesInChapter(
  chapter: Chapter,
  fromIndex: number,
  toIndex: number,
): Chapter {
  const content = rewriteContentFromScenes(
    chapter.content,
    fromIndex,
    toIndex,
  );
  const scenes = [...chapter.scenes];
  const [moved] = scenes.splice(fromIndex, 1);
  if (!moved) return chapter;
  scenes.splice(toIndex, 0, moved);
  return syncScenesFromManuscript({ ...chapter, content, scenes });
}

export function moveSceneBetweenChapters(
  chapters: Chapter[],
  sceneId: string,
  toChapterId: string,
  toIndex: number,
): Chapter[] {
  const found = findScene(chapters, sceneId);
  if (!found) return chapters;

  if (found.chapter.id === toChapterId) {
    return chapters.map((c) =>
      c.id === toChapterId
        ? reorderScenesInChapter(c, found.sceneIndex, toIndex)
        : c,
    );
  }

  const extracted = extractSceneHtmlAt(
    found.chapter.content,
    found.sceneIndex,
  );
  if (!extracted) return chapters;

  return chapters.map((c) => {
    if (c.id === found.chapter.id) {
      const scenes = c.scenes.filter((s) => s.id !== sceneId);
      return syncScenesFromManuscript({
        ...c,
        content: extracted.rest,
        scenes,
      });
    }
    if (c.id === toChapterId) {
      const content = insertSceneHtmlAt(c.content, extracted.part, toIndex);
      const scenes = [...c.scenes];
      const clamped = Math.max(0, Math.min(toIndex, scenes.length));
      scenes.splice(clamped, 0, {
        ...found.scene,
        updatedAt: Date.now(),
      });
      return syncScenesFromManuscript({ ...c, content, scenes });
    }
    return c;
  });
}

export function normalizeScene(s: Partial<Scene> & { id: string }): Scene {
  const legacyStatus = s.status as string | undefined;
  const status: SceneStatus =
    legacyStatus === "writing" ||
    legacyStatus === "outline" ||
    legacyStatus === "draft" ||
    legacyStatus === "revising" ||
    legacyStatus === "final"
      ? legacyStatus
      : "outline";

  return {
    id: s.id,
    title: s.title ?? "Untitled Scene",
    synopsis: s.synopsis ?? "",
    status,
    pov: s.pov ?? "",
    labels: s.labels ?? [],
    characters: s.characters ?? [],
    location: s.location ?? "",
    notes: s.notes ?? "",
    act: s.act ?? "",
    threadIds: Array.isArray(s.threadIds) ? s.threadIds : [],
    wordCount: s.wordCount ?? 0,
    createdAt: s.createdAt ?? Date.now(),
    updatedAt: s.updatedAt ?? Date.now(),
  };
}

export function findScene(
  chapters: Chapter[],
  sceneId: string,
): {
  chapter: Chapter;
  scene: Scene;
  chapterIndex: number;
  sceneIndex: number;
} | null {
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    const si = chapter.scenes.findIndex((s) => s.id === sceneId);
    if (si >= 0) {
      return {
        chapter,
        scene: chapter.scenes[si],
        chapterIndex: ci,
        sceneIndex: si,
      };
    }
  }
  return null;
}

export function formatRelativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function chapterWordCount(chapter: Chapter): number {
  return chapter.scenes.reduce((sum, s) => sum + (s.wordCount || 0), 0);
}

export function chapterProgress(chapter: Chapter): number {
  const scenes = chapter.scenes;
  if (scenes.length === 0) return 0;
  const weights: Record<SceneStatus, number> = {
    outline: 0.1,
    draft: 0.35,
    writing: 0.55,
    revising: 0.8,
    final: 1,
  };
  const total = scenes.reduce((sum, s) => sum + weights[s.status], 0);
  return total / scenes.length;
}
