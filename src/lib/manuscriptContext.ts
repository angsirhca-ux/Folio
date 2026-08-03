/**
 * Pack scene excerpts so every chapter gets a fair share of the context budget.
 * Prevents chapter 1 from consuming the whole window on long manuscripts.
 */
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
      if (used + block.length + 1 > maxChars) {
        omitted[ci] += q.length;
        q.length = 0;
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

export const MANUSCRIPT_CONTEXT_BUDGET = 100_000;
