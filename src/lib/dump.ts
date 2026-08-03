import type { Book, DumpPage, DumpState } from "./types";
import { createId } from "./utils";

export function createDumpPage(
  partial?: Partial<Pick<DumpPage, "title" | "content">>,
): DumpPage {
  const now = Date.now();
  const title = (partial?.title ?? "Untitled").trim() || "Untitled";
  return {
    id: createId(),
    title,
    content:
      partial?.content ??
      `<h1>${escapeHtml(title)}</h1><p></p>`,
    createdAt: now,
    updatedAt: now,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emptyDump(): DumpState {
  const page = createDumpPage({ title: "Scraps" });
  return {
    pages: [page],
    activePageId: page.id,
  };
}

export function ensureBookDump(
  book: Omit<Book, "dump"> & { dump?: DumpState },
): Book {
  const raw = book.dump;
  let pages = Array.isArray(raw?.pages)
    ? raw.pages
        .map(normalizeDumpPage)
        .filter(Boolean) as DumpPage[]
    : [];

  if (pages.length === 0) {
    pages = [createDumpPage({ title: "Scraps" })];
  }

  const activePageId =
    pages.find((p) => p.id === raw?.activePageId)?.id ?? pages[0].id;

  return {
    ...book,
    dump: { pages, activePageId },
  };
}

function normalizeDumpPage(p: Partial<DumpPage>): DumpPage | null {
  if (!p?.id) return null;
  const title = (p.title ?? "Untitled").trim() || "Untitled";
  const now = Date.now();
  return {
    id: p.id,
    title,
    content:
      typeof p.content === "string"
        ? p.content
        : `<h1>${escapeHtml(title)}</h1><p></p>`,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : now,
  };
}

export function activeDumpPage(dump: DumpState | undefined): DumpPage | null {
  if (!dump?.pages?.length) return null;
  return (
    dump.pages.find((p) => p.id === dump.activePageId) ?? dump.pages[0] ?? null
  );
}
