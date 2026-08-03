import type { ImportBlock } from "./types";

const CHAPTER_HEADING =
  /^(chapter|chap\.?|ch\.?)\s+([0-9]+|[ivxlcdm]+|[a-z]+)(\b|[.:—–\-])/i;

const CHAPTER_BARE = /^(chapter|chap\.?|ch\.?)\s*$/i;

const PART_HEADING =
  /^(part|book|prologue|epilogue|preface|introduction|afterword|acknowledgements|acknowledgments|foreword|interlude|coda)\b/i;

const NUMBERED_TITLE =
  /^([0-9]{1,3}|[ivxlcdm]{1,8})([.:\)—–\-]|(\s+[—–\-]))\s+\S+/i;

const NUMBER_ONLY = /^([0-9]{1,3}|[ivxlcdm]{1,6})\.?$/i;

/** True when a line should start a new Folio chapter. */
export function isChapterHeading(text: string, level?: number): boolean {
  const t = normalizeHeadingText(text);
  if (!t || t.length > 140) return false;

  // Explicit H1 always opens a chapter
  if (level === 1) return true;

  if (CHAPTER_HEADING.test(t) || CHAPTER_BARE.test(t)) return true;
  if (PART_HEADING.test(t) && t.split(/\s+/).length <= 12) return true;

  // "1. The Beginning" / "I — Winter"
  if (NUMBERED_TITLE.test(t) && t.split(/\s+/).length <= 14) return true;

  // Lone chapter numbers when styled as a heading
  if (level !== undefined && level <= 2 && NUMBER_ONLY.test(t)) return true;

  // Short ALL-CAPS literary titles
  if (
    level !== 3 &&
    t.length >= 3 &&
    t.length <= 72 &&
    /^[A-Z0-9][A-Z0-9\s'’"“”.,:;!?&—–\-]+$/.test(t) &&
    /[A-Z]/.test(t) &&
    t.split(/\s+/).length <= 10 &&
    !/[a-z]/.test(t)
  ) {
    return true;
  }

  return false;
}

export function isSceneBreakLine(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  return (
    t === "* * *" ||
    t === "***" ||
    t === "• • •" ||
    t === "⁂" ||
    t === "#" ||
    t === "##" ||
    /^(\*\s*){3,}$/.test(t) ||
    /^(-{3,}|\.{3,}|_{3,}|=+)$/.test(t)
  );
}

export function normalizeHeadingText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Promote plain paragraphs that look like chapter titles into H1 headings.
 * Many Word/ODT manuscripts bold a "Chapter 1" line without a real heading style.
 */
export function promoteChapterParagraphs(
  blocks: ImportBlock[],
): ImportBlock[] {
  return blocks.map((block) => {
    if (block.type !== "paragraph") return block;
    const t = normalizeHeadingText(block.text);
    if (!t || t.length > 100) return block;
    // Only promote short, chapter-like lines — not full sentences
    if (t.includes(". ") || t.length > 90) return block;
    if (!isChapterHeading(t)) return block;
    return { type: "heading", level: 1 as const, text: t };
  });
}

/**
 * If a manuscript uses H2 for chapters and has no H1s, elevate chapter-like H2s.
 */
export function elevateChapterHeadings(
  blocks: ImportBlock[],
): ImportBlock[] {
  const hasH1 = blocks.some((b) => b.type === "heading" && b.level === 1);
  if (hasH1) return blocks;

  const h2Count = blocks.filter(
    (b) => b.type === "heading" && b.level === 2,
  ).length;
  if (h2Count < 2) return blocks;

  return blocks.map((block) => {
    if (block.type !== "heading" || block.level !== 2) return block;
    if (isChapterHeading(block.text, 2) || h2Count >= 2) {
      // When there are multiple H2s and no H1s, treat H2s as chapter breaks
      return { ...block, level: 1 as const };
    }
    return block;
  });
}

/**
 * Split a flat block list into chapters on chapter-level headings.
 * Leading prose before the first chapter heading becomes "Opening".
 */
export function splitBlocksIntoChapters(
  blocks: ImportBlock[],
): { title: string; blocks: ImportBlock[] }[] {
  if (blocks.length === 0) {
    return [{ title: "Chapter One", blocks: [] }];
  }

  const normalized = elevateChapterHeadings(promoteChapterParagraphs(blocks));

  const chapters: { title: string; blocks: ImportBlock[] }[] = [];
  let currentTitle = "Opening";
  let current: ImportBlock[] = [];
  let started = false;

  const flush = () => {
    const meaningful = current.some(
      (b) =>
        b.type === "paragraph" ||
        b.type === "blockquote" ||
        b.type === "heading",
    );
    if (!meaningful && chapters.length === 0 && !started) return;
    if (!meaningful && current.length === 0) return;

    const body = [...current];
    const hasOwnH1 = body.some((b) => b.type === "heading" && b.level === 1);
    if (!hasOwnH1) {
      body.unshift({ type: "heading", level: 1, text: currentTitle });
    }
    chapters.push({ title: currentTitle, blocks: body });
  };

  for (const block of normalized) {
    const opensChapter =
      block.type === "heading" && isChapterHeading(block.text, block.level);

    if (opensChapter) {
      if (started || current.length > 0) flush();
      currentTitle =
        normalizeHeadingText(block.text) || `Chapter ${chapters.length + 1}`;
      current = [{ type: "heading", level: 1, text: currentTitle }];
      started = true;
      continue;
    }

    if (block.type === "heading") {
      const level = Math.min(3, Math.max(2, block.level ?? 2)) as 2 | 3;
      current.push({ ...block, level });
    } else {
      current.push(block);
    }
  }

  flush();

  if (
    chapters.length > 1 &&
    chapters[0].title === "Opening" &&
    !chapters[0].blocks.some(
      (b) => b.type === "paragraph" || b.type === "blockquote",
    )
  ) {
    chapters.shift();
  }

  if (chapters.length === 0) {
    return [
      {
        title: "Chapter One",
        blocks: [
          { type: "heading", level: 1, text: "Chapter One" },
          ...normalized.filter((b) => !(b.type === "heading" && b.level === 1)),
        ],
      },
    ];
  }

  if (chapters.length === 1 && chapters[0].title === "Opening") {
    chapters[0].title = "Chapter One";
    const h = chapters[0].blocks.find(
      (b) => b.type === "heading" && b.level === 1,
    );
    if (h) h.text = "Chapter One";
  }

  return chapters;
}

export function blocksToHtml(blocks: ImportBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const escaped = escapeHtml(block.text);
    if (block.type === "heading") {
      const level = block.level ?? 1;
      parts.push(`<h${level}>${escaped}</h${level}>`);
    } else if (block.type === "scene-break") {
      parts.push(`<p class="scene-break">* * *</p>`);
    } else if (block.type === "blockquote") {
      parts.push(`<blockquote><p>${escaped}</p></blockquote>`);
    } else if (block.text.trim()) {
      parts.push(`<p>${escaped}</p>`);
    }
  }
  return parts.join("") || "<p></p>";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function titleFromFilename(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled Manuscript"
  );
}
