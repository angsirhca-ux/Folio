/** Plain text of the first H1 in chapter HTML, or null if none. */
export function extractChapterHeading(html: string): string | null {
  const match = /<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/i.exec(html);
  if (!match) return null;
  return stripInline(match[2]);
}

/**
 * Canonical chapter title: prefer the manuscript H1 so sidebar / outline
 * always match what appears on the page.
 */
export function syncedChapterTitle(
  chapter: Pick<{ title: string; content: string }, "title" | "content">,
): string {
  const heading = extractChapterHeading(chapter.content);
  if (heading != null && heading !== "") return heading;
  return chapter.title?.trim() || "Untitled";
}

/** Keep `chapter.title` aligned with the leading H1 when present. */
export function syncChapterTitleField<
  T extends { title: string; content: string },
>(chapter: T): T {
  const heading = extractChapterHeading(chapter.content);
  if (heading == null || heading === "" || heading === chapter.title) {
    return chapter;
  }
  return { ...chapter, title: heading };
}

/** Replace (or prepend) the first H1 so it matches the sidebar title. */
export function replaceChapterHeading(html: string, title: string): string {
  const safe = escapeHtml(title);
  if (/<h1(\s[^>]*)?>[\s\S]*?<\/h1>/i.test(html)) {
    return html.replace(
      /<h1(\s[^>]*)?>[\s\S]*?<\/h1>/i,
      `<h1$1>${safe}</h1>`,
    );
  }
  if (!html.trim()) return `<h1>${safe}</h1><p></p>`;
  return `<h1>${safe}</h1>${html}`;
}

function stripInline(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/?(strong|b|em|i|span|a)[^>]*>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** “Chapter 3”, “Chapter 3 — Dawn”, etc. */
const NUMBERED_CHAPTER_RE = /^(chapter)\s+(\d+)(.*)$/i;

/**
 * If title looks like a numbered chapter, rewrite the number (keep any suffix).
 * Returns null when the title should be left alone (custom names).
 */
export function applyChapterNumber(title: string, n: number): string | null {
  const trimmed = title.trim();
  const match = NUMBERED_CHAPTER_RE.exec(trimmed);
  if (!match) return null;
  const suffix = match[3] ?? "";
  return `Chapter ${n}${suffix}`;
}

/**
 * Retitle “Chapter N …” entries to match list order, and sync each leading H1.
 * Custom titles (anything not “Chapter &lt;number&gt;…”) are unchanged.
 */
export function renumberNumberedChapters<
  T extends { title: string; content: string; updatedAt?: number },
>(chapters: T[]): T[] {
  const now = Date.now();
  let changed = false;
  const next = chapters.map((chapter, index) => {
    const n = index + 1;
    const fromTitle = applyChapterNumber(chapter.title, n);
    if (!fromTitle) return chapter;

    const content = replaceChapterHeading(chapter.content, fromTitle);
    if (fromTitle === chapter.title && content === chapter.content) {
      return chapter;
    }
    changed = true;
    return {
      ...chapter,
      title: fromTitle,
      content,
      updatedAt: now,
    };
  });
  return changed ? next : chapters;
}
