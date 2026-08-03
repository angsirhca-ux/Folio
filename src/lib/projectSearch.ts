import type { Book } from "@/lib/types";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";

export type ProjectSearchKind =
  | "chapter"
  | "scene"
  | "prose"
  | "character"
  | "location"
  | "research";

export type ProjectSearchHit = {
  /** Stable list key */
  id: string;
  kind: ProjectSearchKind;
  title: string;
  subtitle?: string;
  excerpt?: string;
  score: number;
  chapterId?: string;
  sceneIndex?: number;
  sceneId?: string;
  entityId?: string;
  href?: string;
};

const KIND_ORDER: ProjectSearchKind[] = [
  "scene",
  "chapter",
  "prose",
  "character",
  "location",
  "research",
];

export const PROJECT_SEARCH_KIND_LABEL: Record<ProjectSearchKind, string> = {
  chapter: "Chapters",
  scene: "Scenes",
  prose: "Manuscript",
  character: "Characters",
  location: "Places",
  research: "Research",
};

function plainFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
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
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function includes(hay: string | undefined | null, q: string): boolean {
  if (!hay || !q) return false;
  return hay.toLowerCase().includes(q);
}

function scoreField(
  value: string | undefined | null,
  q: string,
  weight: number,
): number {
  if (!value || !q) return 0;
  const v = value.toLowerCase();
  if (v === q) return weight * 4;
  if (v.startsWith(q)) return weight * 2.5;
  if (v.includes(q)) return weight;
  return 0;
}

function scoreList(values: string[] | undefined, q: string, weight: number): number {
  if (!values?.length) return 0;
  let best = 0;
  for (const v of values) {
    best = Math.max(best, scoreField(v, q, weight));
  }
  return best;
}

function snippetAround(text: string, q: string, radius = 48): string | undefined {
  const lower = text.toLowerCase();
  const i = lower.indexOf(q);
  if (i < 0) return undefined;
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + q.length + radius);
  let snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) snip = `…${snip}`;
  if (end < text.length) snip = `${snip}…`;
  return snip;
}

/**
 * Project-wide search across manuscript, scenes, and wiki atlases.
 * Calm ranking: titles first, then metadata, then prose snippets.
 */
export function searchBook(
  book: Book,
  rawQuery: string,
  options?: { limit?: number },
): ProjectSearchHit[] {
  const q = normalizeQuery(rawQuery);
  if (q.length < 1) return [];

  const limit = options?.limit ?? 48;
  const hits: ProjectSearchHit[] = [];

  book.chapters.forEach((chapter, ci) => {
    const chapterLabel = chapter.title?.trim() || `Chapter ${ci + 1}`;
    let chapterScore =
      scoreField(chapter.title, q, 12) +
      scoreField(chapter.summary, q, 5) +
      scoreField(chapter.notes, q, 3);

    const scenes = chapter.scenes ?? [];
    scenes.forEach((scene, si) => {
      const sceneScore =
        scoreField(scene.title, q, 14) +
        scoreField(scene.synopsis, q, 7) +
        scoreField(scene.pov, q, 5) +
        scoreField(scene.location, q, 5) +
        scoreField(scene.notes, q, 3) +
        scoreField(scene.act, q, 2) +
        scoreList(scene.labels, q, 4) +
        scoreList(scene.characters, q, 4);

      if (sceneScore > 0) {
        hits.push({
          id: `scene:${scene.id}`,
          kind: "scene",
          title: scene.title?.trim() || "Untitled scene",
          subtitle: chapterLabel,
          excerpt: scene.synopsis?.trim() || undefined,
          score: sceneScore + 2,
          chapterId: chapter.id,
          sceneIndex: si,
          sceneId: scene.id,
          href: "/",
        });
      }
    });

    // Prose — prefer scene-scoped snippets for jump accuracy
    const parts = getSceneHtmlParts(chapter.content ?? "");
    parts.forEach((html, si) => {
      const text = plainFromHtml(html);
      if (!includes(text, q)) return;
      const excerpt = snippetAround(text, q);
      const titleBoost =
        scenes[si]?.title && includes(scenes[si].title, q) ? 2 : 0;
      hits.push({
        id: `prose:${chapter.id}:${si}:${q}`,
        kind: "prose",
        title: scenes[si]?.title?.trim() || `Scene ${si + 1}`,
        subtitle: chapterLabel,
        excerpt,
        score: 6 + titleBoost + (excerpt ? 1 : 0),
        chapterId: chapter.id,
        sceneIndex: si,
        sceneId: scenes[si]?.id,
        href: "/",
      });
    });

    // Chapter hit if title/summary matched (and not only via scenes)
    if (chapterScore > 0) {
      hits.push({
        id: `chapter:${chapter.id}`,
        kind: "chapter",
        title: chapterLabel,
        subtitle: chapter.summary?.trim() || undefined,
        excerpt: chapter.summary?.trim()
          ? undefined
          : snippetAround(plainFromHtml(chapter.content ?? ""), q),
        score: chapterScore,
        chapterId: chapter.id,
        sceneIndex: 0,
        href: "/",
      });
    }
  });

  for (const c of book.characters ?? []) {
    const score =
      scoreField(c.name, q, 14) +
      scoreList(c.aliases, q, 8) +
      scoreField(c.shortBio, q, 5) +
      scoreField(c.wiki, q, 3) +
      scoreField(c.secrets, q, 2) +
      scoreField(c.storyDigest, q, 2) +
      scoreList(c.tags, q, 3) +
      scoreField(c.identity?.occupation, q, 2) +
      scoreField(c.psychology?.wants, q, 2) +
      scoreField(c.voice?.speechNotes, q, 2);
    if (score <= 0) continue;
    hits.push({
      id: `character:${c.id}`,
      kind: "character",
      title: c.name?.trim() || "Unnamed",
      subtitle: c.shortBio?.trim() || c.role,
      excerpt: snippetAround(
        [c.wiki, c.shortBio, c.storyDigest].filter(Boolean).join("\n"),
        q,
      ),
      score,
      entityId: c.id,
      href: `/characters/${c.id}`,
    });
  }

  for (const loc of book.locations ?? []) {
    const score =
      scoreField(loc.name, q, 14) +
      scoreList(loc.aliases, q, 8) +
      scoreField(loc.shortBio, q, 5) +
      scoreField(loc.wiki, q, 3) +
      scoreField(loc.place?.region, q, 3) +
      scoreField(loc.secrets, q, 2) +
      scoreField(loc.storyDigest, q, 2) +
      scoreList(loc.tags, q, 3);
    if (score <= 0) continue;
    hits.push({
      id: `location:${loc.id}`,
      kind: "location",
      title: loc.name?.trim() || "Unnamed",
      subtitle: loc.shortBio?.trim() || loc.kind,
      excerpt: snippetAround(
        [loc.wiki, loc.shortBio, loc.storyDigest].filter(Boolean).join("\n"),
        q,
      ),
      score,
      entityId: loc.id,
      href: `/locations/${loc.id}`,
    });
  }

  for (const entry of book.research ?? []) {
    const sourceBlob = (entry.sources ?? [])
      .map((s) => [s.title, s.citation, s.quote, s.notes].join(" "))
      .join("\n");
    const score =
      scoreField(entry.title, q, 14) +
      scoreList(entry.aliases, q, 8) +
      scoreField(entry.shortBio, q, 5) +
      scoreField(entry.summary, q, 5) +
      scoreField(entry.wiki, q, 3) +
      scoreField(entry.questions, q, 3) +
      scoreField(entry.storyDigest, q, 2) +
      scoreList(entry.tags, q, 3) +
      scoreField(sourceBlob, q, 2);
    if (score <= 0) continue;
    hits.push({
      id: `research:${entry.id}`,
      kind: "research",
      title: entry.title?.trim() || "Untitled",
      subtitle: entry.shortBio?.trim() || entry.kind,
      excerpt: snippetAround(
        [entry.summary, entry.wiki, entry.questions, sourceBlob]
          .filter(Boolean)
          .join("\n"),
        q,
      ),
      score,
      entityId: entry.id,
      href: `/research/${entry.id}`,
    });
  }

  // De-dupe prose vs scene when both fire heavily on same scene title
  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ki = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (ki !== 0) return ki;
    return a.title.localeCompare(b.title);
  });

  return hits.slice(0, limit);
}

export function groupSearchHits(
  hits: ProjectSearchHit[],
): { kind: ProjectSearchKind; label: string; hits: ProjectSearchHit[] }[] {
  const byKind = new Map<ProjectSearchKind, ProjectSearchHit[]>();
  for (const hit of hits) {
    const list = byKind.get(hit.kind) ?? [];
    list.push(hit);
    byKind.set(hit.kind, list);
  }
  return KIND_ORDER.filter((k) => (byKind.get(k)?.length ?? 0) > 0).map(
    (kind) => ({
      kind,
      label: PROJECT_SEARCH_KIND_LABEL[kind],
      hits: byKind.get(kind)!,
    }),
  );
}
