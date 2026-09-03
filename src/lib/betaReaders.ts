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
  BetaWouldContinue,
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
export const BETA_READ_STRETCH_TOOL = "save_beta_read_stretch";
export const MANUSCRIPT_BETA_CHAPTER_ID = "__manuscript__";
export const MANUSCRIPT_BETA_TITLE = "Full manuscript";
export const MAX_BETA_MEMORY = 48;
export const MAX_BETA_REVIEWS = 40;
/** Runaway guard — not a quota. Long chapters should fill as they go. */
export const MAX_BETA_REACTIONS = 80;
/** Legacy floor — actual saved cap scales with window count via manuscriptBetaReactionCap. */
export const MAX_MANUSCRIPT_BETA_REACTIONS = 120;
/** Per window chunk before merge — not the saved full-manuscript total. */
export const MAX_MANUSCRIPT_WINDOW_REACTIONS = 40;
export const BETA_READ_MAX_TOKENS = 16_384;
export const MANUSCRIPT_BETA_WINDOW_CHARS = 12_000;

/** Saved reaction cap scales with how many reading windows the manuscript used. */
export function manuscriptBetaReactionCap(windowTotal: number): number {
  return Math.min(
    600,
    Math.max(MAX_MANUSCRIPT_BETA_REACTIONS, windowTotal * 22),
  );
}

/** Keep reactions spread across the whole read when over the save cap. */
export function capManuscriptReactions(
  reactions: BetaReaction[],
  max: number,
): BetaReaction[] {
  if (reactions.length <= max) return reactions;
  if (max <= 0) return [];
  if (max === 1) return [reactions[0]!];

  const last = reactions.length - 1;
  const result: BetaReaction[] = [];
  for (let i = 0; i < max; i++) {
    result.push(reactions[Math.round((i * last) / (max - 1))]!);
  }
  return result;
}

/** Floor for beat-by-beat reactions from chapter length — never a ceiling. */
export function targetBetaReactionCount(
  plainLength: number,
  windowTotal = 1,
): {
  min: number;
  softMax: number;
} {
  let min: number;
  if (plainLength < 2_500) min = 6;
  else if (plainLength < 6_000) min = 10;
  else if (plainLength < 12_000) min = 16;
  else min = 22;

  const softMax =
    windowTotal > 1
      ? Math.max(
          min + 2,
          Math.ceil(manuscriptBetaReactionCap(windowTotal) / windowTotal),
        )
      : MAX_BETA_REACTIONS;

  return { min, softMax };
}

export const BETA_CRAFT_QUESTIONS: Array<{
  id: BetaCraftQuestionId;
  prompt: string;
}> = [
  {
    id: "follow-up",
    prompt:
      "How did this sit after what you just read — the page you wanted, a jolt, a stall? (If this is the opening: did you want to stay in this book?)",
  },
  {
    id: "keep-reading",
    prompt: "Would you keep going in this book tonight — and why (or why not)?",
  },
  {
    id: "skimmed",
    prompt: "Where did your attention drift, if it did? Be honest.",
  },
  {
    id: "believed",
    prompt: "What didn’t you buy — a choice, a feeling, a coincidence?",
  },
  {
    id: "loved",
    prompt: "What did you actually love? (A moment in the story, not a compliment.)",
  },
  {
    id: "disliked",
    prompt: "What rubbed you the wrong way as a reader of this book?",
  },
  {
    id: "carrying",
    prompt:
      "What are you carrying into the next chapter of this book — hope, dread, a question?",
  },
];

/** Same ids as chapter reads — prompts for the last chapter in the manuscript. */
export const BETA_LAST_CHAPTER_CRAFT_QUESTIONS: Array<{
  id: BetaCraftQuestionId;
  prompt: string;
}> = [
  {
    id: "follow-up",
    prompt:
      "How did this chapter follow from what you just read — and does it work as where the book stands for now?",
  },
  {
    id: "keep-reading",
    prompt:
      "As of this ending, are you satisfied — would you tell someone to read this book? Why or why not?",
  },
  {
    id: "skimmed",
    prompt: "Where did your attention drift in this chapter, if it did?",
  },
  {
    id: "believed",
    prompt: "What didn’t you buy in this chapter?",
  },
  {
    id: "loved",
    prompt: "What did you actually love in this stretch?",
  },
  {
    id: "disliked",
    prompt: "What rubbed you wrong as a reader?",
  },
  {
    id: "carrying",
    prompt:
      "What feeling or question are you left with when you close the book here?",
  },
];

export const BETA_MANUSCRIPT_CRAFT_QUESTIONS: Array<{
  id: BetaCraftQuestionId;
  prompt: string;
}> = [
  {
    id: "opening-hold",
    prompt:
      "Did the opening earn your time — would you have kept reading after the first chapter?",
  },
  {
    id: "middle-drag",
    prompt: "Where did the book lose you in the middle, if anywhere? Be specific.",
  },
  {
    id: "ending-land",
    prompt: "How did the ending land for you?",
  },
  {
    id: "keep-reading",
    prompt: "Would you recommend this book to someone like you — and why or why not?",
  },
  {
    id: "skimmed",
    prompt: "Where did your attention drift or skim across the whole book?",
  },
  {
    id: "believed",
    prompt: "What didn’t you buy across the story?",
  },
  {
    id: "loved",
    prompt: "What will you actually remember?",
  },
  {
    id: "disliked",
    prompt: "What rubbed you wrong as a reader of the whole book?",
  },
  {
    id: "carrying",
    prompt:
      "What feeling or question stays with you when you close the book?",
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
      "Reads for the heart. Wants to feel someone wanting something. Impatient when the book gets clever instead of honest. Will forgive a slow page if the interior is true; will bounce if people become plot devices.",
  },
  {
    id: "beta-genre-fan",
    name: "Jules",
    blurb:
      "Reads in bed and will DNF. Wants a reason to turn the page — hook, voice, a question hanging. Skims landscape and logistics. Lives for a twist that was seeded, hates a twist that was sprung.",
  },
  {
    id: "beta-skeptic",
    name: "Owen",
    blurb:
      "The friend who says “would they though?” Remembers what you told him two chapters ago. Suspicious of convenience, speeches, and feelings that arrive without a body. Rooting for the book — that’s why he’s hard.",
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
  const stock = new Map(DEFAULT_BETA_READERS.map((r) => [r.id, r]));
  const readers =
    Array.isArray(raw?.readers) && raw.readers.length > 0
      ? (raw.readers
          .map((r) => {
            const n = normalizePersona(r);
            if (!n) return null;
            const fresh = stock.get(n.id);
            return fresh ? { ...fresh } : n;
          })
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
  const manuscript = r.chapterId === MANUSCRIPT_BETA_CHAPTER_ID;
  return {
    id: r.id ?? createId(),
    readerId: r.readerId,
    chapterId: r.chapterId,
    chapterTitle: manuscript
      ? MANUSCRIPT_BETA_TITLE
      : (r.chapterTitle ?? "").trim() || "Chapter",
    createdAt: typeof r.createdAt === "number" ? r.createdAt : Date.now(),
    summary: (r.summary ?? "").trim().slice(0, 1600),
    reactions: (r.reactions ?? [])
      .map(normalizeReaction)
      .filter(Boolean)
      .slice(0, manuscript ? 600 : MAX_BETA_REACTIONS) as BetaReaction[],
    craftAnswers: normalizeCraftAnswers(r.craftAnswers, manuscript, r.terminalChapter),
    readerWish: (r.readerWish ?? "").trim().slice(0, 1200),
    wouldContinue: normalizeWouldContinue(r.wouldContinue),
    terminalChapter: r.terminalChapter === true ? true : undefined,
  };
}

function normalizeWouldContinue(value: unknown): BetaWouldContinue | undefined {
  if (value === "yes" || value === "maybe" || value === "no") return value;
  return undefined;
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
  manuscript = false,
  terminalChapter = false,
): BetaCraftAnswer[] {
  const questions = manuscript
    ? BETA_MANUSCRIPT_CRAFT_QUESTIONS
    : terminalChapter
      ? BETA_LAST_CHAPTER_CRAFT_QUESTIONS
      : BETA_CRAFT_QUESTIONS;
  const byId = new Map<string, string>();
  for (const a of raw ?? []) {
    if (!a?.questionId || !a.answer?.trim()) continue;
    byId.set(a.questionId, a.answer.trim().slice(0, 800));
  }
  if (!manuscript) {
    // Older reviews used workshop prompts — fold them into the reader debrief.
    if (!byId.has("keep-reading") && byId.has("high-points-earned")) {
      byId.set("keep-reading", byId.get("high-points-earned")!);
    }
    if (!byId.has("believed") && byId.has("weakest-character")) {
      byId.set("believed", byId.get("weakest-character")!);
    }
    if (!byId.has("carrying") && byId.has("goals-clear")) {
      byId.set("carrying", byId.get("goals-clear")!);
    }
    if (!byId.has("skimmed") && byId.has("voices-distinct")) {
      byId.set("skimmed", byId.get("voices-distinct")!);
    }
  }
  return questions.map((q) => ({
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
  /** What this reader would emotionally want instead — or like-it-as-is. */
  readerWish?: string;
  wouldContinue?: string;
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
    manuscript?: boolean;
    terminalChapter?: boolean;
  },
): { review: BetaReview; memoryUpdates: BetaMemoryNote[] } {
  const manuscript =
    args.manuscript ?? args.chapter.id === MANUSCRIPT_BETA_CHAPTER_ID;
  const terminalChapter = Boolean(args.terminalChapter && !manuscript);
  const review: BetaReview = {
    id: createId(),
    readerId: args.reader.id,
    chapterId: args.chapter.id,
    chapterTitle: manuscript ? MANUSCRIPT_BETA_TITLE : args.chapter.title,
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
      .slice(
        0,
        manuscript ? MAX_MANUSCRIPT_WINDOW_REACTIONS : MAX_BETA_REACTIONS,
      ) as BetaReaction[],
    craftAnswers: normalizeCraftAnswers(
      raw?.craftAnswers as Partial<BetaCraftAnswer>[] | undefined,
      args.manuscript,
      terminalChapter,
    ),
    readerWish: (raw?.readerWish ?? "").trim().slice(0, 1200),
    wouldContinue: normalizeWouldContinue(raw?.wouldContinue),
    terminalChapter: terminalChapter ? true : undefined,
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
      chapterId: manuscript ? undefined : args.chapter.id,
    }));

  return { review, memoryUpdates };
}

export type ManuscriptBetaWindow = {
  index: number;
  total: number;
  label: string;
  plain: string;
  fromChapter: number;
  toChapter: number;
};

/** Pack sequential chapters into reading windows for a full-manuscript beta pass. */
export function partitionManuscriptBetaWindows(
  chapters: Pick<Chapter, "title" | "content">[],
  maxChars = MANUSCRIPT_BETA_WINDOW_CHARS,
): ManuscriptBetaWindow[] {
  const blocks = chapters
    .map((ch, i) => ({
      num: i + 1,
      title: (ch.title || "Untitled").trim(),
      plain: truncateChapterPlain(chapterToPlainText(ch.content ?? "")),
    }))
    .filter((b) => b.plain.trim());

  if (blocks.length === 0) return [];

  type Pack = {
    nums: number[];
    titles: string[];
    plains: string[];
    size: number;
  };
  const packs: Pack[] = [];
  let current: Pack | null = null;

  const flush = () => {
    if (!current) return;
    packs.push(current);
    current = null;
  };

  for (const block of blocks) {
    const section = `## Chapter ${block.num}: ${block.title}\n\n${block.plain}`;
    if (!current) {
      current = {
        nums: [block.num],
        titles: [block.title],
        plains: [section],
        size: section.length,
      };
      continue;
    }
    if (current.size + section.length + 4 > maxChars) {
      flush();
      current = {
        nums: [block.num],
        titles: [block.title],
        plains: [section],
        size: section.length,
      };
    } else {
      current.nums.push(block.num);
      current.titles.push(block.title);
      current.plains.push(section);
      current.size += section.length + 4;
    }
  }
  flush();

  const total = packs.length;
  return packs.map((p, index) => ({
    index,
    total,
    label:
      p.nums.length === 1
        ? `Chapter ${p.nums[0]}`
        : `Chapters ${p.nums[0]}–${p.nums[p.nums.length - 1]}`,
    plain: p.plains.join("\n\n* * *\n\n"),
    fromChapter: p.nums[0]!,
    toChapter: p.nums[p.nums.length - 1]!,
  }));
}

/** Compact reading log for windowed full-manuscript debriefs. */
export function formatManuscriptReactionDigest(
  reactions: BetaReaction[],
  maxChars = 14_000,
): string {
  if (reactions.length === 0) return "(none yet — you are at the start of the book)";
  const lines: string[] = [];
  let size = 0;
  for (let i = 0; i < reactions.length; i++) {
    const r = reactions[i]!;
    const excerpt = r.excerpt ? ` “${r.excerpt.slice(0, 140)}”` : "";
    const line = `${i + 1}. [${r.emotion}]${excerpt} ${r.note.slice(0, 220)}`;
    if (size + line.length + 1 > maxChars) {
      lines.push(
        `… (${reactions.length - i} earlier beats omitted — use the beats above only.)`,
      );
      break;
    }
    lines.push(line);
    size += line.length + 1;
  }
  return lines.join("\n");
}

export function buildManuscriptBetaContext(args: {
  book: Pick<Book, "title" | "author" | "characters" | "chapters">;
  reader: BetaReaderPersona;
  window: ManuscriptBetaWindow;
  memory: BetaMemoryNote[];
  chapterReviews: BetaReview[];
  previousWindowEnding?: string;
  /** Reactions logged in earlier windows — required grounding for the final debrief. */
  stretchReactions?: BetaReaction[];
}): string {
  const chapters = args.book.chapters ?? [];
  const { min, softMax } = targetBetaReactionCount(
    args.window.plain.length,
    args.window.total,
  );
  const toc = chapters
    .map((c, i) => `${i + 1}. ${c.title || "Untitled"}`)
    .join("\n");

  const priorChapterReads = args.chapterReviews
    .filter((r) => r.chapterId !== MANUSCRIPT_BETA_CHAPTER_ID)
    .map((r) => {
      const idx = chapters.findIndex((c) => c.id === r.chapterId);
      const title =
        chapters[idx]?.title ?? r.chapterTitle ?? `Chapter ${idx + 1}`;
      return `- Ch ${idx >= 0 ? idx + 1 : "?"} “${title}”: ${r.summary.slice(0, 180)}${r.wouldContinue ? ` · would continue: ${r.wouldContinue}` : ""}`;
    })
    .slice(-14);

  const memoryBlock =
    args.memory.length === 0
      ? "(none yet)"
      : args.memory
          .slice(0, 24)
          .map((m) => `- [${m.kind}] ${m.text}`)
          .join("\n");

  const cast = (args.book.characters ?? [])
    .slice(0, 30)
    .map((c) => `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}`)
    .join("\n");

  const isFinal = args.window.index === args.window.total - 1;
  const stretchDigest =
    isFinal && (args.stretchReactions?.length ?? 0) > 0
      ? formatManuscriptReactionDigest(args.stretchReactions!)
      : "";
  const questions = (isFinal ? BETA_MANUSCRIPT_CRAFT_QUESTIONS : [])
    .map((q) => `- ${q.id}: ${q.prompt}`)
    .join("\n");

  const emotions = EMOTIONS.map(
    (e) => `${e} (${BETA_EMOTION_META[e].label})`,
  ).join(", ");

  return [
    `You are reading the FULL MANUSCRIPT of a novel — not a workshop chapter.`,
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Beta reader: ${args.reader.name}`,
    `Reader posture: ${args.reader.blurb}`,
    `Reading window ${args.window.index + 1} of ${args.window.total}: ${args.window.label}`,
    isFinal
      ? "This is the FINAL stretch — you are closing the book. Answer the whole-book debrief after your reactions."
      : "You are NOT finished yet — reactions and memory only on this window. No whole-book verdict yet.",
    "",
    toc ? `TABLE OF CONTENTS:\n${toc}` : "",
    "",
    priorChapterReads.length
      ? `OPTIONAL — chapter-by-chapter reads you did earlier in Folio (may color your memory, but read THIS text fresh):\n${priorChapterReads.join("\n")}`
      : "",
    "",
    stretchDigest
      ? `YOUR READING LOG from earlier windows (in order — this is your ONLY memory of the opening and middle; do not invent plot beyond these beats, memory, and the text below):\n${stretchDigest}`
      : "",
    "WHAT YOU CARRY SO FAR IN THIS FULL-MANUSCRIPT READ:",
    memoryBlock,
    "",
    args.previousWindowEnding
      ? `WHERE YOU LEFT OFF in the last reading window:\n${args.previousWindowEnding}`
      : "You are starting the book from the beginning.",
    "",
    cast ? `People in this story:\n${cast}` : "",
    "",
    "EMOTIONS you may use:",
    emotions,
    "",
    `REACTION FLOOR for this window: at least ${min}; usually ${softMax} or fewer unless this stretch is packed with feelings. Walk in reading order through the text below. Include chapter context in excerpts when helpful.`,
    "",
    isFinal
      ? "WHEN YOU FINISH THE BOOK — answer EVERY id in first person. Ground opening/middle/ending answers in YOUR READING LOG and memory — never invent scenes, deaths, twists, or relationships you did not mark while reading. If something never registered, say so.\n" +
        questions
      : "",
    "",
    "TEXT FOR THIS WINDOW:",
    args.window.plain || "(empty)",
  ]
    .filter(Boolean)
    .join("\n");
}

export const betaReadManuscriptSystemPrompt = `You are one specific beta reader finishing (or continuing) a FULL NOVEL read — cover to cover, not a chapter workshop.

You are not a developmental editor or teacher. You are a reader with taste, patience limits, and a body that responds while you read.

HOW REAL READERS TALK ON A FULL BOOK:
- First person throughout.
- Along the way: mark lulls, hooks, disbelief, attachment, dread, delight as they happen in reading order.
- On the final stretch: step back — did the opening earn you, where did the middle sag, how did the ending land, would you recommend it?
- Specific moments with short verbatim excerpts so the author can find the page.

FORBIDDEN:
- Do NOT rewrite prose.
- Do NOT say “the author should”, “consider revising”, workshop structure, or copy-edit notes.
- No cheerleading or marketing.

WINDOWED READS:
- If you are not on the final window, save reactions + memoryUpdates ONLY — you have not closed the book yet.
- On the final window, answer the whole-book debrief, wouldContinue, readerWish, and summary.

ACCURACY (final window):
- summary, craftAnswers, and readerWish must ONLY describe plot, characters, and events from YOUR READING LOG, memory notes, or THIS window's text.
- Do NOT infer story beats from the table of contents or character bios alone.
- Do NOT invent scenes, twists, deaths, or relationships you never logged while reading.
- For opening and middle questions, cite what you actually felt in earlier reaction beats — if you skimmed or forgot, say that honestly.`;

export const betaReadStretchTool: Anthropic.Tool = {
  name: BETA_READ_STRETCH_TOOL,
  description:
    "Save along-the-way reactions while reading part of a full manuscript. Not the final debrief.",
  input_schema: {
    type: "object",
    properties: {
      reactions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            emotion: {
              type: "string",
              enum: EMOTIONS,
            },
            excerpt: { type: "string" },
            note: { type: "string" },
          },
          required: ["emotion", "note"],
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
    required: ["reactions"],
  },
};

export type BetaReadStretchPayload = {
  reactions: BetaReadPayload["reactions"];
  memoryUpdates?: BetaReadPayload["memoryUpdates"];
};

export function normalizeBetaReadStretchPayload(
  raw: Partial<BetaReadStretchPayload> | null | undefined,
  reader: BetaReaderPersona,
): { reactions: BetaReaction[]; memoryUpdates: BetaMemoryNote[] } {
  const reactions = (raw?.reactions ?? [])
    .map((r) =>
      normalizeReaction({
        emotion: normalizeEmotion(r.emotion),
        excerpt: r.excerpt,
        note: r.note,
      }),
    )
    .filter(Boolean) as BetaReaction[];

  const memoryUpdates: BetaMemoryNote[] = (raw?.memoryUpdates ?? [])
    .filter((m) => m?.text?.trim())
    .slice(0, 6)
    .map((m) => ({
      id: createId(),
      at: Date.now(),
      readerId: reader.id,
      kind:
        m.kind === "impression" ||
        m.kind === "expectation" ||
        m.kind === "attachment" ||
        m.kind === "confusion" ||
        m.kind === "general"
          ? m.kind
          : "impression",
      text: m.text.trim().slice(0, 400),
    }));

  return { reactions, memoryUpdates };
}

export function mergeManuscriptBetaWindows(args: {
  reader: BetaReaderPersona;
  stretchReactions: BetaReaction[];
  final: BetaReview;
  windowTotal: number;
}): BetaReview {
  const cap = manuscriptBetaReactionCap(args.windowTotal);
  const reactions = capManuscriptReactions(
    [...args.stretchReactions, ...args.final.reactions],
    cap,
  );
  return {
    ...args.final,
    reactions,
  };
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

export function isManuscriptBetaReview(review: Pick<BetaReview, "chapterId">): boolean {
  return review.chapterId === MANUSCRIPT_BETA_CHAPTER_ID;
}

export function latestManuscriptBetaReview(
  state: BetaReadersState | undefined,
  readerId: string,
): BetaReview | undefined {
  return latestBetaReview(state, readerId, MANUSCRIPT_BETA_CHAPTER_ID);
}

export function craftQuestionsForReview(
  review: Pick<BetaReview, "chapterId" | "terminalChapter">,
): Array<{ id: BetaCraftQuestionId; prompt: string }> {
  if (isManuscriptBetaReview(review)) {
    return BETA_MANUSCRIPT_CRAFT_QUESTIONS;
  }
  if (review.terminalChapter) {
    return BETA_LAST_CHAPTER_CRAFT_QUESTIONS;
  }
  return BETA_CRAFT_QUESTIONS;
}

/** Display prompts — infers last-chapter wording for older reviews when still the book end. */
export function craftQuestionsForStoredReview(
  review: Pick<BetaReview, "chapterId" | "terminalChapter">,
  chapters?: Pick<Chapter, "id">[],
): Array<{ id: BetaCraftQuestionId; prompt: string }> {
  if (
    !review.terminalChapter &&
    chapters &&
    !isManuscriptBetaReview(review) &&
    isLastChapterInBook(chapters, review.chapterId)
  ) {
    return craftQuestionsForReview({ ...review, terminalChapter: true });
  }
  return craftQuestionsForReview(review);
}

export function isLastChapterInBook(
  chapters: Pick<Chapter, "id">[],
  chapterId: string,
): boolean {
  if (chapters.length === 0) return false;
  const index = chapters.findIndex((c) => c.id === chapterId);
  return index >= 0 && index === chapters.length - 1;
}

export function memoryForReader(
  state: BetaReadersState | undefined,
  readerId: string,
): BetaMemoryNote[] {
  return (state?.memory ?? []).filter((m) => m.readerId === readerId);
}

export function chapterEndingPlain(html: string, max = 4_500): string {
  const plain = chapterToPlainText(html ?? "");
  if (!plain.trim()) return "";
  if (plain.length <= max) return plain;
  return `[…you were already in the book…]\n\n${plain.slice(-max)}`;
}

export function buildBetaReadContext(args: {
  book: Pick<Book, "title" | "author" | "characters" | "chapters">;
  chapter: Chapter;
  reader: BetaReaderPersona;
  memory: BetaMemoryNote[];
  reviews: BetaReview[];
  /** Immediate previous chapter — so the handoff is felt, not inferred. */
  previousChapter?: Pick<Chapter, "id" | "title" | "content"> | null;
}): string {
  const plain = truncateChapterPlain(chapterToPlainText(args.chapter.content));
  const { min } = targetBetaReactionCount(plain.length);
  const chapters = args.book.chapters ?? [];
  const chapterIndex = chapters.findIndex((c) => c.id === args.chapter.id);
  const isLastChapter = isLastChapterInBook(chapters, args.chapter.id);
  const place =
    chapterIndex < 0
      ? "somewhere in the book"
      : `chapter ${chapterIndex + 1} of ${chapters.length}`;
  const nextTitle =
    !isLastChapter && chapterIndex >= 0 && chapterIndex < chapters.length - 1
      ? chapters[chapterIndex + 1]?.title
      : null;
  const prevMeta =
    args.previousChapter ??
    (chapterIndex > 0 ? chapters[chapterIndex - 1] : null);
  const leftOff = prevMeta
    ? chapterEndingPlain(
        "content" in prevMeta ? (prevMeta.content as string) ?? "" : "",
      )
    : "";
  const prior = chapters
    .slice(0, Math.max(0, chapterIndex))
    .map((c, i) => {
      const priorReview = args.reviews.find(
        (r) => r.readerId === args.reader.id && r.chapterId === c.id,
      );
      const carrying = priorReview?.craftAnswers?.find(
        (a) => a.questionId === "carrying",
      )?.answer;
      const follow = priorReview?.craftAnswers?.find(
        (a) => a.questionId === "follow-up",
      )?.answer;
      const wish = priorReview?.readerWish?.trim().slice(0, 180);
      const cont = priorReview?.wouldContinue;
      const lastBeats = (priorReview?.reactions ?? [])
        .slice(-3)
        .map((rx) => rx.emotion)
        .join(", ");
      const bits = [
        (c.summary || "").trim().slice(0, 160),
        priorReview?.summary
          ? `You said: ${priorReview.summary.slice(0, 200)}`
          : "",
        carrying && carrying !== "(no answer)"
          ? `You were carrying: ${carrying.slice(0, 180)}`
          : "",
        follow && follow !== "(no answer)"
          ? `How it sat then: ${follow.slice(0, 140)}`
          : "",
        cont ? `Keep reading then: ${cont}` : "",
        wish ? `You wanted: ${wish}` : "",
        lastBeats ? `Last beats you felt: ${lastBeats}` : "",
      ].filter(Boolean);
      return `- Ch ${i + 1} “${c.title}”: ${bits.join(" — ") || "(you haven’t read this one yet)"}`;
    })
    .slice(-12);

  const toc = chapters
    .map((c, i) => {
      const here = c.id === args.chapter.id ? " ← you are here" : "";
      return `${i + 1}. ${c.title || "Untitled"}${here}`;
    })
    .join("\n");

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

  const questions = (isLastChapter
    ? BETA_LAST_CHAPTER_CRAFT_QUESTIONS
    : BETA_CRAFT_QUESTIONS
  )
    .map((q) => `- ${q.id}: ${q.prompt}`)
    .join("\n");

  const emotions = EMOTIONS.map(
    (e) => `${e} (${BETA_EMOTION_META[e].label})`,
  ).join(", ");

  return [
    `You are reading a NOVEL, not workshopping a standalone chapter.`,
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Beta reader: ${args.reader.name}`,
    `Reader posture: ${args.reader.blurb}`,
    `Place in the book: ${place} — “${args.chapter.title}”`,
    isLastChapter
      ? "LAST CHAPTER: This is the end of the manuscript as it exists today. There is no next chapter — read and respond as if you are closing the book here, not waiting for more."
      : nextTitle
        ? `There is more after this (next is “${nextTitle}”). You have not read it yet — don’t invent it.`
        : "This is the last chapter in the manuscript as you have it.",
    "",
    toc ? `THE BOOK SO FAR (table of contents):\n${toc}` : "",
    "",
    "WHAT YOU ALREADY CARRY (from earlier in THIS book — it colors how this chapter lands):",
    memoryBlock,
    "",
    prior.length
      ? `HOW YOU FELT IN EARLIER CHAPTERS:\n${prior.join("\n")}`
      : "This is the opening. You are starting the book.",
    "",
    leftOff && prevMeta
      ? `WHERE YOU LEFT OFF — the end of “${prevMeta.title}”, still in your body as you turn the page:\n${leftOff}`
      : "",
    "",
    cast ? `People you know in this story:\n${cast}` : "",
    "",
    "EMOTIONS you may use:",
    emotions,
    "",
    `REACTION FLOOR: at least ${min} along-the-way reactions, more if more feelings hit. Start with how this chapter FOLLOWS (or fails to follow) what you just left. Walk in reading order. No maximum.`,
    "",
    isLastChapter
      ? "WHEN I CLOSED THE BOOK HERE — answer EVERY id in first person. This is the ending as written so far — not a cliffhanger waiting for another chapter:"
      : "WHEN I FINISHED THIS STRETCH OF THE BOOK — answer EVERY id in first person, as a reader mid-novel (or at the opening), not as a teacher:",
    questions,
    "",
    "WHAT YOU ARE READING NOW (this chapter of the book):",
    plain || "(empty chapter)",
  ]
    .filter(Boolean)
    .join("\n");
}

export const betaReadSystemPrompt = `You are one specific beta reader in the middle of a NOVEL (or opening it). You just turned the page. You are not a developmental editor, copy editor, or workshop leader handed “a chapter to critique.”

This stretch only matters as the next part of the book you are already in. Ask yourself: is this a good follow-up? Did it pick up what I was carrying? Did it stall, jolt, or give me the page I wanted after the last one?

Stay in character as the named reader (taste, patience, vices in READER POSTURE). Mara, Jules, and Owen should DISAGREE when the story hits their sore spots. Do not write a balanced committee memo.

HOW REAL BETA READERS TALK:
- First person: “I…”, “I wanted…”, “I skimmed…”, “I didn’t buy…”
- Continuity of FEELING across chapters: “after last chapter I needed…”, “this is exactly where I hoped we’d go”, “this doesn’t follow from where we left her.”
- Along the way, not after-the-fact lecture. Mark lulls, laughs, confusion, attachment, suspicion as they happen.
- Honest about putting the book down. “I’d keep going tonight” / “I’d check my phone” / “I’d stop” is a real answer.
- Predict. Hope. Root for someone. Carry a question into the NEXT chapter of this same book.
- Specific moments with a short verbatim excerpt so the author can find the page.

FORBIDDEN:
- Do NOT rewrite, insert, or paste replacement prose.
- Do NOT say “the author should”, “consider revising”, “this scene needs”, “craft-wise”, “as a chapter this works because…”
- Do NOT treat this as a self-contained assignment. No “goals in every scene,” no workshop structure notes, no copy-edit (commas, tense, POV labels). That’s a different panel.
- Do NOT invent unread later chapters. You may know a next chapter exists; you have not read it.
- No cheerleading, no marketing, no “great job overall.”

REACTIONS:
- If this is not the opening, your FIRST reactions should include the handoff from WHERE YOU LEFT OFF.
- Walk in reading order. Hit the REACTION FLOOR; keep going if more distinct feelings hit. There is no maximum.
- Cover the landing, turns, talk, lulls, and the exit into whatever might come next — not only the climax.
- Notes are 1–3 sentences of lived response, not diagnosis.

AFTER YOU FINISH THIS STRETCH:
- wouldContinue: yes (you’d turn the page in this book tonight), maybe, no.
- Answer every WHEN I FINISHED id in first person, including how it followed the last chapter.
- readerWish: what you wanted more/less of in the story from here — OR that you’d change nothing. Desire language only.
- summary: 1–2 first-person sentences about this part of the BOOK, last in the tool call.
- memoryUpdates: only what you’ll need later in this novel (who you care about, what you’re waiting for, distrust, a question). Max 5.`;

export function betaReadSystemPromptForChapter(isLastChapter: boolean): string {
  if (!isLastChapter) return betaReadSystemPrompt;

  return `${betaReadSystemPrompt}

LAST CHAPTER (AS WRITTEN SO FAR):
- This is the LAST chapter in the manuscript. Nothing comes after — do not read or wait for a next chapter.
- Do NOT ask what happens next, what you are carrying into a next chapter, or whether you would turn the page tonight as if more exists.
- wouldContinue: yes = you are glad you read it / would recommend as it stands; maybe = mixed; no = you would have stopped or feel let down by where it ends.
- Reactions should cover the landing and exit of the book as it stands — closure, open threads, emotional aftertaste — not setup for unread chapters.
- readerWish: what you wanted from THIS ending or from the book as it stands — not “in the next chapter.”`;
}

export function betaReadChapterUserReminder(args: {
  isLastChapter: boolean;
  min: number;
}): string {
  if (args.isLastChapter) {
    return `Remember:
- This is the LAST chapter in the manuscript. There is nothing after — close the book here.
- reactions FIRST — along the way, in order (at least ${args.min}; more if more feelings hit). Cover how the book lands and what you feel closing it.
- wouldContinue: yes / maybe / no — would you recommend the book as it stands?
- Answer every WHEN I CLOSED THE BOOK id (follow-up, keep-reading, skimmed, believed, loved, disliked, carrying).
- readerWish: what you wanted from this ending or the book as it stands — OR you would change nothing.
- summary last — 1–2 first-person sentences about closing the book here.
- memoryUpdates only for durable impressions (max 5).
- Never rewrite. Never “the author should.” Do not tease a next chapter.`;
  }

  return `Remember:
- You are mid-book (or opening it). Judge the HANDOFF: is this a good follow-up to where you left off?
- reactions FIRST — along the way, in order (at least ${args.min}; more if more feelings hit; no maximum). If not the opening, start with how it follows. Short verbatim excerpt. First person.
- wouldContinue: yes / maybe / no — would you keep going in THIS book?
- Answer every WHEN I FINISHED id (follow-up, keep-reading, skimmed, believed, loved, disliked, carrying).
- readerWish: what you would want more/less of in the story from here, OR you would change nothing.
- summary last — 1–2 first-person sentences about this part of the book.
- memoryUpdates only for later in this novel (max 5).
- Never rewrite. Never “the author should.” Never treat this as a standalone assignment.`;
}

export const betaReadTool: Anthropic.Tool = {
  name: BETA_READ_TOOL,
  description:
    "Save one beta reader’s lived response to the next stretch of a novel — handoff from the last chapter, along-the-way reactions, wouldContinue, first-person debrief, reader wish. Never workshop notes or manuscript rewrites.",
  input_schema: {
    type: "object",
    properties: {
      reactions: {
        type: "array",
        description:
          "Along-the-way responses in reading order. If this isn’t the opening, start with how it follows WHERE YOU LEFT OFF. Follow REACTION FLOOR; no maximum. Verbatim excerpt preferred. First person.",
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
                "Short verbatim quote from the chapter for this beat (strongly preferred).",
            },
            note: {
              type: "string",
              description:
                "First person: what you felt here. Not ‘the author should’.",
            },
          },
          required: ["emotion", "note"],
        },
      },
      wouldContinue: {
        type: "string",
        enum: ["yes", "maybe", "no"],
        description:
          "yes = you’d turn the page tonight; maybe = you might later; no = you’d stop here.",
      },
      craftAnswers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionId: {
              type: "string",
              enum: [
                "follow-up",
                "keep-reading",
                "skimmed",
                "believed",
                "loved",
                "disliked",
                "carrying",
              ],
            },
            answer: {
              type: "string",
              description: "First-person reader answer. Not a craft lecture.",
            },
          },
          required: ["questionId", "answer"],
        },
      },
      readerWish: {
        type: "string",
        description:
          "What you emotionally wanted more or less of — or that you’d change nothing. Desire language only; no pasted rewrite.",
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
      summary: {
        type: "string",
        description:
          "ONE or TWO first-person sentences — overall take. Beats belong in reactions.",
      },
    },
    required: [
      "reactions",
      "wouldContinue",
      "craftAnswers",
      "readerWish",
      "summary",
    ],
  },
};

export const betaReadManuscriptTool: Anthropic.Tool = {
  name: BETA_READ_TOOL,
  description:
    "Save the final whole-book beta read — reactions, wouldContinue, debrief, reader wish.",
  input_schema: {
    type: "object",
    properties: {
      reactions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            emotion: { type: "string", enum: EMOTIONS },
            excerpt: { type: "string" },
            note: { type: "string" },
          },
          required: ["emotion", "note"],
        },
      },
      wouldContinue: {
        type: "string",
        enum: ["yes", "maybe", "no"],
      },
      craftAnswers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionId: {
              type: "string",
              enum: BETA_MANUSCRIPT_CRAFT_QUESTIONS.map((q) => q.id),
            },
            answer: { type: "string" },
          },
          required: ["questionId", "answer"],
        },
      },
      readerWish: { type: "string" },
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
      summary: { type: "string" },
    },
    required: [
      "reactions",
      "wouldContinue",
      "craftAnswers",
      "readerWish",
      "summary",
    ],
  },
};
