/**
 * Pack scene excerpts so every chapter gets a fair share of the context budget.
 * Prevents chapter 1 from consuming the whole window on long manuscripts.
 *
 * Budget is characters (not tokens). ~450k chars ≈ ~110k tokens — leaves room
 * for system prompt, tools, bible preamble, and output inside a ~200k window.
 */
export const MANUSCRIPT_CONTEXT_BUDGET = 450_000;

export function packBalancedExcerpts(
  chapterBlocks: string[][],
  maxChars: number,
  preamble = "",
): string {
  const parts: string[] = preamble ? [preamble] : [];
  let used = preamble.length;

  const queues = chapterBlocks.map((blocks) => [...blocks]);
  const omitted: number[] = queues.map(() => 0);
  let active = queues.some((q) => q.length > 0);

  while (active) {
    active = false;
    for (let ci = 0; ci < queues.length; ci++) {
      const q = queues[ci];
      if (!q.length) continue;
      active = true;
      const block = q[0];
      const remaining = maxChars - used - 1;
      if (remaining <= 80) {
        omitted[ci] += q.length;
        q.length = 0;
        continue;
      }
      if (block.length > remaining) {
        // Take a prefix rather than wiping the rest of the chapter.
        const slice = `${block.slice(0, remaining - 1)}…`;
        q.shift();
        omitted[ci] += q.length;
        q.length = 0;
        parts.push(slice);
        used += slice.length + 1;
        continue;
      }
      q.shift();
      parts.push(block);
      used += block.length + 1;
    }
  }

  const skipped = omitted.reduce((a, b) => a + b, 0);
  if (skipped > 0) {
    parts.push(
      `---\n[${skipped} additional scene${skipped === 1 ? "" : "s"} omitted for length — coverage was balanced across chapters]`,
    );
  }

  return parts.join("\n").trim();
}

/** Total characters across all blocks (approx packed size without preamble). */
export function measureChapterBlocks(chapterBlocks: string[][]): number {
  let n = 0;
  for (const blocks of chapterBlocks) {
    for (const b of blocks) n += b.length + 1;
  }
  return n;
}

export type ChapterWindow = {
  fromChapter: number;
  toChapter: number; // exclusive
};

/**
 * Split chapters into windows that each fit under maxChars when packed
 * (including preambleReserve for prompts / prior-find digests).
 */
export function partitionChapterWindows(
  chapterBlocks: string[][],
  maxChars: number,
  preambleReserve = 8_000,
): ChapterWindow[] {
  const budget = Math.max(20_000, maxChars - preambleReserve);
  const windows: ChapterWindow[] = [];
  let from = 0;

  while (from < chapterBlocks.length) {
    let used = 0;
    let to = from;
    while (to < chapterBlocks.length) {
      const chapterSize = measureChapterBlocks([chapterBlocks[to]]);
      // Always take at least one chapter even if oversized (packer will truncate).
      if (to > from && used + chapterSize > budget) break;
      used += chapterSize;
      to += 1;
      if (chapterSize > budget) break;
    }
    windows.push({ fromChapter: from, toChapter: to });
    from = to;
  }

  return windows.length > 0
    ? windows
    : [{ fromChapter: 0, toChapter: Math.max(1, chapterBlocks.length) }];
}
