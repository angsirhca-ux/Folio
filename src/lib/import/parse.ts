import type { Book, Chapter } from "@/lib/types";
import { createId } from "@/lib/storage";
import { emptyStoryMap } from "@/lib/map";
import { emptyGoals } from "@/lib/goals";
import { ensureChapterScenes } from "@/lib/scenes";
import { docxToBlocks } from "./docx";
import { epubToBlocks } from "./epub";
import { htmlToBlocks } from "./html";
import { odtToBlocks } from "./odt";
import {
  blocksToHtml,
  splitBlocksIntoChapters,
  titleFromFilename,
} from "./split";
import { normalizeChapters, normalizeImportBlocks, cleanHeadingText } from "./normalize";
import { textToBlocks } from "./text";
import type { ParsedManuscript } from "./types";

const SUPPORTED =
  /\.(txt|md|markdown|docx|odt|otd|html?|epub)$/i;

export function isSupportedManuscript(file: File): boolean {
  return SUPPORTED.test(file.name) || guessByMime(file.type) !== null;
}

function guessByMime(mime: string): string | null {
  if (mime === "text/plain") return "txt";
  if (mime === "text/markdown") return "md";
  if (mime === "text/html") return "html";
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (
    mime === "application/vnd.oasis.opendocument.text" ||
    mime === "application/x-vnd.oasis.opendocument.text"
  )
    return "odt";
  if (mime === "application/epub+zip") return "epub";
  return null;
}

function extensionOf(file: File): string {
  const fromName = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase();
  if (fromName) {
    if (fromName === "markdown") return "md";
    if (fromName === "otd") return "odt"; // common typo / alias
    return fromName;
  }
  return guessByMime(file.type) ?? "";
}

export async function parseManuscriptFile(
  file: File,
): Promise<ParsedManuscript> {
  const ext = extensionOf(file);
  const sourceName = file.name;
  let title = titleFromFilename(file.name);
  let author = "";
  let blocks;

  if (ext === "docx") {
    blocks = await docxToBlocks(await file.arrayBuffer());
  } else if (ext === "odt") {
    const parsed = await odtToBlocks(await file.arrayBuffer());
    blocks = parsed.blocks;
    if (parsed.title) title = parsed.title;
    if (parsed.author) author = parsed.author;
  } else if (ext === "epub") {
    const parsed = await epubToBlocks(await file.arrayBuffer());
    blocks = parsed.blocks;
    if (parsed.title) title = parsed.title;
    if (parsed.author) author = parsed.author;
  } else if (ext === "html" || ext === "htm") {
    const html = await file.text();
    blocks = htmlToBlocks(html);
  } else if (ext === "txt" || ext === "md" || ext === "") {
    blocks = textToBlocks(await file.text());
  } else {
    throw new Error(
      "Unsupported file. Try .docx, .odt, .txt, .md, .html, or .epub.",
    );
  }

  if (blocks.length === 0) {
    throw new Error("That file looks empty.");
  }

  // Folio rhythm first — then detect chapters from the cleaned text
  const cleanedBlocks = normalizeImportBlocks(blocks);

  let chapters = normalizeChapters(splitBlocksIntoChapters(cleanedBlocks));

  // Promote a short Opening (title scrap) into manuscript title
  if (chapters.length > 1 && chapters[0].title === "Opening") {
    const body = chapters[0].blocks.filter(
      (b) => !(b.type === "heading" && b.level === 1 && b.text === "Opening"),
    );
    const onlyShort =
      body.length === 1 &&
      body[0].type === "paragraph" &&
      body[0].text.length <= 80 &&
      body[0].text.split(/\s+/).length <= 12;
    if (onlyShort) {
      title = cleanHeadingText(body[0].text);
      chapters = chapters.slice(1);
    } else if (body.length === 0) {
      chapters = chapters.slice(1);
    }
  }

  return {
    title: cleanHeadingText(title) || "Untitled Manuscript",
    author: author ? cleanHeadingText(author) : "",
    chapters,
    sourceName,
  };
}

export function parsedToBook(
  parsed: ParsedManuscript,
  existing?: Book | null,
): Book {
  const now = Date.now();
  const chapters: Chapter[] = parsed.chapters.map((ch) => {
    const content = blocksToHtml(ch.blocks);
    return ensureChapterScenes({
      id: createId(),
      title: ch.title,
      content,
      summary: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
      scenes: [],
    });
  });

  if (chapters.length === 0) {
    const id = createId();
    chapters.push(
      ensureChapterScenes({
        id,
        title: "Chapter One",
        content: "<h1>Chapter One</h1><p></p>",
        summary: "",
        notes: "",
        createdAt: now,
        updatedAt: now,
        scenes: [],
      }),
    );
  }

  return {
    id: existing?.id ?? createId(),
    title: parsed.title || existing?.title || "Untitled Manuscript",
    author: parsed.author || existing?.author || "",
    chapters,
    characters: existing?.characters ?? [],
    familyTrees: existing?.familyTrees ?? [],
    locations: existing?.locations ?? [],
    research: existing?.research ?? [],
    encyclopedia: existing?.encyclopedia ?? [],
    encyclopediaStacks: existing?.encyclopediaStacks ?? [],
    chronicle: existing?.chronicle ?? [],
    trash: existing?.trash ?? [],
    map: existing?.map ?? emptyStoryMap(),
    maps: existing?.maps ?? [],
    activeMapId: existing?.activeMapId ?? "",
    developmentalEditor:
      existing?.developmentalEditor ?? {
        memory: [],
        passes: [],
      },
    betaReaders: existing?.betaReaders ?? {
      readers: [],
      memory: [],
      reviews: [],
    },
    critique: existing?.critique ?? {
      memory: [],
      reviews: [],
    },
    dump: existing?.dump ?? {
      pages: [],
      activePageId: "",
    },
    seriesId: existing?.seriesId ?? null,
    plotThreads: existing?.plotThreads ?? [],
    goals: existing?.goals ?? emptyGoals(0, now),
    activeChapterId: chapters[0].id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function countImportWords(parsed: ParsedManuscript): number {
  let n = 0;
  for (const ch of parsed.chapters) {
    for (const b of ch.blocks) {
      if (b.type === "scene-break" || b.type === "heading") continue;
      n += b.text.split(/\s+/).filter(Boolean).length;
    }
  }
  return n;
}
