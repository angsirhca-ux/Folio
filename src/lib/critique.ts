/**
 * Critique lenses — checklist Q&A for genre craft (never rewrites prose).
 * Fantasy worldbuilding ships first; add lenses as data + prompt later.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type {
  Book,
  Chapter,
  CritiqueItemResult,
  CritiqueLens,
  CritiqueLensId,
  CritiqueMemoryNote,
  CritiqueReview,
  CritiqueState,
  CritiqueVerdict,
  Location,
} from "./types";
import {
  chapterToPlainText,
  truncateChapterPlain,
} from "./developmentalEditor";
import { continuityNotesForPrompt } from "./continuity";
import { createId } from "./utils";

export const CRITIQUE_TOOL = "save_critique";
export const MAX_CRITIQUE_MEMORY = 48;
export const MAX_CRITIQUE_REVIEWS = 40;
export const CRITIQUE_MAX_TOKENS = 4096;

export const FANTASY_WORLDBUILDING_LENS: CritiqueLens = {
  id: "fantasy-worldbuilding",
  name: "Fantasy worldbuilding",
  blurb:
    "Hickson-style checklist — does the secondary world feel consequential, lived-in, and earned?",
  genres: ["fantasy"],
  questions: [
    {
      id: "magic-consequences",
      prompt: "Does every magical element have consequences?",
      redFlag: "Magic feels arbitrary.",
    },
    {
      id: "geography-culture",
      prompt: "Does geography explain politics and culture?",
      redFlag: "The world feels like a backdrop.",
    },
    {
      id: "history-present",
      prompt: "Does history affect the present?",
      redFlag: "The setting feels static.",
    },
    {
      id: "culture-origins",
      prompt: "Do cultures have believable origins?",
      redFlag: "They seem like stereotypes.",
    },
    {
      id: "native-thinking",
      prompt: "Do characters think like people from this world?",
      redFlag: "They feel transplanted from modern Earth.",
    },
    {
      id: "wb-serves-story",
      prompt:
        "Does worldbuilding create story opportunities instead of interrupting the story?",
      redFlag: "The lore overshadows the plot.",
    },
    {
      id: "rules-consistent",
      prompt: "Are the world's rules consistent?",
      redFlag: "Readers lose trust in the narrative.",
    },
    {
      id: "elements-earn-place",
      prompt: "Does every major worldbuilding element earn its place?",
      redFlag: "The setting feels cluttered.",
    },
  ],
};

export const DEFAULT_CRITIQUE_LENSES: CritiqueLens[] = [
  FANTASY_WORLDBUILDING_LENS,
];

export function emptyCritique(): CritiqueState {
  return { memory: [], reviews: [] };
}

export function lensById(id: string | undefined): CritiqueLens | null {
  return DEFAULT_CRITIQUE_LENSES.find((l) => l.id === id) ?? null;
}

export function ensureCritique(
  book: Omit<Book, "critique" | "dump"> & {
    critique?: CritiqueState;
    dump?: Book["dump"];
  },
): Book {
  const raw = book.critique;
  return {
    ...book,
    critique: {
      memory: Array.isArray(raw?.memory)
        ? (raw.memory
            .map(normalizeMemory)
            .filter(Boolean) as CritiqueMemoryNote[])
        : [],
      reviews: Array.isArray(raw?.reviews)
        ? (raw.reviews.map(normalizeReview).filter(Boolean) as CritiqueReview[])
        : [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
  } as Book;
}

function normalizeVerdict(value: unknown): CritiqueVerdict {
  if (value === "yes" || value === "partial" || value === "no") return value;
  return "partial";
}

function normalizeMemory(
  m: Partial<CritiqueMemoryNote>,
): CritiqueMemoryNote | null {
  if (!m?.text?.trim() || !m.lensId) return null;
  const lens = lensById(m.lensId);
  if (!lens) return null;
  const kind =
    m.kind === "pattern" ||
    m.kind === "strength" ||
    m.kind === "risk" ||
    m.kind === "general"
      ? m.kind
      : "general";
  return {
    id: m.id ?? createId(),
    at: typeof m.at === "number" ? m.at : Date.now(),
    lensId: lens.id,
    kind,
    text: m.text.trim().slice(0, 400),
    chapterId: m.chapterId,
  };
}

function normalizeItem(
  raw: {
    questionId?: string;
    verdict?: string;
    note?: string;
    excerpt?: string;
    suggestion?: string;
  },
  lens: CritiqueLens,
): CritiqueItemResult | null {
  if (!raw?.questionId || !raw.note?.trim()) return null;
  if (!lens.questions.some((q) => q.id === raw.questionId)) return null;
  return {
    questionId: raw.questionId,
    verdict: normalizeVerdict(raw.verdict),
    note: raw.note.trim().slice(0, 600),
    excerpt: raw.excerpt?.trim().slice(0, 280) || undefined,
    suggestion: raw.suggestion?.trim().slice(0, 280) || undefined,
  };
}

function normalizeReview(r: Partial<CritiqueReview>): CritiqueReview | null {
  if (!r?.chapterId || !r.lensId) return null;
  const lens = lensById(r.lensId);
  if (!lens) return null;
  const byId = new Map<string, CritiqueItemResult>();
  for (const item of r.items ?? []) {
    const n = normalizeItem(item, lens);
    if (n) byId.set(n.questionId, n);
  }
  // Ensure every lens question appears (fill gaps for old/partial payloads)
  const items = lens.questions.map((q) => {
    const existing = byId.get(q.id);
    if (existing) return existing;
    return {
      questionId: q.id,
      verdict: "partial" as const,
      note: "Insufficient evidence in this chapter to judge.",
    };
  });
  return {
    id: r.id ?? createId(),
    lensId: lens.id,
    chapterId: r.chapterId,
    chapterTitle: (r.chapterTitle ?? "").trim() || "Chapter",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    summary: (r.summary ?? "").trim().slice(0, 1600),
    items,
  };
}

export type CritiquePayload = {
  summary: string;
  items: Array<{
    questionId: string;
    verdict: string;
    note: string;
    excerpt?: string;
    suggestion?: string;
  }>;
  memoryUpdates?: Array<{
    kind?: CritiqueMemoryNote["kind"];
    text: string;
  }>;
};

export function normalizeCritiquePayload(
  raw: Partial<CritiquePayload> | null | undefined,
  args: {
    lens: CritiqueLens;
    chapter: Pick<Chapter, "id" | "title">;
  },
): { review: CritiqueReview; memoryUpdates: CritiqueMemoryNote[] } {
  const byId = new Map<string, CritiqueItemResult>();
  for (const item of raw?.items ?? []) {
    const n = normalizeItem(item, args.lens);
    if (n) byId.set(n.questionId, n);
  }
  const items = args.lens.questions.map((q) => {
    const existing = byId.get(q.id);
    if (existing) return existing;
    return {
      questionId: q.id,
      verdict: "partial" as const,
      note: "Insufficient evidence in this chapter to judge.",
    };
  });

  const review: CritiqueReview = {
    id: createId(),
    lensId: args.lens.id,
    chapterId: args.chapter.id,
    chapterTitle: args.chapter.title,
    createdAt: Date.now(),
    summary: (raw?.summary ?? "").trim().slice(0, 1600),
    items,
  };

  const memoryUpdates: CritiqueMemoryNote[] = (raw?.memoryUpdates ?? [])
    .filter((m) => m?.text?.trim())
    .slice(0, 6)
    .map((m) => ({
      id: createId(),
      at: Date.now(),
      lensId: args.lens.id,
      kind:
        m.kind === "pattern" ||
        m.kind === "strength" ||
        m.kind === "risk" ||
        m.kind === "general"
          ? m.kind
          : "pattern",
      text: m.text.trim().slice(0, 400),
      chapterId: args.chapter.id,
    }));

  return { review, memoryUpdates };
}

export function mergeCritiqueReview(
  state: CritiqueState,
  review: CritiqueReview,
  memoryUpdates: CritiqueMemoryNote[],
): CritiqueState {
  const memory = [...memoryUpdates, ...(state.memory ?? [])]
    .filter(
      (note, i, arr) =>
        arr.findIndex(
          (n) =>
            n.lensId === note.lensId &&
            n.text.toLowerCase() === note.text.toLowerCase(),
        ) === i,
    )
    .slice(0, MAX_CRITIQUE_MEMORY);

  const reviews = [
    review,
    ...(state.reviews ?? []).filter(
      (r) =>
        !(r.lensId === review.lensId && r.chapterId === review.chapterId),
    ),
  ].slice(0, MAX_CRITIQUE_REVIEWS);

  return { memory, reviews };
}

export function latestCritiqueReview(
  state: CritiqueState | undefined,
  lensId: CritiqueLensId,
  chapterId: string,
): CritiqueReview | undefined {
  return (state?.reviews ?? []).find(
    (r) => r.lensId === lensId && r.chapterId === chapterId,
  );
}

export function memoryForLens(
  state: CritiqueState | undefined,
  lensId: CritiqueLensId,
): CritiqueMemoryNote[] {
  return (state?.memory ?? []).filter((m) => m.lensId === lensId);
}

function bibleSnippet(
  label: string,
  lines: string[],
  limit: number,
): string {
  if (lines.length === 0) return "";
  return `${label}:\n${lines.slice(0, limit).join("\n")}`;
}

export function buildCritiqueContext(args: {
  book: Pick<
    Book,
    | "title"
    | "author"
    | "characters"
    | "locations"
    | "encyclopedia"
    | "research"
    | "chapters"
  >;
  chapter: Chapter;
  lens: CritiqueLens;
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
}): string {
  const plain = truncateChapterPlain(chapterToPlainText(args.chapter.content));
  const chapterIndex = args.book.chapters.findIndex(
    (c) => c.id === args.chapter.id,
  );
  const prior = args.book.chapters
    .slice(0, Math.max(0, chapterIndex))
    .map((c, i) => {
      const priorReview = args.reviews.find(
        (r) => r.lensId === args.lens.id && r.chapterId === c.id,
      );
      const bits = [
        (c.summary || "").trim().slice(0, 180),
        priorReview?.summary
          ? `Earlier critique: ${priorReview.summary.slice(0, 220)}`
          : "",
      ].filter(Boolean);
      return `- Ch ${i + 1} “${c.title}”: ${bits.join(" — ") || "(no notes yet)"}`;
    })
    .slice(-10);

  const memoryBlock =
    args.memory.length === 0
      ? "(none yet)"
      : args.memory
          .slice(0, 20)
          .map((m) => `- [${m.kind}] ${m.text}`)
          .join("\n");

  const cast = (args.book.characters ?? []).slice(0, 28).map((c) => {
    const asOf = continuityNotesForPrompt(c.continuityNotes, 2);
    return `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}${
      asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
    }`;
  });

  const places = (args.book.locations ?? [] as Location[]).slice(0, 28).map((l) => {
    const asOf = continuityNotesForPrompt(l.continuityNotes, 2);
    return `- ${l.name}${l.shortBio ? `: ${l.shortBio}` : ""}${
      asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
    }`;
  });

  const encyclopedia = (args.book.encyclopedia ?? [])
    .slice(0, 20)
    .map((e) => {
      const blurb = e.shortBio || e.summary || "";
      return `- ${e.title}${blurb ? `: ${blurb.slice(0, 140)}` : ""}`;
    });

  const research = (args.book.research ?? [])
    .slice(0, 12)
    .map((r) => {
      const blurb = r.shortBio || r.summary || "";
      return `- ${r.title}${blurb ? `: ${blurb.slice(0, 120)}` : ""}`;
    });

  const questions = args.lens.questions
    .map(
      (q) =>
        `- ${q.id}: ${q.prompt}\n  Red flag if no: ${q.redFlag}`,
    )
    .join("\n");

  return [
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Critique lens: ${args.lens.name}`,
    `Lens posture: ${args.lens.blurb}`,
    `Chapter under review: ${args.chapter.title}`,
    "",
    "DURABLE LENS MEMORY (patterns from earlier chapters — stay consistent):",
    memoryBlock,
    "",
    prior.length
      ? `PRIOR CHAPTER DIGESTS:\n${prior.join("\n")}`
      : "PRIOR CHAPTER DIGESTS: (opening / first chapter in order)",
    "",
    bibleSnippet("CAST", cast, 28),
    bibleSnippet("PLACES", places, 28),
    bibleSnippet("ENCYCLOPEDIA (in-world)", encyclopedia, 20),
    bibleSnippet("RESEARCH NOTES", research, 12),
    "",
    "CHECKLIST — answer EVERY question id with yes | partial | no:",
    questions,
    "",
    "CHAPTER TEXT:",
    plain || "(empty chapter)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function critiqueSystemPrompt(lens: CritiqueLens): string {
  return `You are a genre craft critic for a working novelist — not a copy editor and not a rewriter.
You apply the “${lens.name}” checklist to ONE chapter, using the book bible and prior digests when the chapter is thin.

HARD RULES:
- Do NOT rewrite, insert, or paste replacement prose into the manuscript.
- Answer EVERY checklist question id exactly once.
- verdict must be yes, partial, or no.
- For no or partial: prefer a short verbatim excerpt from the chapter when evidence exists; say so plainly when evidence is insufficient.
- note: spare diagnostic (what holds or fails). suggestion: one gentle “watch for…” seed — never a polished rewrite ready to paste.
- memoryUpdates: only durable lens patterns worth remembering later (max 5). Skip one-off nits.
- Be specific. No cheerleading. No marketing tone.
- Prefer concrete contradictions over vague vibes.

Lens: ${lens.blurb}`;
}

export function critiqueToolForLens(lens: CritiqueLens): Anthropic.Tool {
  const questionIds = lens.questions.map((q) => q.id);
  return {
    name: CRITIQUE_TOOL,
    description:
      "Save a genre critique checklist for one chapter — verdicts, notes, optional excerpts. Never manuscript rewrites.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "3–6 sentences: overall critique letter for this chapter under this lens.",
        },
        items: {
          type: "array",
          description: `One result per question id (${questionIds.join(", ")}).`,
          items: {
            type: "object",
            properties: {
              questionId: {
                type: "string",
                enum: questionIds,
              },
              verdict: {
                type: "string",
                enum: ["yes", "partial", "no"],
              },
              note: {
                type: "string",
                description: "Diagnostic — what holds or fails.",
              },
              excerpt: {
                type: "string",
                description:
                  "Short verbatim quote when no/partial is grounded in the chapter.",
              },
              suggestion: {
                type: "string",
                description:
                  "Gentle watch-for seed. Never polished replacement prose.",
              },
            },
            required: ["questionId", "verdict", "note"],
          },
        },
        memoryUpdates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["pattern", "strength", "risk", "general"],
              },
              text: { type: "string" },
            },
            required: ["text"],
          },
        },
      },
      required: ["summary", "items"],
    },
  };
}
