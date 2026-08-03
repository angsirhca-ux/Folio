import type { Book, ResearchEntry, ResearchKind, Chapter } from "@/lib/types";
import {
  createResearchLink,
  createResearchSource,
  researchAppearances,
  researchMatchesTitle,
  namesMatch,
} from "@/lib/research";
import { getSceneHtmlParts } from "@/lib/manuscriptScenes";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "@/lib/manuscriptContext";
import type { EnrichApplyMode } from "@/lib/characterEnrichment";

const AUTO_WIKI_PREFIX = "Compiled from the manuscript";

export type ResearchEnrichmentPayload = {
  kind?: ResearchKind;
  shortBio?: string;
  wiki?: string;
  summary?: string;
  questions?: string;
  aliases?: string[];
  tags?: string[];
  linkedCharacters?: string[];
  linkedLocations?: string[];
  sources?: Array<{
    title: string;
    citation?: string;
    quote?: string;
    notes?: string;
  }>;
  links?: Array<{
    toTitle: string;
    label: string;
    notes?: string;
  }>;
};

export type DiscoveredResearch = {
  title: string;
  kind?: ResearchKind;
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

export function buildResearchManuscriptContext(
  book: Pick<Book, "title" | "chapters" | "research" | "characters" | "locations">,
  entry: ResearchEntry,
): string {
  const appearances = researchAppearances(book.chapters, entry);
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Research topic: ${entry.title}`,
    entry.aliases.length ? `Aliases: ${entry.aliases.join(", ")}` : "",
    `Kind: ${entry.kind}`,
    entry.shortBio ? `Blurb: ${entry.shortBio}` : "",
    entry.wiki && !isAutoWiki(entry.wiki) ? `Author notes:\n${entry.wiki}` : "",
    `Cast: ${(book.characters ?? []).map((c) => c.name).join(", ") || "—"}`,
    `Places: ${(book.locations ?? []).map((l) => l.name).join(", ") || "—"}`,
    "",
    `Evidence scenes: ${appearances.length}. Use the FULL manuscript — every chapter.`,
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
        `Chapter ${a.chapterIndex + 1}: ${a.chapterTitle}`,
        `Scene: ${a.scene.title}${a.viaLabel ? " [label]" : " [prose]"}`,
        a.scene.synopsis ? `Synopsis: ${a.scene.synopsis}` : "",
        `Labels: ${(a.scene.labels ?? []).join(", ") || "—"}`,
        `Prose:`,
        prose || "(empty)",
        "",
      ]
        .filter((l) => l !== "")
        .join("\n"),
    );
  }

  if (appearances.length < 3) {
    book.chapters.forEach((chapter, chapterIndex) => {
      const htmlParts = getSceneHtmlParts(chapter.content);
      (chapter.scenes ?? []).forEach((scene, i) => {
        if (seen.has(scene.id)) return;
        const prose = scenePlain(htmlParts[i] ?? "");
        if (!prose) return;
        const clipped =
          prose.length > 1400 ? `${prose.slice(0, 1400).trim()}…` : prose;
        byChapter[chapterIndex].push(
          `---\nChapter ${chapterIndex + 1}: ${chapter.title}\nScene: ${scene.title}\nLabels: ${(scene.labels ?? []).join(", ") || "—"}\n${clipped}\n`,
        );
      });
    });
  }

  return packBalancedExcerpts(byChapter, MANUSCRIPT_CONTEXT_BUDGET, preamble);
}

export function buildResearchDiscoveryContext(
  book: Pick<Book, "title" | "chapters" | "research">,
): string {
  const known =
    (book.research ?? []).map((e) => e.title).join(", ") || "(none)";
  const preamble = [
    `Manuscript: ${book.title || "Untitled"}`,
    `Chapters: ${book.chapters.length}`,
    `Already in research: ${known}`,
    `Find themes, motifs, recurring images, and open questions across EVERY chapter.`,
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

export function researchSnapshotForPrompt(entry: ResearchEntry): string {
  return JSON.stringify(
    {
      title: entry.title,
      aliases: entry.aliases,
      kind: entry.kind,
      shortBio: entry.shortBio,
      wiki: isAutoWiki(entry.wiki) ? "" : entry.wiki,
      summary: entry.summary,
      questions: entry.questions,
      linkedCharacters: entry.linkedCharacters,
      linkedLocations: entry.linkedLocations,
      tags: entry.tags.filter((t) => t !== "from-story" && t !== "label"),
      sources: entry.sources.map((s) => ({
        title: s.title,
        citation: s.citation,
        quote: s.quote,
        notes: s.notes,
      })),
    },
    null,
    2,
  );
}

export function applyResearchEnrichment(
  entry: ResearchEntry,
  payload: ResearchEnrichmentPayload,
  roster: ResearchEntry[],
  mode: EnrichApplyMode = "fill-empty",
): ResearchEntry {
  let next: ResearchEntry = { ...entry };
  const fill = (current: string, incoming?: string) =>
    shouldFillField(current, incoming, mode);

  if (payload.kind && (next.kind === "unspecified" || mode === "deepen")) {
    next = { ...next, kind: payload.kind };
  }
  if (fill(next.shortBio, payload.shortBio)) {
    next = { ...next, shortBio: payload.shortBio!.trim() };
  }
  if (fill(next.wiki, payload.wiki)) {
    next = { ...next, wiki: payload.wiki!.trim() };
  }
  if (fill(next.summary, payload.summary)) {
    next = { ...next, summary: payload.summary!.trim() };
  }
  if (fill(next.questions, payload.questions)) {
    next = { ...next, questions: payload.questions!.trim() };
  }

  if (payload.aliases?.length) {
    const aliases = new Set(next.aliases);
    for (const a of payload.aliases) {
      if (a.trim() && !researchMatchesTitle(next, a)) aliases.add(a.trim());
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
    const people = new Set(
      mode === "deepen" ? [] : next.linkedCharacters,
    );
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

  if (payload.sources?.length) {
    const sources =
      mode === "deepen"
        ? next.sources.filter((s) => !s.notes.includes("(Claude)"))
        : [...next.sources];
    for (const s of payload.sources) {
      if (!s.title?.trim()) continue;
      if (sources.some((x) => namesMatch(x.title, s.title))) continue;
      sources.push(
        createResearchSource({
          title: s.title.trim(),
          citation: s.citation ?? "",
          quote: s.quote ?? "",
          notes: s.notes?.trim() || "From manuscript (Claude)",
        }),
      );
    }
    next = { ...next, sources };
  }

  if (payload.links?.length) {
    const links =
      mode === "deepen"
        ? next.links.filter((l) => !l.notes.includes("(Claude)"))
        : [...next.links];
    for (const r of payload.links) {
      if (!r.toTitle?.trim() || !r.label?.trim()) continue;
      const linked = roster.find((e) =>
        researchMatchesTitle(e, r.toTitle),
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
        createResearchLink({
          toEntryId: linked?.id ?? "",
          toTitle: linked?.title ?? r.toTitle.trim(),
          label: r.label.trim(),
          notes: r.notes?.trim() || "Linked by Claude",
        }),
      );
    }
    next = { ...next, links };
  }

  return { ...next, updatedAt: Date.now() };
}

export const ENRICH_RESEARCH_TOOL = "save_research_entry";

export const enrichResearchTool = {
  name: ENRICH_RESEARCH_TOOL,
  description:
    "Save an enriched research / commonplace entry grounded in the FULL manuscript.",
  input_schema: {
    type: "object" as const,
    properties: {
      kind: {
        type: "string",
        enum: [
          "theme",
          "motif",
          "period",
          "craft",
          "source",
          "lore",
          "question",
          "unspecified",
        ],
      },
      shortBio: { type: "string" },
      wiki: {
        type: "string",
        description: "2–5 paragraphs of research notes from the whole book.",
      },
      summary: { type: "string" },
      questions: { type: "string" },
      aliases: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      linkedCharacters: { type: "array", items: { type: "string" } },
      linkedLocations: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            citation: { type: "string" },
            quote: { type: "string" },
            notes: { type: "string" },
          },
          required: ["title"],
        },
      },
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

export const DISCOVER_RESEARCH_TOOL = "save_discovered_research";

export const discoverResearchTool = {
  name: DISCOVER_RESEARCH_TOOL,
  description:
    "List themes, motifs, and research topics from the FULL manuscript not already listed.",
  input_schema: {
    type: "object" as const,
    properties: {
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            kind: {
              type: "string",
              enum: [
                "theme",
                "motif",
                "period",
                "craft",
                "source",
                "lore",
                "question",
                "unspecified",
              ],
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
