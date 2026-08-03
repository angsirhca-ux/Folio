import { NextResponse } from "next/server";
import {
  ENRICH_ENCYCLOPEDIA_TOOL,
  buildEncyclopediaManuscriptContext,
  enrichEncyclopediaTool,
  encyclopediaSnapshotForPrompt,
  type EncyclopediaEnrichmentPayload,
} from "@/lib/encyclopediaEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, EncyclopediaEntry } from "@/lib/types";

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
    | "title"
    | "chapters"
    | "encyclopedia"
    | "encyclopediaStacks"
    | "characters"
    | "locations"
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

  const entry = (body.book?.encyclopedia ?? []).find(
    (e: EncyclopediaEntry) => e.id === body.entryId,
  );
  if (!entry) {
    return NextResponse.json(
      { error: "Encyclopedia entry not found in payload." },
      { status: 400 },
    );
  }

  const chapterCount = body.book.chapters?.length ?? 0;
  const context = buildEncyclopediaManuscriptContext(body.book, entry);
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
      tools: [enrichEncyclopediaTool],
      tool_choice: { type: "tool", name: ENRICH_ENCYCLOPEDIA_TOOL },
      system: `You are a literary world-bible editor for a novelist's encyclopedia.
The manuscript has ${chapterCount} chapter(s). Use evidence from EVERY chapter.
Capture IN-WORLD canon only. Suggest stackName that fits this book (reuse Existing stacks when possible).
Do not invent real-world sources or citations — that belongs in Research, not Encyclopedia.
Ground claims in the text. Write in a spare, novelistic register.`,
      messages: [
        {
          role: "user",
          content: `Enrich this encyclopedia article using the FULL manuscript (${chapterCount} chapters).

Current snapshot:
${encyclopediaSnapshotForPrompt(entry)}

Manuscript evidence:
${context}`,
        },
      ],
    });

    const enrichment = extractToolInput<EncyclopediaEnrichmentPayload>(
      message,
      ENRICH_ENCYCLOPEDIA_TOOL,
    );
    if (!enrichment) {
      return NextResponse.json(
        { error: "Claude returned no structured encyclopedia payload." },
        { status: 502 },
      );
    }

    return NextResponse.json({ enrichment, chapters: chapterCount });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
