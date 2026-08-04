import { NextResponse } from "next/server";
import {
  CRITIQUE_MAX_TOKENS,
  CRITIQUE_TOOL,
  buildCritiqueContext,
  critiqueSystemPrompt,
  critiqueToolForPack,
  normalizeCritiquePayload,
  packById,
  type CritiquePayload,
} from "@/lib/critique";
import { chapterToPlainText } from "@/lib/developmentalEditor";
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
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
  });
}

type CritiqueBody = {
  packId: string;
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
  chapter: Pick<Chapter, "id" | "title" | "content" | "summary">;
  memory?: CritiqueMemoryNote[];
  reviews?: CritiqueReview[];
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
    createdAt: 0,
    updatedAt: 0,
    scenes: [],
  } as Chapter;

  const chapters = Array.isArray(body.book?.chapters)
    ? body.book.chapters
    : [chapter];

  const context = buildCritiqueContext({
    book: {
      title: body.book?.title ?? "",
      author: body.book?.author ?? "",
      characters: body.book?.characters ?? [],
      locations: body.book?.locations ?? [],
      encyclopedia: body.book?.encyclopedia ?? [],
      research: body.book?.research ?? [],
      chapters,
    },
    chapter,
    pack,
    memory: (body.memory ?? []),
    reviews: (body.reviews ?? []).filter((r) => r.packId === pack.id),
  });

  const tool = critiqueToolForPack(pack);

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: CRITIQUE_MAX_TOKENS,
      tools: [tool],
      tool_choice: { type: "tool", name: CRITIQUE_TOOL },
      system: critiqueSystemPrompt(pack),
      messages: [
        {
          role: "user",
          content: `Apply the ${pack.name} checklist to this chapter and respond with the save_critique tool.

Remember:
- Answer EVERY question id with yes | partial | no | n/a.
- Use n/a for Fantasy/Romance items that do not apply.
- For no/partial, prefer a short verbatim excerpt when evidence exists.
- suggestion is a watch-for seed only — never rewritten prose.
- memoryUpdates only for durable patterns (max 5).
- Never rewrite the manuscript.

${context}`,
        },
      ],
    });

    const raw = extractToolInput<CritiquePayload>(message, CRITIQUE_TOOL);
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned no structured critique payload." },
        { status: 502 },
      );
    }

    const { review, memoryUpdates } = normalizeCritiquePayload(raw, {
      pack,
      chapter,
    });

    return NextResponse.json({ review, memoryUpdates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
