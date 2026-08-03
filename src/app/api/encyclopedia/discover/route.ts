import { NextResponse } from "next/server";
import {
  DISCOVER_ENCYCLOPEDIA_TOOL,
  buildEncyclopediaDiscoveryContext,
  discoverEncyclopediaTool,
  type DiscoveredEncyclopedia,
} from "@/lib/encyclopediaEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<Book, "title" | "chapters" | "encyclopedia" | "encyclopediaStacks">;
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

  let body: DiscoverBody;
  try {
    body = (await request.json()) as DiscoverBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chapterCount = body.book.chapters?.length ?? 0;
  const context = buildEncyclopediaDiscoveryContext(body.book);
  if (context.length < 120) {
    return NextResponse.json(
      { error: "Manuscript is too short to discover encyclopedia articles." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [discoverEncyclopediaTool],
      tool_choice: { type: "tool", name: DISCOVER_ENCYCLOPEDIA_TOOL },
      system: `You find in-world encyclopedia articles for a novelist's story bible.
Stack names should fit THIS book (not fantasy defaults) — reuse Existing stacks when they fit, or suggest a short plain stackName.
Scan EVERY chapter. Skip topics already listed. Skip literary themes/motifs (those belong in Research). Do not invent plot facts — name what the text actually establishes about the world.`,
      messages: [
        {
          role: "user",
          content: `Discover missing encyclopedia articles across all ${chapterCount} chapters.\n\n${context}`,
        },
      ],
    });

    const result = extractToolInput<{ entries: DiscoveredEncyclopedia[] }>(
      message,
      DISCOVER_ENCYCLOPEDIA_TOOL,
    );
    const entries = (result?.entries ?? [])
      .map((e) => ({
        ...e,
        title: e.title?.trim() ?? "",
      }))
      .filter((e) => e.title.length > 1);

    return NextResponse.json({ entries, chapters: chapterCount });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
