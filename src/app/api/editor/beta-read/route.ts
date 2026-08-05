import { NextResponse } from "next/server";
import {
  BETA_READ_TOOL,
  betaReadSystemPrompt,
  betaReadTool,
  buildBetaReadContext,
  normalizeBetaReadPayload,
  type BetaReadPayload,
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
  book: Pick<Book, "title" | "author" | "characters" | "chapters">;
  chapter: Pick<Chapter, "id" | "title" | "content" | "summary">;
  reader: BetaReaderPersona;
  memory?: BetaMemoryNote[];
  reviews?: BetaReview[];
};

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
  });

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [betaReadTool],
      tool_choice: { type: "tool", name: BETA_READ_TOOL },
      system: betaReadSystemPrompt,
      messages: [
        {
          role: "user",
          content: `Read this chapter as ${body.reader.name} and respond with the save_beta_read tool.

Remember:
- Emotional reactions first — name the feeling, cite a short excerpt when you can (2–6 reactions).
- Answer every craft question id briefly.
- memoryUpdates only for durable impressions you’ll need in later chapters (max 5).
- Never rewrite the manuscript.

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
    });

    return NextResponse.json({ review, memoryUpdates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
