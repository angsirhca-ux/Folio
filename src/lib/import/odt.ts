import JSZip from "jszip";
import type { ImportBlock } from "./types";
import { isChapterHeading, isSceneBreakLine, normalizeHeadingText } from "./split";

/**
 * Parse OpenDocument Text (.odt) — also accepts misnamed .otd.
 * ODT is a ZIP with content.xml using text:h / text:p nodes.
 */
export async function odtToBlocks(buffer: ArrayBuffer): Promise<{
  blocks: ImportBlock[];
  title?: string;
  author?: string;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file("content.xml")?.async("string");
  if (!contentXml) {
    throw new Error("This doesn’t look like a valid OpenDocument (.odt) file.");
  }

  let title: string | undefined;
  let author: string | undefined;
  const metaXml = await zip.file("meta.xml")?.async("string");
  if (metaXml) {
    title =
      /<dc:title[^>]*>([^<]*)<\/dc:title>/i.exec(metaXml)?.[1]?.trim() ||
      undefined;
    author =
      /<dc:creator[^>]*>([^<]*)<\/dc:creator>/i.exec(metaXml)?.[1]?.trim() ||
      undefined;
  }

  const stylesXml = (await zip.file("styles.xml")?.async("string")) ?? "";
  const styleLevels = buildStyleOutlineMap(stylesXml + contentXml);

  const blocks = parseOdtContent(contentXml, styleLevels);
  if (blocks.length === 0) {
    throw new Error("No readable text was found in that OpenDocument file.");
  }

  return { blocks, title, author };
}

/** Map paragraph style name → outline level (1–3) when it behaves like a heading. */
function buildStyleOutlineMap(xml: string): Map<string, 1 | 2 | 3> {
  const map = new Map<string, 1 | 2 | 3>();
  const styleRe =
    /<(?:style:style|style:default-style)\b([^>]*)>([\s\S]*?)<\/(?:style:style|style:default-style)>/gi;
  let m: RegExpExecArray | null;

  while ((m = styleRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const name = /style:name="([^"]+)"/i.exec(attrs)?.[1];
    if (!name) continue;

    const family = /style:family="([^"]+)"/i.exec(attrs)?.[1];
    if (family && family !== "paragraph") continue;

    const outline =
      /style:default-outline-level="(\d+)"/i.exec(attrs)?.[1] ??
      /style:default-outline-level="(\d+)"/i.exec(body)?.[1] ??
      /fo:outline-level="(\d+)"/i.exec(body)?.[1];

    if (outline) {
      const level = Math.min(3, Math.max(1, Number(outline))) as 1 | 2 | 3;
      map.set(name, level);
      continue;
    }

    // Heuristic from style display name / name
    const lower = name.toLowerCase();
    if (
      /heading\s*1|title|chapter|kapitel|chapitre|capitulo|глава/.test(lower)
    ) {
      map.set(name, 1);
    } else if (/heading\s*2|subtitle/.test(lower)) {
      map.set(name, 2);
    } else if (/heading\s*3/.test(lower)) {
      map.set(name, 3);
    } else if (/^h1\b|heading_?1/.test(lower)) {
      map.set(name, 1);
    } else if (/^h2\b|heading_?2/.test(lower)) {
      map.set(name, 2);
    }
  }

  // Common built-ins even if styles.xml omitted details
  for (const [name, level] of [
    ["Heading", 1],
    ["Heading_20_1", 1],
    ["Heading_20_2", 2],
    ["Heading_20_3", 3],
    ["Title", 1],
    ["Chapter", 1],
    ["Chapter_20_Title", 1],
  ] as const) {
    if (!map.has(name)) map.set(name, level as 1 | 2 | 3);
  }

  return map;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function stripXml(text: string): string {
  return decodeXmlEntities(
    text
      .replace(/<text:line-break\s*\/>/gi, "\n")
      .replace(/<text:tab\s*\/>/gi, " ")
      .replace(/<text:s\b[^>]*\/>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseOdtContent(
  xml: string,
  styleLevels: Map<string, 1 | 2 | 3>,
): ImportBlock[] {
  const blocks: ImportBlock[] = [];

  const body =
    /<office:text\b[^>]*>([\s\S]*?)<\/office:text>/i.exec(xml)?.[1] ?? xml;

  const nodeRe = /<(text:h|text:p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = nodeRe.exec(body)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";
    const text = stripXml(match[3]);
    if (!text) continue;

    const styleName =
      /text:style-name="([^"]+)"/i.exec(attrs)?.[1] ??
      /style-name="([^"]+)"/i.exec(attrs)?.[1];

    if (tag === "text:h") {
      const levelRaw =
        /text:outline-level="(\d+)"/i.exec(attrs)?.[1] ??
        /outline-level="(\d+)"/i.exec(attrs)?.[1] ??
        (styleName ? String(styleLevels.get(styleName) ?? "") : "") ??
        "1";
      const level = Math.min(3, Math.max(1, Number(levelRaw) || 1)) as
        | 1
        | 2
        | 3;
      blocks.push({
        type: "heading",
        level,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    // Paragraphs styled as headings / chapter titles
    if (styleName && styleLevels.has(styleName)) {
      blocks.push({
        type: "heading",
        level: styleLevels.get(styleName)!,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    if (styleName && /chapter|heading|title|kapitel/i.test(styleName) && text.length < 120) {
      blocks.push({
        type: "heading",
        level: 1,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    if (isSceneBreakLine(text)) {
      blocks.push({ type: "scene-break", text: "* * *" });
      continue;
    }

    // Plain paragraph that is clearly a chapter marker
    if (isChapterHeading(text) && text.length < 100 && !text.includes(". ")) {
      blocks.push({
        type: "heading",
        level: 1,
        text: normalizeHeadingText(text),
      });
      continue;
    }

    blocks.push({ type: "paragraph", text });
  }

  return blocks;
}
