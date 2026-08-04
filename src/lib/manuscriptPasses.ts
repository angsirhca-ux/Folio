import type { ChapterWindow } from "./manuscriptContext";

/**
 * Run a chapter-window multipass over a manuscript and merge results.
 */
export async function runManuscriptPasses<T>(opts: {
  windows: ChapterWindow[];
  runPass: (
    window: ChapterWindow,
    meta: { pass: number; passCount: number; prior: T },
  ) => Promise<T>;
  merge: (acc: T, part: T) => T;
  empty: T;
  /** Soft cap — windows are already sized; this is a safety valve. */
  maxPasses?: number;
}): Promise<{ result: T; passCount: number }> {
  const max = opts.maxPasses ?? 12;
  const windows = opts.windows.slice(0, max);
  if (windows.length === 0) {
    return { result: opts.empty, passCount: 0 };
  }

  let acc = opts.empty;
  for (let i = 0; i < windows.length; i++) {
    const part = await opts.runPass(windows[i], {
      pass: i + 1,
      passCount: windows.length,
      prior: acc,
    });
    acc = opts.merge(acc, part);
  }
  return { result: acc, passCount: windows.length };
}
