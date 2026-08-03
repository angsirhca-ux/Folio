import type { Book } from "./types";

export type MentionKind = "encyclopedia" | "character" | "location";

export type MentionTerm = {
  id: string;
  kind: MentionKind;
  label: string;
  /** Name + aliases, longest first, min length 3. */
  phrases: string[];
};

export type MentionHit = {
  from: number;
  to: number;
  term: MentionTerm;
};

const MIN_PHRASE = 3;

function phrasesFor(name: string, aliases: string[]): string[] {
  const raw = [name, ...aliases]
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_PHRASE);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of raw.sort((a, b) => b.length - a.length)) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Bible titles worth noticing while drafting. */
export function collectMentionTerms(book: Book): MentionTerm[] {
  const terms: MentionTerm[] = [];

  for (const e of book.encyclopedia ?? []) {
    const phrases = phrasesFor(e.title, e.aliases ?? []);
    if (!phrases.length) continue;
    terms.push({
      id: e.id,
      kind: "encyclopedia",
      label: e.title.trim() || "Untitled",
      phrases,
    });
  }

  for (const c of book.characters ?? []) {
    const phrases = phrasesFor(c.name, c.aliases ?? []);
    if (!phrases.length) continue;
    terms.push({
      id: c.id,
      kind: "character",
      label: c.name.trim() || "Unnamed",
      phrases,
    });
  }

  for (const l of book.locations ?? []) {
    const phrases = phrasesFor(l.name, l.aliases ?? []);
    if (!phrases.length) continue;
    terms.push({
      id: l.id,
      kind: "location",
      label: l.name.trim() || "Unnamed",
      phrases,
    });
  }

  return terms;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function phraseRegex(phrase: string): RegExp {
  const escaped = escapeRegExp(phrase);
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
}

function overlaps(
  a: { from: number; to: number },
  b: { from: number; to: number },
): boolean {
  return a.from < b.to && b.from < a.to;
}

/**
 * Find non-overlapping mention ranges in a ProseMirror doc.
 * Longer phrases win when they collide.
 */
export function findMentionHits(
  doc: { descendants: (f: (node: { isText?: boolean; text?: string }, pos: number) => void) => void },
  terms: MentionTerm[],
): MentionHit[] {
  type Flat = { phrase: string; term: MentionTerm };
  const flat: Flat[] = [];
  for (const term of terms) {
    for (const phrase of term.phrases) {
      flat.push({ phrase, term });
    }
  }
  flat.sort((a, b) => b.phrase.length - a.phrase.length);

  const hits: MentionHit[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    for (const { phrase, term } of flat) {
      const re = phraseRegex(phrase);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const from = pos + m.index;
        const to = from + m[0].length;
        const range = { from, to };
        if (hits.some((h) => overlaps(h, range))) continue;
        hits.push({ from, to, term });
      }
    }
  });

  return hits;
}
