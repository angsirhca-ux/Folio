export interface ImportBlock {
  type: "heading" | "paragraph" | "scene-break" | "blockquote";
  level?: 1 | 2 | 3;
  text: string;
}

export interface ImportChapterDraft {
  title: string;
  blocks: ImportBlock[];
}

export interface ParsedManuscript {
  title: string;
  author: string;
  chapters: ImportChapterDraft[];
  sourceName: string;
}
