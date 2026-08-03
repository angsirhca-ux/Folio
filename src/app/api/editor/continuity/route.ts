import { NextResponse } from "next/server";
import {
  CONTINUITY_TOOL_NAME,
  buildContinuityContext,
  continuitySystemPrompt,
  continuityTool,
  normalizeContinuityPayload,
  type ContinuityPayload,
} from "@/lib/continuityEditor";
import { chapterToPlainText } from "@/lib/developmentalEditor";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, DevelopmentalMemoryNote, Series } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
  });
}

type ContinuityBody = {
  book: Pick<
    Book,
    "title" | "author" | "chapters" | "characters" | "locations" | "research"
  >;
  series?: Pick<
    Series,
    "title" | "synopsis" | "notes" | "characters" | "locations"
  > | null;
  memory?: DevelopmentalMemoryNote[];
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

  let body: ContinuityBody;
  try {
    body = (await request.json()) as ContinuityBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chapters = body.book?.chapters ?? [];
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "This book has no chapters to check." },
      { status: 422 },
    );
  }

  const totalPlain = chapters
    .map((c) => chapterToPlainText(c.content ?? ""))
    .join("\n");
  if (totalPlain.replace(/\s+/g, "").length < 80) {
    return NextResponse.json(
      {
        error:
          "Not enough prose yet for a continuity pass. Write a little more across the book first.",
      },
      { status: 422 },
    );
  }

  const context = buildContinuityContext(
    {
      title: body.book.title ?? "",
      author: body.book.author ?? "",
      chapters,
      characters: body.book.characters ?? [],
      locations: body.book.locations ?? [],
      research: body.book.research ?? [],
    },
    body.memory ?? [],
    body.series
      ? {
          title: body.series.title ?? "Series",
          synopsis: body.series.synopsis,
          notes: body.series.notes,
          characters: body.series.characters,
          locations: body.series.locations,
        }
      : null,
  );

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [continuityTool],
      tool_choice: { type: "tool", name: CONTINUITY_TOOL_NAME },
      system: continuitySystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Run a whole-book continuity pass.

Remember:
- Flag inconsistencies across chapters (names, cast, places, timeline, forgotten details).
- Use exact chapterId and sceneIndex from the ledger when you can.
- Excerpts must be findable in the provided text.
- Exactly two directional suggestions per flag — never rewrite the manuscript.
- A short continuity letter in summary is welcome; flags are required for concrete issues.

${context}`,
        },
      ],
    });

    const raw = extractToolInput<ContinuityPayload>(
      message,
      CONTINUITY_TOOL_NAME,
    );
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned no structured continuity payload." },
        { status: 502 },
      );
    }

    const { pass, memoryUpdates } = normalizeContinuityPayload(raw, {
      title: body.book.title ?? "",
      chapters,
    });

    return NextResponse.json({ pass, memoryUpdates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
