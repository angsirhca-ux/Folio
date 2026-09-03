import type { Book, BookCompileSettings, BookFrontMatter, Chapter } from "@/lib/types";
import { countWords } from "@/lib/utils";
import type { ManuscriptBlock } from "./manuscript";

/** How scene breaks appear in the compiled file. */
export type SceneBreakStyle = "asterisks" | "blank" | "hash" | "none";

/** High-level compile intent — sets sensible defaults; user can still tweak. */
export type CompilePreset = "reading" | "submission";

export type CompileOptions = {
  preset: CompilePreset;
  /** Included chapters, in book order (ids only). Empty = nothing ships. */
  chapterIds: string[];
  includeTitlePage: boolean;
  /** EPUB contents list (ignored by other formats). */
  includeToc: boolean;
  sceneBreak: SceneBreakStyle;
  includeDedication: boolean;
  includeCopyright: boolean;
  includeEpigraph: boolean;
};

export type FrontMatterSection = {
  id: "dedication" | "copyright" | "epigraph";
  title: string;
  paragraphs: string[];
  attribution?: string;
  variant?: "copyright";
};

export const SCENE_BREAK_OPTIONS: Array<{
  id: SceneBreakStyle;
  label: string;
  hint: string;
}> = [
  {
    id: "asterisks",
    label: "* * *",
    hint: "Ornamental — reading copies",
  },
  {
    id: "blank",
    label: "Blank line",
    hint: "Quiet gap between scenes",
  },
  {
    id: "hash",
    label: "#",
    hint: "Submission / agent style",
  },
  {
    id: "none",
    label: "Omit",
    hint: "Drop scene breaks entirely",
  },
];

export const COMPILE_PRESETS: Array<{
  id: CompilePreset;
  label: string;
  description: string;
}> = [
  {
    id: "reading",
    label: "Reading copy",
    description: "Title page, ornamental breaks — for you, betas, or an ebook.",
  },
  {
    id: "submission",
    label: "Submission draft",
    description:
      "Lean front matter, # scene breaks — Word uses standard manuscript styling.",
  },
];

export function allChapterIds(book: Book): string[] {
  return book.chapters.map((c) => c.id);
}

export function chaptersForCompile(
  book: Book,
  options: CompileOptions,
): Chapter[] {
  const want = new Set(options.chapterIds);
  return book.chapters.filter(
    (c) => want.has(c.id) && !c.compile?.omitFromExport,
  );
}

export function chapterIdsForCompile(book: Book): string[] {
  return book.chapters
    .filter((c) => !c.compile?.omitFromExport)
    .map((c) => c.id);
}

export function defaultCompileOptions(book: Book): CompileOptions {
  return {
    preset: "reading",
    chapterIds: chapterIdsForCompile(book),
    includeTitlePage: true,
    includeToc: true,
    sceneBreak: "asterisks",
    includeDedication: false,
    includeCopyright: false,
    includeEpigraph: false,
  };
}

/** Merge persisted book settings with current chapter list. */
export function compileOptionsForBook(book: Book): CompileOptions {
  const base = defaultCompileOptions(book);
  const saved = book.compileSettings;
  if (!saved) return base;

  return {
    preset: saved.preset ?? base.preset,
    chapterIds: base.chapterIds,
    includeTitlePage: saved.includeTitlePage ?? base.includeTitlePage,
    includeToc: saved.includeToc ?? base.includeToc,
    sceneBreak: saved.sceneBreak ?? base.sceneBreak,
    includeDedication: saved.includeDedication ?? base.includeDedication,
    includeCopyright: saved.includeCopyright ?? base.includeCopyright,
    includeEpigraph: saved.includeEpigraph ?? base.includeEpigraph,
  };
}

/** Persistable subset — chapter ids refreshed when dialog opens. */
export function compileSettingsFromOptions(
  options: CompileOptions,
): BookCompileSettings {
  return {
    preset: options.preset,
    includeTitlePage: options.includeTitlePage,
    includeToc: options.includeToc,
    sceneBreak: options.sceneBreak,
    includeDedication: options.includeDedication,
    includeCopyright: options.includeCopyright,
    includeEpigraph: options.includeEpigraph,
  };
}

export function emptyFrontMatter(): BookFrontMatter {
  return {};
}

function paragraphsFromText(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Front-matter sections to render before chapter spine. */
export function frontMatterSections(
  book: Book,
  options: CompileOptions,
): FrontMatterSection[] {
  const fm = book.frontMatter ?? {};
  const sections: FrontMatterSection[] = [];

  if (options.includeEpigraph) {
    const paragraphs = paragraphsFromText(fm.epigraph);
    if (paragraphs.length) {
      sections.push({
        id: "epigraph",
        title: "Epigraph",
        paragraphs,
        attribution: fm.epigraphAttribution?.trim() || undefined,
      });
    }
  }

  if (options.includeDedication) {
    const paragraphs = paragraphsFromText(fm.dedication);
    if (paragraphs.length) {
      sections.push({
        id: "dedication",
        title: "Dedication",
        paragraphs,
      });
    }
  }

  if (options.includeCopyright) {
    const paragraphs = paragraphsFromText(fm.copyright);
    if (paragraphs.length) {
      sections.push({
        id: "copyright",
        title: "Copyright",
        paragraphs,
        variant: "copyright",
      });
    }
  }

  return sections;
}

/** Apply a preset while keeping the current chapter selection. */
export function applyCompilePreset(
  preset: CompilePreset,
  current: CompileOptions,
): CompileOptions {
  if (preset === "submission") {
    return {
      ...current,
      preset,
      includeTitlePage: true,
      includeToc: false,
      sceneBreak: "hash",
      includeDedication: false,
      includeCopyright: false,
      includeEpigraph: false,
    };
  }
  return {
    ...current,
    preset,
    includeTitlePage: true,
    includeToc: true,
    sceneBreak: "asterisks",
  };
}

/** Whether to show a part divider before this chapter in compile order. */
export function partDividerForChapter(
  chapters: Chapter[],
  index: number,
): string | null {
  const label = chapters[index]?.compile?.partLabel?.trim();
  if (!label) return null;
  const prev = index > 0 ? chapters[index - 1]?.compile?.partLabel?.trim() : null;
  if (prev === label) return null;
  return label;
}

export function compileWordCount(book: Book, options: CompileOptions): number {
  return chaptersForCompile(book, options).reduce(
    (n, c) => n + countWords(c.content ?? ""),
    0,
  );
}

export function sceneBreakText(style: SceneBreakStyle): string | null {
  if (style === "asterisks") return "* * *";
  if (style === "hash") return "#";
  if (style === "blank") return "";
  return null;
}

/** Rewrite scene-break blocks according to compile options. */
export function applySceneBreakStyle(
  blocks: ManuscriptBlock[],
  style: SceneBreakStyle,
): ManuscriptBlock[] {
  if (style === "asterisks") {
    return blocks.map((b) =>
      b.type === "scene-break" ? { ...b, text: "* * *" } : b,
    );
  }
  if (style === "hash") {
    return blocks.map((b) =>
      b.type === "scene-break" ? { ...b, text: "#" } : b,
    );
  }
  if (style === "blank") {
    return blocks.map((b) =>
      b.type === "scene-break" ? { ...b, text: "" } : b,
    );
  }
  // none — drop
  return blocks.filter((b) => b.type !== "scene-break");
}
