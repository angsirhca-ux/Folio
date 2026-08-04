"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Cloud,
  CloudOff,
  Download,
  FolderOpen,
  FolderX,
  HardDriveDownload,
  Loader2,
  Pencil,
  Pin,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Separator } from "@/components/ui/separator";
import { useBook } from "@/providers/BookProvider";
import { readBackupFile } from "@/lib/backup";
import { formatRelativeDate } from "@/lib/scenes";
import { snapshotWordDelta } from "@/lib/snapshots";
import { formatWordCount, cn } from "@/lib/utils";

export function BackupDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    book,
    libraryBooks,
    downloadLibraryBackup,
    downloadBookBackup,
    restoreFromBackup,
    listBookSnapshots,
    takeBookSnapshot,
    renameBookSnapshot,
    restoreBookSnapshot,
    deleteBookSnapshot,
    summarizeSnapshotDiff,
    dropboxStatus,
    dropboxSyncing,
    dropboxConflict,
    connectDropbox,
    disconnectDropboxAccount,
    syncDropboxNow,
    resolveDropboxConflict,
    refreshDropboxStatus,
    folderMirrorStatus,
    folderMirrorWriting,
    chooseFolderMirror,
    clearFolderMirrorLink,
    writeFolderMirrorNow,
    refreshFolderMirrorStatus,
  } = useBook();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<
    Awaited<ReturnType<typeof readBackupFile>> | null
  >(null);
  const [pendingSnapRestore, setPendingSnapRestore] = useState<string | null>(
    null,
  );
  const [checkpointName, setCheckpointName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [restoreDiffLines, setRestoreDiffLines] = useState<string[]>([]);

  const snapshots = listBookSnapshots();

  useEffect(() => {
    if (!pendingSnapRestore) {
      setRestoreDiffLines([]);
      return;
    }
    setRestoreDiffLines(summarizeSnapshotDiff(pendingSnapRestore) ?? []);
  }, [pendingSnapRestore, summarizeSnapshotDiff]);

  useEffect(() => {
    if (open) {
      refreshDropboxStatus();
      refreshFolderMirrorStatus();
    }
  }, [open, refreshDropboxStatus, refreshFolderMirrorStatus]);

  function flash(ok: string) {
    setError(null);
    setMessage(ok);
    window.setTimeout(() => setMessage(null), 3200);
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await readBackupFile(file);
      setPendingRestore(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function confirmRestore() {
    if (!pendingRestore) return;
    try {
      restoreFromBackup(pendingRestore);
      setPendingRestore(null);
      flash("Library restored. A snapshot was kept of what you had.");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
      setPendingRestore(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex w-[min(96vw,32rem)] max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-[var(--border)] px-7 pb-4 pt-7 pr-14">
            <DialogTitle>Backup & sync</DialogTitle>
            <DialogDescription>
              Dropbox keeps the shelf across devices — including phone write
              mode at /m. Downloads and snapshots stay as your local safety net.
            </DialogDescription>
          </DialogHeader>

          <div className="folio-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-7 py-5">
            <section className="space-y-3">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Dropbox sync
              </p>
              {!dropboxStatus.configured ? (
                <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  Add{" "}
                  <span className="text-[var(--ink)]">
                    NEXT_PUBLIC_DROPBOX_APP_KEY
                  </span>{" "}
                  to .env.local (see env.example), create an App Folder app in
                  the Dropbox console, then restart the server.
                </p>
              ) : dropboxStatus.connected ? (
                <>
                  <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    Connected
                    {dropboxStatus.email || dropboxStatus.displayName
                      ? ` as ${dropboxStatus.displayName || dropboxStatus.email}`
                      : ""}
                    . Library file lives in your Dropbox App Folder.
                    {dropboxStatus.lastSyncedAt
                      ? ` Last synced ${formatRelativeDate(dropboxStatus.lastSyncedAt)}.`
                      : ""}{" "}
                    On a phone: open Folio → Mobile write, connect the same
                    Dropbox, then tap Sync. Simultaneous edits on two devices
                    may ask you to keep one full library snapshot.
                  </p>
                  {dropboxConflict ? (
                    <div className="rounded-xl border border-[rgba(107,58,42,0.2)] bg-[rgba(107,58,42,0.06)] px-3 py-3">
                      <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                        Dropbox has a newer copy while this device also has
                        unsaved changes.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={dropboxSyncing}
                          onClick={() =>
                            void resolveDropboxConflict("remote").then(() =>
                              flash("Kept the Dropbox copy."),
                            )
                          }
                        >
                          Use Dropbox
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={dropboxSyncing}
                          onClick={() =>
                            void resolveDropboxConflict("local").then(() =>
                              flash("Kept this device and uploaded."),
                            )
                          }
                        >
                          Keep this device
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={dropboxSyncing}
                      onClick={() => {
                        void syncDropboxNow()
                          .then(() => flash("Synced with Dropbox."))
                          .catch((e) =>
                            setError(
                              e instanceof Error ? e.message : "Sync failed.",
                            ),
                          );
                      }}
                    >
                      {dropboxSyncing ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Cloud className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      Sync now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        disconnectDropboxAccount();
                        flash("Dropbox disconnected.");
                      }}
                    >
                      <CloudOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Disconnect
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    Connect Dropbox to keep manuscripts across laptops and
                    phones — same trust model as Scrivener. Folio only uses its
                    App Folder.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void connectDropbox().catch((e) =>
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not start Dropbox login.",
                        ),
                      );
                    }}
                  >
                    <Cloud className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Connect Dropbox
                  </Button>
                </>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Local folder
              </p>
              {!folderMirrorStatus.supported ? (
                <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  Continuous folder copies need Chrome or Edge. On this browser,
                  use Download library below — or Dropbox for other devices.
                </p>
              ) : folderMirrorStatus.linked ? (
                <>
                  <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    Mirroring to{" "}
                    <span className="text-[var(--ink)]">
                      {folderMirrorStatus.folderName || "chosen folder"}
                    </span>
                    . Continuous local copy — not sync. Prefer Dropbox for phones
                    and other machines.
                    {folderMirrorStatus.lastWrittenAt
                      ? ` Last written ${formatRelativeDate(folderMirrorStatus.lastWrittenAt)}.`
                      : ""}
                  </p>
                  {folderMirrorStatus.lastError ? (
                    <p className="font-[family-name:var(--font-ui)] text-sm text-[#6B3A2A]">
                      {folderMirrorStatus.lastError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={folderMirrorWriting}
                      onClick={() => {
                        void writeFolderMirrorNow()
                          .then(() => flash("Wrote folio-library.json."))
                          .catch((e) =>
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Could not write folder.",
                            ),
                          );
                      }}
                    >
                      {folderMirrorWriting ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <FolderOpen
                          className="h-3.5 w-3.5"
                          strokeWidth={1.5}
                        />
                      )}
                      Write now
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void clearFolderMirrorLink().then(() =>
                          flash("Folder disconnected."),
                        );
                      }}
                    >
                      <FolderX className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Disconnect folder
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                    Choose a Folio folder on this Mac — Folio writes{" "}
                    <span className="text-[var(--ink)]">folio-library.json</span>{" "}
                    after each save, plus a short rolling history under{" "}
                    <span className="text-[var(--ink)]">backups/</span>. Pick a
                    dedicated folder, not Dropbox’s App Folder.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void chooseFolderMirror()
                        .then(() => flash("Folder linked. Mirror is on."))
                        .catch((e) => {
                          if (
                            e instanceof Error &&
                            (e.name === "AbortError" ||
                              /abort/i.test(e.message))
                          ) {
                            return;
                          }
                          setError(
                            e instanceof Error
                              ? e.message
                              : "Could not choose a folder.",
                          );
                        });
                    }}
                  >
                    <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Choose Folio folder…
                  </Button>
                </>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                Durable backup
              </p>
              <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                A Folio{" "}
                <span className="text-[var(--ink)]">.json</span> file holds every
                manuscript, wiki, and setting on this device — {libraryBooks.length}{" "}
                {libraryBooks.length === 1 ? "book" : "books"} on the shelf.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    downloadLibraryBackup();
                    flash("Library backup downloaded.");
                  }}
                >
                  <HardDriveDownload className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Download library
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    downloadBookBackup();
                    flash(`“${book.title || "Untitled"}” downloaded.`);
                  }}
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  This book only
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  ) : (
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  Restore…
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json,.folio.json"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                  Draft history · {book.title || "Untitled"}
                </p>
              </div>
              <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
                Named checkpoints stick around longer. Auto safety copies (before
                Dropbox or restore) prune first. Prefer Dropbox or a downloaded
                backup for long-term safety.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const label =
                        checkpointName.trim() || "Checkpoint";
                      takeBookSnapshot(label, "checkpoint");
                      setCheckpointName("");
                      flash("Checkpoint saved.");
                    }
                  }}
                  placeholder="Name this checkpoint…"
                  className="h-9 min-w-[10rem] flex-1 rounded-full border border-[rgba(45,42,38,0.1)] bg-[rgba(247,243,234,0.7)] px-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="subtle"
                  className="gap-1.5 rounded-full"
                  onClick={() => {
                    const label = checkpointName.trim() || "Checkpoint";
                    takeBookSnapshot(label, "checkpoint");
                    setCheckpointName("");
                    flash("Checkpoint saved.");
                  }}
                >
                  <Camera className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Save checkpoint
                </Button>
              </div>

              {snapshots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[rgba(45,42,38,0.1)] px-4 py-6 text-center font-[family-name:var(--font-ui)] text-sm italic text-[var(--ink-faint)]">
                  No draft history yet — save a named checkpoint before a risky
                  rewrite.
                </p>
              ) : (
                <ul className="space-y-2">
                  {snapshots.map((snap) => {
                    const delta = snapshotWordDelta(snap, book);
                    const renaming = renamingId === snap.id;
                    return (
                      <li
                        key={snap.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(45,42,38,0.06)] px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          {renaming ? (
                            <input
                              autoFocus
                              value={renameDraft}
                              onChange={(e) => setRenameDraft(e.target.value)}
                              onBlur={() => {
                                if (renameDraft.trim()) {
                                  renameBookSnapshot(snap.id, renameDraft);
                                  flash("Checkpoint renamed.");
                                }
                                setRenamingId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                }
                                if (e.key === "Escape") {
                                  setRenamingId(null);
                                }
                              }}
                              className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] focus:outline-none"
                            />
                          ) : (
                            <p className="flex items-center gap-1.5 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
                              {snap.kind === "checkpoint" ? (
                                <Pin
                                  className="h-3 w-3 shrink-0 text-[var(--accent)]"
                                  strokeWidth={1.5}
                                />
                              ) : null}
                              {snap.label}
                            </p>
                          )}
                          <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
                            {formatRelativeDate(snap.createdAt)} ·{" "}
                            {formatWordCount(snap.wordCount)} words ·{" "}
                            {snap.chapterCount}{" "}
                            {snap.chapterCount === 1 ? "chapter" : "chapters"}
                            {delta !== 0
                              ? ` · ${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US")} since then`
                              : " · same length as now"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            title="Rename"
                            aria-label="Rename checkpoint"
                            onClick={() => {
                              setRenamingId(snap.id);
                              setRenameDraft(snap.label);
                            }}
                            className="rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            title="Restore"
                            aria-label="Restore snapshot"
                            onClick={() => setPendingSnapRestore(snap.id)}
                            className="rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--ink)]"
                          >
                            <RotateCcw
                              className="h-3.5 w-3.5"
                              strokeWidth={1.5}
                            />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            aria-label="Delete snapshot"
                            onClick={() => {
                              deleteBookSnapshot(snap.id);
                              flash("Snapshot removed.");
                            }}
                            className="rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(107,58,42,0.08)] hover:text-[#6B3A2A]"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {message ? (
              <p
                className={cn(
                  "font-[family-name:var(--font-ui)] text-sm text-[var(--accent)]",
                )}
              >
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="font-[family-name:var(--font-ui)] text-sm text-[#6B3A2A]">
                {error}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        onOpenChange={(o) => {
          if (!o) setPendingRestore(null);
        }}
        title="Restore from backup?"
        description={
          pendingRestore?.format === "folio-backup"
            ? "This replaces your entire Folio library and settings with the file. A snapshot of the open book is taken first when possible."
            : "This replaces or adds the manuscript from the file into your library and opens it. A snapshot of the open book is taken first when possible."
        }
        confirmLabel="Restore"
        onConfirm={confirmRestore}
      />

      <ConfirmDialog
        open={Boolean(pendingSnapRestore)}
        onOpenChange={(o) => {
          if (!o) setPendingSnapRestore(null);
        }}
        title="Restore this draft?"
        description={[
          "The current manuscript will be replaced. A safety copy is kept when storage allows.",
          "",
          ...restoreDiffLines,
        ].join("\n")}
        confirmLabel="Restore draft"
        destructive={false}
        onConfirm={() => {
          if (pendingSnapRestore) {
            restoreBookSnapshot(pendingSnapRestore);
            flash("Draft restored.");
          }
          setPendingSnapRestore(null);
        }}
      />
    </>
  );
}

export function BackupSettingsRow({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
          Backup & Dropbox
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
          Sync, local folder mirror, download, or rewind this book
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onOpen}>
        Open
      </Button>
    </div>
  );
}
