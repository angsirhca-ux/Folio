import { NextResponse } from "next/server";
import {
  REVIEW_TOOL_NAME,
  REVIEW_MAX_TOKENS,
  MAX_FLAGS_PER_PASS,
  buildReviewContext,
  chapterPassLabel,
  chapterToPlainText,
  normalizeReviewPayload,
  reviewSystemPrompt,
  reviewToolForKind,
  type ReviewPayload,
} from "@/lib/developmentalEditor";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type {
  Book,
  Chapter,
  DevelopmentalMemoryNote,
  DevelopmentalPassKind,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return NextResponse.json({
    configured,
    model: configured ? anthropicModel() : null,
  });
}

type ReviewBody = {
  kind: DevelopmentalPassKind;
  book: Pick<
    Book,
    "title" | "author" | "characters" | "locations" | "chapters"
  >;
  chapter: Pick<Chapter, "id" | "title" | "content" | "scenes">;
  memory?: DevelopmentalMemoryNote[];
  /** Prior passes for cross-chapter digests (same book). */
  passes?: Book["developmentalEditor"]["passes"];
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

  let body: ReviewBody;
  try {
    body = (await request.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kindRaw = String(body.kind);
  if (kindRaw === "line") {
    body.kind = "style";
  } else if (
    kindRaw !== "style" &&
    kindRaw !== "story" &&
    kindRaw !== "action"
  ) {
    return NextResponse.json(
      { error: 'kind must be "style", "story", or "action".' },
      { status: 400 },
    );
  }

  if (!body.chapter?.id || body.chapter.content == null) {
    return NextResponse.json(
      { error: "chapter with id and content is required." },
      { status: 400 },
    );
  }

  const plain = chapterToPlainText(body.chapter.content);
  if (plain.replace(/\s+/g, "").length < 40) {
    return NextResponse.json(
      {
        error:
          "This chapter doesn’t have enough prose yet to review. Write a little more first.",
      },
      { status: 422 },
    );
  }

  const chapter = {
    ...body.chapter,
    scenes: body.chapter.scenes ?? [],
  } as Chapter;
  const context = buildReviewContext({
    book: {
      title: body.book?.title ?? "",
      author: body.book?.author ?? "",
      characters: body.book?.characters ?? [],
      locations: body.book?.locations ?? [],
      chapters: body.book?.chapters ?? [chapter],
    },
    chapter,
    kind: body.kind,
    memory: body.memory ?? [],
    passes: body.passes ?? [],
  });

  const passLabel = chapterPassLabel(body.kind);

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: REVIEW_MAX_TOKENS,
      tools: [reviewToolForKind(body.kind)],
      tool_choice: { type: "tool", name: REVIEW_TOOL_NAME },
      system: reviewSystemPrompt(body.kind),
      messages: [
        {
          role: "user",
          content: `Run a ${passLabel} pass on the current chapter only.

Remember:
- Return discrete flags for specific moments (verbatim excerpts the author can find on the page).
- Flag real issues — don’t drop problems to keep the list short. Soft max around ${MAX_FLAGS_PER_PASS} flags; collapse identical repeats into representative moments.
- A summary overview is fine, but flags are required whenever you notice issues — do not put everything only in the summary.
- Give EXACTLY TWO suggestions per flag (directional seeds like "perhaps…" / "consider…").
- Suggestions stay in this review only — never rewrite or insert into the manuscript.

${context}`,
        },
      ],
    });

    const raw = extractToolInput<ReviewPayload>(message, REVIEW_TOOL_NAME);
    if (!raw) {
      return NextResponse.json(
        { error: "Claude returned no structured review payload." },
        { status: 502 },
      );
    }

    const { pass, memoryUpdates } = normalizeReviewPayload(
      body.kind,
      raw,
      chapter,
    );

    return NextResponse.json({ pass, memoryUpdates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
