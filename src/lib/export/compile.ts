import type { Book, Chapter } from "@/lib/types";
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

export function defaultCompileOptions(book: Book): CompileOptions {
  return {
    preset: "reading",
    chapterIds: allChapterIds(book),
    includeTitlePage: true,
    includeToc: true,
    sceneBreak: "asterisks",
  };
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

export function chaptersForCompile(
  book: Book,
  options: CompileOptions,
): Chapter[] {
  const want = new Set(options.chapterIds);
  return book.chapters.filter((c) => want.has(c.id));
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
