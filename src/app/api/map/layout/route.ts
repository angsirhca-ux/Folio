import { NextResponse } from "next/server";
import {
  LAYOUT_MAP_TOOL,
  MAP_LAYOUT_SYSTEM,
  applyMapLayout,
  buildMapLayoutContext,
  layoutMapTool,
  normalizeMapLayoutPayload,
  type MapLayoutPayload,
} from "@/lib/mapLayout";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type LayoutBody = {
  book: Pick<Book, "title" | "chapters" | "locations" | "map">;
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

  let body: LayoutBody;
  try {
    body = (await request.json()) as LayoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const locations = body.book?.locations ?? [];
  if (locations.length < 1) {
    return NextResponse.json(
      {
        error:
          "Need at least one place in the atlas — or use Build map from story to discover places first.",
      },
      { status: 422 },
    );
  }

  const context = buildMapLayoutContext(body.book);
  if (context.length < 160) {
    return NextResponse.json(
      {
        error:
          "Not enough manuscript or atlas detail to infer geography. Add place notes or write more scenes that mention where things are.",
      },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [layoutMapTool],
      tool_choice: { type: "tool", name: LAYOUT_MAP_TOOL },
      system: MAP_LAYOUT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Arrange these places on the story map.\n\n${context}`,
        },
      ],
    });

    const raw = extractToolInput<MapLayoutPayload>(message, LAYOUT_MAP_TOOL);
    const layout = normalizeMapLayoutPayload(raw, locations);
    if (layout.pins.length === 0) {
      return NextResponse.json(
        { error: "Claude returned no usable pin positions." },
        { status: 502 },
      );
    }

    const map = applyMapLayout(body.book.map, layout, locations, {
      expand: false,
    });
    return NextResponse.json({ layout, map });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
