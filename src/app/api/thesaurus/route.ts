import { NextResponse } from "next/server";
import { normalizeLookupWord, type ThesaurusHit } from "@/lib/thesaurus";

export const runtime = "nodejs";

type DatamuseWord = {
  word?: string;
  score?: number;
  tags?: string[];
};

async function datamuse(pathQuery: string): Promise<ThesaurusHit[]> {
  const res = await fetch(`https://api.datamuse.com/words?${pathQuery}`, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as DatamuseWord[];
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => ({
      word: (row.word ?? "").trim(),
      score: row.score,
      tags: row.tags,
    }))
    .filter((h) => h.word.length > 0);
}

/**
 * GET /api/thesaurus?q=quiet
 * Synonyms + near-meaning related words (Datamuse — no API key).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = normalizeLookupWord(searchParams.get("q") ?? "");
  if (!q || q.length > 64) {
    return NextResponse.json(
      { error: "Provide a single word to look up." },
      { status: 400 },
    );
  }

  try {
    const encoded = encodeURIComponent(q.toLowerCase());
    const [synonyms, related] = await Promise.all([
      datamuse(`rel_syn=${encoded}&max=24`),
      datamuse(`ml=${encoded}&max=16`),
    ]);

    const seen = new Set(synonyms.map((s) => s.word.toLowerCase()));
    seen.add(q.toLowerCase());
    const relatedFiltered = related.filter(
      (r) => !seen.has(r.word.toLowerCase()),
    );

    return NextResponse.json({
      query: q,
      synonyms,
      related: relatedFiltered.slice(0, 12),
    });
  } catch {
    return NextResponse.json(
      { error: "Thesaurus is unreachable right now." },
      { status: 502 },
    );
  }
}
