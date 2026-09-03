import { NextResponse } from "next/server";
import {
  BETA_READ_MAX_TOKENS,
  BETA_READ_STRETCH_TOOL,
  BETA_READ_TOOL,
  MANUSCRIPT_BETA_CHAPTER_ID,
  MANUSCRIPT_BETA_TITLE,
  betaReadManuscriptSystemPrompt,
  betaReadManuscriptTool,
  betaReadStretchTool,
  betaReadSystemPrompt,
  betaReadSystemPromptForChapter,
  betaReadChapterUserReminder,
  betaReadTool,
  buildBetaReadContext,
  buildManuscriptBetaContext,
  isLastChapterInBook,
  mergeManuscriptBetaWindows,
  normalizeBetaReadPayload,
  normalizeBetaReadStretchPayload,
  partitionManuscriptBetaWindows,
  targetBetaReactionCount,
  type BetaReadPayload,
  type BetaReadStretchPayload,
} from "@/lib/betaReaders";
import { chapterToPlainText } from "@/lib/developmentalEditor";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type {
  BetaMemoryNote,
  BetaReaderPersona,
  BetaReview,
  Book,
  Chapter,
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

type BetaReadBody = {
  mode?: "chapter" | "manuscript";
  /** One window of a full-manuscript read — client orchestrates the loop. */
  manuscriptStep?: {
    windowIndex: number;
    stretchReactions: BetaReview["reactions"];
    previousWindowEnding?: string;
  };
  book: Pick<Book, "title" | "author" | "characters" | "chapters">;
  chapter?: Pick<Chapter, "id" | "title" | "content" | "summary">;
  previousChapter?: Pick<Chapter, "id" | "title" | "content"> | null;
  reader: BetaReaderPersona;
  memory?: BetaMemoryNote[];
  reviews?: BetaReview[];
};

async function runManuscriptBetaReadWindow(
  client: NonNullable<ReturnType<typeof getAnthropicClient>>,
  body: BetaReadBody,
) {
  const step = body.manuscriptStep;
  if (!step || step.windowIndex < 0) {
    return NextResponse.json(
      { error: "manuscriptStep.windowIndex is required for full-book reads." },
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
          "The manuscript doesn’t have enough prose yet for a full-book beta read.",
      },
      { status: 422 },
    );
  }

  const windows = partitionManuscriptBetaWindows(chapters);
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

  const isFinal = step.windowIndex === windows.length - 1;
  const readerMemory = (body.memory ?? []).filter(
    (m) => m.readerId === body.reader.id,
  );
  const readerReviews = (body.reviews ?? []).filter(
    (r) => r.readerId === body.reader.id,
  );

  const context = buildManuscriptBetaContext({
    book: {
      title: body.book?.title ?? "",
      author: body.book?.author ?? "",
      characters: body.book?.characters ?? [],
      chapters,
    },
    reader: body.reader,
    window,
    memory: readerMemory,
    chapterReviews: readerReviews,
    previousWindowEnding: step.previousWindowEnding,
    stretchReactions: step.stretchReactions,
  });

  const { min, softMax } = targetBetaReactionCount(
    window.plain.length,
    window.total,
  );

  if (!isFinal) {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: BETA_READ_MAX_TOKENS,
      tools: [betaReadStretchTool],
      tool_choice: { type: "tool", name: BETA_READ_STRETCH_TOOL },
      system: betaReadManuscriptSystemPrompt,
      messages: [
        {
          role: "user",
          content: `Continue reading the full manuscript as ${body.reader.name}. Window ${window.index + 1} of ${window.total}.

You have NOT finished the book — reactions and memoryUpdates ONLY. No whole-book verdict yet.

At least ${min} reactions in reading order (usually ${softMax} or fewer for this stretch). First person. Short excerpts when you can.

${context}`,
        },
      ],
    });

    const raw = extractToolInput<BetaReadStretchPayload>(
      message,
      BETA_READ_STRETCH_TOOL,
    );
    if (!raw) {
      return NextResponse.json(
        {
          error: `Claude returned no beta-read stretch for window ${window.index + 1} of ${window.total}.`,
        },
        { status: 502 },
      );
    }

    const { reactions, memoryUpdates } = normalizeBetaReadStretchPayload(
      raw,
      body.reader,
    );

    return NextResponse.json({
      done: false as const,
      windowIndex: step.windowIndex,
      total: windows.length,
      stretchReactions: [...step.stretchReactions, ...reactions],
      memoryUpdates,
      previousWindowEnding: window.plain.slice(-4_500),
    });
  }

  const message = await client.messages.create({
    model: anthropicModel(),
    max_tokens: BETA_READ_MAX_TOKENS,
    tools: [betaReadManuscriptTool],
    tool_choice: { type: "tool", name: BETA_READ_TOOL },
    system: betaReadManuscriptSystemPrompt,
    messages: [
      {
        role: "user",
        content: `Finish reading the full manuscript as ${body.reader.name}. Final window ${window.index + 1} of ${window.total}.

You are closing the book. reactions FIRST for this last stretch (at least ${min}, usually ${softMax} or fewer), then whole-book debrief, wouldContinue, readerWish, summary.

For the debrief: your ONLY sources for the opening and middle are YOUR READING LOG and memory in the context below — not the chapter list, not character bios, not guesswork. If you did not mark something while reading, do not claim it happened.

${context}`,
      },
    ],
  });

  const raw = extractToolInput<BetaReadPayload>(message, BETA_READ_TOOL);
  if (!raw) {
    return NextResponse.json(
      {
        error: `Claude returned no final manuscript beta read for window ${window.index + 1} of ${window.total}.`,
      },
      { status: 502 },
    );
  }

  const normalized = normalizeBetaReadPayload(raw, {
    reader: body.reader,
    chapter: {
      id: MANUSCRIPT_BETA_CHAPTER_ID,
      title: MANUSCRIPT_BETA_TITLE,
    },
    manuscript: true,
  });

  const review = mergeManuscriptBetaWindows({
    reader: body.reader,
    stretchReactions: step.stretchReactions,
    final: normalized.review,
    windowTotal: windows.length,
  });

  return NextResponse.json({
    done: true as const,
    review,
    memoryUpdates: normalized.memoryUpdates,
    total: windows.length,
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

  let body: BetaReadBody;
  try {
    body = (await request.json()) as BetaReadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.reader?.id || !body.reader?.name?.trim()) {
    return NextResponse.json(
      { error: "reader with id and name is required." },
      { status: 400 },
    );
  }

  if (body.mode === "manuscript") {
    try {
      return await runManuscriptBetaReadWindow(client, body);
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Unknown Anthropic error";
      return NextResponse.json({ error: detail }, { status: 502 });
    }
  }

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
          "This chapter doesn’t have enough prose yet for a beta read. Write a little more first.",
      },
      { status: 422 },
    );
  }

  const chapter = {
    ...body.chapter,
    summary: body.chapter.summary ?? "",
    notes: "",
    createdAt: 0,
    updatedAt: 0,
    scenes: [],
  } as Chapter;

  const chapters = Array.isArray(body.book?.chapters)
    ? body.book.chapters
    : [chapter];

  const chapterIndex = chapters.findIndex((c) => c.id === chapter.id);
  const isLastChapter = isLastChapterInBook(chapters, chapter.id);
  const previousChapter =
    body.previousChapter ??
    (chapterIndex > 0 ? chapters[chapterIndex - 1] : null);

  const { min } = targetBetaReactionCount(plain.length);

  const context = buildBetaReadContext({
    book: {
      title: body.book?.title ?? "",
      author: body.book?.author ?? "",
      characters: body.book?.characters ?? [],
      chapters,
    },
    chapter,
    reader: body.reader,
    memory: (body.memory ?? []).filter((m) => m.readerId === body.reader.id),
    reviews: (body.reviews ?? []).filter((r) => r.readerId === body.reader.id),
    previousChapter,
  });

  const opener = isLastChapter
    ? `Finish ${body.book?.title ? `“${body.book.title}”` : "this novel"} as ${body.reader.name}. This is the LAST chapter in the manuscript — close the book here, not a chapter to workshop.`
    : `Keep reading ${body.book?.title ? `“${body.book.title}”` : "this novel"} as ${body.reader.name}. This is the next stretch of the book, not a chapter to workshop.`;

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: BETA_READ_MAX_TOKENS,
      tools: [betaReadTool],
      tool_choice: { type: "tool", name: BETA_READ_TOOL },
      system: betaReadSystemPromptForChapter(isLastChapter),
      messages: [
        {
          role: "user",
          content: `${opener}

Stay in their taste (${body.reader.blurb.slice(0, 220)}).

${betaReadChapterUserReminder({ isLastChapter, min })}

${context}`,
        },
      ],
    });

    const raw = extractToolInput<BetaReadPayload>(message, BETA_READ_TOOL);
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned no structured beta-read payload." },
        { status: 502 },
      );
    }

    const { review, memoryUpdates } = normalizeBetaReadPayload(raw, {
      reader: body.reader,
      chapter,
      terminalChapter: isLastChapter,
    });

    return NextResponse.json({ review, memoryUpdates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
