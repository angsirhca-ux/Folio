"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  BookOpen,
  Cloud,
  CloudOff,
  Inbox,
  Italic,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { ManuscriptEditor } from "@/components/Editor/ManuscriptEditor";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { formatRelativeDate } from "@/lib/scenes";
import { dropboxRedirectUriForDisplay } from "@/lib/dropboxSync";
import { cn } from "@/lib/utils";

type Mode = "manuscript" | "dump";

export function MobileWriteApp() {
  const {
    book,
    activeChapter,
    activeDumpPage,
    hydrated,
    selectChapter,
    addChapter,
    updateChapterContent,
    updateChapterTitle,
    selectDumpPage,
    addDumpPage,
    updateDumpPageContent,
    updateDumpPageTitle,
    dropboxStatus,
    dropboxSyncing,
    dropboxConflict,
    connectDropbox,
    syncDropboxNow,
    resolveDropboxConflict,
    saveNow,
    libraryBooks,
    switchBook,
  } = useBook();

  const [mode, setMode] = useState<Mode>("manuscript");
  const [listOpen, setListOpen] = useState(false);
  const [booksOpen, setBooksOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [syncHint, setSyncHint] = useState<string | null>(null);
  const [narrowHint, setNarrowHint] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    // Soft prompt only when opened on a wide screen from desktop entry.
    const wide = window.matchMedia("(min-width: 900px)").matches;
    setNarrowHint(wide);
  }, []);

  useEffect(() => {
    if (searchParams.get("dropbox") === "connected") {
      setSyncHint("Connected");
      window.setTimeout(() => setSyncHint(null), 2500);
    }
  }, [searchParams]);

  const onEditorReady = useCallback((ed: Editor | null) => {
    setEditor(ed);
  }, []);

  async function flushThenSync() {
    editor?.commands.blur();
    // Let TipTap debounce land in book state, then persist.
    await new Promise((r) => window.setTimeout(r, 400));
    saveNow();
    await new Promise((r) => window.setTimeout(r, 50));
    await syncDropboxNow();
    setSyncHint("Synced");
    window.setTimeout(() => setSyncHint(null), 2000);
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--paper)] text-[var(--ink-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  const pages =
    mode === "manuscript" ? book.chapters : (book.dump?.pages ?? []);
  const activeId =
    mode === "manuscript" ? activeChapter.id : activeDumpPage.id;
  const activeTitle =
    mode === "manuscript" ? activeChapter.title : activeDumpPage.title;
  const activeContent =
    mode === "manuscript" ? activeChapter.content : activeDumpPage.content;

  return (
    <div className="mobile-write relative flex min-h-[100dvh] flex-col bg-[var(--paper)] text-[var(--ink)]">
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--sidebar)]/95 backdrop-blur-md"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingLeft: "max(0.75rem, env(safe-area-inset-left))",
          paddingRight: "max(0.75rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex items-center gap-2 pb-2.5 pt-1">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="min-w-0 flex-1 rounded-xl px-2 py-2 text-left transition-colors active:bg-[rgba(45,42,38,0.06)]"
          >
            <p className="truncate font-[family-name:var(--font-display)] text-[0.6rem] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
              {book.title?.trim() || "Untitled"} ·{" "}
              {mode === "manuscript" ? "Manuscript" : "Dump"}
            </p>
            <p className="mt-0.5 truncate font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
              {activeTitle}
            </p>
          </button>

          <SyncChip
            connected={dropboxStatus.connected}
            configured={dropboxStatus.configured}
            syncing={dropboxSyncing}
            conflict={Boolean(dropboxConflict)}
            lastSyncedAt={dropboxStatus.lastSyncedAt}
            hint={syncHint}
            onSync={() => void flushThenSync()}
            onConnect={() => void connectDropbox()}
          />

          <button
            type="button"
            aria-label="Books"
            onClick={() => setBooksOpen(true)}
            className="rounded-xl p-2.5 text-[var(--ink-faint)] active:bg-[rgba(45,42,38,0.06)] active:text-[var(--ink)]"
          >
            <BookOpen className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {!dropboxStatus.connected && dropboxStatus.configured ? (
          <div className="border-t border-[rgba(45,42,38,0.06)] px-2 pb-3 pt-2">
            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
              Connect Dropbox so this phone and your desktop share the same
              library.
            </p>
            <p className="mt-2 break-all font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]">
              OAuth redirect (must match Dropbox exactly):{" "}
              {dropboxRedirectUriForDisplay()}
            </p>
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => void connectDropbox()}
            >
              Connect Dropbox
            </Button>
          </div>
        ) : null}

        {!dropboxStatus.configured ? (
          <p className="border-t border-[rgba(45,42,38,0.06)] px-2 pb-3 pt-2 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
            Writing stays on this device until Dropbox is configured (see
            desktop Settings → Backup).
          </p>
        ) : null}
      </header>

      {narrowHint ? (
        <div className="flex items-center justify-between gap-2 border-b border-[rgba(45,42,38,0.06)] bg-[rgba(247,243,234,0.65)] px-3 py-2">
          <p className="font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
            Mobile write mode —{" "}
            <Link href="/" className="text-[var(--accent)] underline-offset-2 hover:underline">
              open full Folio
            </Link>
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNarrowHint(false)}
            className="p-1 text-[var(--ink-faint)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <main
        className="folio-scroll min-h-0 flex-1 overflow-y-auto"
        style={{
          paddingBottom: "max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom)))",
        }}
      >
        <article className="mx-auto w-full max-w-[40rem] px-4 pt-6 sm:px-6">
          <input
            value={activeTitle}
            onChange={(e) => {
              if (mode === "manuscript") {
                updateChapterTitle(activeChapter.id, e.target.value);
              } else {
                updateDumpPageTitle(activeDumpPage.id, e.target.value);
              }
            }}
            aria-label="Page title"
            className="mb-6 w-full bg-transparent text-center font-[family-name:var(--font-display)] text-2xl font-medium tracking-wide text-[var(--ink)] outline-none"
            placeholder="Untitled"
          />
          <ManuscriptEditor
            key={`${mode}-${activeId}`}
            documentId={activeId}
            content={activeContent}
            onChange={
              mode === "manuscript"
                ? (html) => updateChapterContent(html, activeId)
                : (html) => updateDumpPageContent(html, activeId)
            }
            onEditorReady={onEditorReady}
            className="mobile-write-editor text-[1.05rem] leading-[1.75]"
          />
        </article>
      </main>

      <FormatBar editor={editor} />

      {/* Chapter / dump list sheet */}
      {listOpen ? (
        <Sheet onClose={() => setListOpen(false)} title="Pages">
          <div className="mb-4 flex gap-2">
            <ModeTab
              active={mode === "manuscript"}
              label="Manuscript"
              icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={1.5} />}
              onClick={() => setMode("manuscript")}
            />
            <ModeTab
              active={mode === "dump"}
              label="Dump"
              icon={<Inbox className="h-3.5 w-3.5" strokeWidth={1.5} />}
              onClick={() => setMode("dump")}
            />
          </div>
          <ul className="space-y-1">
            {pages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "manuscript") selectChapter(p.id);
                    else selectDumpPage(p.id);
                    setListOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-xl px-3 py-3 text-left font-[family-name:var(--font-ui)] text-sm transition-colors",
                    p.id === activeId
                      ? "bg-[rgba(176,141,87,0.16)] text-[var(--ink)]"
                      : "text-[var(--ink)] active:bg-[rgba(45,42,38,0.05)]",
                  )}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              if (mode === "manuscript") addChapter();
              else addDumpPage();
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(45,42,38,0.15)] py-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)] active:bg-[rgba(45,42,38,0.04)]"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            {mode === "manuscript" ? "New chapter" : "New dump page"}
          </button>
          <Link
            href="/"
            className="mt-6 block text-center font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] underline-offset-2 hover:underline"
          >
            Open full Folio studio
          </Link>
        </Sheet>
      ) : null}

      {booksOpen ? (
        <Sheet onClose={() => setBooksOpen(false)} title="Books">
          <ul className="space-y-1">
            {libraryBooks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchBook(b.id);
                    setBooksOpen(false);
                    setMode("manuscript");
                  }}
                  className={cn(
                    "flex w-full rounded-xl px-3 py-3 text-left font-[family-name:var(--font-ui)] text-sm",
                    b.id === book.id
                      ? "bg-[rgba(176,141,87,0.16)]"
                      : "active:bg-[rgba(45,42,38,0.05)]",
                  )}
                >
                  {b.title?.trim() || "Untitled"}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/books"
            className="mt-6 block text-center font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)] underline-offset-2 hover:underline"
          >
            Manage library
          </Link>
        </Sheet>
      ) : null}

      {dropboxConflict ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(45,42,38,0.45)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-lg">
            <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Sync conflict
            </p>
            <p className="mt-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              Dropbox has a newer library while this phone also changed. Choose
              one snapshot — Folio can’t merge chapter-by-chapter yet.
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                disabled={dropboxSyncing}
                onClick={() => void resolveDropboxConflict("remote")}
              >
                Keep Dropbox copy
              </Button>
              <Button
                variant="outline"
                disabled={dropboxSyncing}
                onClick={() => void resolveDropboxConflict("local")}
              >
                Keep this phone
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SyncChip({
  connected,
  configured,
  syncing,
  conflict,
  lastSyncedAt,
  hint,
  onSync,
  onConnect,
}: {
  connected: boolean;
  configured: boolean;
  syncing: boolean;
  conflict: boolean;
  lastSyncedAt: number | null;
  hint: string | null;
  onSync: () => void;
  onConnect: () => void;
}) {
  if (!configured) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-faint)]"
        title="Dropbox not configured"
      >
        <CloudOff className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    );
  }
  if (!connected) {
    return (
      <button
        type="button"
        onClick={onConnect}
        className="inline-flex items-center gap-1 rounded-full bg-[rgba(45,42,38,0.06)] px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[0.65rem] text-[var(--ink-muted)]"
      >
        <CloudOff className="h-3.5 w-3.5" strokeWidth={1.5} />
        Sync
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={syncing}
      title={
        conflict
          ? "Resolve conflict"
          : lastSyncedAt
            ? `Last synced ${formatRelativeDate(lastSyncedAt)}`
            : "Sync now"
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 font-[family-name:var(--font-ui)] text-[0.65rem]",
        conflict
          ? "bg-[rgba(107,58,42,0.12)] text-[#6B3A2A]"
          : "bg-[rgba(176,141,87,0.14)] text-[var(--ink)]",
      )}
    >
      {syncing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
      ) : (
        <Cloud className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
      {hint ?? (conflict ? "Conflict" : syncing ? "…" : "Sync")}
      {!syncing && !hint ? (
        <RefreshCw className="h-3 w-3 opacity-60" strokeWidth={1.5} />
      ) : null}
    </button>
  );
}

function FormatBar({ editor }: { editor: Editor | null }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--sidebar)]/95 backdrop-blur-md"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="mx-auto flex max-w-[40rem] items-center justify-center gap-1 px-2 py-2">
        <FormatBtn
          label="Bold"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" strokeWidth={1.5} />
        </FormatBtn>
        <FormatBtn
          label="Italic"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" strokeWidth={1.5} />
        </FormatBtn>
        <FormatBtn
          label="Scene break"
          disabled={!editor}
          onClick={() => editor?.chain().focus().setSceneBreak().run()}
        >
          <Minus className="h-4 w-4" strokeWidth={1.5} />
        </FormatBtn>
      </div>
    </div>
  );
}

function FormatBtn({
  children,
  label,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "rounded-xl p-3 text-[var(--ink-muted)] transition-colors active:bg-[rgba(45,42,38,0.08)] active:text-[var(--ink)] disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ModeTab({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-[family-name:var(--font-ui)] text-xs transition-colors",
        active
          ? "bg-[var(--accent-soft)] text-[var(--ink)]"
          : "text-[var(--ink-faint)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[rgba(45,42,38,0.4)]">
      <button
        type="button"
        className="min-h-0 flex-1"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--paper)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            {title}
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--ink-faint)]"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
