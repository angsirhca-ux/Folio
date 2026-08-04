import { NextResponse } from "next/server";
import {
  PLOT_THREAD_DISCOVER_TOOL_NAME,
  buildPlotThreadDiscoveryContext,
  chaptersHavePlottableProse,
  discoverPlotThreadsTool,
  type PlotThreadDiscoverPayload,
} from "@/lib/plotThreadEnrichment";
import { PLOT_THREAD_PALETTE } from "@/lib/plotThreads";
import {
  anthropicModel,
  extractToolInput,
  getAnthropicClient,
} from "@/lib/anthropic";
import type { Book } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type DiscoverBody = {
  book: Pick<Book, "title" | "chapters" | "plotThreads">;
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

  let body: DiscoverBody;
  try {
    body = (await request.json()) as DiscoverBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const chapters = body.book.chapters ?? [];
  if (!chaptersHavePlottableProse(chapters)) {
    return NextResponse.json(
      {
        error:
          "Manuscript is too thin to populate threads — add scene prose or synopses first.",
      },
      { status: 422 },
    );
  }

  const context = buildPlotThreadDiscoveryContext({
    title: body.book.title,
    chapters,
    plotThreads: body.book.plotThreads ?? [],
  });
  if (context.length < 160) {
    return NextResponse.json(
      { error: "Not enough manuscript context to propose plot threads." },
      { status: 422 },
    );
  }

  const chapterCount = chapters.length;
  const sceneCount = chapters.reduce(
    (n, ch) => n + (ch.scenes?.length ?? 0),
    0,
  );

  const existingThreads = body.book.plotThreads ?? [];
  const hasLockedThreads = existingThreads.length > 0;

  try {
    const message = await client.messages.create({
      model: anthropicModel(),
      max_tokens: 8192,
      tools: [discoverPlotThreadsTool],
      tool_choice: {
        type: "tool",
        name: PLOT_THREAD_DISCOVER_TOOL_NAME,
      },
      system: `You map a novelist's manuscript onto a Plottr-style timeline of plot threads.
${
  hasLockedThreads
    ? `Threads are LOCKED. Use ONLY these exact names: ${existingThreads.map((t) => t.name).join(", ")}. Do not invent new threads. Assign scenes onto these tracks.`
    : `Propose 3–8 sharp threads (main plot, romance, mystery, character arcs, etc.) — not vague themes.`
}
Assign only real sceneId values from the context. A scene may touch multiple threads.
Use only these hex colors: ${PLOT_THREAD_PALETTE.join(", ")}.
Do not invent scenes or rewrite prose. Flags and structure only.`,
      messages: [
        {
          role: "user",
          content: `Populate plot threads for “${body.book.title || "Untitled"}” (${chapterCount} chapters, ${sceneCount} scenes).\n\n${context}`,
        },
      ],
    });

    const result = extractToolInput<PlotThreadDiscoverPayload>(
      message,
      PLOT_THREAD_DISCOVER_TOOL_NAME,
    );

    const threads = (result?.threads ?? [])
      .map((t) => ({
        name: t.name?.trim() ?? "",
        color: t.color,
        summary: t.summary?.trim() ?? "",
      }))
      .filter((t) => t.name.length > 1);

    const assignments = (result?.assignments ?? [])
      .map((a) => ({
        sceneId: a.sceneId?.trim() ?? "",
        threadNames: (a.threadNames ?? [])
          .map((n) => n.trim())
          .filter(Boolean),
      }))
      .filter((a) => a.sceneId && a.threadNames.length > 0);

    return NextResponse.json({
      threads,
      assignments,
      chapters: chapterCount,
      scenes: sceneCount,
    });
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : "Unknown Anthropic error";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
