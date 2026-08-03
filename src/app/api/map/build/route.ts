import { NextResponse } from "next/server";
import {
  DISCOVER_LOCATIONS_TOOL,
  buildLocationDiscoveryContext,
  discoverLocationsTool,
  type DiscoveredLocation,
} from "@/lib/locationEnrichment";
import { createLocation, findLocationByName } from "@/lib/locations";
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
import type { Book, Location } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

type BuildBody = {
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

  let body: BuildBody;
  try {
    body = (await request.json()) as BuildBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const existing = body.book?.locations ?? [];
  const chapters = body.book?.chapters ?? [];
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "Add chapters before building a map from the story." },
      { status: 422 },
    );
  }

  try {
    // --- Phase 1: discover missing places ---
    let locationsToAdd: Location[] = [];
    const discoverContext = buildLocationDiscoveryContext({
      title: body.book.title,
      chapters,
      locations: existing,
    });

    if (discoverContext.length >= 120) {
      const discoverMsg = await client.messages.create({
        model: anthropicModel(),
        max_tokens: 2048,
        tools: [discoverLocationsTool],
        tool_choice: { type: "tool", name: DISCOVER_LOCATIONS_TOOL },
        system: `You find named places in literary manuscripts for a novelist's location wiki and story map.
Only return specific places with proper or clearly established names.
Skip generic nouns used once without identity ("a room", "outside").
Do not invent places. Skip anything already listed.`,
        messages: [
          {
            role: "user",
            content: `Discover missing locations for the story map.\n\n${discoverContext}`,
          },
        ],
      });

      const discovered = extractToolInput<{ locations: DiscoveredLocation[] }>(
        discoverMsg,
        DISCOVER_LOCATIONS_TOOL,
      );
      const candidates = (discovered?.locations ?? [])
        .map((l) => ({
          ...l,
          name: l.name?.trim() ?? "",
        }))
        .filter((l) => l.name.length > 1);

      let roster = [...existing];
      for (const d of candidates) {
        if (findLocationByName(roster, d.name)) continue;
        const loc = createLocation({
          name: d.name,
          kind: d.kind ?? "unspecified",
          shortBio: d.shortBio ?? "",
          tags: ["from-story", "claude"],
        });
        locationsToAdd.push(loc);
        roster.push(loc);
      }
    }

    const workingAtlas = [...existing, ...locationsToAdd];
    if (workingAtlas.length === 0) {
      return NextResponse.json(
        {
          error:
            "No places found yet. Name locations in the manuscript or add them to the atlas, then try again.",
        },
        { status: 422 },
      );
    }

    // --- Phase 2: layout pins + regions ---
    const layoutBook = {
      title: body.book.title,
      chapters,
      locations: workingAtlas,
      map: body.book.map,
    };
    const context = buildMapLayoutContext(layoutBook);
    if (context.length < 120) {
      return NextResponse.json(
        {
          error:
            "Not enough manuscript detail to infer geography. Write more scenes that mention where things are.",
        },
        { status: 422 },
      );
    }

    const layoutMsg = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [layoutMapTool],
      tool_choice: { type: "tool", name: LAYOUT_MAP_TOOL },
      system: MAP_LAYOUT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Build an accurate story map from the manuscript and atlas.\n\n${context}`,
        },
      ],
    });

    const raw = extractToolInput<MapLayoutPayload>(layoutMsg, LAYOUT_MAP_TOOL);
    const layout = normalizeMapLayoutPayload(raw, workingAtlas);
    if (layout.pins.length === 0 && workingAtlas.length > 0) {
      return NextResponse.json(
        { error: "Claude returned no usable pin positions." },
        { status: 502 },
      );
    }

    const map = applyMapLayout(body.book.map, layout, workingAtlas, {
      expand: false,
    });

    return NextResponse.json({
      locationsToAdd,
      layout,
      map,
      summary: layout.summary,
      stats: {
        added: locationsToAdd.length,
        pins: layout.pins.length,
        regions: layout.regions?.length ?? 0,
        connections: layout.connections?.length ?? 0,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
