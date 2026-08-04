import type {
  Book,
  EncyclopediaEntry,
  Chapter,
} from "@/lib/types";
import {
  createEncyclopediaLink,
  encyclopediaAppearances,
  encyclopediaMatchesTitle,
} from "@/lib/encyclopedia";
import { namesMatch } from "@/lib/research";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "@/lib/manuscriptContext";
import type { EnrichApplyMode } from "@/lib/characterEnrichment";

const AUTO_WIKI_PREFIX = "Compiled from the manuscript";

export type EncyclopediaEnrichmentPayload = {
  /** Suggested stack name — caller creates/matches the stack. */
  stackName?: string;
  shortBio?: string;
  wiki?: string;
  summary?: string;
  aliases?: string[];
  tags?: string[];
  linkedCharacters?: string[];
  linkedLocations?: string[];
  links?: Array<{
    toTitle: string;
    label: string;
    notes?: string;
  }>;
};

export type DiscoveredEncyclopedia = {
  title: string;
  stackName?: string;
  shortBio?: string;
  evidence?: string;
};

function filled(value: string | undefined | null): boolean {
  return Boolean(value && value.trim());
}

function isAutoWiki(wiki: string): boolean {
  return wiki.trim().startsWith(AUTO_WIKI_PREFIX);
}

export function shouldFillField(
  current: string | undefined,
  incoming: string | undefined,
  mode: EnrichApplyMode = "fill-empty",
): boolean {
  if (!incoming?.trim()) return false;
  if (mode === "deepen") return true;
  if (!filled(current)) return true;
  if (isAutoWiki(current ?? "")) return true;
  return false;
}

function scenePlain(html: string): string {
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

export function buildEncyclopediaManuscriptContext(
  book: Pick<
    Book,
    | "title"
    | "chapters"
    | "encyclopedia"
    | "encyclopediaStacks"
    | "characters"
    | "locations"
  >,
  entry: EncyclopediaEntry,
): string {
  const appearances = encyclopediaAppearances(book.chapters, entry);
  const stackName =
    (book.encyclopediaStacks ?? []).find((s) => s.id === entry.stackId)?.name ??
    "Unsorted";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Encyclopedia article: ${entry.title}`,
    `Stack: ${stackName}`,
    entry.aliases.length ? `Aliases: ${entry.aliases.join(", ")}` : "",
    entry.shortBio ? `Blurb: ${entry.shortBio}` : "",
    entry.wiki && !isAutoWiki(entry.wiki) ? `Author notes:\n${entry.wiki}` : "",
    `Cast: ${(book.characters ?? []).map((c) => c.name).join(", ") || "—"}`,
    `Places: ${(book.locations ?? []).map((l) => l.name).join(", ") || "—"}`,
    `Existing stacks: ${(book.encyclopediaStacks ?? []).map((s) => s.name).join(", ") || "(none)"}`,
    "",
    `Evidence scenes: ${appearances.length}. Use the FULL manuscript — every chapter.`,
    "Extract IN-WORLD canon only. Do not invent outside research sources.",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const byChapter: string[][] = book.chapters.map(() => []);
  const seen = new Set<string>();

  for (const a of appearances) {
    const chapter = book.chapters.find((c) => c.id === a.chapterId);
    if (!chapter) continue;
    const htmlParts = getSceneHtmlParts(chapter.content);
    const prose = scenePlain(htmlParts[a.sceneIndex] ?? "");
    seen.add(a.scene.id);
    byChapter[a.chapterIndex]?.push(
      [
        `---`,
        `Chapter ${a.chapterIndex + 1}: ${a.chapterTitle} / ${a.scene.title}`,
        `Labels: ${(a.scene.labels ?? []).join(", ") || "—"}`,
        prose,
        "",
      ].join("\n"),
    );
  }

  book.chapters.forEach((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    (chapter.scenes ?? []).forEach((scene, sceneIndex) => {
      if (seen.has(scene.id)) return;
      const prose = scenePlain(htmlParts[sceneIndex] ?? "");
      if (prose.length < 40) return;
      byChapter[chapterIndex]?.push(
        [
          `---`,
          `Chapter ${chapterIndex + 1}: ${chapter.title} / ${scene.title}`,
          `Labels: ${(scene.labels ?? []).join(", ") || "—"}`,
          prose,
          "",
        ].join("\n"),
      );
    });
  });

  return packBalancedExcerpts(byChapter, MANUSCRIPT_CONTEXT_BUDGET, preamble);
}

export function buildEncyclopediaDiscoveryContext(
  book: Pick<Book, "title" | "chapters" | "encyclopedia" | "encyclopediaStacks">,
): string {
  const known =
    (book.encyclopedia ?? []).map((e) => e.title).join(", ") || "(none)";
  const stacks =
    (book.encyclopediaStacks ?? []).map((s) => s.name).join(", ") || "(none yet)";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Already in encyclopedia: ${known}`,
    `Existing stacks: ${stacks}`,
    `Find in-world canon across EVERY chapter. Suggest a short stackName for each (reuse an existing stack when it fits).`,
    `Skip literary themes/motifs (those belong in Research). Skip topics already listed.`,
    "",
    "Excerpts:",
  ].join("\n");

  const byChapter: string[][] = book.chapters.map((chapter, chapterIndex) => {
    const htmlParts = getSceneHtmlParts(chapter.content);
    const blocks: string[] = [];
    for (let i = 0; i < htmlParts.length; i++) {
      const prose = scenePlain(htmlParts[i] ?? "");
      if (!prose) continue;
      const scene = chapter.scenes?.[i];
      blocks.push(
        `---\nChapter ${chapterIndex + 1}: ${chapter.title} / ${scene?.title ?? `Scene ${i + 1}`}\nLabels: ${(scene?.labels ?? []).join(", ") || "—"}\n${prose}\n`,
      );
    }
    return blocks;
  });

  return packBalancedExcerpts(byChapter, MANUSCRIPT_CONTEXT_BUDGET, preamble);
}

export function encyclopediaSnapshotForPrompt(entry: EncyclopediaEntry): string {
  return JSON.stringify(
    {
      title: entry.title,
      aliases: entry.aliases,
      stackId: entry.stackId,
      shortBio: entry.shortBio,
      wiki: isAutoWiki(entry.wiki) ? "" : entry.wiki,
      summary: entry.summary,
      linkedCharacters: entry.linkedCharacters,
      linkedLocations: entry.linkedLocations,
      memberIds: entry.memberIds ?? [],
      memberLocationIds: entry.memberLocationIds ?? [],
      continuityNotes: (entry.continuityNotes ?? []).map((n) => ({
        asOf: n.asOf,
        note: n.note,
      })),
      tags: entry.tags.filter((t) => t !== "from-story" && t !== "label"),
    },
    null,
    2,
  );
}

export function applyEncyclopediaEnrichment(
  entry: EncyclopediaEntry,
  payload: EncyclopediaEnrichmentPayload,
  roster: EncyclopediaEntry[],
  mode: EnrichApplyMode = "fill-empty",
): EncyclopediaEntry {
  let next: EncyclopediaEntry = { ...entry };
  const fill = (current: string, incoming?: string) =>
    shouldFillField(current, incoming, mode);

  if (fill(next.shortBio, payload.shortBio)) {
    next = { ...next, shortBio: payload.shortBio!.trim() };
  }
  if (fill(next.wiki, payload.wiki)) {
    next = { ...next, wiki: payload.wiki!.trim() };
  }
  if (fill(next.summary, payload.summary)) {
    next = { ...next, summary: payload.summary!.trim() };
  }

  if (payload.aliases?.length) {
    const aliases = new Set(next.aliases);
    for (const a of payload.aliases) {
      if (a.trim() && !encyclopediaMatchesTitle(next, a)) aliases.add(a.trim());
    }
    next = { ...next, aliases: [...aliases] };
  }

  const tags = new Set(next.tags);
  for (const t of payload.tags ?? []) {
    if (t.trim()) tags.add(t.trim().toLowerCase());
  }
  tags.add("claude");
  next = { ...next, tags: [...tags] };

  if (payload.linkedCharacters?.length) {
    const people = new Set(mode === "deepen" ? [] : next.linkedCharacters);
    if (mode !== "deepen") {
      for (const n of next.linkedCharacters) people.add(n);
    }
    for (const n of payload.linkedCharacters) {
      if (n.trim()) people.add(n.trim());
    }
    next = {
      ...next,
      linkedCharacters: [...people].sort((a, b) => a.localeCompare(b)),
    };
  }

  if (payload.linkedLocations?.length) {
    const places = new Set(mode === "deepen" ? [] : next.linkedLocations);
    if (mode !== "deepen") {
      for (const n of next.linkedLocations) places.add(n);
    }
    for (const n of payload.linkedLocations) {
      if (n.trim()) places.add(n.trim());
    }
    next = {
      ...next,
      linkedLocations: [...places].sort((a, b) => a.localeCompare(b)),
    };
  }

  if (payload.links?.length) {
    const links =
      mode === "deepen"
        ? next.links.filter((l) => !l.notes.includes("(Clarence)") && !l.notes.includes("(Claude)"))
        : [...next.links];
    for (const r of payload.links) {
      if (!r.toTitle?.trim() || !r.label?.trim()) continue;
      const linked = roster.find((e) =>
        encyclopediaMatchesTitle(e, r.toTitle),
      );
      if (
        links.some(
          (x) =>
            namesMatch(x.toTitle, r.toTitle) ||
            (linked && x.toEntryId === linked.id),
        )
      ) {
        continue;
      }
      links.push(
        createEncyclopediaLink({
          toEntryId: linked?.id ?? "",
          toTitle: linked?.title ?? r.toTitle.trim(),
          label: r.label.trim(),
          notes: r.notes?.trim() || "Linked by Clarence",
        }),
      );
    }
    next = { ...next, links };
  }

  return { ...next, updatedAt: Date.now() };
}

export const ENRICH_ENCYCLOPEDIA_TOOL = "save_encyclopedia_entry";

export const enrichEncyclopediaTool = {
  name: ENRICH_ENCYCLOPEDIA_TOOL,
  description:
    "Save an enriched in-world encyclopedia article grounded in the FULL manuscript.",
  input_schema: {
    type: "object" as const,
    properties: {
      stackName: {
        type: "string",
        description:
          "Short stack name for this article (e.g. Customs, Case files, Magic). Reuse an existing stack when it fits.",
      },
      shortBio: { type: "string" },
      wiki: {
        type: "string",
        description: "2–5 paragraphs of in-world canon notes from the whole book.",
      },
      summary: { type: "string" },
      aliases: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      linkedCharacters: { type: "array", items: { type: "string" } },
      linkedLocations: { type: "array", items: { type: "string" } },
      links: {
        type: "array",
        items: {
          type: "object",
          properties: {
            toTitle: { type: "string" },
            label: { type: "string" },
            notes: { type: "string" },
          },
          required: ["toTitle", "label"],
        },
      },
    },
  },
};

export const DISCOVER_ENCYCLOPEDIA_TOOL = "save_discovered_encyclopedia";

export const discoverEncyclopediaTool = {
  name: DISCOVER_ENCYCLOPEDIA_TOOL,
  description:
    "List in-world encyclopedia articles from the FULL manuscript not already listed.",
  input_schema: {
    type: "object" as const,
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            stackName: {
              type: "string",
              description: "Suggested stack name; reuse existing stacks when possible.",
            },
            shortBio: { type: "string" },
            evidence: { type: "string" },
          },
          required: ["title"],
        },
      },
    },
    required: ["entries"],
  },
};

export function chaptersHaveProse(chapters: Chapter[]): boolean {
  return chapters.some((ch) => scenePlain(ch.content).length > 40);
}
