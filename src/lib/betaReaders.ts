import type Anthropic from "@anthropic-ai/sdk";
import type {
  BetaCraftAnswer,
  BetaCraftQuestionId,
  BetaEmotion,
  BetaMemoryNote,
  BetaReaction,
  BetaReaderPersona,
  BetaReadersState,
  BetaReview,
  Book,
  Chapter,
} from "./types";
import { BETA_EMOTION_META } from "./types";
import {
  chapterToPlainText,
  truncateChapterPlain,
} from "./developmentalEditor";
import { createId } from "./utils";

export const BETA_READ_TOOL = "save_beta_read";
export const MAX_BETA_MEMORY = 48;
export const MAX_BETA_REVIEWS = 40;

export const BETA_CRAFT_QUESTIONS: Array<{
  id: BetaCraftQuestionId;
  prompt: string;
}> = [
  {
    id: "goals-clear",
    prompt:
      "Are the main character's goals and motivations clear in every scene?",
  },
  {
    id: "voices-distinct",
    prompt:
      "Do the characters sound distinct from one another when they speak?",
  },
  {
    id: "weakest-character",
    prompt: "Which character feels the weakest or least believable, and why?",
  },
  {
    id: "high-points-earned",
    prompt:
      "Do the emotional high points feel earned based on what happened before?",
  },
  {
    id: "loved",
    prompt: "What did you love about this chapter?",
  },
  {
    id: "disliked",
    prompt: "What did you not enjoy about this chapter?",
  },
];

const EMOTIONS: BetaEmotion[] = [
  "surprised",
  "bored",
  "shocked",
  "moved",
  "confused",
  "delighted",
  "tense",
  "detached",
  "curious",
  "skeptical",
  "anxious",
  "amused",
  "heartbroken",
  "hopeful",
];

export const DEFAULT_BETA_READERS: BetaReaderPersona[] = [
  {
    id: "beta-close-reader",
    name: "Mara",
    blurb:
      "Close literary reader who tracks character desire and emotional honesty. Notices when motivation goes foggy.",
  },
  {
    id: "beta-genre-fan",
    name: "Jules",
    blurb:
      "Genre-savvy page-turner who wants momentum, distinct voices, and earned twists. Bored by filler and flat dialogue.",
  },
  {
    id: "beta-skeptic",
    name: "Owen",
    blurb:
      "Skeptical craft-minded reader who questions believability and whether big feelings were set up. Remembers prior chapters carefully.",
  },
];

export function emptyBetaReaders(): BetaReadersState {
  return {
    readers: DEFAULT_BETA_READERS.map((r) => ({ ...r })),
    memory: [],
    reviews: [],
  };
}

export function ensureBetaReaders(
  book: Omit<Book, "betaReaders" | "dump"> & {
    betaReaders?: BetaReadersState;
    dump?: Book["dump"];
  },
): Book {
  const raw = book.betaReaders;
  const readers =
    Array.isArray(raw?.readers) && raw.readers.length > 0
      ? (raw.readers
          .map(normalizePersona)
          .filter(Boolean) as BetaReaderPersona[])
      : DEFAULT_BETA_READERS.map((r) => ({ ...r }));

  return {
    ...book,
    betaReaders: {
      readers,
      memory: Array.isArray(raw?.memory)
        ? (raw.memory.map(normalizeMemory).filter(Boolean) as BetaMemoryNote[])
        : [],
      reviews: Array.isArray(raw?.reviews)
        ? (raw.reviews.map(normalizeReview).filter(Boolean) as BetaReview[])
        : [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
  };
}

function normalizePersona(
  r: Partial<BetaReaderPersona>,
): BetaReaderPersona | null {
  if (!r?.name?.trim()) return null;
  return {
    id: r.id?.trim() || createId(),
    name: r.name.trim(),
    blurb: (r.blurb ?? "").trim() || "A careful beta reader.",
  };
}

function normalizeEmotion(value: unknown): BetaEmotion {
  if (typeof value === "string" && EMOTIONS.includes(value as BetaEmotion)) {
    return value as BetaEmotion;
  }
  return "curious";
}

function normalizeMemory(m: Partial<BetaMemoryNote>): BetaMemoryNote | null {
  if (!m?.text?.trim() || !m.readerId) return null;
  const kind =
    m.kind === "impression" ||
    m.kind === "expectation" ||
    m.kind === "attachment" ||
    m.kind === "confusion" ||
    m.kind === "general"
      ? m.kind
      : "general";
  return {
    id: m.id ?? createId(),
    at: typeof m.at === "number" ? m.at : Date.now(),
    readerId: m.readerId,
    kind,
    text: m.text.trim().slice(0, 400),
    chapterId: m.chapterId,
  };
}

function normalizeReview(r: Partial<BetaReview>): BetaReview | null {
  if (!r?.readerId || !r.chapterId) return null;
  return {
    id: r.id ?? createId(),
    readerId: r.readerId,
    chapterId: r.chapterId,
    chapterTitle: (r.chapterTitle ?? "").trim() || "Chapter",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    summary: (r.summary ?? "").trim().slice(0, 1600),
    reactions: (r.reactions ?? [])
      .map(normalizeReaction)
      .filter(Boolean) as BetaReaction[],
    craftAnswers: normalizeCraftAnswers(r.craftAnswers),
  };
}

function normalizeReaction(r: Partial<BetaReaction>): BetaReaction | null {
  if (!r?.note?.trim()) return null;
  return {
    id: r.id ?? createId(),
    emotion: normalizeEmotion(r.emotion),
    excerpt: r.excerpt?.trim().slice(0, 280) || undefined,
    note: r.note.trim().slice(0, 500),
  };
}

function normalizeCraftAnswers(
  raw: Partial<BetaCraftAnswer>[] | undefined,
): BetaCraftAnswer[] {
  const byId = new Map<string, string>();
  for (const a of raw ?? []) {
    if (!a?.questionId || !a.answer?.trim()) continue;
    byId.set(a.questionId, a.answer.trim().slice(0, 800));
  }
  return BETA_CRAFT_QUESTIONS.map((q) => ({
    questionId: q.id,
    answer: byId.get(q.id) || "(no answer)",
  }));
}

export type BetaReadPayload = {
  summary: string;
  reactions: Array<{
    emotion: string;
    excerpt?: string;
    note: string;
  }>;
  craftAnswers: Array<{
    questionId: string;
    answer: string;
  }>;
  memoryUpdates?: Array<{
    kind?: BetaMemoryNote["kind"];
    text: string;
  }>;
};

export function normalizeBetaReadPayload(
  raw: Partial<BetaReadPayload> | null | undefined,
  args: {
    reader: BetaReaderPersona;
    chapter: Pick<Chapter, "id" | "title">;
  },
): { review: BetaReview; memoryUpdates: BetaMemoryNote[] } {
  const review: BetaReview = {
    id: createId(),
    readerId: args.reader.id,
    chapterId: args.chapter.id,
    chapterTitle: args.chapter.title,
    createdAt: Date.now(),
    summary: (raw?.summary ?? "").trim().slice(0, 1600),
    reactions: (raw?.reactions ?? [])
      .map((r) =>
        normalizeReaction({
          emotion: normalizeEmotion(r.emotion),
          excerpt: r.excerpt,
          note: r.note,
        }),
      )
      .filter(Boolean)
      .slice(0, 12) as BetaReaction[],
    craftAnswers: normalizeCraftAnswers(
      raw?.craftAnswers as Partial<BetaCraftAnswer>[] | undefined,
    ),
  };

  const memoryUpdates: BetaMemoryNote[] = (raw?.memoryUpdates ?? [])
    .filter((m) => m?.text?.trim())
    .slice(0, 8)
    .map((m) => ({
      id: createId(),
      at: Date.now(),
      readerId: args.reader.id,
      kind:
        m.kind === "impression" ||
        m.kind === "expectation" ||
        m.kind === "attachment" ||
        m.kind === "confusion" ||
        m.kind === "general"
          ? m.kind
          : "impression",
      text: m.text.trim().slice(0, 400),
      chapterId: args.chapter.id,
    }));

  return { review, memoryUpdates };
}

export function mergeBetaReview(
  state: BetaReadersState,
  review: BetaReview,
  memoryUpdates: BetaMemoryNote[],
): BetaReadersState {
  const memory = [...memoryUpdates, ...(state.memory ?? [])]
    .filter(
      (note, i, arr) =>
        arr.findIndex(
          (n) =>
            n.readerId === note.readerId &&
            n.text.toLowerCase() === note.text.toLowerCase(),
        ) === i,
    )
    .slice(0, MAX_BETA_MEMORY);

  const reviews = [
    review,
    ...(state.reviews ?? []).filter(
      (r) =>
        !(r.readerId === review.readerId && r.chapterId === review.chapterId),
    ),
  ].slice(0, MAX_BETA_REVIEWS);

  return {
    readers: state.readers?.length
      ? state.readers
      : DEFAULT_BETA_READERS.map((r) => ({ ...r })),
    memory,
    reviews,
  };
}

export function latestBetaReview(
  state: BetaReadersState | undefined,
  readerId: string,
  chapterId: string,
): BetaReview | undefined {
  return (state?.reviews ?? []).find(
    (r) => r.readerId === readerId && r.chapterId === chapterId,
  );
}

export function memoryForReader(
  state: BetaReadersState | undefined,
  readerId: string,
): BetaMemoryNote[] {
  return (state?.memory ?? []).filter((m) => m.readerId === readerId);
}

export function buildBetaReadContext(args: {
  book: Pick<Book, "title" | "author" | "characters" | "chapters">;
  chapter: Chapter;
  reader: BetaReaderPersona;
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
}): string {
  const plain = truncateChapterPlain(chapterToPlainText(args.chapter.content));
  const chapterIndex = args.book.chapters.findIndex(
    (c) => c.id === args.chapter.id,
  );
  const prior = args.book.chapters
    .slice(0, Math.max(0, chapterIndex))
    .map((c, i) => {
      const priorReview = args.reviews.find(
        (r) => r.readerId === args.reader.id && r.chapterId === c.id,
      );
      const bits = [
        (c.summary || "").trim().slice(0, 180),
        priorReview?.summary
          ? `Your earlier take: ${priorReview.summary.slice(0, 220)}`
          : "",
      ].filter(Boolean);
      return `- Ch ${i + 1} “${c.title}”: ${bits.join(" — ") || "(no notes yet)"}`;
    })
    .slice(-12);

  const memoryBlock =
    args.memory.length === 0
      ? "(none yet — this may be your first chapter with this reader)"
      : args.memory
          .slice(0, 24)
          .map((m) => `- [${m.kind}] ${m.text}`)
          .join("\n");

  const cast = (args.book.characters ?? [])
    .slice(0, 30)
    .map((c) => `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}`)
    .join("\n");

  const questions = BETA_CRAFT_QUESTIONS.map(
    (q) => `- ${q.id}: ${q.prompt}`,
  ).join("\n");

  const emotions = EMOTIONS.map(
    (e) => `${e} (${BETA_EMOTION_META[e].label})`,
  ).join(", ");

  return [
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Beta reader: ${args.reader.name}`,
    `Reader posture: ${args.reader.blurb}`,
    `Chapter under review: ${args.chapter.title}`,
    "",
    "YOUR MEMORY FROM EARLIER CHAPTERS (carry these forward — they shape how you read this chapter):",
    memoryBlock,
    "",
    prior.length
      ? `PRIOR CHAPTER DIGESTS (what came before, including your earlier takes):\n${prior.join("\n")}`
      : "PRIOR CHAPTER DIGESTS: (this is the opening / first chapter in order)",
    "",
    cast ? `CAST ROSTER:\n${cast}` : "",
    "",
    "EMOTIONS you may use:",
    emotions,
    "",
    "CRAFT QUESTIONS — answer EVERY id:",
    questions,
    "",
    "CHAPTER TEXT:",
    plain || "(empty chapter)",
  ]
    .filter(Boolean)
    .join("\n");
}

export const betaReadSystemPrompt = `You are a beta reader for a working novelist — not a copy editor rewriting their book.
You read ONE chapter in character as the named beta reader, remembering what you carried from earlier chapters.

HARD RULES:
- Do NOT rewrite, insert, or paste replacement prose into the manuscript.
- Speak as a reader: honest emotional reactions and craft answers.
- Use YOUR MEMORY and prior chapter digests so your take stays consistent across the book.
- Every craft question id must receive an answer.
- reactions: 2–8 emotional beats from this chapter. Prefer concrete moments with a short verbatim excerpt when you can find one.
- memoryUpdates: only durable impressions worth remembering in later chapters (attachments, open questions, expectations, confusion). Skip one-off nits.
- Be specific and spare. No cheerleading. No marketing tone.`;

export const betaReadTool: Anthropic.Tool = {
  name: BETA_READ_TOOL,
  description:
    "Save a beta reader response for one chapter — emotions, craft answers, and durable memory. Never manuscript rewrites.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "2–5 sentences: your overall take on this chapter.",
      },
      reactions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            emotion: {
              type: "string",
              enum: [
                "surprised",
                "bored",
                "shocked",
                "moved",
                "confused",
                "delighted",
                "tense",
                "detached",
                "curious",
                "skeptical",
                "anxious",
                "amused",
                "heartbroken",
                "hopeful",
              ],
            },
            excerpt: {
              type: "string",
              description:
                "Short verbatim quote from the chapter when relevant.",
            },
            note: {
              type: "string",
              description: "Why you felt this.",
            },
          },
          required: ["emotion", "note"],
        },
      },
      craftAnswers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionId: {
              type: "string",
              enum: [
                "goals-clear",
                "voices-distinct",
                "weakest-character",
                "high-points-earned",
                "loved",
                "disliked",
              ],
            },
            answer: { type: "string" },
          },
          required: ["questionId", "answer"],
        },
      },
      memoryUpdates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "impression",
                "expectation",
                "attachment",
                "confusion",
                "general",
              ],
            },
            text: { type: "string" },
          },
          required: ["text"],
        },
      },
    },
    required: ["summary", "reactions", "craftAnswers"],
  },
};
