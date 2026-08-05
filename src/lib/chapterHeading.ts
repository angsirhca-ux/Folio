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

/** “Chapter 3”, “Chapter One”, “Chapter III — Dawn”, etc. */
const NUMBERED_CHAPTER_RE =
  /^(chapter)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|i{1,3}|iv|vi{0,3}|ix|x{1,3}|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx)(\b|$)(.*)$/i;

const WORD_OR_ROMAN_OK = true; // documents intent for the regex above

/**
 * If title looks like a numbered chapter, rewrite the number (keep any suffix).
 * Returns null when the title should be left alone (custom names).
 */
export function applyChapterNumber(title: string, n: number): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const match = NUMBERED_CHAPTER_RE.exec(trimmed);
  if (!match) return null;
  // match[3] is word-boundary group; suffix is match[4]
  const suffix = (match[4] ?? "").replace(/^\s+/, (s) => s); // keep leading space/dash from original
  // Normalize suffix spacing: " — Dawn" / " - Dawn" / " Dawn"
  const normalizedSuffix = suffix.replace(/^\s*/, (lead) =>
    lead.length ? (suffix.match(/^\s*[-–—:]/) ? suffix.replace(/^\s*/, " ") : suffix.startsWith(" ") ? suffix : ` ${suffix}`) : "",
  );
  void WORD_OR_ROMAN_OK;
  void normalizedSuffix;
  const cleanSuffix = suffix.match(/^\s*$/)
    ? ""
    : suffix.match(/^\s*[-–—:]/)
      ? ` ${suffix.trim()}`
      : suffix.startsWith(" ")
        ? suffix
        : ` ${suffix}`;
  return `Chapter ${n}${cleanSuffix}`;
}

/**
 * Retitle “Chapter N …” entries to match list order, and sync each leading H1.
 * Accepts digits, English words (One…Twenty…), and light roman numerals.
 * Custom titles (anything not a numbered “Chapter …”) are unchanged.
 */
export function renumberNumberedChapters<
  T extends { title: string; content: string; updatedAt?: number },
>(chapters: T[]): T[] {
  const now = Date.now();
  let changed = false;
  const next = chapters.map((chapter, index) => {
    const n = index + 1;
    const heading = extractChapterHeading(chapter.content);
    const fromTitle = applyChapterNumber(chapter.title, n);
    const fromHeading =
      heading != null ? applyChapterNumber(heading, n) : null;

    // Prefer rewriting when either the sidebar title or the page H1 is numbered
    const newTitle = fromTitle ?? (fromHeading ? `Chapter ${n}${fromHeading.slice(`Chapter ${n}`.length)}` : null);
    // fromHeading already is full "Chapter N…" — use it when title didn't match
    const resolved = fromTitle ?? fromHeading;
    if (!resolved) return chapter;

    const content = replaceChapterHeading(chapter.content, resolved);
    if (resolved === chapter.title && content === chapter.content) {
      return chapter;
    }
    changed = true;
    return {
      ...chapter,
      title: resolved,
      content,
      updatedAt: now,
    };
  });
  return changed ? next : chapters;
}
