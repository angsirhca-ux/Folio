import JSZip from "jszip";
import { htmlToBlocks } from "./html";
import type { ImportBlock } from "./types";

/**
 * Lightweight EPUB import: concatenate spine XHTML documents into blocks.
 * Chapter splits still come from headings inside those documents.
 */
export async function epubToBlocks(buffer: ArrayBuffer): Promise<{
  blocks: ImportBlock[];
  title?: string;
  author?: string;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("This EPUB is missing a container file.");

  const opfPath =
    /full-path="([^"]+)"/.exec(container)?.[1] ??
    /full-path='([^']+)'/.exec(container)?.[1];
  if (!opfPath) throw new Error("Could not find the EPUB package document.");

  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) throw new Error("Could not read the EPUB package document.");

  const title =
    /<dc:title[^>]*>([^<]+)<\/dc:title>/i.exec(opf)?.[1]?.trim() || undefined;
  const author =
    /<dc:creator[^>]*>([^<]+)<\/dc:creator>/i.exec(opf)?.[1]?.trim() ||
    undefined;

  const manifest = new Map<string, string>();
  const itemRe =
    /<item\b[^>]*\bid="([^"]+)"[^>]*\bhref="([^"]+)"[^>]*>/gi;
  const itemReAlt =
    /<item\b[^>]*\bhref="([^"]+)"[^>]*\bid="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opf)) !== null) {
    manifest.set(m[1], m[2]);
  }
  while ((m = itemReAlt.exec(opf)) !== null) {
    if (!manifest.has(m[2])) manifest.set(m[2], m[1]);
  }

  // Re-parse more carefully for id/href regardless of attr order
  manifest.clear();
  const itemAny = /<item\b([^>]+)>/gi;
  while ((m = itemAny.exec(opf)) !== null) {
    const attrs = m[1];
    const id = /\bid="([^"]+)"/i.exec(attrs)?.[1];
    const href = /\bhref="([^"]+)"/i.exec(attrs)?.[1];
    if (id && href) manifest.set(id, href);
  }

  const spineIds: string[] = [];
  const spineRe = /<itemref\b[^>]*\bidref="([^"]+)"[^>]*>/gi;
  while ((m = spineRe.exec(opf)) !== null) {
    spineIds.push(m[1]);
  }

  const blocks: ImportBlock[] = [];
  for (const id of spineIds) {
    const href = manifest.get(id);
    if (!href) continue;
    if (!/\.x?html?$/i.test(href)) continue;
    const path = opfDir + href;
    const xhtml = await zip.file(path)?.async("string");
    if (!xhtml) continue;

    // Skip nav / toc only documents when short and mostly links
    if (/epub:type="toc"|epub:type='toc'/i.test(xhtml) && xhtml.length < 4000) {
      continue;
    }

    const body =
      /<body[^>]*>([\s\S]*?)<\/body>/i.exec(xhtml)?.[1] ?? xhtml;
    blocks.push(...htmlToBlocks(body));
  }

  if (blocks.length === 0) {
    throw new Error("No readable chapters were found in this EPUB.");
  }

  return { blocks, title, author };
}
