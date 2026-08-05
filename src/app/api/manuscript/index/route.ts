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
    | "clarenceContext"
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
      .map((c) => ({
        ...c,
        name: c.name?.trim() ?? "",
        aliases: (c.aliases ?? [])
          .map((a) => a.trim())
          .filter((a) => a.length > 1),
        presence:
          c.presence === "mentioned" || c.presence === "present"
            ? c.presence
            : ("present" as const),
      }))
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

/**
 * Streams NDJSON progress so the UI can show pass N of M + elapsed time.
 * Lines: start → pass* → done | error
 */
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
  const seededThreads = (body.book.plotThreads ?? []).map((t) => ({
    name: t.name,
    color: t.color,
  }));
  const hasLockedThreads = seededThreads.length > 0;
  const passCount = Math.min(windows.length, 12);
  const runWindows = windows.slice(0, passCount);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        send({
          type: "start",
          pass: 0,
          passCount,
          chapters: chapters.length,
        });

        let acc = emptyManuscriptIndex(sourceHash, {
          plotThreads: seededThreads,
        });

        for (let i = 0; i < runWindows.length; i++) {
          const pass = i + 1;
          send({ type: "pass", pass, passCount, chapters: chapters.length });

          const window = runWindows[i]!;
          const context = buildManuscriptIndexContext(
            bookCtx,
            window,
            pass > 1 ? acc : null,
            { pass, passCount },
          );

          if (context.length < 120) {
            continue;
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
CAST: one person = one entry. Reuse the fullest name from prior finds / bible. Add nicknames under aliases — do not create a second card for “Lily” if “Lily Chen” already exists.
presence=present only when they are on-stage (act, speak, occupy the scene). If they are only talked about, remembered, or narrated, use presence=mentioned.
If AUTHOR guidance names a first-person narrator, treat “I/me/my” as that person and mark them protagonist / present in those scenes.
${
  hasLockedThreads
    ? "Plot threads are LOCKED to the names listed in the prompt — use those exact names only; do not invent new tracks; assign scenes onto them."
    : "Reuse plot thread names from prior passes when the same strand continues."
}`,
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
          acc = mergeManuscriptIndexSlice(acc, slice);
        }

        const index: ManuscriptIndex = {
          ...acc,
          generatedAt: Date.now(),
          sourceHash,
        };

        send({
          type: "done",
          index,
          passes: passCount,
          chapters: chapters.length,
        });
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : "Unknown Anthropic error";
        send({ type: "error", error: detail });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
