import { NextResponse } from "next/server";
import {
  MANUSCRIPT_INDEX_TOOL_NAME,
  buildManuscriptIndexContext,
  emptyManuscriptIndex,
  manuscriptIndexTool,
  manuscriptSourceHash,
  mergeManuscriptIndexSlice,
  partitionManuscriptWindows,
  type ManuscriptIndex,
  type ManuscriptIndexSlice,
} from "@/lib/manuscriptIndex";
import { runManuscriptPasses } from "@/lib/manuscriptPasses";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";
import { chapterToPlainText } from "@/lib/developmentalEditor";

export const runtime = "nodejs";
export const maxDuration = 300;

type IndexBody = {
  book: Pick<
    Book,
    | "title"
    | "chapters"
    | "characters"
    | "locations"
    | "research"
    | "encyclopedia"
    | "chronicle"
    | "plotThreads"
  >;
};

function chaptersHaveIndexableProse(
  chapters: Book["chapters"] | undefined,
): boolean {
  let budget = 0;
  for (const ch of chapters ?? []) {
    budget += chapterToPlainText(ch.content ?? "").length;
    budget += (ch.summary ?? "").length;
    if (budget > 400) return true;
  }
  return false;
}

function normalizeSlice(raw: ManuscriptIndexSlice | null): ManuscriptIndexSlice {
  if (!raw) return {};
  return {
    characters: (raw.characters ?? [])
      .map((c) => ({ ...c, name: c.name?.trim() ?? "" }))
      .filter((c) => c.name.length > 1),
    locations: (raw.locations ?? [])
      .map((l) => ({ ...l, name: l.name?.trim() ?? "" }))
      .filter((l) => l.name.length > 1),
    research: (raw.research ?? [])
      .map((r) => ({ ...r, title: r.title?.trim() ?? "" }))
      .filter((r) => r.title.length > 1),
    encyclopedia: (raw.encyclopedia ?? [])
      .map((e) => ({ ...e, title: e.title?.trim() ?? "" }))
      .filter((e) => e.title.length > 1),
    chronicle: (raw.chronicle ?? [])
      .map((e) => ({ ...e, title: e.title?.trim() ?? "" }))
      .filter((e) => e.title.length > 0),
    plotThreads: (raw.plotThreads ?? [])
      .map((t) => ({
        name: t.name?.trim() ?? "",
        color: t.color,
        summary: t.summary?.trim() ?? "",
      }))
      .filter((t) => t.name.length > 1),
    plotAssignments: (raw.plotAssignments ?? [])
      .map((a) => ({
        sceneId: a.sceneId?.trim() ?? "",
        threadNames: (a.threadNames ?? []).map((n) => n.trim()).filter(Boolean),
      }))
      .filter((a) => a.sceneId && a.threadNames.length > 0),
  };
}

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

  let body: IndexBody;
  try {
    body = (await request.json()) as IndexBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chapters = body.book?.chapters ?? [];
  if (!chaptersHaveIndexableProse(chapters)) {
    return NextResponse.json(
      {
        error:
          "Manuscript is too thin to index — write more prose or chapter summaries first.",
      },
      { status: 422 },
    );
  }

  const sourceHash = manuscriptSourceHash(chapters);
  const windows = partitionManuscriptWindows(chapters);
  const bookCtx = {
    title: body.book.title,
    chapters,
    characters: body.book.characters ?? [],
    locations: body.book.locations ?? [],
    research: body.book.research ?? [],
    encyclopedia: body.book.encyclopedia ?? [],
    chronicle: body.book.chronicle ?? [],
    plotThreads: body.book.plotThreads ?? [],
  };

  try {
    const { result, passCount } = await runManuscriptPasses<ManuscriptIndex>({
      windows,
      empty: emptyManuscriptIndex(sourceHash),
      merge: (acc, part) => mergeManuscriptIndexSlice(acc, part),
      runPass: async (window, meta) => {
        const context = buildManuscriptIndexContext(
          bookCtx,
          window,
          meta.pass > 1 ? meta.prior : null,
          { pass: meta.pass, passCount: meta.passCount },
        );
        if (context.length < 120) {
          return emptyManuscriptIndex(sourceHash);
        }

        const message = await client.messages.create({
          model: anthropicModel(),
          max_tokens: 8192,
          tools: [manuscriptIndexTool],
          tool_choice: {
            type: "tool",
            name: MANUSCRIPT_INDEX_TOOL_NAME,
          },
          system: `You are indexing a novelist's manuscript into a world bible reading.
Extract ONLY what is evidenced in this chapter window (plus continuity with prior finds listed in the prompt).
Return cast names, places, outside-research topics, in-world encyclopedia seeds, world-history chronicle events (lore — not plot beats), and plot threads with exact sceneId assignments.
Never invent unsupported entities. Never rewrite manuscript prose.
Reuse plot thread names from prior passes when the same strand continues.`,
          messages: [
            {
              role: "user",
              content: `Index manuscript window for “${body.book.title || "Untitled"}”.\n\n${context}`,
            },
          ],
        });

        const raw = extractToolInput<ManuscriptIndexSlice>(
          message,
          MANUSCRIPT_INDEX_TOOL_NAME,
        );
        const slice = normalizeSlice(raw);
        return mergeManuscriptIndexSlice(
          emptyManuscriptIndex(sourceHash),
          slice,
        );
      },
    });

    const index: ManuscriptIndex = {
      ...result,
      generatedAt: Date.now(),
      sourceHash,
    };

    return NextResponse.json({
      index,
      passes: passCount,
      chapters: chapters.length,
    });
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
