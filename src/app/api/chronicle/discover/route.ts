import { NextResponse } from "next/server";
import {
  CHRONICLE_DISCOVER_TOOL_NAME,
  buildChronicleDiscoveryContext,
  chaptersHaveChronicleProse,
  discoverChronicleTool,
  type ChronicleDiscoverPayload,
} from "@/lib/chronicleEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<
    Book,
    | "title"
    | "chapters"
    | "chronicle"
    | "characters"
    | "locations"
    | "encyclopedia"
  >;
};

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
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

  let body: DiscoverBody;
  try {
    body = (await request.json()) as DiscoverBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chapters = body.book?.chapters ?? [];
  if (!chaptersHaveChronicleProse(chapters)) {
    return NextResponse.json(
      {
        error:
          "Manuscript is too thin to build a chronicle — write more prose or chapter summaries first.",
      },
      { status: 422 },
    );
  }

  const context = buildChronicleDiscoveryContext({
    title: body.book.title,
    chapters,
    chronicle: body.book.chronicle ?? [],
    characters: body.book.characters ?? [],
    locations: body.book.locations ?? [],
    encyclopedia: body.book.encyclopedia ?? [],
  });

  if (context.length < 200) {
    return NextResponse.json(
      { error: "Not enough manuscript context to propose chronicle events." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 8192,
      tools: [discoverChronicleTool],
      tool_choice: {
        type: "tool",
        name: CHRONICLE_DISCOVER_TOOL_NAME,
      },
      system: `You are building a WORLD CHRONICLE (lore history) for a novelist’s secondary world — not a plot outline of the novel.
Extract ages, wars, founding moments, cataclysms, dynasties, and myths that the text or bible treat as past.
Skip ordinary present-tense plot beats unless framed as history.
Ground every event in evidence. Prefer 4–14 sharp events. Do not invent unsupported lore. Never rewrite manuscript prose.
Link only names that appear in the provided cast / places / encyclopedia lists.`,
      messages: [
        {
          role: "user",
          content: `Pull chronicle events for “${body.book.title || "Untitled"}”.\n\n${context}`,
        },
      ],
    });

    const raw = extractToolInput<ChronicleDiscoverPayload>(
      message,
      CHRONICLE_DISCOVER_TOOL_NAME,
    );
    if (!raw?.events?.length) {
      return NextResponse.json(
        { error: "Claude returned no chronicle events." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      events: raw.events.slice(0, 16),
    } satisfies ChronicleDiscoverPayload);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
