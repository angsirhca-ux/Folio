import { NextResponse } from "next/server";
import {
  ENRICH_TOOL_NAME,
  buildCharacterManuscriptContext,
  characterSnapshotForPrompt,
  enrichCharacterTool,
  type CharacterEnrichmentPayload,
} from "@/lib/characterEnrichment";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, Character } from "@/lib/types";

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
  book: Pick<Book, "title" | "chapters" | "characters">;
  characterId: string;
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

  const character = (body.book?.characters ?? []).find(
    (c: Character) => c.id === body.characterId,
  );
  if (!character) {
    return NextResponse.json(
      { error: "Character not found in payload." },
      { status: 400 },
    );
  }

  const chapterCount = body.book.chapters?.length ?? 0;
  const context = buildCharacterManuscriptContext(body.book, character);
  if (context.length < 80) {
    return NextResponse.json(
      {
        error:
          "Not enough manuscript text yet to enrich this character. Write more scenes first.",
      },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 8192,
      tools: [enrichCharacterTool],
      tool_choice: { type: "tool", name: ENRICH_TOOL_NAME },
      system: `You are a literary character-bible editor for a novelist.
The manuscript has ${chapterCount} chapter(s). Evidence may span the entire book.
You MUST use material from every chapter present in the excerpts — never summarize only the opening.
Ground every claim in the manuscript excerpts. Do not invent plot facts, ages, jobs, or relationships the text does not support.
If evidence is thin, leave fields empty rather than guessing.
Write in a spare, novelistic register — no marketing copy, no bullet-point AI tone.
Prefer quoting or lightly adapting the author's language for voice.sample and shortBio.
Arc.turningPoints should include turns from later chapters when they appear.`,
      messages: [
        {
          role: "user",
          content: `Enrich the wiki for this character using the FULL manuscript evidence (${chapterCount} chapters).

Current snapshot:
${characterSnapshotForPrompt(character)}

Manuscript evidence:
${context}`,
        },
      ],
    });

    const enrichment = extractToolInput<CharacterEnrichmentPayload>(
      message,
      ENRICH_TOOL_NAME,
    );
    if (!enrichment) {
      return NextResponse.json(
        { error: "Claude returned no structured wiki payload." },
        { status: 502 },
      );
    }

    return NextResponse.json({ enrichment, chapters: chapterCount });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
