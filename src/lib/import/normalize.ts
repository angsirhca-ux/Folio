import type { ImportBlock } from "./types";
import { isSceneBreakLine, normalizeHeadingText } from "./split";

/**
 * Clean imported prose so Folio’s typography and rhythm apply —
 * no foreign fonts/styles, no Word/ODT spacing debris.
 */
export function cleanImportedText(raw: string): string {
  let t = raw;

  // Unicode cleanup
  t = t.replace(/^\uFEFF/, "");
  t = t.replace(/[\u200B-\u200D\u2060\uFEFF]/g, ""); // zero-widths
  t = t.replace(/\u00AD/g, ""); // soft hyphen
  t = t.replace(/[\u00A0\u202F\u2000-\u200A\u3000]/g, " "); // exotic spaces → regular
  t = t.replace(/\r\n?/g, "\n");
  t = t.replace(/\t/g, " ");

  // Soft line-wraps inside a paragraph → spaces
  t = t.replace(/\n+/g, " ");

  // Collapse whitespace
  t = t.replace(/ {2,}/g, " ").trim();

  // Dashes & ellipsis (literary Folio conventions)
  t = t.replace(/\s*[–—]\s*/g, " — ");
  t = t.replace(/(\S)--(\S)/g, "$1 — $2");
  t = t.replace(/(\S)--\s/g, "$1 — ");
  t = t.replace(/\s--(\S)/g, " — $1");
  t = t.replace(/\.{3,}/g, "…");
  t = t.replace(/\u2026/g, "…");
  t = t.replace(/\s*…\s*/g, "… ");
  t = t.replace(/… +/g, "… ");

  // Straight quotes → typographic
  t = smartQuotes(t);

  // Punctuation spacing
  t = t.replace(/\s+([,.;:!?…])/g, "$1");
  t = t.replace(/([(\[{])\s+/g, "$1");
  t = t.replace(/\s+([)\]}])/g, "$1");
  t = t.replace(/([.!?])([A-ZÁÉÍÓÚÄËÏÖÜÅÆØÑ])/g, "$1 $2");
  t = t.replace(/([,;:])(?=[A-Za-zÀ-ÿ])/g, "$1 ");

  // Leftover markup / markdown emphasis crumbs
  t = t.replace(/<\/?[^>]+>/g, "");
  t = t.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");
  t = t.replace(/_{1,2}([^_]+)_{1,2}/g, "$1");

  // Final collapse + em-dash rhythm
  t = t.replace(/\s*—\s*/g, " — ");
  t = t.replace(/ {2,}/g, " ").trim();

  return t;
}

function smartQuotes(input: string): string {
  let t = input.replace(/``/g, "“").replace(/''/g, "”");

  let out = "";
  let openDouble = true;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '"') {
      out += openDouble ? "“" : "”";
      openDouble = !openDouble;
      continue;
    }
    out += ch;
  }
  t = out;

  t = t.replace(/(\w)'(\w)/g, "$1’$2");
  t = t.replace(/'(\d{2}s)\b/g, "’$1");
  t = t.replace(/'/g, (match, offset, str: string) => {
    const prev = str[offset - 1] ?? "";
    if (/\w/.test(prev)) return "’";
    if (!prev || /[\s(“\[\-]/.test(prev)) return "‘";
    return "’";
  });

  return t;
}

export function cleanHeadingText(raw: string): string {
  return normalizeHeadingText(cleanImportedText(raw));
}

function sameTitle(a: string, b: string): boolean {
  return (
    normalizeHeadingText(a).toLowerCase() ===
    normalizeHeadingText(b).toLowerCase()
  );
}

/**
 * Normalize a block list into Folio-clean manuscript structure.
 */
export function normalizeImportBlocks(blocks: ImportBlock[]): ImportBlock[] {
  const cleaned: ImportBlock[] = [];

  for (const block of blocks) {
    if (block.type === "scene-break") {
      if (cleaned[cleaned.length - 1]?.type === "scene-break") continue;
      cleaned.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    const text =
      block.type === "heading"
        ? cleanHeadingText(block.text)
        : cleanImportedText(block.text);

    if (!text) continue;

    if (isSceneBreakLine(text)) {
      if (cleaned[cleaned.length - 1]?.type === "scene-break") continue;
      cleaned.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    if (block.type === "heading") {
      cleaned.push({ type: "heading", level: block.level ?? 1, text });
      continue;
    }

    if (block.type === "blockquote") {
      cleaned.push({ type: "blockquote", text });
      continue;
    }

    cleaned.push({ type: "paragraph", text });
  }

  // Drop a paragraph that merely repeats the preceding chapter heading
  const deduped: ImportBlock[] = [];
  for (const block of cleaned) {
    const prev = deduped[deduped.length - 1];
    if (
      block.type === "paragraph" &&
      prev?.type === "heading" &&
      prev.level === 1 &&
      sameTitle(block.text, prev.text)
    ) {
      continue;
    }
    deduped.push(block);
  }

  return deduped;
}

/** Apply Folio cleanup to every chapter after splitting. */
export function normalizeChapters(
  chapters: { title: string; blocks: ImportBlock[] }[],
): { title: string; blocks: ImportBlock[] }[] {
  return chapters.map((ch) => {
    const title = cleanHeadingText(ch.title) || "Chapter";
    const body = normalizeImportBlocks(ch.blocks).filter(
      (b) => !(b.type === "heading" && b.level === 1 && sameTitle(b.text, title)),
    );

    return {
      title,
      blocks: [{ type: "heading", level: 1, text: title }, ...body],
    };
  });
}
