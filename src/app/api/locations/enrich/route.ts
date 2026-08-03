import { NextResponse } from "next/server";
import {
  ENRICH_LOCATION_TOOL,
  buildLocationManuscriptContext,
  enrichLocationTool,
  locationSnapshotForPrompt,
  type LocationEnrichmentPayload,
} from "@/lib/locationEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, Location } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
  });
}

type EnrichBody = {
  book: Pick<Book, "title" | "chapters" | "locations">;
  locationId: string;
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

  let body: EnrichBody;
  try {
    body = (await request.json()) as EnrichBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const location = (body.book?.locations ?? []).find(
    (l: Location) => l.id === body.locationId,
  );
  if (!location) {
    return NextResponse.json(
      { error: "Location not found in payload." },
      { status: 400 },
    );
  }

  const context = buildLocationManuscriptContext(body.book, location);
  if (context.length < 80) {
    return NextResponse.json(
      {
        error:
          "Not enough manuscript text yet to enrich this location. Write more scenes first.",
      },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [enrichLocationTool],
      tool_choice: { type: "tool", name: ENRICH_LOCATION_TOOL },
      system: `You are a literary setting-bible editor for a novelist.
The manuscript may span multiple chapters. Use evidence from EVERY chapter in the excerpts — never stop after the opening.
Ground every claim in the manuscript excerpts. Do not invent geography, history, or sensory detail the text does not support.
If evidence is thin, leave fields empty rather than guessing.
Write in a spare, novelistic register — no travel-brochure tone.
Prefer the author's language for atmosphere and shortBio.`,
      messages: [
        {
          role: "user",
          content: `Enrich the wiki for this location using the FULL manuscript.

Current snapshot:
${locationSnapshotForPrompt(location)}

Manuscript evidence:
${context}`,
        },
      ],
    });

    const enrichment = extractToolInput<LocationEnrichmentPayload>(
      message,
      ENRICH_LOCATION_TOOL,
    );
    if (!enrichment) {
      return NextResponse.json(
        { error: "Claude returned no structured wiki payload." },
        { status: 502 },
      );
    }

    return NextResponse.json({ enrichment });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
