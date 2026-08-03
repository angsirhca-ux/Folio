import type {
  Book,
  Chapter,
  EncyclopediaDepth,
  EncyclopediaEntry,
  EncyclopediaLink,
  EncyclopediaStack,
  ResearchEntry,
  Scene,
} from "./types";
import { LEGACY_ENCYCLOPEDIA_KIND_LABEL } from "./types";
import { createId } from "./utils";
import { getSceneHtmlParts } from "./manuscriptScenes";
import { namesMatch } from "./research";
import { normalizeContinuityNotes } from "./continuity";

/** Muted Folio accents for encyclopedia stacks — calm, glanceable, not neon. */
export const ENCYCLOPEDIA_STACK_PALETTE = [
  "#8B7355", // warm clay
  "#6B7F94", // slate blue
  "#7A8F6E", // sage
  "#9A7B8A", // dusty rose
  "#7A8A8A", // pewter
  "#A07850", // oak
  "#6E7A8F", // steel
  "#8A847A", // stone
] as const;

export function nextEncyclopediaStackColor(
  existing: EncyclopediaStack[],
): string {
  const used = new Set(existing.map((s) => s.color));
  const free = ENCYCLOPEDIA_STACK_PALETTE.find((c) => !used.has(c));
  if (free) return free;
  return ENCYCLOPEDIA_STACK_PALETTE[
    existing.length % ENCYCLOPEDIA_STACK_PALETTE.length
  ];
}

export function createEncyclopediaStack(
  partial: Partial<EncyclopediaStack> & { name: string; order?: number },
  siblings: EncyclopediaStack[] = [],
): EncyclopediaStack {
  const now = Date.now();
  const order = partial.order ?? siblings.length;
  return {
    id: partial.id ?? createId(),
    name: partial.name.trim() || "Untitled stack",
    color: partial.color?.trim() || nextEncyclopediaStackColor(siblings),
    order,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

export function createEncyclopediaLink(
  partial: Partial<EncyclopediaLink> & { label: string },
): EncyclopediaLink {
  return {
    id: partial.id ?? createId(),
    toEntryId: partial.toEntryId ?? "",
    toTitle: partial.toTitle ?? "",
    label: partial.label,
    notes: partial.notes ?? "",
  };
}

export function createEncyclopediaEntry(
  partial: Partial<EncyclopediaEntry> & { title: string; stackId: string },
): EncyclopediaEntry {
  const now = Date.now();
  return {
    id: partial.id ?? createId(),
    title: partial.title.trim() || "Untitled",
    aliases: partial.aliases ?? [],
    stackId: partial.stackId,
    shortBio: partial.shortBio ?? "",
    wiki: partial.wiki ?? "",
    summary: partial.summary ?? "",
    links: partial.links ?? [],
    linkedCharacters: partial.linkedCharacters ?? [],
    linkedLocations: partial.linkedLocations ?? [],
    memberIds: partial.memberIds ?? [],
    memberLocationIds: partial.memberLocationIds ?? [],
    continuityNotes: normalizeContinuityNotes(partial.continuityNotes),
    coverImage: partial.coverImage,
    coverName: partial.coverName,
    tags: partial.tags ?? [],
    storyDigest: partial.storyDigest ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/** Optional shelf starter packs — applied once when creating stacks. */
export const ENCYCLOPEDIA_STACK_STARTERS: Array<{
  id: string;
  label: string;
  hint: string;
  stacks: string[];
}> = [
  {
    id: "blank",
    label: "Blank",
    hint: "Start empty — name stacks yourself",
    stacks: [],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    hint: "Customs, magic, creatures, factions…",
    stacks: ["Customs", "Magic", "Creatures", "Factions", "Items", "Mythology"],
  },
  {
    id: "mystery",
    label: "Mystery",
    hint: "Case files, evidence, motives…",
    stacks: ["Case files", "Evidence", "Motives", "Places of interest"],
  },
  {
    id: "historical",
    label: "Historical",
    hint: "Period detail, institutions, customs…",
    stacks: ["Period detail", "Institutions", "Customs", "Figures"],
  },
  {
    id: "contemporary",
    label: "Contemporary",
    hint: "Institutions, subcultures, settings…",
    stacks: ["Institutions", "Subcultures", "Technology", "Settings"],
  },
];

/** Add missing starter stacks onto a book’s shelf (idempotent by name). */
export function applyEncyclopediaStackStarter(
  stacks: EncyclopediaStack[],
  starterId: string,
): EncyclopediaStack[] {
  const starter = ENCYCLOPEDIA_STACK_STARTERS.find((s) => s.id === starterId);
  if (!starter || starter.stacks.length === 0) return stacks;
  let next = [...stacks];
  for (const name of starter.stacks) {
    const ensured = ensureEncyclopediaStackNamed(next, name);
    next = ensured.stacks;
  }
  return sortEncyclopediaStacks(next);
}

/** Convert a legacy research "lore" entry into an encyclopedia article. */
export function researchLoreToEncyclopedia(
  entry: ResearchEntry & { kind?: string },
  stackId: string,
): EncyclopediaEntry {
  return createEncyclopediaEntry({
    id: entry.id,
    title: entry.title,
    aliases: entry.aliases ?? [],
    stackId,
    shortBio: entry.shortBio ?? "",
    wiki: entry.wiki ?? "",
    summary: entry.summary ?? "",
    links: (entry.links ?? []).map((l) =>
      createEncyclopediaLink({
        id: l.id,
        toEntryId: l.toEntryId,
        toTitle: l.toTitle,
        label: l.label,
        notes: l.notes,
      }),
    ),
    linkedCharacters: entry.linkedCharacters ?? [],
    linkedLocations: entry.linkedLocations ?? [],
    tags: [...new Set([...(entry.tags ?? []), "migrated-from-research"])],
    storyDigest: entry.storyDigest ?? "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function countFilled(values: (string | undefined | null)[]): number {
  return values.filter(filled).length;
}

export function encyclopediaCompleteness(entry: EncyclopediaEntry): number {
  const fields = [
    entry.shortBio,
    entry.wiki,
    entry.summary,
    entry.stackId ? "x" : "",
    entry.links.length > 0 ? "x" : "",
    entry.linkedCharacters.length > 0 ? "x" : "",
    entry.linkedLocations.length > 0 ? "x" : "",
    entry.memberIds.length > 0 ? "x" : "",
    entry.memberLocationIds.length > 0 ? "x" : "",
    entry.coverImage ? "x" : "",
    entry.continuityNotes.length > 0 ? "x" : "",
    entry.aliases.length > 0 ? "x" : "",
    entry.tags.length > 0 ? "x" : "",
  ];
  return countFilled(fields) / fields.length;
}

export function encyclopediaDepth(
  entry: EncyclopediaEntry,
  appearanceCount = 0,
): EncyclopediaDepth {
  const complete = encyclopediaCompleteness(entry);
  const hasSketch =
    filled(entry.shortBio) || filled(entry.wiki) || filled(entry.summary);
  const hasPortrait =
    countFilled([entry.summary, entry.wiki]) >= 1 || entry.links.length > 0;
  const hasLiving =
    (countFilled([entry.summary, entry.wiki]) >= 1 && appearanceCount >= 1) ||
    complete >= 0.55;

  if (hasLiving) return "living";
  if (hasPortrait || complete >= 0.28) return "portrait";
  if (hasSketch || appearanceCount >= 1) return "sketch";
  return "stub";
}

export function encyclopediaMatchesTitle(
  entry: EncyclopediaEntry,
  title: string,
): boolean {
  if (!title.trim()) return false;
  if (namesMatch(entry.title, title)) return true;
  return entry.aliases.some((alias) => namesMatch(alias, title));
}

export function findEncyclopediaByTitle(
  entries: EncyclopediaEntry[],
  title: string,
): EncyclopediaEntry | undefined {
  return entries.find((e) => encyclopediaMatchesTitle(e, title));
}

export function sortEncyclopediaStacks(
  stacks: EncyclopediaStack[],
): EncyclopediaStack[] {
  return [...stacks].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name),
  );
}

export function findStackByName(
  stacks: EncyclopediaStack[],
  name: string,
): EncyclopediaStack | undefined {
  const n = name.trim().toLowerCase();
  return stacks.find((s) => s.name.trim().toLowerCase() === n);
}

export interface EncyclopediaAppearance {
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

export function encyclopediaAppearances(
  chapters: Chapter[],
  entry: EncyclopediaEntry,
): EncyclopediaAppearance[] {
  const titles = [entry.title, ...entry.aliases];
  const out: EncyclopediaAppearance[] = [];

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

function buildStoryDigest(
  entry: EncyclopediaEntry,
  appearances: EncyclopediaAppearance[],
): string {
  if (appearances.length === 0) {
    return "Not yet on the page — mention it in prose or add a scene label.";
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

function enrichEncyclopediaFromStory(
  entry: EncyclopediaEntry,
  appearances: EncyclopediaAppearance[],
): EncyclopediaEntry {
  const storyDigest = buildStoryDigest(entry, appearances);
  let next: EncyclopediaEntry = { ...entry, storyDigest };

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
    next.shortBio !== entry.shortBio ||
    next.wiki !== entry.wiki ||
    next.storyDigest !== entry.storyDigest ||
    next.linkedCharacters.join("|") !== entry.linkedCharacters.join("|") ||
    next.linkedLocations.join("|") !== entry.linkedLocations.join("|") ||
    next.tags.join("|") !== entry.tags.join("|");

  if (!touched) return entry;
  return { ...next, updatedAt: Date.now() };
}

type LegacyEncyclopediaEntry = Partial<EncyclopediaEntry> & {
  id?: string;
  title?: string;
  kind?: string;
  stackId?: string;
};

/** Find or create a stack by display name (case-insensitive). */
export function ensureEncyclopediaStackNamed(
  stacks: EncyclopediaStack[],
  name: string,
): { stacks: EncyclopediaStack[]; stack: EncyclopediaStack } {
  const label = name.trim() || "General";
  const existing = findStackByName(stacks, label);
  if (existing) return { stacks, stack: existing };
  const stack = createEncyclopediaStack(
    {
      name: label,
      order: stacks.length,
    },
    stacks,
  );
  return { stacks: [...stacks, stack], stack };
}

function ensureStack(
  stacks: EncyclopediaStack[],
  name: string,
): { stacks: EncyclopediaStack[]; stack: EncyclopediaStack } {
  return ensureEncyclopediaStackNamed(stacks, name);
}

/**
 * Normalize stacks + entries; migrate legacy research lore and fixed kinds.
 */
export function ensureBookEncyclopedia(
  book: Omit<Book, "encyclopedia" | "encyclopediaStacks" | "research"> & {
    encyclopedia?: LegacyEncyclopediaEntry[];
    encyclopediaStacks?: EncyclopediaStack[];
    research?: Array<ResearchEntry & { kind?: string }>;
  },
): Book {
  const rawResearch = book.research ?? [];
  let stacks: EncyclopediaStack[] = [];
  for (const [i, s] of [...(book.encyclopediaStacks ?? [])].entries()) {
    stacks.push(
      createEncyclopediaStack(
        {
          ...s,
          name: s.name || "Untitled stack",
          order: s.order ?? i,
        },
        stacks,
      ),
    );
  }

  const loreMigrated: EncyclopediaEntry[] = [];
  const keptResearch: ResearchEntry[] = [];

  for (const e of rawResearch) {
    if ((e as { kind?: string }).kind === "lore") {
      const ensured = ensureStack(stacks, "Concepts");
      stacks = ensured.stacks;
      loreMigrated.push(researchLoreToEncyclopedia(e, ensured.stack.id));
    } else {
      keptResearch.push(e as ResearchEntry);
    }
  }

  const existingRaw = book.encyclopedia ?? [];
  const byId = new Set<string>();
  const entries: EncyclopediaEntry[] = [];

  for (const raw of existingRaw) {
    let stackId = raw.stackId ?? "";
    if (!stackId || !stacks.some((s) => s.id === stackId)) {
      const legacyKind = raw.kind ?? "unspecified";
      const label =
        LEGACY_ENCYCLOPEDIA_KIND_LABEL[legacyKind] ??
        (typeof legacyKind === "string" && legacyKind.trim()
          ? legacyKind
          : "General");
      const ensured = ensureStack(stacks, label);
      stacks = ensured.stacks;
      stackId = ensured.stack.id;
    }
    const entry = createEncyclopediaEntry({
      ...raw,
      id: raw.id,
      title: raw.title || "Untitled",
      stackId,
      links: raw.links ?? [],
      linkedCharacters: raw.linkedCharacters ?? [],
      linkedLocations: raw.linkedLocations ?? [],
      aliases: raw.aliases ?? [],
      tags: raw.tags ?? [],
      storyDigest: raw.storyDigest ?? "",
    });
    byId.add(entry.id);
    entries.push(entry);
  }

  for (const migrated of loreMigrated) {
    if (byId.has(migrated.id)) continue;
    if (
      entries.some((e) => e.title.toLowerCase() === migrated.title.toLowerCase())
    ) {
      continue;
    }
    entries.push(migrated);
  }

  // Ensure at least an empty stacks array (user adds what they need)
  stacks = sortEncyclopediaStacks(stacks);

  return {
    ...(book as Book),
    research: keptResearch,
    encyclopediaStacks: stacks,
    encyclopedia: entries,
  };
}

/**
 * Refresh digests / linked cast for existing encyclopedia cards.
 * Does not invent stacks or cards — stacks stay user-defined.
 */
export function syncEncyclopediaFromManuscript(book: Book): Book {
  let encyclopedia = [...(book.encyclopedia ?? [])];
  let changed = false;

  encyclopedia = encyclopedia.map((e) => {
    const appearances = encyclopediaAppearances(book.chapters, e);
    const enriched = enrichEncyclopediaFromStory(e, appearances);
    if (enriched !== e) changed = true;
    return enriched;
  });

  if (!changed) return book;
  return {
    ...book,
    encyclopedia,
    updatedAt: Date.now(),
  };
}
