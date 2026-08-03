import type { Book, BookGoals, WritingDayLog } from "./types";
import { countWords } from "./utils";

export function localDateKey(ms = Date.now()): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyGoals(wordCount = 0, now = Date.now()): BookGoals {
  const today = localDateKey(now);
  return {
    dailyTarget: 0,
    manuscriptTarget: 0,
    deadline: "",
    sessionIntention: "",
    dayLog: [],
    dayStartWordCount: Math.max(0, wordCount),
    dayStartDate: today,
  };
}

export function bookManuscriptWordCount(book: Pick<Book, "chapters">): number {
  return book.chapters.reduce((sum, ch) => sum + countWords(ch.content ?? ""), 0);
}

export function ensureBookGoals(book: Book): Book {
  const wc = bookManuscriptWordCount(book);
  if (!book.goals) {
    return { ...book, goals: emptyGoals(wc) };
  }
  const g = book.goals;
  return {
    ...book,
    goals: {
      dailyTarget: Math.max(0, Math.floor(g.dailyTarget ?? 0)),
      manuscriptTarget: Math.max(0, Math.floor(g.manuscriptTarget ?? 0)),
      deadline: typeof g.deadline === "string" ? g.deadline : "",
      sessionIntention:
        typeof g.sessionIntention === "string" ? g.sessionIntention : "",
      dayLog: Array.isArray(g.dayLog) ? g.dayLog : [],
      dayStartWordCount:
        typeof g.dayStartWordCount === "number"
          ? g.dayStartWordCount
          : wc,
      dayStartDate:
        typeof g.dayStartDate === "string" && g.dayStartDate
          ? g.dayStartDate
          : localDateKey(),
    },
  };
}

/** Keep the day baseline and today’s log aligned with the live manuscript count. */
export function syncGoalsWithWordCount(
  goals: BookGoals,
  wordCount: number,
  now = Date.now(),
): BookGoals {
  const today = localDateKey(now);
  let dayStartWordCount = goals.dayStartWordCount ?? wordCount;
  let dayStartDate = goals.dayStartDate || today;
  let dayLog: WritingDayLog[] = [...(goals.dayLog ?? [])];

  if (dayStartDate !== today) {
    dayStartWordCount = wordCount;
    dayStartDate = today;
  }

  const writtenToday = Math.max(0, wordCount - dayStartWordCount);
  const idx = dayLog.findIndex((d) => d.date === today);
  if (writtenToday > 0) {
    const entry = { date: today, wordsWritten: writtenToday };
    if (idx >= 0) dayLog[idx] = entry;
    else dayLog.unshift(entry);
  } else if (idx >= 0) {
    dayLog[idx] = { date: today, wordsWritten: 0 };
  }

  dayLog = dayLog
    .filter((d) => d.date && typeof d.wordsWritten === "number")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 120);

  return {
    ...goals,
    dayStartWordCount,
    dayStartDate,
    dayLog,
  };
}

export function wordsWrittenToday(goals: BookGoals, wordCount: number): number {
  if (goals.dayStartDate !== localDateKey()) {
    return 0;
  }
  return Math.max(0, wordCount - (goals.dayStartWordCount ?? wordCount));
}

/** Gentle streak: consecutive days with any words, allowing “today still empty.” */
export function writingStreak(goals: BookGoals, now = Date.now()): number {
  const byDate = new Map(
    (goals.dayLog ?? [])
      .filter((d) => d.wordsWritten > 0)
      .map((d) => [d.date, d.wordsWritten]),
  );
  let cursor = localDateKey(now);
  if (!byDate.has(cursor)) {
    // If today is empty, start counting from yesterday.
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    cursor = localDateKey(y.getTime());
  }
  let streak = 0;
  while (byDate.has(cursor)) {
    streak += 1;
    const d = new Date(`${cursor}T12:00:00`);
    d.setDate(d.getDate() - 1);
    cursor = localDateKey(d.getTime());
  }
  return streak;
}

export function daysUntilDeadline(
  deadline: string,
  now = Date.now(),
): number | null {
  if (!deadline?.trim()) return null;
  const target = new Date(`${deadline.trim()}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;
  const ms = target.getTime() - now;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function clampGoalTarget(value: number, max = 2_000_000): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.floor(value)));
}
