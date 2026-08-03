import { NextResponse } from "next/server";
import {
  DISCOVER_LOCATIONS_TOOL,
  buildLocationDiscoveryContext,
  discoverLocationsTool,
  type DiscoveredLocation,
} from "@/lib/locationEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<Book, "title" | "chapters" | "locations">;
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

  const context = buildLocationDiscoveryContext(body.book);
  if (context.length < 120) {
    return NextResponse.json(
      { error: "Manuscript is too short to discover locations." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 2048,
      tools: [discoverLocationsTool],
      tool_choice: { type: "tool", name: DISCOVER_LOCATIONS_TOOL },
      system: `You find named places in literary manuscripts for a novelist's location wiki.
Only return specific places with proper or clearly established names (Study, Riverbank, Ash Street).
Skip generic nouns used once without identity ("a room", "outside").
Do not invent places. Skip anything already listed.`,
      messages: [
        {
          role: "user",
          content: `Discover missing locations.\n\n${context}`,
        },
      ],
    });

    const result = extractToolInput<{ locations: DiscoveredLocation[] }>(
      message,
      DISCOVER_LOCATIONS_TOOL,
    );
    const locations = (result?.locations ?? [])
      .map((l) => ({
        ...l,
        name: l.name?.trim() ?? "",
      }))
      .filter((l) => l.name.length > 1);

    return NextResponse.json({ locations });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
