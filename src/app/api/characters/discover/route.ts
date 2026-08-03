import { NextResponse } from "next/server";
import {
  DISCOVER_TOOL_NAME,
  buildDiscoveryContext,
  discoverCastTool,
  type DiscoveredCharacter,
} from "@/lib/characterEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<Book, "title" | "chapters" | "characters">;
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
  const context = buildDiscoveryContext(body.book);
  if (context.length < 120) {
    return NextResponse.json(
      { error: "Manuscript is too short to discover cast members." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [discoverCastTool],
      tool_choice: { type: "tool", name: DISCOVER_TOOL_NAME },
      system: `You find named characters in literary manuscripts for a novelist's cast wiki.
The manuscript has ${chapterCount} chapter(s). Scan EVERY chapter in the excerpts — do not stop after the opening.
Only return people with proper names who meaningfully appear.
Skip generic roles without names ("the baker"), animals unless named, and anyone already listed in the cast.
Do not invent characters.`,
      messages: [
        {
          role: "user",
          content: `Discover missing cast members across all ${chapterCount} chapters.\n\n${context}`,
        },
      ],
    });

    const result = extractToolInput<{ characters: DiscoveredCharacter[] }>(
      message,
      DISCOVER_TOOL_NAME,
    );
    const characters = (result?.characters ?? [])
      .map((c) => ({
        ...c,
        name: c.name?.trim() ?? "",
      }))
      .filter((c) => c.name.length > 1);

    return NextResponse.json({ characters, chapters: chapterCount });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
