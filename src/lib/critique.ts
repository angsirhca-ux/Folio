/**
 * Critique packs — checklist Q&A for craft (never rewrites prose).
 * Smart pack = Scene + Fantasy + Romance + Arc; Pressure is a separate run.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type {
  Book,
  Chapter,
  CritiqueItemResult,
  CritiqueLens,
  CritiqueLensId,
  CritiqueMemoryNote,
  CritiquePack,
  CritiquePackId,
  CritiquePackQuestion,
  CritiqueReview,
  CritiqueSectionId,
  CritiqueState,
  CritiqueVerdict,
  Location,
} from "./types";
import {
  chapterToPlainText,
  truncateChapterPlain,
} from "./developmentalEditor";
import {
  chapterEndingPlain,
  MANUSCRIPT_BETA_CHAPTER_ID,
  MANUSCRIPT_BETA_TITLE,
  partitionManuscriptBetaWindows,
  type ManuscriptBetaWindow,
} from "./betaReaders";
import { continuityNotesForPrompt } from "./continuity";
import { createId } from "./utils";

export const CRITIQUE_TOOL = "save_critique";
export const MANUSCRIPT_CRITIQUE_CHAPTER_ID = MANUSCRIPT_BETA_CHAPTER_ID;
export const MANUSCRIPT_CRITIQUE_TITLE = MANUSCRIPT_BETA_TITLE;
export const MANUSCRIPT_CRITIQUE_WINDOW_CHARS = 12_000;
export const MAX_CRITIQUE_MEMORY = 48;
export const MAX_CRITIQUE_REVIEWS = 40;
export const CRITIQUE_MAX_TOKENS = 8192;

export const SMART_CRITIQUE_SECTIONS: CritiqueSectionId[] = [
  "scene",
  "fantasy",
  "romance",
  "arc",
];

export type CritiqueVerdictSummary = {
  yes: number;
  partial: number;
  no: number;
  na: number;
  open: number;
};

export function critiqueVerdictSummary(
  items: CritiqueItemResult[],
): CritiqueVerdictSummary {
  const summary: CritiqueVerdictSummary = {
    yes: 0,
    partial: 0,
    no: 0,
    na: 0,
    open: 0,
  };
  for (const item of items) {
    if (item.verdict === "n/a") {
      summary.na += 1;
    } else {
      summary[item.verdict] += 1;
    }
    if (item.verdict === "no" || item.verdict === "partial") {
      summary.open += 1;
    }
  }
  return summary;
}

export function questionsForCritiqueRun(
  pack: CritiquePack,
  sections?: CritiqueSectionId[],
): CritiquePackQuestion[] {
  if (!sections?.length || pack.id !== "smart") {
    return pack.questions;
  }
  const allowed = new Set(sections);
  return pack.questions.filter((q) => allowed.has(q.sectionId));
}

export const CRITIQUE_SECTION_META: Record<
  CritiqueSectionId,
  { label: string }
> = {
  scene: { label: "Scene" },
  fantasy: { label: "Fantasy" },
  romance: { label: "Romance" },
  arc: { label: "Character & arc" },
  pressure: { label: "Pressure" },
};

const SCENE_QUESTIONS: CritiquePackQuestion[] = [
  {
    id: "scene-begins-goal",
    sectionId: "scene",
    prompt: "Does every scene begin with a goal?",
    redFlag: "Scene lacks direction.",
  },
  {
    id: "meaningful-conflict",
    sectionId: "scene",
    prompt: "Is there meaningful conflict?",
    redFlag: "Scene feels flat.",
  },
  {
    id: "ends-worse",
    sectionId: "scene",
    prompt: "Does the scene end worse than it began?",
    redFlag: "No momentum.",
  },
  {
    id: "react-and-decide",
    sectionId: "scene",
    prompt: "Does the protagonist react and decide afterward?",
    redFlag: "Story feels rushed.",
  },
  {
    id: "chapter-changes-something",
    sectionId: "scene",
    prompt: "Does every chapter permanently change something?",
    redFlag: "Filler.",
  },
];

const FANTASY_QUESTIONS: CritiquePackQuestion[] = [
  {
    id: "magic-consequences",
    sectionId: "fantasy",
    prompt: "Does every magical element have consequences?",
    redFlag: "Magic feels arbitrary.",
  },
  {
    id: "geography-culture",
    sectionId: "fantasy",
    prompt: "Does geography explain politics and culture?",
    redFlag: "The world feels like a backdrop.",
  },
  {
    id: "history-present",
    sectionId: "fantasy",
    prompt: "Does history affect the present?",
    redFlag: "The setting feels static.",
  },
  {
    id: "culture-origins",
    sectionId: "fantasy",
    prompt: "Do cultures have believable origins?",
    redFlag: "They seem like stereotypes.",
  },
  {
    id: "native-thinking",
    sectionId: "fantasy",
    prompt: "Do characters think like people from this world?",
    redFlag: "They feel transplanted from modern Earth.",
  },
  {
    id: "wb-serves-story",
    sectionId: "fantasy",
    prompt:
      "Does worldbuilding create story opportunities instead of interrupting the story?",
    redFlag: "The lore overshadows the plot.",
  },
  {
    id: "rules-consistent",
    sectionId: "fantasy",
    prompt: "Are the world's rules consistent?",
    redFlag: "Readers lose trust in the narrative.",
  },
  {
    id: "elements-earn-place",
    sectionId: "fantasy",
    prompt: "Does every major worldbuilding element earn its place?",
    redFlag: "The setting feels cluttered.",
  },
];

const ROMANCE_QUESTIONS: CritiquePackQuestion[] = [
  {
    id: "romantic-scene-change",
    sectionId: "romance",
    prompt: "Does every romantic scene change the relationship?",
    redFlag: "The romance feels stagnant.",
  },
  {
    id: "believable-reasons",
    sectionId: "romance",
    prompt: "Do both characters have believable reasons to fall in love?",
    redFlag: "The relationship feels unearned.",
  },
  {
    id: "conflict-rooted",
    sectionId: "romance",
    prompt:
      "Is the conflict rooted in character or circumstance rather than convenience?",
    redFlag: "Drama feels forced.",
  },
  {
    id: "leads-grow",
    sectionId: "romance",
    prompt: "Do both leads grow emotionally?",
    redFlag: "One or both feel static.",
  },
  {
    id: "trust-builds",
    sectionId: "romance",
    prompt: "Does trust build over time?",
    redFlag: "Intimacy feels rushed.",
  },
  {
    id: "vulnerability-increases",
    sectionId: "romance",
    prompt: "Does vulnerability increase throughout the story?",
    redFlag: "The romance stays superficial.",
  },
  {
    id: "darkest-inevitable",
    sectionId: "romance",
    prompt: "Is the breakup or darkest moment inevitable?",
    redFlag: "The climax feels contrived.",
  },
  {
    id: "ending-resolves-both",
    sectionId: "romance",
    prompt: "Does the ending resolve both the plot and the emotional arc?",
    redFlag: "The conclusion feels hollow.",
  },
  {
    id: "romance-essential",
    sectionId: "romance",
    prompt: "Would removing the romance fundamentally change the story?",
    redFlag: "The romance feels tacked on.",
  },
  {
    id: "why-these-two",
    sectionId: "romance",
    prompt:
      "Do readers understand why these two belong together specifically?",
    redFlag: "They seem interchangeable.",
  },
];

/** Merged Truby + Story Genius — no brand names in UI. */
const ARC_QUESTIONS: CritiquePackQuestion[] = [
  {
    id: "false-belief",
    sectionId: "arc",
    prompt: "Does the hero believe something false?",
    redFlag: "Arc feels weak.",
  },
  {
    id: "defining-weakness",
    sectionId: "arc",
    prompt: "Does the protagonist have one defining weakness?",
    redFlag: "Character feels flat.",
  },
  {
    id: "obstacles-challenge-belief",
    sectionId: "arc",
    prompt: "Does every obstacle challenge that belief?",
    redFlag: "Plot feels disconnected.",
  },
  {
    id: "cast-challenges-hero",
    sectionId: "arc",
    prompt: "Does every major character challenge the hero?",
    redFlag: "Supporting cast feels random.",
  },
  {
    id: "reactions-fit-history",
    sectionId: "arc",
    prompt: "Do reactions fit the character's history?",
    redFlag: "Character feels generic.",
  },
  {
    id: "ending-inevitable",
    sectionId: "arc",
    prompt: "Is the ending emotionally inevitable?",
    redFlag: "Resolution feels convenient.",
  },
  {
    id: "hero-becomes-different",
    sectionId: "arc",
    prompt: "Does the hero become someone different?",
    redFlag: "No meaningful arc.",
  },
];

const PRESSURE_QUESTIONS: CritiquePackQuestion[] = [
  {
    id: "stakes-clear",
    sectionId: "pressure",
    prompt:
      "Can the reader tell what may be gained or lost in this chapter?",
    redFlag: "Tension feels weightless.",
  },
  {
    id: "agency-choices",
    sectionId: "pressure",
    prompt:
      "Does the POV (or lead) drive the chapter through choices, not only reaction?",
    redFlag: "Protagonist feels passive.",
  },
  {
    id: "causal-chain",
    sectionId: "pressure",
    prompt:
      "Do beats connect by consequence (“but/therefore”) rather than “and then”?",
    redFlag: "Plot feels episodic.",
  },
  {
    id: "chapter-pull",
    sectionId: "pressure",
    prompt:
      "Does the chapter end with consequence, decision, discovery, or unanswered pressure?",
    redFlag: "Soft landing — no reason to turn the page.",
  },
];

export const SMART_CRITIQUE_PACK: CritiquePack = {
  id: "smart",
  name: "Smart pack",
  blurb:
    "Craft checklists you can run by section — scene, fantasy, romance, or character arc — or all at once. Skips what doesn’t apply.",
  questions: [
    ...SCENE_QUESTIONS,
    ...FANTASY_QUESTIONS,
    ...ROMANCE_QUESTIONS,
    ...ARC_QUESTIONS,
  ],
};

export const PRESSURE_CRITIQUE_PACK: CritiquePack = {
  id: "pressure",
  name: "Pressure",
  blurb:
    "Shorter heat-check: stakes, protagonist agency, cause-and-effect, and whether the chapter ending pulls the reader on.",
  questions: PRESSURE_QUESTIONS,
};

export const CRITIQUE_PACKS: CritiquePack[] = [
  SMART_CRITIQUE_PACK,
  PRESSURE_CRITIQUE_PACK,
];

/** Legacy lens catalogs (data only — UI uses packs). */
export const FANTASY_WORLDBUILDING_LENS: CritiqueLens = {
  id: "fantasy-worldbuilding",
  name: "Fantasy worldbuilding",
  blurb: "Worldbuilding checklist.",
  genres: ["fantasy"],
  questions: FANTASY_QUESTIONS.map(({ id, prompt, redFlag }) => ({
    id,
    prompt,
    redFlag,
  })),
};

export const ROMANCING_THE_BEAT_LENS: CritiqueLens = {
  id: "romancing-the-beat",
  name: "Romance",
  blurb: "Romance checklist.",
  genres: ["romance"],
  questions: ROMANCE_QUESTIONS.map(({ id, prompt, redFlag }) => ({
    id,
    prompt,
    redFlag,
  })),
};

export const SELLING_WRITER_LENS: CritiqueLens = {
  id: "selling-writer",
  name: "Scene",
  blurb: "Scene craft.",
  genres: ["fiction"],
  questions: SCENE_QUESTIONS.map(({ id, prompt, redFlag }) => ({
    id,
    prompt,
    redFlag,
  })),
};

export const DEFAULT_CRITIQUE_LENSES: CritiqueLens[] = [
  FANTASY_WORLDBUILDING_LENS,
  ROMANCING_THE_BEAT_LENS,
  SELLING_WRITER_LENS,
];

export function emptyCritique(): CritiqueState {
  return { memory: [], reviews: [] };
}

export function packById(id: string | undefined): CritiquePack | null {
  return CRITIQUE_PACKS.find((p) => p.id === id) ?? null;
}

export function lensById(id: string | undefined): CritiqueLens | null {
  return DEFAULT_CRITIQUE_LENSES.find((l) => l.id === id) ?? null;
}

function sectionForLegacyLens(lensId: CritiqueLensId): CritiqueSectionId {
  if (lensId === "fantasy-worldbuilding") return "fantasy";
  if (lensId === "romancing-the-beat") return "romance";
  if (lensId === "selling-writer") return "scene";
  if (lensId === "truby" || lensId === "story-genius") return "arc";
  return "scene";
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
  if (
    value === "yes" ||
    value === "partial" ||
    value === "no" ||
    value === "n/a"
  ) {
    return value;
  }
  return "partial";
}

function normalizeMemory(
  m: Partial<CritiqueMemoryNote> & { lensId?: string; packId?: string },
): CritiqueMemoryNote | null {
  if (!m?.text?.trim()) return null;
  const packId: CritiquePackId | null =
    m.packId === "smart" || m.packId === "pressure"
      ? m.packId
      : m.lensId
        ? "smart"
        : null;
  if (!packId) return null;
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
    packId,
    lensId: lensById(m.lensId)?.id,
    kind,
    text: m.text.trim().slice(0, 400),
    chapterId: m.chapterId,
  };
}

function questionMap(pack: CritiquePack): Map<string, CritiquePackQuestion> {
  return new Map(pack.questions.map((q) => [q.id, q]));
}

function normalizeItem(
  raw: {
    questionId?: string;
    sectionId?: string;
    verdict?: string;
    note?: string;
    excerpt?: string;
    suggestion?: string;
  },
  pack: CritiquePack,
): CritiqueItemResult | null {
  if (!raw?.questionId || !raw.note?.trim()) return null;
  const q = questionMap(pack).get(raw.questionId);
  if (!q) return null;
  return {
    questionId: raw.questionId,
    sectionId: q.sectionId,
    verdict: normalizeVerdict(raw.verdict),
    note: raw.note.trim().slice(0, 600),
    excerpt: raw.excerpt?.trim().slice(0, 280) || undefined,
    suggestion: raw.suggestion?.trim().slice(0, 280) || undefined,
  };
}

function normalizeReview(r: Partial<CritiqueReview>): CritiqueReview | null {
  if (!r?.chapterId) return null;

  let pack = packById(r.packId);
  let legacyLensId: CritiqueLensId | undefined;

  if (!pack && r.lensId) {
    const lens = lensById(r.lensId);
    if (!lens) return null;
    legacyLensId = lens.id;
    const section = sectionForLegacyLens(lens.id);
    pack = {
      id: "smart",
      name: "Smart pack",
      blurb: "",
      questions: lens.questions.map((q) => ({
        ...q,
        sectionId: section,
      })),
    };
  }
  if (!pack) return null;

  const byId = new Map<string, CritiqueItemResult>();
  for (const item of r.items ?? []) {
    const n = normalizeItem(item, pack);
    if (n) byId.set(n.questionId, n);
  }
  const items = pack.questions.map((q) => {
    const existing = byId.get(q.id);
    if (existing) return existing;
    return {
      questionId: q.id,
      sectionId: q.sectionId,
      verdict: "partial" as const,
      note: "Insufficient evidence in this chapter to judge.",
    };
  });

  return {
    id: r.id ?? createId(),
    packId: pack.id,
    lensId: legacyLensId ?? r.lensId,
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
    pack: CritiquePack;
    chapter: Pick<Chapter, "id" | "title">;
    questions?: CritiquePackQuestion[];
    manuscript?: boolean;
  },
): { review: CritiqueReview; memoryUpdates: CritiqueMemoryNote[] } {
  const manuscript =
    args.manuscript ?? args.chapter.id === MANUSCRIPT_CRITIQUE_CHAPTER_ID;
  const scoped = args.questions ?? args.pack.questions;
  const byId = new Map<string, CritiqueItemResult>();
  for (const item of raw?.items ?? []) {
    const n = normalizeItem(item, args.pack);
    if (n && scoped.some((q) => q.id === n.questionId)) {
      byId.set(n.questionId, n);
    }
  }
  const items = scoped.map((q) => {
    const existing = byId.get(q.id);
    if (existing) return existing;
    return {
      questionId: q.id,
      sectionId: q.sectionId,
      verdict: "partial" as const,
      note: "Insufficient evidence in this chapter to judge.",
    };
  });

  const review: CritiqueReview = {
    id: createId(),
    packId: args.pack.id,
    chapterId: args.chapter.id,
    chapterTitle: manuscript ? MANUSCRIPT_CRITIQUE_TITLE : args.chapter.title,
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
      packId: args.pack.id,
      kind:
        m.kind === "pattern" ||
        m.kind === "strength" ||
        m.kind === "risk" ||
        m.kind === "general"
          ? m.kind
          : "pattern",
      text: m.text.trim().slice(0, 400),
      chapterId: manuscript ? undefined : args.chapter.id,
    }));

  return { review, memoryUpdates };
}

export function mergeCritiqueReview(
  state: CritiqueState,
  review: CritiqueReview,
  memoryUpdates: CritiqueMemoryNote[],
  options?: { mergeItems?: boolean },
): CritiqueState {
  const memory = [...memoryUpdates, ...(state.memory ?? [])]
    .filter(
      (note, i, arr) =>
        arr.findIndex(
          (n) =>
            n.packId === note.packId &&
            n.text.toLowerCase() === note.text.toLowerCase(),
        ) === i,
    )
    .slice(0, MAX_CRITIQUE_MEMORY);

  const prior = (state.reviews ?? []).find(
    (r) => r.packId === review.packId && r.chapterId === review.chapterId,
  );

  let finalReview = review;
  if (options?.mergeItems) {
    const pack = packById(review.packId);
    const byId = new Map(
      (prior?.items ?? []).map((item) => [item.questionId, item]),
    );
    for (const item of review.items) {
      byId.set(item.questionId, item);
    }
    if (pack) {
      const items = pack.questions.map((q) => {
        const existing = byId.get(q.id);
        return (
          existing ?? {
            questionId: q.id,
            sectionId: q.sectionId,
            verdict: "partial" as const,
            note: "Not reviewed yet — run this section when ready.",
          }
        );
      });
      finalReview = {
        ...review,
        summary: review.summary.trim()
          ? review.summary
          : (prior?.summary ?? review.summary),
        items,
      };
    }
  }

  const reviews = [
    finalReview,
    ...(state.reviews ?? []).filter(
      (r) =>
        !(r.packId === finalReview.packId && r.chapterId === finalReview.chapterId),
    ),
  ].slice(0, MAX_CRITIQUE_REVIEWS);

  return { memory, reviews };
}

export function latestCritiqueReview(
  state: CritiqueState | undefined,
  packId: CritiquePackId,
  chapterId: string,
): CritiqueReview | undefined {
  return (state?.reviews ?? []).find(
    (r) => r.packId === packId && r.chapterId === chapterId,
  );
}

export function isManuscriptCritiqueReview(review: CritiqueReview): boolean {
  return review.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID;
}

export function latestManuscriptCritiqueReview(
  state: CritiqueState | undefined,
  packId: CritiquePackId,
): CritiqueReview | undefined {
  return latestCritiqueReview(state, packId, MANUSCRIPT_CRITIQUE_CHAPTER_ID);
}

export function memoryForPack(
  state: CritiqueState | undefined,
  packId: CritiquePackId,
): CritiqueMemoryNote[] {
  return (state?.memory ?? []).filter((m) => m.packId === packId);
}

/** All durable critique memory for the book (both packs). */
export function memoryForCritique(
  state: CritiqueState | undefined,
): CritiqueMemoryNote[] {
  return state?.memory ?? [];
}

/** Visible checklist rows — hide n/a by default. */
export function visibleCritiqueItems(
  items: CritiqueItemResult[],
  showNa = false,
): CritiqueItemResult[] {
  const filtered = showNa ? items : items.filter((i) => i.verdict !== "n/a");
  return [...filtered].sort((a, b) => {
    const rank = (v: CritiqueVerdict) =>
      v === "no" ? 0 : v === "partial" ? 1 : v === "yes" ? 2 : 3;
    const diff = rank(a.verdict) - rank(b.verdict);
    return diff !== 0 ? diff : a.questionId.localeCompare(b.questionId);
  });
}

export function groupCritiqueItems(
  items: CritiqueItemResult[],
  pack: CritiquePack,
): Array<{ sectionId: CritiqueSectionId; label: string; items: CritiqueItemResult[] }> {
  const order: CritiqueSectionId[] = [];
  for (const q of pack.questions) {
    if (!order.includes(q.sectionId)) order.push(q.sectionId);
  }
  return order
    .map((sectionId) => ({
      sectionId,
      label: CRITIQUE_SECTION_META[sectionId].label,
      items: items.filter((i) => i.sectionId === sectionId),
    }))
    .filter((g) => g.items.length > 0);
}

export type OpenCritiqueIssue = {
  chapterId: string;
  chapterTitle: string;
  packId: CritiquePackId;
  packName: string;
  sectionId: CritiqueSectionId;
  sectionLabel: string;
  questionId: string;
  prompt: string;
  verdict: CritiqueVerdict;
  note: string;
  excerpt?: string;
  suggestion?: string;
};

/** All no/partial checklist items across the manuscript. */
export function openCritiqueIssues(
  state: CritiqueState | undefined,
  chapters: Pick<Chapter, "id" | "title">[],
  packId?: CritiquePackId,
): OpenCritiqueIssue[] {
  const chapterOrder = new Map(chapters.map((c, i) => [c.id, i]));
  const issues: OpenCritiqueIssue[] = [];

  for (const review of state?.reviews ?? []) {
    if (packId && review.packId !== packId) continue;
    const pack = packById(review.packId);
    if (!pack) continue;
    const chapterTitle =
      review.chapterId === MANUSCRIPT_CRITIQUE_CHAPTER_ID
        ? MANUSCRIPT_CRITIQUE_TITLE
        : (chapters.find((c) => c.id === review.chapterId)?.title ??
          review.chapterTitle);

    for (const item of review.items) {
      if (item.verdict !== "no" && item.verdict !== "partial") continue;
      const q = pack.questions.find((qq) => qq.id === item.questionId);
      issues.push({
        chapterId: review.chapterId,
        chapterTitle,
        packId: review.packId,
        packName: pack.name,
        sectionId: item.sectionId,
        sectionLabel: CRITIQUE_SECTION_META[item.sectionId].label,
        questionId: item.questionId,
        prompt: q?.prompt ?? item.questionId,
        verdict: item.verdict,
        note: item.note,
        excerpt: item.excerpt,
        suggestion: item.suggestion,
      });
    }
  }

  const verdictRank = (v: CritiqueVerdict) => (v === "no" ? 0 : 1);
  return issues.sort((a, b) => {
    const ao = chapterOrder.get(a.chapterId) ?? 999;
    const bo = chapterOrder.get(b.chapterId) ?? 999;
    if (ao !== bo) return ao - bo;
    const diff = verdictRank(a.verdict) - verdictRank(b.verdict);
    return diff !== 0 ? diff : a.prompt.localeCompare(b.prompt);
  });
}

export function formatCritiqueNoteBlock(args: {
  packName: string;
  prompt: string;
  verdict: CritiqueVerdict;
  note: string;
  excerpt?: string;
  suggestion?: string;
}): string {
  const lines = [
    "— Critique —",
    `${args.packName}: ${args.prompt}`,
    `${args.verdict === "n/a" ? "N/A" : args.verdict.toUpperCase()} — ${args.note.trim()}`,
    args.excerpt?.trim() ? `“${args.excerpt.trim().slice(0, 220)}”` : "",
    args.suggestion?.trim() ? `Watch for: ${args.suggestion.trim()}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

const VERDICT_PRIORITY: Record<CritiqueVerdict, number> = {
  no: 0,
  partial: 1,
  yes: 2,
  "n/a": 3,
};

/** Merge checklist rows from multiple review windows — keep the strictest verdict. */
export function mergeCritiqueWindowItems(
  questions: CritiquePackQuestion[],
  windowResults: CritiqueItemResult[][],
): CritiqueItemResult[] {
  const byId = new Map<string, CritiqueItemResult>();
  for (const items of windowResults) {
    for (const item of items) {
      const existing = byId.get(item.questionId);
      if (
        !existing ||
        VERDICT_PRIORITY[item.verdict] < VERDICT_PRIORITY[existing.verdict]
      ) {
        byId.set(item.questionId, item);
      }
    }
  }
  return questions.map((q) => {
    const existing = byId.get(q.id);
    return (
      existing ?? {
        questionId: q.id,
        sectionId: q.sectionId,
        verdict: "partial" as const,
        note: "Insufficient evidence in the windows reviewed.",
      }
    );
  });
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
  pack: CritiquePack;
  memory: CritiqueMemoryNote[];
  reviews: CritiqueReview[];
  sections?: CritiqueSectionId[];
  previousChapter?: Pick<Chapter, "id" | "title" | "content"> | null;
  plainOverride?: string;
  windowNote?: string;
}): string {
  const scopedQuestions = questionsForCritiqueRun(args.pack, args.sections);
  const plain =
    args.plainOverride ??
    truncateChapterPlain(chapterToPlainText(args.chapter.content));
  const chapterIndex = args.book.chapters.findIndex(
    (c) => c.id === args.chapter.id,
  );
  const chapterNumber = chapterIndex >= 0 ? chapterIndex + 1 : null;
  const prevMeta =
    args.previousChapter ??
    (chapterIndex > 0 ? args.book.chapters[chapterIndex - 1] : null);
  const leftOff = prevMeta
    ? chapterEndingPlain(prevMeta.content ?? "")
    : "";
  const prior = args.book.chapters
    .slice(0, Math.max(0, chapterIndex))
    .map((c, i) => {
      const priorReview = args.reviews.find(
        (r) => r.packId === args.pack.id && r.chapterId === c.id,
      );
      const openItems = (priorReview?.items ?? [])
        .filter((it) => it.verdict === "no" || it.verdict === "partial")
        .slice(0, 4)
        .map((it) => `${it.questionId}: ${it.note.slice(0, 90)}`)
        .join("; ");
      const bits = [
        (c.summary || "").trim().slice(0, 180),
        priorReview?.summary
          ? `Earlier critique: ${priorReview.summary.slice(0, 220)}`
          : "",
        openItems ? `Open checklist notes: ${openItems}` : "",
      ].filter(Boolean);
      return `- Ch ${i + 1} “${c.title}”: ${bits.join(" — ") || "(no notes yet)"}`;
    })
    .slice(-10);

  const memoryBlock =
    args.memory.length === 0
      ? "(none yet)"
      : args.memory
          .slice(0, 20)
          .map((m) => {
            const chapterLabel = m.chapterId
              ? args.book.chapters.find((c) => c.id === m.chapterId)?.title
              : null;
            return `- [${m.kind}]${chapterLabel ? ` (${chapterLabel})` : ""} ${m.text}`;
          })
          .join("\n");

  const cast = (args.book.characters ?? []).slice(0, 28).map((c) => {
    const asOf = continuityNotesForPrompt(c.continuityNotes, 2);
    return `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}${
      asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
    }`;
  });

  const places = (args.book.locations ?? ([] as Location[])).slice(0, 28).map(
    (l) => {
      const asOf = continuityNotesForPrompt(l.continuityNotes, 2);
      return `- ${l.name}${l.shortBio ? `: ${l.shortBio}` : ""}${
        asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
      }`;
    },
  );

  const encyclopedia = (args.book.encyclopedia ?? [])
    .slice(0, 20)
    .map((e) => {
      const blurb = e.shortBio || e.summary || "";
      return `- ${e.title}${blurb ? `: ${blurb.slice(0, 140)}` : ""}`;
    });

  const research = (args.book.research ?? []).slice(0, 12).map((r) => {
    const blurb = r.shortBio || r.summary || "";
    return `- ${r.title}${blurb ? `: ${blurb.slice(0, 120)}` : ""}`;
  });

  const bySection = groupCritiqueItems(
    scopedQuestions.map((q) => ({
      questionId: q.id,
      sectionId: q.sectionId,
      verdict: "partial" as const,
      note: "",
    })),
    args.pack,
  );

  const questions = bySection
    .map((sec) => {
      const lines = scopedQuestions
        .filter((q) => q.sectionId === sec.sectionId)
        .map(
          (q) =>
            `- ${q.id}: ${q.prompt}\n  Red flag if no: ${q.redFlag}`,
        )
        .join("\n");
      return `## ${sec.label}\n${lines}`;
    })
    .join("\n\n");

  const sectionNote =
    args.sections?.length && args.pack.id === "smart"
      ? `This run covers: ${args.sections.map((id) => CRITIQUE_SECTION_META[id].label).join(", ")}.`
      : "";

  return [
    args.windowNote ? args.windowNote : "",
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    chapterNumber
      ? `Place in book: chapter ${chapterNumber} of ${args.book.chapters.length}`
      : "",
    `Critique pack: ${args.pack.name}`,
    sectionNote,
    `Pack posture: ${args.pack.blurb}`,
    `Chapter under review: ${args.chapter.title}`,
    "",
    leftOff
      ? `WHERE THE READER LEFT OFF (end of previous chapter — judge the handoff into this one):\n${leftOff}`
      : "WHERE THE READER LEFT OFF: (opening chapter)",
    "",
    "DURABLE PACK MEMORY (patterns from earlier chapters — stay consistent; do not re-lecture settled patterns unless they recur here):",
    memoryBlock,
    "",
    prior.length
      ? `PRIOR CHAPTER DIGESTS (including earlier checklist notes):\n${prior.join("\n")}`
      : "PRIOR CHAPTER DIGESTS: (opening / first chapter in order)",
    "",
    bibleSnippet("CAST", cast, 28),
    bibleSnippet("PLACES", places, 28),
    bibleSnippet("ENCYCLOPEDIA (in-world)", encyclopedia, 20),
    bibleSnippet("RESEARCH NOTES", research, 12),
    "",
    "CHECKLIST — answer EVERY question id with yes | partial | no | n/a:",
    questions,
    "",
    "CHAPTER TEXT:",
    plain || "(empty chapter)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function critiqueSystemPrompt(
  pack: CritiquePack,
  sections?: CritiqueSectionId[],
): string {
  const scoped = questionsForCritiqueRun(pack, sections);
  const sectionNames =
    sections?.length && pack.id === "smart"
      ? sections.map((id) => CRITIQUE_SECTION_META[id].label).join(", ")
      : pack.name;

  const naHint =
    pack.id === "smart"
      ? `- Use verdict n/a when a Fantasy question has no magic/worldbuilding to judge, or a Romance question has no romantic relationship on the page or in digests. Do not invent genre problems.
- For Character & arc: judge from this chapter + digests + the handoff from the previous chapter; use partial + “insufficient evidence” freely for whole-book ending items.`
      : `- Prefer yes / partial / no; use n/a only if the chapter is too thin to judge that item.`;

  return `You are a craft critic for a working novelist — not a copy editor, not a beta reader, and not a rewriter.
You are reviewing ONE chapter in the middle of a novel, using the checklist for ${sectionNames}.

Your job is diagnostic: name what is working, what is at risk, and what fails — in THIS chapter, on the page.
Lead with the chapter’s real pressures (handoff, scene shape, relationship movement, arc pressure) — not abstract craft lecture.

HARD RULES:
- Do NOT rewrite, insert, or paste replacement prose into the manuscript.
- Answer EVERY checklist question id in this run exactly once.
- verdict must be yes, partial, no, or n/a.
${naHint}
- For no or partial: prefer a short verbatim excerpt from the chapter when evidence exists; say so plainly when evidence is insufficient.
- For n/a: note briefly why it does not apply (one short sentence). No excerpt needed.
- note: specific and chapter-grounded (what holds or fails here). suggestion: one gentle “watch for…” seed — never a polished rewrite ready to paste. Skip suggestion on n/a.
- summary: 3–5 sentences as a critique letter — top strengths, top risks, and whether the chapter earns its place in the book right now.
- memoryUpdates: only durable patterns worth remembering later (max 5). Skip one-off nits and n/a noise.
- Use prior digests, memory, and the previous chapter ending: judge the HANDOFF. Do not repeat settled patterns unless they newly fail here.
- Be specific. No cheerleading. No marketing tone. No brand-name lecture (do not say Truby, Story Genius, Romancing the Beat).
- Prefer concrete contradictions over vague vibes.

Pack: ${pack.blurb}
Questions in this run: ${scoped.length}`;
}

export function critiqueToolForPack(
  pack: CritiquePack,
  sections?: CritiqueSectionId[],
): Anthropic.Tool {
  const scoped = questionsForCritiqueRun(pack, sections);
  const questionIds = scoped.map((q) => q.id);
  return {
    name: CRITIQUE_TOOL,
    description:
      "Save a craft critique checklist for one chapter — verdicts, notes, optional excerpts. Never manuscript rewrites.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "3–6 sentences: overall critique letter for this chapter under this pack.",
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
                enum: ["yes", "partial", "no", "n/a"],
              },
              note: {
                type: "string",
                description: "Diagnostic — what holds, fails, or why n/a.",
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

export function partitionManuscriptCritiqueWindows(
  chapters: Pick<Chapter, "title" | "content">[],
  maxChars = MANUSCRIPT_CRITIQUE_WINDOW_CHARS,
): ManuscriptBetaWindow[] {
  return partitionManuscriptBetaWindows(chapters, maxChars);
}

export function buildManuscriptCritiqueContext(args: {
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
  pack: CritiquePack;
  window: ManuscriptBetaWindow;
  memory: CritiqueMemoryNote[];
  chapterReviews: CritiqueReview[];
  sections?: CritiqueSectionId[];
  previousWindowEnding?: string;
}): string {
  const scopedQuestions = questionsForCritiqueRun(args.pack, args.sections);
  const chapters = args.book.chapters ?? [];
  const isFinal = args.window.index === args.window.total - 1;

  const toc = chapters
    .map((c, i) => `${i + 1}. ${c.title || "Untitled"}`)
    .join("\n");

  const priorChapterCritiques = args.chapterReviews
    .filter((r) => r.chapterId !== MANUSCRIPT_CRITIQUE_CHAPTER_ID)
    .map((r) => {
      const idx = chapters.findIndex((c) => c.id === r.chapterId);
      const title =
        chapters[idx]?.title ?? r.chapterTitle ?? `Chapter ${idx + 1}`;
      const openItems = r.items
        .filter((it) => it.verdict === "no" || it.verdict === "partial")
        .slice(0, 3)
        .map((it) => `${it.questionId}: ${it.note.slice(0, 80)}`)
        .join("; ");
      return `- Ch ${idx >= 0 ? idx + 1 : "?"} “${title}” (${r.packId}): ${r.summary.slice(0, 160)}${openItems ? ` · open: ${openItems}` : ""}`;
    })
    .slice(-12);

  const memoryBlock =
    args.memory.length === 0
      ? "(none yet)"
      : args.memory
          .slice(0, 24)
          .map((m) => {
            const chapterLabel = m.chapterId
              ? chapters.find((c) => c.id === m.chapterId)?.title
              : null;
            return `- [${m.kind}]${chapterLabel ? ` (${chapterLabel})` : ""} ${m.text}`;
          })
          .join("\n");

  const cast = (args.book.characters ?? []).slice(0, 28).map((c) => {
    const asOf = continuityNotesForPrompt(c.continuityNotes, 2);
    return `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}${
      asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
    }`;
  });

  const places = (args.book.locations ?? ([] as Location[])).slice(0, 28).map(
    (l) => {
      const asOf = continuityNotesForPrompt(l.continuityNotes, 2);
      return `- ${l.name}${l.shortBio ? `: ${l.shortBio}` : ""}${
        asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
      }`;
    },
  );

  const bySection = groupCritiqueItems(
    scopedQuestions.map((q) => ({
      questionId: q.id,
      sectionId: q.sectionId,
      verdict: "partial" as const,
      note: "",
    })),
    args.pack,
  );

  const questions = bySection
    .map((sec) => {
      const lines = scopedQuestions
        .filter((q) => q.sectionId === sec.sectionId)
        .map(
          (q) =>
            `- ${q.id}: ${q.prompt}\n  Red flag if no: ${q.redFlag}`,
        )
        .join("\n");
      return `## ${sec.label}\n${lines}`;
    })
    .join("\n\n");

  const sectionNote =
    args.sections?.length && args.pack.id === "smart"
      ? `This run covers: ${args.sections.map((id) => CRITIQUE_SECTION_META[id].label).join(", ")}.`
      : "";

  const windowNote = [
    `READING WINDOW ${args.window.index + 1} of ${args.window.total}: ${args.window.label}.`,
    isFinal
      ? "This is the FINAL stretch — you may judge whole-book items (ending, arc completion, romance resolution)."
      : "You have NOT finished the book — use partial + “insufficient evidence in this section” for ending/arc/romance-resolution items not yet visible. Judge scene-level items only where evidence appears in THIS window.",
  ].join(" ");

  return [
    windowNote,
    `FULL MANUSCRIPT critique — cover to cover, not a single chapter workshop.`,
    `Manuscript: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Critique pack: ${args.pack.name}`,
    sectionNote,
    `Pack posture: ${args.pack.blurb}`,
    "",
    toc ? `TABLE OF CONTENTS:\n${toc}` : "",
    "",
    priorChapterCritiques.length
      ? `OPTIONAL — chapter-level critiques already run in Folio (may color memory, but judge THIS text fresh):\n${priorChapterCritiques.join("\n")}`
      : "",
    "",
    "DURABLE PACK MEMORY (patterns from this full-manuscript read so far):",
    memoryBlock,
    "",
    args.previousWindowEnding
      ? `WHERE YOU LEFT OFF in the last reading window:\n${args.previousWindowEnding}`
      : "You are starting from the beginning of the manuscript.",
    "",
    bibleSnippet("CAST", cast, 28),
    bibleSnippet("PLACES", places, 28),
    "",
    "CHECKLIST — answer EVERY question id with yes | partial | no | n/a:",
    questions,
    "",
    "TEXT FOR THIS WINDOW:",
    args.window.plain || "(empty)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function critiqueManuscriptSystemPrompt(
  pack: CritiquePack,
  sections?: CritiqueSectionId[],
): string {
  const scoped = questionsForCritiqueRun(pack, sections);
  const sectionNames =
    sections?.length && pack.id === "smart"
      ? sections.map((id) => CRITIQUE_SECTION_META[id].label).join(", ")
      : pack.name;

  const naHint =
    pack.id === "smart"
      ? `- Use verdict n/a when a Fantasy question has no magic/worldbuilding to judge, or a Romance question has no romantic relationship in the manuscript.
- For Character & arc and ending items: on non-final windows use partial + “insufficient evidence in this section”; on the final window judge the whole book.`
      : `- Interpret Pressure items book-wide: stakes across the story, protagonist agency over the manuscript, cause-and-effect chains, and whether endings pull the reader on.
- Use n/a only if the manuscript is too thin to judge that item.`;

  return `You are a craft critic for a working novelist — not a copy editor, not a beta reader, and not a rewriter.
You are reviewing the FULL MANUSCRIPT cover to cover, using the checklist for ${sectionNames}.

Your job is diagnostic: name what is working, what is at risk, and what fails — across the book, grounded in the prose you can see in this reading window.
On the final window, step back: opening hold, middle drag, ending land, arc payoff.

HARD RULES:
- Do NOT rewrite, insert, or paste replacement prose into the manuscript.
- Answer EVERY checklist question id in this run exactly once.
- verdict must be yes, partial, no, or n/a.
${naHint}
- For no or partial: prefer a short verbatim excerpt when evidence exists; say so plainly when evidence is insufficient in this window.
- For n/a: note briefly why it does not apply (one short sentence). No excerpt needed.
- note: specific and book-grounded. suggestion: one gentle “watch for…” seed — never a polished rewrite. Skip suggestion on n/a.
- summary: 3–6 sentences as a critique letter for THIS window’s reading — top strengths, top risks. On the final window, include whole-book verdict.
- memoryUpdates: only durable patterns worth remembering (max 5). Skip one-off nits.
- Be specific. No cheerleading. No marketing tone. No brand-name lecture.
- Prefer concrete contradictions over vague vibes.

Pack: ${pack.blurb}
Questions in this run: ${scoped.length}`;
}
