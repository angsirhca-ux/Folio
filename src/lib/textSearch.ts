/**
 * Shared text folding for manuscript find + AI excerpt location.
 * Keeps index maps stable (multi-char folds repeat the source pos).
 */

export function foldSearchChar(ch: string): string {
  switch (ch) {
    case "\u2018": // ‘
    case "\u2019": // ’
    case "\u201A": // ‚
    case "\u201B": // ‛
    case "\u2032": // ′
      return "'";
    case "\u201C": // “
    case "\u201D": // ”
    case "\u201E": // „
    case "\u201F": // ‟
    case "\u2033": // ″
      return '"';
    case "\u2013": // –
    case "\u2014": // —
    case "\u2212": // −
      return "-";
    case "\u00A0": // nbsp
    case "\u202F": // narrow nbsp
    case "\u2007": // figure space
    case "\u2009": // thin space
    case "\u200A": // hair space
    case "\t":
      return " ";
    case "\u2026": // …
      return "...";
    default:
      return ch;
  }
}

/** Fold a string for comparison (quotes, dashes, ellipsis, spaces). */
export function foldSearchText(input: string): string {
  let out = "";
  for (const ch of input) out += foldSearchChar(ch);
  return out.replace(/\s+/g, " ").trim();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
