import { NextResponse } from "next/server";
import {
  REVIEW_TOOL_NAME,
  REVIEW_MAX_TOKENS,
  MAX_FLAGS_PER_PASS,
  buildReviewContext,
  chapterPassLabel,
  chapterToPlainText,
  normalizeReviewPayload,
  partitionChapterReviewWindows,
  reviewSystemPrompt,
  reviewToolForKind,
  type ReviewPayload,
} from "@/lib/developmentalEditor";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import { createId } from "@/lib/utils";
import type {
  Book,
  Chapter,
  DevelopmentalFlag,
  DevelopmentalMemoryNote,
  DevelopmentalPassKind,
} from "@/lib/types";

export const runtime = "nodejs";
/** Long chapters run several windowed Claude calls — allow up to 5 minutes. */
export const maxDuration = 300;

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

function dedupeFlags(flags: DevelopmentalFlag[]): DevelopmentalFlag[] {
  const seen = new Set<string>();
  const out: DevelopmentalFlag[] = [];
  for (const f of flags) {
    const key = `${f.category}:${f.excerpt.toLowerCase().slice(0, 96)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= MAX_FLAGS_PER_PASS) break;
  }
  return out;
}

function dedupeMemory(
  notes: DevelopmentalMemoryNote[],
): DevelopmentalMemoryNote[] {
  const seen = new Set<string>();
  const out: DevelopmentalMemoryNote[] = [];
  for (const n of notes) {
    const key = n.text.toLowerCase().slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
    if (out.length >= 12) break;
  }
  return out;
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

  const bookSlice = {
    title: body.book?.title ?? "",
    author: body.book?.author ?? "",
    characters: body.book?.characters ?? [],
    locations: body.book?.locations ?? [],
    chapters: body.book?.chapters ?? [chapter],
  };

  const passLabel = chapterPassLabel(body.kind);
  const windows = partitionChapterReviewWindows(chapter);
  const tool = reviewToolForKind(body.kind);
  const system = reviewSystemPrompt(body.kind);

  try {
    const allFlags: DevelopmentalFlag[] = [];
    const summaries: string[] = [];
    const allMemory: DevelopmentalMemoryNote[] = [];

    for (const window of windows) {
      const windowNote =
        windows.length > 1
          ? `WINDOW ${window.index + 1} of ${windows.length} — covering: ${window.label}. Flag ONLY issues whose excerpts appear in this window’s text. Soft max ~${Math.max(8, Math.ceil(MAX_FLAGS_PER_PASS / windows.length))} flags for this window.`
          : undefined;

      const context = buildReviewContext({
        book: bookSlice,
        chapter,
        kind: body.kind,
        memory: body.memory ?? [],
        passes: body.passes ?? [],
        plainOverride: window.plain,
        windowNote,
      });

      const message = await client.messages.create({
        model: anthropicModel(),
        max_tokens: REVIEW_MAX_TOKENS,
        tools: [tool],
        tool_choice: { type: "tool", name: REVIEW_TOOL_NAME },
        system,
        messages: [
          {
            role: "user",
            content: `Run a ${passLabel} pass on the current chapter${
              windows.length > 1
                ? ` (window ${window.index + 1}/${windows.length})`
                : ""
            }.

Remember:
- Return discrete flags for specific moments (verbatim excerpts the author can find on the page).
- Flag real issues — don’t drop problems to keep the list short. Soft max around ${MAX_FLAGS_PER_PASS} flags across the whole chapter; collapse identical repeats into representative moments.
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
          {
            error:
              windows.length > 1
                ? `Claude returned no structured review for window ${window.index + 1} of ${windows.length}. Try again.`
                : "Claude returned no structured review payload.",
          },
          { status: 502 },
        );
      }

      const { pass, memoryUpdates } = normalizeReviewPayload(
        body.kind,
        raw,
        chapter,
      );
      allFlags.push(...pass.flags);
      if (pass.summary.trim()) {
        summaries.push(
          windows.length > 1
            ? `[Part ${window.index + 1}] ${pass.summary.trim()}`
            : pass.summary.trim(),
        );
      }
      allMemory.push(...memoryUpdates);
    }

    const pass = {
      id: createId(),
      kind: body.kind,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      createdAt: Date.now(),
      summary: summaries.join("\n\n").slice(0, 1600),
      flags: dedupeFlags(allFlags),
    };

    return NextResponse.json({
      pass,
      memoryUpdates: dedupeMemory(allMemory),
      windows: windows.length,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
