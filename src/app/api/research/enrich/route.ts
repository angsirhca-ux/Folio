import { NextResponse } from "next/server";
import {
  ENRICH_RESEARCH_TOOL,
  buildResearchManuscriptContext,
  enrichResearchTool,
  researchSnapshotForPrompt,
  type ResearchEnrichmentPayload,
} from "@/lib/researchEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, ResearchEntry } from "@/lib/types";

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
  book: Pick<
    Book,
    "title" | "chapters" | "research" | "characters" | "locations"
  >;
  entryId: string;
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

  const entry = (body.book?.research ?? []).find(
    (e: ResearchEntry) => e.id === body.entryId,
  );
  if (!entry) {
    return NextResponse.json(
      { error: "Research entry not found in payload." },
      { status: 400 },
    );
  }

  const chapterCount = body.book.chapters?.length ?? 0;
  const context = buildResearchManuscriptContext(body.book, entry);
  if (context.length < 80) {
    return NextResponse.json(
      {
        error:
          "Not enough manuscript text yet to enrich this entry. Write more scenes first.",
      },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 8192,
      tools: [enrichResearchTool],
      tool_choice: { type: "tool", name: ENRICH_RESEARCH_TOOL },
      system: `You are a literary research editor for a novelist's commonplace book.
The manuscript has ${chapterCount} chapter(s). Use evidence from EVERY chapter.
Ground claims in the text. Do not invent sources that are not on the page unless clearly labeled as open questions.
Write in a spare, novelistic register — no academic jargon, no marketing tone.
Prefer the author's language when quoting.`,
      messages: [
        {
          role: "user",
          content: `Enrich this research entry using the FULL manuscript (${chapterCount} chapters).

Current snapshot:
${researchSnapshotForPrompt(entry)}

Manuscript evidence:
${context}`,
        },
      ],
    });

    const enrichment = extractToolInput<ResearchEnrichmentPayload>(
      message,
      ENRICH_RESEARCH_TOOL,
    );
    if (!enrichment) {
      return NextResponse.json(
        { error: "Claude returned no structured research payload." },
        { status: 502 },
      );
    }

    return NextResponse.json({ enrichment, chapters: chapterCount });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
