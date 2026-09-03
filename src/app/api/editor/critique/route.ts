import { NextResponse } from "next/server";
import {
  CRITIQUE_MAX_TOKENS,
  CRITIQUE_TOOL,
  MANUSCRIPT_CRITIQUE_CHAPTER_ID,
  MANUSCRIPT_CRITIQUE_TITLE,
  buildCritiqueContext,
  buildManuscriptCritiqueContext,
  critiqueManuscriptSystemPrompt,
  critiqueSystemPrompt,
  critiqueToolForPack,
  mergeCritiqueWindowItems,
  normalizeCritiquePayload,
  packById,
  partitionManuscriptCritiqueWindows,
  questionsForCritiqueRun,
  type CritiquePayload,
} from "@/lib/critique";
import { createId } from "@/lib/utils";
import {
  chapterToPlainText,
  partitionChapterReviewWindows,
  type ReviewTextWindow,
} from "@/lib/developmentalEditor";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type {
  Book,
  Chapter,
  CritiqueMemoryNote,
  CritiqueReview,
  CritiqueSectionId,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
  });
}

type CritiqueBody = {
  mode?: "chapter" | "manuscript";
  manuscriptStep?: {
    windowIndex: number;
    previousWindowEnding?: string;
  };
  packId: string;
  /** Smart-pack section filter — run Scene / Fantasy / Romance / Arc independently. */
  sections?: CritiqueSectionId[];
  /** @deprecated prefer packId */
  lensId?: string;
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
  chapter?: Pick<Chapter, "id" | "title" | "content" | "summary" | "scenes">;
  previousChapter?: Pick<Chapter, "id" | "title" | "content"> | null;
  memory?: CritiqueMemoryNote[];
  reviews?: CritiqueReview[];
};

async function callCritiqueTool(
  client: NonNullable<ReturnType<typeof getAnthropicClient>>,
  args: {
    packId: string;
    tool: ReturnType<typeof critiqueToolForPack>;
    system: string;
    userContent: string;
  },
): Promise<CritiquePayload | null> {
  const message = await client.messages.create({
    model: anthropicModel(),
    max_tokens: CRITIQUE_MAX_TOKENS,
    tools: [args.tool],
    tool_choice: { type: "tool", name: CRITIQUE_TOOL },
    system: args.system,
    messages: [{ role: "user", content: args.userContent }],
  });
  return extractToolInput<CritiquePayload>(message, CRITIQUE_TOOL);
}

function dedupeMemory(updates: CritiqueMemoryNote[]): CritiqueMemoryNote[] {
  const seen = new Set<string>();
  return updates
    .filter((m) => {
      const key = `${m.packId}:${m.text.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function runManuscriptCritiqueWindow(
  client: NonNullable<ReturnType<typeof getAnthropicClient>>,
  body: CritiqueBody,
  pack: NonNullable<ReturnType<typeof packById>>,
) {
  const step = body.manuscriptStep;
  if (!step || step.windowIndex < 0) {
    return NextResponse.json(
      {
        error: "manuscriptStep.windowIndex is required for full-book critique.",
      },
      { status: 400 },
    );
  }

  const chapters = (body.book?.chapters ?? []).filter(
    (c) => c?.content != null,
  );
  const totalPlain = chapters
    .map((c) => chapterToPlainText(c.content ?? ""))
    .join(" ");
  if (totalPlain.replace(/\s+/g, "").length < 200) {
    return NextResponse.json(
      {
        error:
          "The manuscript doesn’t have enough prose yet for a full-book critique.",
      },
      { status: 422 },
    );
  }

  const windows = partitionManuscriptCritiqueWindows(chapters);
  if (windows.length === 0) {
    return NextResponse.json(
      { error: "No readable chapters found in this manuscript." },
      { status: 422 },
    );
  }

  const window = windows[step.windowIndex];
  if (!window) {
    return NextResponse.json(
      {
        error: `Invalid manuscript window ${step.windowIndex + 1} of ${windows.length}.`,
      },
      { status: 400 },
    );
  }

  const sections =
    body.sections?.filter((s): s is CritiqueSectionId =>
      ["scene", "fantasy", "romance", "arc", "pressure"].includes(s),
    ) ?? undefined;
  const scopedQuestions = questionsForCritiqueRun(pack, sections);
  const tool = critiqueToolForPack(pack, sections);
  const system = critiqueManuscriptSystemPrompt(pack, sections);

  const bookSlice = {
    title: body.book?.title ?? "",
    author: body.book?.author ?? "",
    characters: body.book?.characters ?? [],
    locations: body.book?.locations ?? [],
    encyclopedia: body.book?.encyclopedia ?? [],
    research: body.book?.research ?? [],
    chapters,
  };

  const accumulatedMemory = (body.memory ?? []).filter(
    (m) => m.packId === pack.id,
  );
  const packReviews = (body.reviews ?? []).filter((r) => r.packId === pack.id);

  const context = buildManuscriptCritiqueContext({
    book: bookSlice,
    pack,
    window,
    memory: accumulatedMemory,
    chapterReviews: packReviews,
    sections,
    previousWindowEnding: step.previousWindowEnding,
  });

  const raw = await callCritiqueTool(client, {
    packId: pack.id,
    tool,
    system,
    userContent: `Apply the ${pack.name} checklist to this FULL MANUSCRIPT reading window (${window.index + 1}/${window.total}) and respond with the save_critique tool.

Remember:
- Answer EVERY question id in this run with yes | partial | no | n/a.
- Use n/a for Fantasy/Romance items that do not apply to this book.
- For no/partial, prefer a short verbatim excerpt from THIS window when evidence exists.
- On non-final windows: partial + “insufficient evidence in this section” for whole-book ending/arc items.
- suggestion is a watch-for seed only — never rewritten prose.
- memoryUpdates only for durable patterns (max 5).
- Never rewrite the manuscript.

${context}`,
  });

  if (!raw) {
    return NextResponse.json(
      {
        error: `Claude returned no structured critique for window ${window.index + 1} of ${window.total}. Try again.`,
      },
      { status: 502 },
    );
  }

  const normalized = normalizeCritiquePayload(raw, {
    pack,
    chapter: {
      id: MANUSCRIPT_CRITIQUE_CHAPTER_ID,
      title: MANUSCRIPT_CRITIQUE_TITLE,
    },
    questions: scopedQuestions,
    manuscript: true,
  });

  return NextResponse.json({
    windowIndex: step.windowIndex,
    total: windows.length,
    label: window.label,
    items: normalized.review.items,
    memoryUpdates: normalized.memoryUpdates,
    summaryPart: normalized.review.summary.trim(),
    previousWindowEnding: window.plain.slice(-4_500),
    done: step.windowIndex === windows.length - 1,
  });
}

async function runChapterCritique(
  client: NonNullable<ReturnType<typeof getAnthropicClient>>,
  body: CritiqueBody,
  pack: NonNullable<ReturnType<typeof packById>>,
) {
  if (!body.chapter?.id || body.chapter.content == null) {
    return NextResponse.json(
      { error: "chapter with id and content is required." },
      { status: 400 },
    );
  }

  const plain = chapterToPlainText(body.chapter.content);
  if (plain.replace(/\s+/g, "").length < 40) {
    return NextResponse.json(
      {
        error:
          "This chapter doesn’t have enough prose yet for a critique. Write a little more first.",
      },
      { status: 422 },
    );
  }

  const chapter = {
    ...body.chapter,
    summary: body.chapter.summary ?? "",
    notes: "",
    scenes: body.chapter.scenes ?? [],
    createdAt: 0,
    updatedAt: 0,
  } as Chapter;

  const chapters = Array.isArray(body.book?.chapters)
    ? body.book.chapters
    : [chapter];

  const chapterIndex = chapters.findIndex((c) => c.id === chapter.id);
  const previousChapter =
    body.previousChapter ??
    (chapterIndex > 0 ? chapters[chapterIndex - 1] : null);

  const sections =
    body.sections?.filter((s): s is CritiqueSectionId =>
      ["scene", "fantasy", "romance", "arc", "pressure"].includes(s),
    ) ?? undefined;
  const scopedQuestions = questionsForCritiqueRun(pack, sections);
  const tool = critiqueToolForPack(pack, sections);
  const system = critiqueSystemPrompt(pack, sections);
  const windows: ReviewTextWindow[] = partitionChapterReviewWindows(chapter);
  const windowTotal = windows.length;

  const bookSlice = {
    title: body.book?.title ?? "",
    author: body.book?.author ?? "",
    characters: body.book?.characters ?? [],
    locations: body.book?.locations ?? [],
    encyclopedia: body.book?.encyclopedia ?? [],
    research: body.book?.research ?? [],
    chapters,
  };

  const packMemory = (body.memory ?? []).filter((m) => m.packId === pack.id);
  const packReviews = (body.reviews ?? []).filter((r) => r.packId === pack.id);

  const windowItemSets: CritiqueReview["items"][] = [];
  const summaries: string[] = [];
  const memoryUpdates: CritiqueMemoryNote[] = [];

  for (const window of windows) {
    const windowNote = [
      windowTotal > 1
        ? `WINDOW ${window.index + 1} of ${windowTotal} — covering: ${window.label}. Judge only from prose in this window. Use partial + “insufficient evidence in this section” when a checklist item needs whole-chapter context not visible here.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const context = buildCritiqueContext({
      book: bookSlice,
      chapter,
      pack,
      memory: packMemory,
      reviews: packReviews,
      sections,
      previousChapter,
      plainOverride: window.plain,
      windowNote,
    });

    const raw = await callCritiqueTool(client, {
      packId: pack.id,
      tool,
      system,
      userContent: `Apply the ${pack.name} checklist to this chapter${
        windowTotal > 1
          ? ` (window ${window.index + 1}/${windowTotal})`
          : ""
      } and respond with the save_critique tool.

Remember:
- Answer EVERY question id in this run with yes | partial | no | n/a.
- Use n/a for Fantasy/Romance items that do not apply.
- For no/partial, prefer a short verbatim excerpt from THIS window when evidence exists.
- suggestion is a watch-for seed only — never rewritten prose.
- memoryUpdates only for durable patterns (max 5).
- Never rewrite the manuscript.

${context}`,
    });

    if (!raw) {
      return NextResponse.json(
        {
          error:
            windowTotal > 1
              ? `Claude returned no structured critique for window ${window.index + 1} of ${windowTotal}. Try again.`
              : "Claude returned no structured critique payload.",
        },
        { status: 502 },
      );
    }

    const normalized = normalizeCritiquePayload(raw, {
      pack,
      chapter,
      questions: scopedQuestions,
    });

    windowItemSets.push(normalized.review.items);
    if (normalized.review.summary.trim()) {
      summaries.push(
        windowTotal > 1
          ? `[Part ${window.index + 1}] ${normalized.review.summary.trim()}`
          : normalized.review.summary.trim(),
      );
    }
    memoryUpdates.push(...normalized.memoryUpdates);
  }

  const mergedItems = mergeCritiqueWindowItems(
    scopedQuestions,
    windowItemSets,
  );

  const review: CritiqueReview = {
    id: createId(),
    packId: pack.id,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    createdAt: Date.now(),
    summary: summaries.join("\n\n").slice(0, 1600),
    items: mergedItems,
  };

  return NextResponse.json({
    review,
    memoryUpdates: dedupeMemory(memoryUpdates),
    windows: windowTotal,
  });
}

export async function POST(request: Request) {
  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let body: CritiqueBody;
  try {
    body = (await request.json()) as CritiqueBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pack = packById(body.packId);
  if (!pack) {
    return NextResponse.json(
      { error: "Unknown critique pack. Use smart or pressure." },
      { status: 400 },
    );
  }

  const mode = body.mode ?? "chapter";

  try {
    if (mode === "manuscript") {
      return await runManuscriptCritiqueWindow(client, body, pack);
    }
    return await runChapterCritique(client, body, pack);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
