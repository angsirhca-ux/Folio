/**
 * Split chapter HTML into scenes at *** / scene-break ornaments.
 * Storyboard cards and the manuscript Contents list both use this.
 */

export interface ManuscriptScene {
  index: number;
  title: string;
  preview: string;
  html: string;
}

export const SCENE_BREAK_HTML = `<p class="scene-break" data-type="scene-break"><span class="scene-break-mark">* * *</span></p>`;

const SCENE_BREAK_RE =
  /<p[^>]*(?:class="[^"]*scene-break[^"]*"|data-type="scene-break")[^>]*>[\s\S]*?<\/p>|<p[^>]*>\s*(?:\*\s*){3,}\s*<\/p>/gi;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/\s+/g, " ")
    .trim();
}

function stripToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?(strong|b|em|i|span|a)[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " "),
  );
}

function firstBodyLine(html: string): string {
  const withoutH1 = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "");
  const p = /<p(\s[^>]*)?>([\s\S]*?)<\/p>/i.exec(withoutH1);
  if (p) {
    const text = stripToText(p[2]);
    if (text && !/^(\*\s*){3,}$/.test(text)) return text;
  }
  const h2 = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(withoutH1);
  if (h2) {
    const text = stripToText(h2[1]);
    if (text) return text;
  }
  return stripToText(withoutH1);
}

function titleFromScene(html: string, index: number): string {
  const line = firstBodyLine(html);
  if (!line) return `Scene ${index + 1}`;
  if (line.length <= 42) return line;
  const cut = line.slice(0, 42);
  const space = cut.lastIndexOf(" ");
  return `${(space > 16 ? cut.slice(0, space) : cut).trim()}…`;
}

/** Raw HTML parts between scene breaks (preserves manuscript text). */
export function getSceneHtmlParts(html: string): string[] {
  if (!html?.trim()) return ["<p></p>"];

  const raw = html.split(SCENE_BREAK_RE);
  const parts: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const part = raw[i] ?? "";
    if (i > 0 && !stripToText(part)) continue;
    parts.push(part.trim() ? part : "<p></p>");
  }

  return parts.length > 0 ? parts : ["<p></p>"];
}

export function joinSceneHtmlParts(parts: string[]): string {
  if (parts.length === 0) return "<p></p>";
  return parts.join(SCENE_BREAK_HTML);
}

/** Scenes within a chapter, split on *** scene breaks. Always ≥ 1. */
export function splitManuscriptScenes(html: string): ManuscriptScene[] {
  return getSceneHtmlParts(html).map((part, index) => {
    const preview = firstBodyLine(part);
    return {
      index,
      title: titleFromScene(part, index),
      preview: preview.slice(0, 120),
      html: part,
    };
  });
}

export function countManuscriptScenes(html: string): number {
  return getSceneHtmlParts(html).length;
}

export function rewriteContentFromScenes(
  content: string,
  fromIndex: number,
  toIndex: number,
): string {
  const parts = getSceneHtmlParts(content);
  if (
    fromIndex < 0 ||
    fromIndex >= parts.length ||
    toIndex < 0 ||
    toIndex >= parts.length ||
    fromIndex === toIndex
  ) {
    return content;
  }
  const [moved] = parts.splice(fromIndex, 1);
  parts.splice(toIndex, 0, moved);
  return joinSceneHtmlParts(parts);
}

export function extractSceneHtmlAt(
  content: string,
  index: number,
): { part: string; rest: string } | null {
  const parts = getSceneHtmlParts(content);
  if (index < 0 || index >= parts.length) return null;
  const part = parts[index];
  const restParts = parts.filter((_, i) => i !== index);
  return {
    part,
    rest: restParts.length ? joinSceneHtmlParts(restParts) : "<p></p>",
  };
}

export function insertSceneHtmlAt(
  content: string,
  part: string,
  index: number,
): string {
  const parts = getSceneHtmlParts(content);
  const clamped = Math.max(0, Math.min(index, parts.length));
  parts.splice(clamped, 0, part);
  return joinSceneHtmlParts(parts);
}

/** Remove scene-break ornaments so a single-scene edit cannot invent extra breaks. */
export function stripSceneBreakHtml(html: string): string {
  const cleaned = html.replace(SCENE_BREAK_RE, "").trim();
  return cleaned || "<p></p>";
}

/**
 * Replace one scene's HTML in the chapter manuscript (same index as storyboard card).
 * Strips nested scene breaks from the fragment.
 */
export function replaceSceneHtmlAt(
  content: string,
  index: number,
  html: string,
): string {
  const parts = getSceneHtmlParts(content);
  if (index < 0 || index >= parts.length) return content;
  parts[index] = stripSceneBreakHtml(html);
  return joinSceneHtmlParts(parts);
}

export function isPlaceholderSceneTitle(title: string): boolean {
  const t = title.trim();
  return (
    !t ||
    t === "Untitled Scene" ||
    t === "Opening" ||
    /^Scene \d+$/i.test(t)
  );
}
