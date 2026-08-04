import { NextResponse } from "next/server";
import {
  SOUNDTRACK_COMPOSE_TOOL_NAME,
  buildSoundtrackComposeContext,
  composeSoundtrackTool,
  type SoundtrackComposePayload,
} from "@/lib/soundtrackCompose";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book, ManuscriptIndexData } from "@/lib/types";
import { isManuscriptIndexFresh } from "@/lib/manuscriptIndex";

export const runtime = "nodejs";
export const maxDuration = 120;

type ComposeBody = {
  book: Pick<Book, "title" | "author" | "chapters" | "soundtrack">;
  manuscriptIndex: ManuscriptIndexData;
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

  let body: ComposeBody;
  try {
    body = (await request.json()) as ComposeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const index = body.manuscriptIndex;
  if (!index?.sourceHash) {
    return NextResponse.json(
      {
        error:
          "Read the manuscript first — Soundtrack uses the shared Claude reading.",
      },
      { status: 422 },
    );
  }

  if (
    !isManuscriptIndexFresh({
      chapters: body.book.chapters ?? [],
      manuscriptIndex: index,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "Manuscript reading is stale — Reread or Populate will refresh it first.",
      },
      { status: 422 },
    );
  }

  const context = buildSoundtrackComposeContext(
    {
      title: body.book.title,
      author: body.book.author,
      chapters: body.book.chapters ?? [],
      soundtrack: body.book.soundtrack ?? [],
    },
    index,
  );

  if (context.length < 160) {
    return NextResponse.json(
      { error: "Not enough manuscript reading to compose a soundtrack." },
      { status: 422 },
    );
  }

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 4096,
      tools: [composeSoundtrackTool],
      tool_choice: {
        type: "tool",
        name: SOUNDTRACK_COMPOSE_TOOL_NAME,
      },
      system: `You are a novelist’s music supervisor — playful but tasteful.
Given a structured manuscript READING (not raw skim), propose exactly 15 songs that feel like a soundtrack for this book.
Match tone, characters, and arc. Prefer real songs. Vary energy across the 15. Never rewrite manuscript prose.
Each track needs title, artist, a short why-it-fits note, and a placement label.`,
      messages: [
        {
          role: "user",
          content: `Compose the soundtrack for “${body.book.title || "Untitled"}”.\n\n${context}`,
        },
      ],
    });

    const raw = extractToolInput<SoundtrackComposePayload>(
      message,
      SOUNDTRACK_COMPOSE_TOOL_NAME,
    );
    const songs = (raw?.songs ?? [])
      .map((s) => ({
        title: s.title?.trim() ?? "",
        artist: s.artist?.trim() ?? "",
        note: s.note?.trim() ?? "",
        placement: s.placement?.trim() ?? "",
        order: s.order,
      }))
      .filter((s) => s.title && s.artist)
      .slice(0, 15);

    if (songs.length === 0) {
      return NextResponse.json(
        { error: "No tracks came back from Clarence." },
        { status: 502 },
      );
    }

    return NextResponse.json({ songs } satisfies SoundtrackComposePayload);
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
