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
    // Prefer synonyms; fall back to meaning-like + related triggers so common
    // words still return something when Datamuse’s syn list is thin.
    const [synonyms, related, triggers] = await Promise.all([
      datamuse(`rel_syn=${encoded}&max=24`),
      datamuse(`ml=${encoded}&max=20`),
      datamuse(`rel_trg=${encoded}&max=12`),
    ]);

    const seen = new Set<string>([q.toLowerCase()]);
    const synOut: ThesaurusHit[] = [];
    for (const h of synonyms) {
      const key = h.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      synOut.push(h);
    }
    // If synonym list is empty, promote meaning-like matches into the main list
    if (synOut.length === 0) {
      for (const h of related) {
        const key = h.word.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        synOut.push(h);
        if (synOut.length >= 16) break;
      }
    }
    const relatedFiltered: ThesaurusHit[] = [];
    for (const h of [...related, ...triggers]) {
      const key = h.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      relatedFiltered.push(h);
      if (relatedFiltered.length >= 12) break;
    }

    return NextResponse.json({
      query: q,
      synonyms: synOut,
      related: relatedFiltered,
    });
  } catch {
    return NextResponse.json(
      { error: "Thesaurus is unreachable right now." },
      { status: 502 },
    );
  }
}
