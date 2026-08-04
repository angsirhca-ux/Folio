import type {
  Book,
  Chapter,
  Character,
  DevelopmentalEditorState,
  DevelopmentalFlag,
  DevelopmentalFlagCategory,
  DevelopmentalMemoryNote,
  DevelopmentalPass,
  DevelopmentalPassKind,
  DevelopmentalSeverity,
} from "./types";
import { DEVELOPMENTAL_CATEGORY_META } from "./types";
import { createId } from "./utils";
import { continuityNotesForPrompt } from "./continuity";

export const REVIEW_TOOL_NAME = "save_editorial_review";

export const CHAPTER_PLAIN_BUDGET = 90_000;
export const MAX_MEMORY_NOTES = 40;
export const MAX_PASSES_KEPT = 24;
/** Safety ceiling so a runaway response can’t hang the UI — not a “top 12 only” filter. */
export const MAX_FLAGS_PER_PASS = 40;
export const REVIEW_MAX_TOKENS = 6144;

export function emptyDevelopmentalEditor(): DevelopmentalEditorState {
  return { memory: [], passes: [] };
}

/** Map legacy Line Edit / show-dont-tell into Style & Story. */
function migratePassKind(kind: string | undefined): DevelopmentalPassKind {
  if (kind === "story" || kind === "continuity" || kind === "style") return kind;
  if (kind === "line") return "style";
  return "style";
}

function migrateFlagCategory(
  raw: string | undefined,
): DevelopmentalFlagCategory | null {
  if (!raw) return null;
  if (raw === "show-dont-tell") return "telling";
  if (
    (
      [
        "filter-words",
        "weak-verbs",
        "repetition",
        "dialogue-tags",
        "adverbs",
        "flow-rhythm",
        "redundancy",
        "word-choice",
        "dialogue-polish",
        "telling",
        "pacing",
        "plot-holes",
        "character-voice",
        "name-variants",
        "cast-mismatch",
        "location-jump",
        "timeline",
        "forgotten-detail",
        "orphan-tag",
      ] as string[]
    ).includes(raw)
  ) {
    return raw as DevelopmentalFlagCategory;
  }
  return null;
}

export function ensureDevelopmentalEditor(
  book: Omit<Book, "developmentalEditor" | "betaReaders" | "dump"> & {
    developmentalEditor?: DevelopmentalEditorState;
    betaReaders?: Book["betaReaders"];
    dump?: Book["dump"];
  },
): Book {
  const raw = book.developmentalEditor;
  const memory = (Array.isArray(raw?.memory) ? raw.memory : []).map((m) => ({
    ...m,
    kind:
      m.kind === "general" || m.kind === "preference"
        ? m.kind
        : migratePassKind(String(m.kind)),
  }));
  const passes = (Array.isArray(raw?.passes) ? raw.passes : []).map((p) => ({
    ...p,
    kind: migratePassKind(String(p.kind)),
    flags: (p.flags ?? [])
      .map((f) => {
        const category = migrateFlagCategory(f.category);
        if (!category) return null;
        return { ...f, category };
      })
      .filter(Boolean) as DevelopmentalFlag[],
  }));

  return {
    ...book,
    developmentalEditor: { memory, passes },
    betaReaders: book.betaReaders ?? {
      readers: [],
      memory: [],
      reviews: [],
    },
    critique: book.critique ?? {
      memory: [],
      reviews: [],
    },
    dump: book.dump ?? { pages: [], activePageId: "" },
  };
}

/** TipTap HTML → plain text for editorial review. */
export function chapterToPlainText(html: string): string {
  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, (m) => {
      const t = m.replace(/<[^>]+>/g, "").trim();
      return t ? `\n\n# ${t}\n\n` : "\n\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/class="scene-break"[^>]*>[\s\S]*?<\/p>/gi, "\n\n* * *\n\n")
    .replace(/data-type="scene-break"[^>]*>[\s\S]*?<\/[^>]+>/gi, "\n\n* * *\n\n")
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateChapterPlain(plain: string, max = CHAPTER_PLAIN_BUDGET): string {
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}\n\n[…chapter truncated for length…]`;
}

export type ReviewPayload = {
  summary: string;
  flags: Array<{
    category: DevelopmentalFlagCategory;
    severity?: DevelopmentalSeverity;
    excerpt: string;
    note: string;
    suggestions: [string, string] | string[];
  }>;
  memoryUpdates?: Array<{
    kind?: DevelopmentalPassKind | "general";
    text: string;
  }>;
};

function normalizeSuggestions(
  raw: unknown,
): [string, string] {
  const list = Array.isArray(raw)
    ? raw
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .map((s) => s.slice(0, 280))
    : [];
  while (list.length < 2) {
    list.push(
      list.length === 0
        ? "Consider what a concrete beat of action or sensory detail might do here."
        : "Consider whether a quieter choice — gesture, silence, or image — would carry more.",
    );
  }
  return [list[0], list[1]];
}

const STYLE_CATEGORIES: DevelopmentalFlagCategory[] = [
  "filter-words",
  "weak-verbs",
  "repetition",
  "dialogue-tags",
  "adverbs",
  "flow-rhythm",
  "redundancy",
  "word-choice",
  "dialogue-polish",
];

const STORY_CATEGORIES: DevelopmentalFlagCategory[] = [
  "telling",
  "pacing",
  "plot-holes",
  "character-voice",
];

export function categoriesForPass(
  kind: DevelopmentalPassKind,
): DevelopmentalFlagCategory[] {
  if (kind === "style") return STYLE_CATEGORIES;
  if (kind === "story") return STORY_CATEGORIES;
  return [
    "name-variants",
    "cast-mismatch",
    "location-jump",
    "timeline",
    "forgotten-detail",
    "orphan-tag",
  ];
}

export function chapterPassLabel(kind: DevelopmentalPassKind): string {
  if (kind === "style") return "Style & Line";
  if (kind === "story") return "Story & Structure";
  return "Continuity";
}

/** Map near-miss categories so a pass still keeps useful flags. */
export function coerceFlagCategory(
  kind: DevelopmentalPassKind,
  raw: string | undefined,
): DevelopmentalFlagCategory | null {
  const allowed = categoriesForPass(kind);
  if (raw && (allowed as string[]).includes(raw)) {
    return raw as DevelopmentalFlagCategory;
  }
  // Legacy Line Edit category
  if (raw === "show-dont-tell") {
    return kind === "story" ? "telling" : null;
  }
  if (kind === "story") {
    if (raw === "dialogue-polish" || raw === "dialogue-tags") {
      return "character-voice";
    }
    if (raw === "flow-rhythm" || raw === "redundancy") return "pacing";
  }
  return null;
}

export function normalizeReviewPayload(
  kind: DevelopmentalPassKind,
  payload: ReviewPayload,
  chapter: Pick<Chapter, "id" | "title">,
): { pass: DevelopmentalPass; memoryUpdates: DevelopmentalMemoryNote[] } {
  const flags: DevelopmentalFlag[] = (payload.flags ?? [])
    .map((f) => {
      if (!f?.excerpt?.trim() || !f.note?.trim()) return null;
      const category = coerceFlagCategory(kind, f.category);
      if (!category) return null;
      return {
        id: createId(),
        category,
        severity:
          f.severity === "issue" || f.severity === "watch" || f.severity === "note"
            ? f.severity
            : ("watch" as DevelopmentalSeverity),
        excerpt: f.excerpt.trim().slice(0, 280),
        note: f.note.trim().slice(0, 600),
        suggestions: normalizeSuggestions(f.suggestions),
        verdict: null,
        closed: false,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_FLAGS_PER_PASS) as DevelopmentalFlag[];

  const pass: DevelopmentalPass = {
    id: createId(),
    kind,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    createdAt: Date.now(),
    summary: (payload.summary ?? "").trim().slice(0, 1200),
    flags,
  };

  const memoryUpdates: DevelopmentalMemoryNote[] = (payload.memoryUpdates ?? [])
    .filter((m) => m?.text?.trim())
    .slice(0, 8)
    .map((m) => ({
      id: createId(),
      at: Date.now(),
      kind:
        m.kind === "style" ||
        m.kind === "story" ||
        m.kind === "continuity"
          ? m.kind
          : String(m.kind) === "line"
            ? "style"
            : "general",
      text: m.text.trim().slice(0, 400),
    }));

  return { pass, memoryUpdates };
}

export function mergeDevelopmentalPass(
  state: DevelopmentalEditorState,
  pass: DevelopmentalPass,
  memoryUpdates: DevelopmentalMemoryNote[],
): DevelopmentalEditorState {
  const memory = [...memoryUpdates, ...(state.memory ?? [])]
    .filter(
      (note, i, arr) =>
        arr.findIndex(
          (n) => n.text.toLowerCase() === note.text.toLowerCase(),
        ) === i,
    )
    .slice(0, MAX_MEMORY_NOTES);

  const passes = [pass, ...(state.passes ?? [])].slice(0, MAX_PASSES_KEPT);

  return { memory, passes };
}

export function latestPassForChapter(
  state: DevelopmentalEditorState | undefined,
  chapterId: string,
  kind?: DevelopmentalPassKind,
): DevelopmentalPass | undefined {
  const passes = state?.passes ?? [];
  // Continuity is book-scoped — latest continuity pass, any chapter key.
  if (kind === "continuity") {
    return passes.find((p) => p.kind === "continuity");
  }
  return passes.find(
    (p) =>
      p.chapterId === chapterId &&
      p.kind !== "continuity" &&
      (kind == null || p.kind === kind),
  );
}

export function patchDevelopmentalFlag(
  state: DevelopmentalEditorState,
  passId: string,
  flagId: string,
  partial: Partial<Pick<DevelopmentalFlag, "verdict" | "closed">>,
): DevelopmentalEditorState {
  return {
    ...state,
    passes: (state.passes ?? []).map((pass) => {
      if (pass.id !== passId) return pass;
      return {
        ...pass,
        flags: pass.flags.map((flag) =>
          flag.id === flagId ? { ...flag, ...partial } : flag,
        ),
      };
    }),
  };
}

/** Preference note when the author ✓ likes or ✕ dislikes a flag. */
export function createPreferenceMemoryNote(
  flag: DevelopmentalFlag,
  verdict: "liked" | "disliked",
  passKind: DevelopmentalPassKind,
): DevelopmentalMemoryNote {
  const label =
    DEVELOPMENTAL_CATEGORY_META[flag.category]?.label ?? flag.category;
  const excerpt = flag.excerpt.trim().slice(0, 100);
  const note = flag.note.trim().slice(0, 160);
  const polarity = verdict === "liked" ? "LIKED" : "DISLIKED";
  const guidance =
    verdict === "liked"
      ? "Prefer similar precise flags in this category when they recur."
      : "Soften or skip similar nags in this category; still flag genuine issues.";
  return {
    id: createId(),
    at: Date.now(),
    kind: "preference",
    text: `Author ${polarity} ${label} (${passKind}): “${excerpt}” — ${note} — ${guidance}`.slice(
      0,
      400,
    ),
  };
}

export function applyDevelopmentalFlagPatch(
  state: DevelopmentalEditorState,
  passId: string,
  flagId: string,
  partial: Partial<Pick<DevelopmentalFlag, "verdict" | "closed">>,
): DevelopmentalEditorState {
  const pass = (state.passes ?? []).find((p) => p.id === passId);
  const flag = pass?.flags.find((f) => f.id === flagId);
  let next = patchDevelopmentalFlag(state, passId, flagId, partial);

  if (
    flag &&
    pass &&
    partial.verdict != null &&
    (partial.verdict === "liked" || partial.verdict === "disliked")
  ) {
    const pref = createPreferenceMemoryNote(flag, partial.verdict, pass.kind);
    next = {
      ...next,
      memory: [pref, ...(next.memory ?? [])]
        .filter(
          (note, i, arr) =>
            arr.findIndex(
              (n) => n.text.toLowerCase() === note.text.toLowerCase(),
            ) === i,
        )
        .slice(0, MAX_MEMORY_NOTES),
    };
  }

  return next;
}

export function splitEditorMemory(memory: DevelopmentalMemoryNote[]): {
  preferences: DevelopmentalMemoryNote[];
  general: DevelopmentalMemoryNote[];
} {
  const preferences: DevelopmentalMemoryNote[] = [];
  const general: DevelopmentalMemoryNote[] = [];
  for (const m of memory) {
    if (m.kind === "preference" || /^Author (LIKED|DISLIKED)\b/.test(m.text)) {
      preferences.push(m);
    } else {
      general.push(m);
    }
  }
  return { preferences, general };
}

export function formatMemoryBlocks(memory: DevelopmentalMemoryNote[]): {
  preferencesBlock: string;
  generalBlock: string;
} {
  const { preferences, general } = splitEditorMemory(memory);
  return {
    preferencesBlock:
      preferences.length === 0
        ? "(none yet)"
        : preferences
            .slice(0, 16)
            .map((m) => `- ${m.text}`)
            .join("\n"),
    generalBlock:
      general.length === 0
        ? "(none yet)"
        : general
            .slice(0, 24)
            .map((m) => `- [${m.kind}] ${m.text}`)
            .join("\n"),
  };
}

/** Match roster characters named as POV or cast on this chapter's scenes. */
export function buildCharacterVoiceSnippets(
  characters: Character[],
  chapter: Chapter,
  maxChars = 2800,
): string {
  const wanted = new Set<string>();
  for (const s of chapter.scenes ?? []) {
    if (s.pov?.trim()) wanted.add(s.pov.trim().toLowerCase());
    for (const name of s.characters ?? []) {
      if (name.trim()) wanted.add(name.trim().toLowerCase());
    }
  }
  if (wanted.size === 0) return "";

  const matched = (characters ?? []).filter((c) => {
    const names = [c.name, ...(c.aliases ?? [])]
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    return names.some((n) => wanted.has(n));
  });

  if (matched.length === 0) return "";

  const chunks: string[] = [];
  let used = 0;
  for (const c of matched.slice(0, 12)) {
    const bits = [
      c.shortBio?.trim() ? `blurb: ${c.shortBio.trim().slice(0, 160)}` : "",
      c.voice?.speechNotes?.trim()
        ? `speech: ${c.voice.speechNotes.trim().slice(0, 220)}`
        : "",
      c.voice?.mannerisms?.trim()
        ? `manner: ${c.voice.mannerisms.trim().slice(0, 160)}`
        : "",
      c.voice?.sample?.trim()
        ? `sample: ${c.voice.sample.trim().slice(0, 200)}`
        : "",
      c.psychology?.wants?.trim()
        ? `wants: ${c.psychology.wants.trim().slice(0, 120)}`
        : "",
      c.psychology?.fears?.trim()
        ? `fears: ${c.psychology.fears.trim().slice(0, 120)}`
        : "",
      continuityNotesForPrompt(c.continuityNotes, 4)
        ? `as-of:\n    ${continuityNotesForPrompt(c.continuityNotes, 4).split("\n").join("\n    ")}`
        : "",
    ].filter(Boolean);
    if (bits.length === 0) continue;
    const block = `- ${c.name}\n  ${bits.join("\n  ")}`;
    if (used + block.length > maxChars) break;
    chunks.push(block);
    used += block.length;
  }

  return chunks.join("\n");
}

/** Append a try-next pin into private notes (never manuscript content). */
export function formatTryNextPin(args: {
  suggestion: string;
  excerpt: string;
  note?: string;
}): string {
  const lines = [
    "— Try next —",
    args.suggestion.trim(),
    args.excerpt.trim() ? `re: “${args.excerpt.trim().slice(0, 120)}”` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export function appendPrivateNote(
  existing: string,
  addition: string,
): string {
  const base = (existing ?? "").trimEnd();
  const add = addition.trim();
  if (!add) return existing ?? "";
  if (!base) return add;
  return `${base}\n\n${add}`;
}

export function buildReviewContext(args: {
  book: Pick<Book, "title" | "author" | "characters" | "locations">;
  chapter: Chapter;
  kind: DevelopmentalPassKind;
  memory: DevelopmentalMemoryNote[];
}): string {
  const plain = truncateChapterPlain(chapterToPlainText(args.chapter.content));
  const cast = (args.book.characters ?? [])
    .slice(0, 40)
    .map((c) => {
      const asOf = continuityNotesForPrompt(c.continuityNotes, 3);
      return `- ${c.name}${c.shortBio ? `: ${c.shortBio}` : ""}${
        asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
      }`;
    })
    .join("\n");
  const places = (args.book.locations ?? [])
    .slice(0, 40)
    .map((l) => {
      const asOf = continuityNotesForPrompt(l.continuityNotes, 3);
      return `- ${l.name}${l.shortBio ? `: ${l.shortBio}` : ""}${
        asOf ? `\n  ${asOf.split("\n").join("\n  ")}` : ""
      }`;
    })
    .join("\n");
  const { preferencesBlock, generalBlock } = formatMemoryBlocks(args.memory);
  const voiceBible =
    args.kind === "story" || args.kind === "style"
      ? buildCharacterVoiceSnippets(
          args.book.characters ?? [],
          args.chapter,
        )
      : "";

  return [
    `Book: ${args.book.title || "Untitled"}`,
    args.book.author ? `Author: ${args.book.author}` : "",
    `Pass: ${chapterPassLabel(args.kind)}`,
    `Chapter under review ONLY: ${args.chapter.title}`,
    "",
    "AUTHOR PREFERENCES (from ✓ liked / ✕ not useful on prior flags — respect tone; do not suppress real issues solely because of dislike):",
    preferencesBlock,
    "",
    "EDITOR MEMORY (durable notes from prior passes — use to stay consistent; do not invent):",
    generalBlock,
    "",
    cast ? `Cast roster (names only — for voice/consistency checks):\n${cast}` : "",
    places ? `Places (names only):\n${places}` : "",
    voiceBible
      ? `\nCHARACTER VOICE BIBLE (from this book's wiki for POV/cast in this chapter — check dialogue/interiority against these notes; suggest questions, not replacement lines):\n${voiceBible}`
      : "",
    "",
    "CHAPTER TEXT (flag issues in THIS chapter only):",
    plain || "(empty chapter)",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reviewSystemPrompt(kind: DevelopmentalPassKind): string {
  const shared = `You are a developmental editor and copy editor for a working novelist.
You FLAG specific moments in the chapter and offer brief directional suggestions — but you never touch the manuscript.

HARD RULES:
- Do NOT insert, paste, or apply anything into the manuscript. Suggestions exist only in this review response.
- Do NOT rewrite the flagged sentence as polished replacement prose ready to drop in.
- The summary alone is NOT enough. You MUST return discrete flags for concrete moments in the text.
- Every flag needs: a short verbatim excerpt (a phrase or sentence the author can find on the page), a diagnostic note, and EXACTLY TWO suggestions.
- Excerpts must be copy-pasteable from the chapter — specific enough to locate (prefer under ~120 characters).
- Flag every concrete issue you find in this chapter (don’t omit real problems to keep the list short). If the same issue recurs, flag representative moments rather than every identical repeat.
- Soft upper bound: about ${MAX_FLAGS_PER_PASS} flags if the chapter is packed — prioritize distinct moments over duplicates.
- Suggestions are seeds the author might try — e.g. "perhaps she notices the jacket sleeve first" or "try making eye contact before the line lands."
- Phrase suggestions as gentle options ("perhaps…", "consider…", "try…"), not commands.
- Always provide two distinct suggestions per flag (different angles).
- Flag ONLY the current chapter text provided. Other chapters are out of scope for flags.
- Use AUTHOR PREFERENCES and EDITOR MEMORY to stay consistent: lean into patterns they liked; soften categories they disliked — but still flag genuine issues.
- Prefer precise, spare notes. No cheerleading. No marketing tone.
- If the chapter is thin, return few or no flags rather than stretching.
- memoryUpdates: only durable patterns worth remembering later (max 4). Skip one-off nits.`;

  if (kind === "style") {
    return `${shared}

STYLE & LINE — line-level craft for this chapter only. Look for:

Mechanics
1. filter-words — sensory/cognitive filters: saw, heard, noticed, felt, thought, realized, watched, seemed, appeared, etc.
2. weak-verbs — passive voice, or limp verbs propped up by adverbs.
3. repetition — words, phrases, or sentence openings used too often in this chapter.
4. dialogue-tags — tags other than said, or missing action beats when tags strain.
5. adverbs — excessive -ly modifiers, especially with dialogue or weak verbs.

Prose & dialogue
6. flow-rhythm — awkward structure; monotonous cadence; places that need varied sentence length.
7. redundancy — filler and repeated constructions that slow the action (beyond simple word repeats).
8. word-choice — vague adjectives or limp diction (diagnose; do not paste a rewritten sentence).
9. dialogue-polish — unnatural or indistinct dialogue / clunky tags; use the voice bible when provided.

For each real instance, add a flag with that line’s excerpt — do not only summarize patterns in the summary. Use only the category ids above. Soft cap ~${MAX_FLAGS_PER_PASS} if the chapter is dense with repeats.

Ignore story/plot/character-arc and show-vs-tell (those belong to Story & Structure). Stay at the line level — no plot holes, world-rule breaks, or book-wide continuity.`;
  }

  return `${shared}

STORY & STRUCTURE — look only for:
1. telling — narrative summary where a scene could play out in moment-to-moment action or dialogue (show vs tell).
2. pacing — sudden speed-ups, or slow paragraphs that drag without earning their weight.
3. plot-holes — logic gaps, broken world rules (use memory + roster when helpful), or timeline slips visible in this chapter.
4. character-voice — dialogue or interiority that collapses distinct characters into one voice, or drifts from the CHARACTER VOICE BIBLE when provided.

For character-voice flags: diagnose against this book's voice notes (speech, manner, wants/fears). Phrase suggestions as Socratic questions or directional seeds ("Does this sound like her under pressure?", "perhaps her fear of X would color the line") — never write replacement dialogue ready to paste.

Pick every clear story/structure issue (soft cap ~${MAX_FLAGS_PER_PASS}). Use only the category ids above.

Ignore copy-edit minutiae (filter words, -ly counts, rhythm) on this pass.`;
}

export function reviewToolForKind(kind: DevelopmentalPassKind) {
  const categories = categoriesForPass(kind);
  return {
    name: REVIEW_TOOL_NAME,
    description: `Save editorial flags for this ${chapterPassLabel(kind)} pass (up to ${MAX_FLAGS_PER_PASS}). Suggestions stay in this review only — never applied to the manuscript.`,
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description:
            "2–4 sentences: overall editorial skim of this chapter for this pass.",
        },
        flags: {
          type: "array",
          description: `All distinct issues found (soft max ${MAX_FLAGS_PER_PASS}; skip identical repeats).`,
          items: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: [...categories],
              },
              severity: {
                type: "string",
                enum: ["note", "watch", "issue"],
              },
              excerpt: {
                type: "string",
                description: "Short verbatim quote from the chapter.",
              },
              note: {
                type: "string",
                description: "What to notice — why this was flagged.",
              },
              suggestions: {
                type: "array",
                description:
                  "Exactly two directional suggestions for the author (panel only — never manuscript text).",
                items: { type: "string" },
                minItems: 2,
                maxItems: 2,
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
                enum: ["style", "story", "general"],
              },
              text: {
                type: "string",
                description: "Durable pattern to remember across future passes.",
              },
            },
            required: ["text"],
          },
        },
      },
      required: ["summary", "flags"],
    },
  };
}

/** @deprecated Prefer reviewToolForKind — kept for any legacy imports. */
export const reviewTool = reviewToolForKind("style");
