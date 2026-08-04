import { chapterToPlainText, formatMemoryBlocks } from "./developmentalEditor";
import {
  MANUSCRIPT_CONTEXT_BUDGET,
  packBalancedExcerpts,
} from "./manuscriptContext";
import { getSceneHtmlParts } from "./manuscriptScenes";
import { createId } from "./utils";
import type Anthropic from "@anthropic-ai/sdk";
import type {
  Book,
  DevelopmentalFlag,
  DevelopmentalFlagCategory,
  DevelopmentalMemoryNote,
  DevelopmentalPass,
  DevelopmentalSeverity,
} from "./types";

export const CONTINUITY_TOOL_NAME = "save_continuity_review";
export const CONTINUITY_BOOK_CHAPTER_ID = "__book__";

const CONTINUITY_CATEGORIES: DevelopmentalFlagCategory[] = [
  "name-variants",
  "cast-mismatch",
  "location-jump",
  "timeline",
  "forgotten-detail",
  "orphan-tag",
];

export type ContinuityPayload = {
  summary: string;
  flags: Array<{
    category: DevelopmentalFlagCategory;
    severity?: DevelopmentalSeverity;
    excerpt: string;
    note: string;
    suggestions: [string, string] | string[];
    chapterTitle?: string;
    chapterId?: string;
    sceneIndex?: number;
  }>;
  memoryUpdates?: Array<{
    kind?: "continuity" | "general";
    text: string;
  }>;
};

function normalizeSuggestions(raw: unknown): [string, string] {
  const list = Array.isArray(raw)
    ? raw
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .map((s) => s.slice(0, 280))
    : [];
  while (list.length < 2) {
    list.push(
      list.length === 0
        ? "Consider checking earlier chapters for the established detail."
        : "Consider a quiet reminder beat so the reader (and later you) stay aligned.",
    );
  }
  return [list[0], list[1]];
}

function resolveChapterId(
  rawId: string | undefined,
  rawTitle: string | undefined,
  book: Pick<Book, "chapters">,
): string | undefined {
  if (rawId && book.chapters.some((c) => c.id === rawId)) return rawId;
  const title = rawTitle?.trim().toLowerCase();
  if (!title) return undefined;
  const hit = book.chapters.find(
    (c) => c.title.trim().toLowerCase() === title,
  );
  return hit?.id;
}

export function normalizeContinuityPayload(
  payload: ContinuityPayload,
  book: Pick<Book, "chapters" | "title">,
): { pass: DevelopmentalPass; memoryUpdates: DevelopmentalMemoryNote[] } {
  const allowed = new Set(CONTINUITY_CATEGORIES);
  const flags: DevelopmentalFlag[] = (payload.flags ?? [])
    .filter((f) => f && allowed.has(f.category))
    .filter((f) => f.excerpt?.trim() && f.note?.trim())
    .slice(0, 60)
    .map((f) => {
      const chapterId = resolveChapterId(f.chapterId, f.chapterTitle, book);
      const sceneIndex =
        typeof f.sceneIndex === "number" && Number.isFinite(f.sceneIndex)
          ? Math.max(0, Math.floor(f.sceneIndex))
          : undefined;
      return {
        id: createId(),
        category: f.category,
        severity:
          f.severity === "issue" || f.severity === "watch" || f.severity === "note"
            ? f.severity
            : "watch",
        excerpt: f.excerpt.trim().slice(0, 280),
        note: f.note.trim().slice(0, 600),
        suggestions: normalizeSuggestions(f.suggestions),
        verdict: null,
        closed: false,
        chapterId,
        sceneIndex,
      };
    });

  const pass: DevelopmentalPass = {
    id: createId(),
    kind: "continuity",
    chapterId: CONTINUITY_BOOK_CHAPTER_ID,
    chapterTitle: book.title?.trim() || "Whole book",
    createdAt: Date.now(),
    summary: (payload.summary ?? "").trim().slice(0, 1600),
    flags,
  };

  const memoryUpdates: DevelopmentalMemoryNote[] = (payload.memoryUpdates ?? [])
    .filter((m) => m?.text?.trim())
    .slice(0, 10)
    .map((m) => ({
      id: createId(),
      at: Date.now(),
      kind: m.kind === "continuity" ? "continuity" : "general",
      text: m.text.trim().slice(0, 400),
    }));

  return { pass, memoryUpdates };
}

/** Ordered scene ledger + balanced prose for book-wide continuity. */
export function buildContinuityContext(
  book: Pick<
    Book,
    | "title"
    | "author"
    | "chapters"
    | "characters"
    | "locations"
    | "research"
  >,
  memory: DevelopmentalMemoryNote[],
  series?: {
    title: string;
    synopsis?: string;
    notes?: string;
    characters?: Book["characters"];
    locations?: Book["locations"];
  } | null,
): string {
  const ledgerLines: string[] = [];
  const chapterBlocks: string[][] = [];

  book.chapters.forEach((ch, ci) => {
    const parts = getSceneHtmlParts(ch.content ?? "");
    const scenes = ch.scenes ?? [];
    const blocks: string[] = [];

    parts.forEach((html, si) => {
      const scene = scenes[si];
      const plain = chapterToPlainText(html);
      if (plain.replace(/\s+/g, "").length < 20) return;

      ledgerLines.push(
        [
          `${ci + 1}.${si + 1}`,
          `chId=${ch.id}`,
          `ch="${ch.title}"`,
          `scene="${scene?.title?.trim() || `Scene ${si + 1}`}"`,
          scene?.pov ? `pov=${scene.pov}` : "",
          scene?.location ? `loc=${scene.location}` : "",
          scene?.characters?.length
            ? `cast=${scene.characters.join("/")}`
            : "",
          scene?.act ? `act=${scene.act}` : "",
          scene?.synopsis ? `synopsis=${scene.synopsis.slice(0, 160)}` : "",
          ch.summary ? `chSummary=${ch.summary.slice(0, 120)}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      );

      const excerpt = plain;
      blocks.push(
        `---\nChapter ${ci + 1} “${ch.title}” · scene ${si + 1}` +
          (scene?.title ? ` “${scene.title}”` : "") +
          `\nid=${ch.id} sceneIndex=${si}\n${excerpt}`,
      );
    });

    chapterBlocks.push(blocks);
  });

  const cast = (book.characters ?? [])
    .slice(0, 50)
    .map((c) => {
      const alias = c.aliases?.length ? ` (aka ${c.aliases.join(", ")})` : "";
      const bits = [
        c.shortBio,
        c.identity?.appearance,
        c.identity?.distinguishing,
        c.secrets ? `secret:${c.secrets.slice(0, 80)}` : "",
      ]
        .filter(Boolean)
        .join("; ");
      return `- ${c.name}${alias}${bits ? `: ${bits.slice(0, 200)}` : ""}`;
    })
    .join("\n");

  const places = (book.locations ?? [])
    .slice(0, 50)
    .map((l) => {
      const bits = [
        l.shortBio,
        l.place?.region,
        l.connections?.length
          ? `links:${l.connections
              .slice(0, 4)
              .map((c) => c.toName || c.label)
              .join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("; ");
      return `- ${l.name}${bits ? `: ${bits.slice(0, 180)}` : ""}`;
    })
    .join("\n");

  const research = (book.research ?? [])
    .slice(0, 24)
    .map((r) => `- ${r.title}${r.shortBio ? `: ${r.shortBio.slice(0, 100)}` : ""}`)
    .join("\n");

  const seriesCast = (series?.characters ?? [])
    .slice(0, 40)
    .map((c) => {
      const bits = [c.shortBio, c.identity?.appearance]
        .filter(Boolean)
        .join("; ");
      return `- ${c.name}${bits ? `: ${bits.slice(0, 160)}` : ""}`;
    })
    .join("\n");

  const seriesPlaces = (series?.locations ?? [])
    .slice(0, 40)
    .map((l) => {
      const bits = [l.shortBio, l.place?.region].filter(Boolean).join("; ");
      return `- ${l.name}${bits ? `: ${bits.slice(0, 160)}` : ""}`;
    })
    .join("\n");

  const seriesBlock =
    series &&
    (seriesCast || seriesPlaces || series.synopsis || series.notes)
      ? [
          `SERIES BIBLE (“${series.title}”):`,
          series.synopsis ? `Synopsis: ${series.synopsis.slice(0, 400)}` : "",
          series.notes ? `Notes: ${series.notes.slice(0, 600)}` : "",
          seriesCast ? `Shared cast:\n${seriesCast}` : "",
          seriesPlaces ? `Shared places:\n${seriesPlaces}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

  const { preferencesBlock, generalBlock } = formatMemoryBlocks(memory);

  const preamble = [
    `Book: ${book.title || "Untitled"}`,
    book.author ? `Author: ${book.author}` : "",
    "Pass: Continuity (whole manuscript)",
    "",
    "AUTHOR PREFERENCES (from ✓ liked / ✕ not useful — respect tone; never suppress real continuity contradictions because of dislike):",
    preferencesBlock,
    "",
    "EDITOR MEMORY:",
    generalBlock,
    "",
    seriesBlock,
    cast ? `CAST BIBLE:\n${cast}` : "",
    places ? `PLACES BIBLE:\n${places}` : "",
    research ? `RESEARCH:\n${research}` : "",
    "",
    "SCENE LEDGER (order of the book — use chId / sceneIndex on flags):",
    ledgerLines.length ? ledgerLines.join("\n") : "(no scenes yet)",
    "",
    "PROSE EXCERPTS (balanced across chapters):",
  ]
    .filter(Boolean)
    .join("\n");

  return packBalancedExcerpts(
    chapterBlocks,
    MANUSCRIPT_CONTEXT_BUDGET,
    preamble,
  );
}

export function continuitySystemPrompt(): string {
  return `You are a continuity editor for a working novelist.
You read the WHOLE book (ledger + excerpts + bible) and FLAG inconsistencies — you never rewrite the manuscript.

HARD RULES:
- Do NOT insert or rewrite manuscript prose. Suggestions stay in this review only.
- Every flag needs: verbatim excerpt (findable in the provided text), diagnostic note, EXACTLY TWO gentle suggestions ("perhaps…", "consider…").
- Include chapterId (exact id from ledger) and sceneIndex when possible; also chapterTitle.
- Prefer concrete contradictions over vague vibes.
- Respect AUTHOR PREFERENCES for tone of feedback; never skip a real continuity contradiction because the author disliked a similar note.
- If the book is thin, return few or no flags rather than inventing problems.
- memoryUpdates: only durable continuity facts worth remembering later.

CONTINUITY CATEGORIES — use only these:
1. name-variants — same person/place spelled or nicknamed inconsistently without being listed as an alias.
2. cast-mismatch — someone present in prose who isn't in scene cast/POV, or casted but never appears; orphan names with no wiki.
3. location-jump — impossible or unexplained place changes between adjacent scenes; tagged place vs prose mismatch.
4. timeline — order, time-of-day, season, or duration claims that contradict earlier chapters/summaries.
5. forgotten-detail — an established bible/prose detail (scar, prop, rule, relationship) contradicted or dropped later.
6. orphan-tag — scene metadata (POV, location, cast label) that doesn't match any roster entry or the prose.

Flag only genuine continuity risks. Skip style and craft nits (those belong to other passes).`;
}

export const continuityTool: Anthropic.Tool = {
  name: CONTINUITY_TOOL_NAME,
  description:
    "Save book-wide continuity flags. Suggestions stay in this review — never applied to the manuscript.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "3–6 sentences: overall continuity letter for the author.",
      },
      flags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: CONTINUITY_CATEGORIES,
            },
            severity: {
              type: "string",
              enum: ["note", "watch", "issue"],
            },
            excerpt: {
              type: "string",
              description: "Short verbatim quote from the provided text.",
            },
            note: {
              type: "string",
              description: "What is inconsistent and with what earlier fact.",
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 2,
            },
            chapterId: {
              type: "string",
              description: "Exact chapter id from the scene ledger.",
            },
            chapterTitle: {
              type: "string",
              description: "Chapter title as shown in the ledger.",
            },
            sceneIndex: {
              type: "number",
              description: "0-based scene index within the chapter.",
            },
          },
          required: ["category", "excerpt", "note", "suggestions"],
        },
      },
      memoryUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["continuity", "general"],
            },
            text: { type: "string" },
          },
          required: ["text"],
        },
      },
    },
    required: ["summary", "flags"],
  },
};
