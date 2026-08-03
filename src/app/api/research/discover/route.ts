import { NextResponse } from "next/server";
import {
  DISCOVER_RESEARCH_TOOL,
  buildResearchDiscoveryContext,
  discoverResearchTool,
  type DiscoveredResearch,
} from "@/lib/researchEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<Book, "title" | "chapters" | "research">;
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
  const context = buildResearchDiscoveryContext(body.book);
  if (context.length < 120) {
    return NextResponse.json(
      { error: "Manuscript is too short to discover research topics." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [discoverResearchTool],
      tool_choice: { type: "tool", name: DISCOVER_RESEARCH_TOOL },
      system: `You find research topics for a novelist's commonplace book: themes, motifs, recurring images, craft questions, lore.
Scan EVERY chapter. Skip topics already listed. Do not invent plot facts — name what the text actually circles.`,
      messages: [
        {
          role: "user",
          content: `Discover missing research topics across all ${chapterCount} chapters.\n\n${context}`,
        },
      ],
    });

    const result = extractToolInput<{ entries: DiscoveredResearch[] }>(
      message,
      DISCOVER_RESEARCH_TOOL,
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
