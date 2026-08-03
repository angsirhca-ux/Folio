import type {
  Book,
  Chapter,
  ResearchDepth,
  ResearchEntry,
  ResearchKind,
  ResearchLink,
  ResearchSource,
  Scene,
} from "./types";
import { createId } from "./utils";
import { getSceneHtmlParts } from "./manuscriptScenes";

export function createResearchSource(
  partial: Partial<ResearchSource> & { title: string },
): ResearchSource {
  return {
    id: partial.id ?? createId(),
    title: partial.title.trim() || "Untitled source",
    citation: partial.citation ?? "",
    quote: partial.quote ?? "",
    notes: partial.notes ?? "",
  };
}

export function createResearchLink(
  partial: Partial<ResearchLink> & { label: string },
): ResearchLink {
  return {
    id: partial.id ?? createId(),
    toEntryId: partial.toEntryId ?? "",
    toTitle: partial.toTitle ?? "",
    label: partial.label,
    notes: partial.notes ?? "",
  };
}

export function createResearchEntry(
  partial: Partial<Omit<ResearchEntry, "kind">> & {
    title: string;
    kind?: string;
  },
): ResearchEntry {
  const now = Date.now();
  const rawKind = (partial as { kind?: string }).kind ?? "unspecified";
  const kind: ResearchKind =
    rawKind === "lore"
      ? "unspecified"
      : (([
          "theme",
          "motif",
          "period",
          "craft",
          "source",
          "question",
          "unspecified",
        ].includes(rawKind)
          ? rawKind
          : "unspecified") as ResearchKind);
  return {
    id: partial.id ?? createId(),
    title: partial.title.trim() || "Untitled",
    aliases: partial.aliases ?? [],
    kind,
    shortBio: partial.shortBio ?? "",
    wiki: partial.wiki ?? "",
    summary: partial.summary ?? "",
    questions: partial.questions ?? "",
    sources: partial.sources ?? [],
    links: partial.links ?? [],
    linkedCharacters: partial.linkedCharacters ?? [],
    linkedLocations: partial.linkedLocations ?? [],
    tags: partial.tags ?? [],
    storyDigest: partial.storyDigest ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function countFilled(values: (string | undefined | null)[]): number {
  return values.filter(filled).length;
}

export function researchCompleteness(entry: ResearchEntry): number {
  const fields = [
    entry.shortBio,
    entry.wiki,
    entry.summary,
    entry.questions,
    entry.kind !== "unspecified" ? "x" : "",
    entry.sources.length > 0 ? "x" : "",
    entry.links.length > 0 ? "x" : "",
    entry.linkedCharacters.length > 0 ? "x" : "",
    entry.linkedLocations.length > 0 ? "x" : "",
    entry.aliases.length > 0 ? "x" : "",
    entry.tags.length > 0 ? "x" : "",
  ];
  return countFilled(fields) / fields.length;
}

export function researchDepth(
  entry: ResearchEntry,
  appearanceCount = 0,
): ResearchDepth {
  const complete = researchCompleteness(entry);
  const hasSketch =
    filled(entry.shortBio) ||
    entry.kind !== "unspecified" ||
    filled(entry.wiki);
  const hasPortrait =
    countFilled([entry.summary, entry.wiki, entry.questions]) >= 2 ||
    entry.sources.length > 0;
  const hasLiving =
    (entry.sources.length >= 1 &&
      countFilled([entry.summary, entry.wiki]) >= 1 &&
      appearanceCount >= 1) ||
    complete >= 0.55;

  if (hasLiving) return "living";
  if (hasPortrait || complete >= 0.28) return "portrait";
  if (hasSketch || appearanceCount >= 1) return "sketch";
  return "stub";
}

export function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function researchMatchesTitle(
  entry: ResearchEntry,
  title: string,
): boolean {
  if (!title.trim()) return false;
  if (namesMatch(entry.title, title)) return true;
  return entry.aliases.some((alias) => namesMatch(alias, title));
}

export function findResearchByTitle(
  entries: ResearchEntry[],
  title: string,
): ResearchEntry | undefined {
  return entries.find((e) => researchMatchesTitle(e, title));
}

export interface ResearchAppearance {
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  scene: Scene;
  sceneIndex: number;
  viaLabel: boolean;
  viaProse: boolean;
}

function scenePlainText(html: string): string {
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

function titleInProse(prose: string, titles: string[]): boolean {
  const lower = prose.toLowerCase();
  return titles.some((t) => {
    const n = t.trim();
    if (n.length < 3) return false;
    return lower.includes(n.toLowerCase());
  });
}

export function researchAppearances(
  chapters: Chapter[],
  entry: ResearchEntry,
): ResearchAppearance[] {
  const titles = [entry.title, ...entry.aliases];
  const out: ResearchAppearance[] = [];

  chapters.forEach((chapter, chapterIndex) => {
    const parts = getSceneHtmlParts(chapter.content);
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      const viaLabel = (scene.labels ?? []).some((l) =>
        titles.some((t) => namesMatch(l, t)),
      );
      const prose = scenePlainText(parts[sceneIndex] ?? "");
      const viaProse = !viaLabel && titleInProse(prose, titles);
      if (viaLabel || viaProse) {
        out.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterIndex,
          scene,
          sceneIndex,
          viaLabel,
          viaProse,
        });
      }
    });
  });

  return out;
}

function collectLabelTopics(chapters: Chapter[]): string[] {
  const names = new Set<string>();
  for (const ch of chapters) {
    for (const s of ch.scenes ?? []) {
      for (const label of s.labels ?? []) {
        if (label.trim()) names.add(label.trim());
      }
    }
  }
  return [...names];
}

function inferKindFromTitle(title: string): ResearchKind {
  const t = title.toLowerCase();
  if (/theme|meaning|about/.test(t)) return "theme";
  if (/motif|image|symbol|letter|light|dusk|mist|house/.test(t)) return "motif";
  if (/how to|craft|voice|structure|pov/.test(t)) return "craft";
  if (/who|why|what|how\?|\?/.test(t)) return "question";
  if (/source|article|book|citation|history|period|victorian|century/.test(t))
    return "source";
  return "motif";
}

function buildStoryDigest(
  entry: ResearchEntry,
  appearances: ResearchAppearance[],
): string {
  if (appearances.length === 0) {
    return "Not yet threaded into scenes — add labels or write the topic into the prose.";
  }

  const lines: string[] = [
    `Touches ${appearances.length} scene${appearances.length === 1 ? "" : "s"}.`,
    "",
  ];

  for (const a of appearances) {
    const bit = a.scene.synopsis?.trim() || a.scene.title;
    const how = a.viaLabel ? "label" : "prose";
    lines.push(`• ${a.chapterTitle} / ${a.scene.title} (${how})`);
    if (bit && bit !== a.scene.title) lines.push(`  ${bit}`);
  }

  if (entry.linkedCharacters.length) {
    lines.push("", `People: ${entry.linkedCharacters.join(", ")}`);
  }
  if (entry.linkedLocations.length) {
    lines.push(`Places: ${entry.linkedLocations.join(", ")}`);
  }

  return lines.join("\n").trim();
}

function enrichResearchFromStory(
  entry: ResearchEntry,
  appearances: ResearchAppearance[],
): ResearchEntry {
  const storyDigest = buildStoryDigest(entry, appearances);
  let next: ResearchEntry = { ...entry, storyDigest };

  if (next.kind === "unspecified" && appearances.length > 0) {
    next = { ...next, kind: inferKindFromTitle(next.title) };
  }

  if (!filled(next.shortBio) && appearances.length > 0) {
    const first =
      appearances.find((a) => a.scene.synopsis.trim()) ?? appearances[0];
    if (first?.scene.synopsis.trim()) {
      const bio = first.scene.synopsis.trim();
      next = {
        ...next,
        shortBio: bio.length > 140 ? `${bio.slice(0, 137).trim()}…` : bio,
      };
    }
  }

  if (!filled(next.wiki) && appearances.length > 0) {
    next = {
      ...next,
      wiki: `Compiled from the manuscript as of this draft. Edit freely — the “From the manuscript” digest below stays in sync with scenes.\n\n${storyDigest}`,
    };
  }

  // Pull cast/place from appearing scenes
  const people = new Set(next.linkedCharacters);
  const places = new Set(next.linkedLocations);
  for (const a of appearances) {
    if (a.scene.pov.trim()) people.add(a.scene.pov.trim());
    for (const n of a.scene.characters ?? []) {
      if (n.trim()) people.add(n.trim());
    }
    if (a.scene.location.trim()) places.add(a.scene.location.trim());
  }
  next = {
    ...next,
    linkedCharacters: [...people].sort((a, b) => a.localeCompare(b)),
    linkedLocations: [...places].sort((a, b) => a.localeCompare(b)),
  };

  const tags = new Set(next.tags);
  tags.add("from-story");
  next = { ...next, tags: [...tags] };

  const touched =
    next.kind !== entry.kind ||
    next.shortBio !== entry.shortBio ||
    next.wiki !== entry.wiki ||
    next.storyDigest !== entry.storyDigest ||
    next.linkedCharacters.join("|") !== entry.linkedCharacters.join("|") ||
    next.linkedLocations.join("|") !== entry.linkedLocations.join("|") ||
    next.tags.join("|") !== entry.tags.join("|");

  if (!touched) return entry;
  return { ...next, updatedAt: Date.now() };
}

export function ensureBookResearch(
  book: Omit<
    Book,
    "research" | "trash" | "developmentalEditor" | "betaReaders" | "dump"
  > & {
    research?: ResearchEntry[];
    encyclopedia?: Book["encyclopedia"];
    trash?: Book["trash"];
    developmentalEditor?: Book["developmentalEditor"];
    betaReaders?: Book["betaReaders"];
    dump?: Book["dump"];
  },
): Book {
  const raw = book.research ?? [];
  const normalized: Book = {
    ...book,
    encyclopedia: book.encyclopedia ?? [],
    trash: book.trash ?? [],
    developmentalEditor: book.developmentalEditor ?? {
      memory: [],
      passes: [],
    },
    betaReaders: book.betaReaders ?? {
      readers: [],
      memory: [],
      reviews: [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
    research: raw.map((e) =>
      createResearchEntry({
        ...e,
        title: e.title || "Untitled",
        sources: e.sources ?? [],
        links: e.links ?? [],
        linkedCharacters: e.linkedCharacters ?? [],
        linkedLocations: e.linkedLocations ?? [],
        aliases: e.aliases ?? [],
        tags: e.tags ?? [],
        storyDigest: e.storyDigest ?? "",
      }),
    ),
  };
  return syncResearchFromManuscript(normalized);
}

/**
 * Promote scene labels into research stubs and refresh digests from the page.
 */
export function syncResearchFromManuscript(book: Book): Book {
  const topics = collectLabelTopics(book.chapters);
  let research = [...(book.research ?? [])];
  let created = false;

  for (const title of topics) {
    if (findResearchByTitle(research, title)) continue;
    research.push(
      createResearchEntry({
        title,
        kind: inferKindFromTitle(title),
        tags: ["from-story", "label"],
      }),
    );
    created = true;
  }

  let changed = created;
  research = research.map((e) => {
    const appearances = researchAppearances(book.chapters, e);
    const enriched = enrichResearchFromStory(e, appearances);
    if (enriched !== e) changed = true;
    return enriched;
  });

  if (!changed) return book;
  return {
    ...book,
    research,
    updatedAt: Date.now(),
  };
}

export const RESEARCH_KIND_OPTIONS: {
  value: ResearchKind;
  label: string;
}[] = [
  { value: "source", label: "Source" },
  { value: "period", label: "Period" },
  { value: "craft", label: "Craft" },
  { value: "theme", label: "Theme" },
  { value: "motif", label: "Motif" },
  { value: "question", label: "Question" },
  { value: "unspecified", label: "Unspecified" },
];
