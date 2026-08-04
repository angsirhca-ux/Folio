/**
 * Local name / continuity hygiene — find a name (and aliases) across
 * manuscript prose and the rest of the bible. No AI.
 */

import type { Book, Chapter } from "./types";
import { getSceneHtmlParts } from "./manuscriptScenes";

export function normalizeNameForms(
  name: string,
  aliases: string[] = [],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [name, ...aliases]) {
    const n = raw.trim();
    if (!n || n.length < 2) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  // Longest first so “Elena Voss” wins over “Elena” when both could match
  out.sort((a, b) => b.length - a.length);
  return out;
}

export function nameMentionedInText(text: string, name: string): boolean {
  const n = name.trim();
  if (!n || n.length < 2) return false;
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^\\p{L}])${escaped}(?:[^\\p{L}]|$)`, "iu");
  return re.test(text);
}

/** First matching form in `forms` (already longest-first), or null. */
export function firstMatchingForm(
  text: string,
  forms: string[],
): string | null {
  for (const form of forms) {
    if (nameMentionedInText(text, form)) return form;
  }
  return null;
}

export function scenePlainText(html: string): string {
  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function snippetAround(text: string, needle: string, radius = 52): string {
  const lower = text.toLowerCase();
  const n = needle.toLowerCase();
  const i = lower.indexOf(n);
  if (i < 0) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    return trimmed.length > radius * 2
      ? `${trimmed.slice(0, radius * 2)}…`
      : trimmed;
  }
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + needle.length + radius);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = `…${snip}`;
  if (end < text.length) snip = `${snip}…`;
  return snip;
}

export type NameProseHit = {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  sceneIndex: number;
  sceneId: string;
  sceneTitle: string;
  matchedAs: string;
  excerpt: string;
};

export type NameFormTally = {
  form: string;
  /** Is this the canonical name (first form)? */
  canonical: boolean;
  proseCount: number;
};

export type NameBibleHit = {
  kind: "character" | "location" | "encyclopedia" | "research";
  id: string;
  title: string;
  /** Where it showed up — relationship, wiki, inhabitants, … */
  where: string;
  href: string;
  matchedAs: string;
};

function pushField(
  hits: NameBibleHit[],
  forms: string[],
  field: string,
  value: string | undefined | null,
  meta: Omit<NameBibleHit, "matchedAs" | "where"> & { where?: string },
) {
  if (!value?.trim()) return;
  const matchedAs = firstMatchingForm(value, forms);
  if (!matchedAs) return;
  hits.push({
    ...meta,
    where: meta.where ?? field,
    matchedAs,
  });
}

/**
 * Scan scene prose for name/alias mentions. One hit per scene (best/longest match).
 */
export function findProseNameHits(
  chapters: Chapter[],
  forms: string[],
  options?: { limit?: number },
): NameProseHit[] {
  if (forms.length === 0) return [];
  const limit = options?.limit ?? 80;
  const out: NameProseHit[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const parts = getSceneHtmlParts(chapter.content ?? "");
    const scenes = chapter.scenes ?? [];
    const count = Math.max(parts.length, scenes.length, 1);

    for (let sceneIndex = 0; sceneIndex < count; sceneIndex++) {
      const prose = scenePlainText(parts[sceneIndex] ?? "");
      if (!prose) continue;
      const matchedAs = firstMatchingForm(prose, forms);
      if (!matchedAs) continue;
      const scene = scenes[sceneIndex];
      out.push({
        chapterId: chapter.id,
        chapterTitle: chapter.title?.trim() || `Chapter ${chapterIndex + 1}`,
        chapterIndex,
        sceneIndex,
        sceneId: scene?.id ?? `${chapter.id}:${sceneIndex}`,
        sceneTitle: scene?.title?.trim() || `Scene ${sceneIndex + 1}`,
        matchedAs,
        excerpt: snippetAround(prose, matchedAs),
      });
      if (out.length >= limit) return;
    }
  });

  return out;
}

export function tallyNameForms(
  forms: string[],
  proseHits: NameProseHit[],
): NameFormTally[] {
  const counts = new Map<string, number>();
  for (const hit of proseHits) {
    const key = hit.matchedAs.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return forms.map((form, i) => ({
    form,
    canonical: i === 0,
    proseCount: counts.get(form.toLowerCase()) ?? 0,
  }));
}

/**
 * Other bible cards that mention this name (not the entity’s own page).
 */
export function findBibleNameHits(
  book: Book,
  forms: string[],
  exclude: { kind: NameBibleHit["kind"]; id: string },
): NameBibleHit[] {
  if (forms.length === 0) return [];
  const hits: NameBibleHit[] = [];

  for (const c of book.characters ?? []) {
    if (exclude.kind === "character" && c.id === exclude.id) continue;
    const href = `/characters/${c.id}`;
    const base = {
      kind: "character" as const,
      id: c.id,
      title: c.name?.trim() || "Unnamed",
      href,
    };
    pushField(hits, forms, "bio", c.shortBio, base);
    pushField(hits, forms, "wiki", c.wiki, base);
    pushField(hits, forms, "secrets", c.secrets, base);
    for (const r of c.relationships ?? []) {
      const blob = [r.toName, r.label, r.notes].filter(Boolean).join(" · ");
      pushField(hits, forms, "tie", blob, {
        ...base,
        where: r.label?.trim() ? `Tie · ${r.label}` : "Tie",
      });
    }
  }

  for (const l of book.locations ?? []) {
    if (exclude.kind === "location" && l.id === exclude.id) continue;
    const href = `/locations/${l.id}`;
    const base = {
      kind: "location" as const,
      id: l.id,
      title: l.name?.trim() || "Unnamed place",
      href,
    };
    pushField(hits, forms, "bio", l.shortBio, base);
    pushField(hits, forms, "wiki", l.wiki, base);
    pushField(hits, forms, "atmosphere", l.sensory?.atmosphere, base);
    pushField(hits, forms, "secrets", l.secrets, base);
    pushField(hits, forms, "function", l.story?.function, base);
    for (const n of l.inhabitants ?? []) {
      pushField(hits, forms, "inhabitant", n, {
        ...base,
        where: "Inhabitant",
      });
    }
    for (const conn of l.connections ?? []) {
      const blob = [conn.toName, conn.label, conn.notes].filter(Boolean).join(" · ");
      pushField(hits, forms, "link", blob, {
        ...base,
        where: conn.label?.trim() ? `Link · ${conn.label}` : "Link",
      });
    }
  }

  for (const e of book.encyclopedia ?? []) {
    if (exclude.kind === "encyclopedia" && e.id === exclude.id) continue;
    const href = `/encyclopedia/${e.id}`;
    const base = {
      kind: "encyclopedia" as const,
      id: e.id,
      title: e.title?.trim() || "Untitled",
      href,
    };
    pushField(hits, forms, "bio", e.shortBio, base);
    pushField(hits, forms, "wiki", e.wiki, base);
    pushField(hits, forms, "summary", e.summary, base);
  }

  for (const e of book.research ?? []) {
    if (exclude.kind === "research" && e.id === exclude.id) continue;
    const href = `/research/${e.id}`;
    const base = {
      kind: "research" as const,
      id: e.id,
      title: e.title?.trim() || "Untitled",
      href,
    };
    pushField(hits, forms, "bio", e.shortBio, base);
    pushField(hits, forms, "wiki", e.wiki, base);
    pushField(hits, forms, "summary", e.summary, base);
    pushField(hits, forms, "questions", e.questions, base);
  }

  // Dedupe same card+where
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.kind}:${h.id}:${h.where}:${h.matchedAs.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type NameContinuityReport = {
  forms: string[];
  proseHits: NameProseHit[];
  formTally: NameFormTally[];
  bibleHits: NameBibleHit[];
  unusedAliases: string[];
  proseOnlyAliases: string[];
};

export function buildNameContinuityReport(
  book: Book,
  opts: {
    name: string;
    aliases?: string[];
    exclude: { kind: NameBibleHit["kind"]; id: string };
    proseLimit?: number;
  },
): NameContinuityReport {
  const forms = normalizeNameForms(opts.name, opts.aliases ?? []);
  const proseHits = findProseNameHits(book.chapters, forms, {
    limit: opts.proseLimit ?? 80,
  });
  const formTally = tallyNameForms(forms, proseHits);
  const bibleHits = findBibleNameHits(book, forms, opts.exclude);

  const unusedAliases = formTally
    .filter((t) => !t.canonical && t.proseCount === 0)
    .map((t) => t.form);

  const canonicalCount = formTally.find((t) => t.canonical)?.proseCount ?? 0;
  const proseOnlyAliases =
    canonicalCount === 0
      ? formTally
          .filter((t) => !t.canonical && t.proseCount > 0)
          .map((t) => t.form)
      : [];

  return {
    forms,
    proseHits,
    formTally,
    bibleHits,
    unusedAliases,
    proseOnlyAliases,
  };
}
