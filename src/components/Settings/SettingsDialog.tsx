"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeSwitcher } from "@/components/ThemeSwitcher/ThemeSwitcher";
import { ExportSettingsRow } from "@/components/Export/ExportDialog";
import { ImportSettingsRow } from "@/components/Import/ImportDialog";
import { BackupSettingsRow } from "@/components/Backup/BackupDialog";
import { FolioHowToDialog } from "@/components/Help/FolioHowToDialog";
import { useBook } from "@/providers/BookProvider";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenExport?: () => void;
  onOpenImport?: () => void;
  onOpenBackup?: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  onOpenExport,
  onOpenImport,
  onOpenBackup,
}: SettingsDialogProps) {
  const {
    book,
    settings,
    setTitle,
    setAuthor,
    updateSettings,
    toggleFocusMode,
    deleteManuscript,
  } = useBook();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(88vh,38rem)]">
          <DialogHeader className="mb-4">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Shape the page to your hand. Everything else stays out of the way.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[rgba(45,42,38,0.08)] bg-[rgba(247,243,234,0.55)] px-3.5 py-3">
              <div>
                <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
                  How to use Folio
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  Tabs, Clarence, critiques, icons, and shortcuts
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={() => {
                  setHowToOpen(true);
                  onOpenChange(false);
                }}
              >
                <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.5} />
                How to
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="title">Manuscript title</Label>
              <input
                id="title"
                value={book.title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
                placeholder="Untitled Manuscript"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <input
                id="author"
                value={book.author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 font-[family-name:var(--font-ui)] text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
                placeholder="Your name"
              />
            </div>

            <Separator />

            <div>
              <Label className="mb-2 block">Theme</Label>
              <ThemeSwitcher />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Focus mode</Label>
                  <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    Soften surrounding paragraphs
                  </p>
                </div>
                <Switch
                  checked={settings.focusMode}
                  onCheckedChange={() => toggleFocusMode()}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Type size</Label>
                  <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    {settings.fontSize}px
                  </p>
                </div>
                <input
                  type="range"
                  min={17}
                  max={24}
                  step={1}
                  value={settings.fontSize}
                  onChange={(e) =>
                    updateSettings({ fontSize: Number(e.target.value) })
                  }
                  className="w-28 accent-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Line height</Label>
                  <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                    {settings.lineHeight.toFixed(2)}
                  </p>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={2}
                  step={0.05}
                  value={settings.lineHeight}
                  onChange={(e) =>
                    updateSettings({ lineHeight: Number(e.target.value) })
                  }
                  className="w-28 accent-[var(--accent)]"
                />
              </div>
            </div>

            <Separator />

            {onOpenImport ? <ImportSettingsRow onImport={onOpenImport} /> : null}
            {onOpenExport ? <ExportSettingsRow onExport={onOpenExport} /> : null}
            {onOpenBackup ? <BackupSettingsRow onOpen={onOpenBackup} /> : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
                  Mobile write
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  Phone drafting at /m — Add to Home Screen, then connect
                  Dropbox on the phone.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/m">Open</Link>
              </Button>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-[family-name:var(--font-ui)] text-sm tracking-wide text-[var(--ink)]">
                  Delete manuscript
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                  Start over with a blank book
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-[color-mix(in_srgb,#8B4513_35%,var(--border))] text-[#6B3A2A] hover:bg-[rgba(139,69,19,0.08)]"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>

            <Separator />

            <div className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-faint)]">
              <p className="mb-2 tracking-[0.12em] uppercase">Shortcuts</p>
              <ul className="columns-2 gap-x-4 space-y-1.5">
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ K</kbd>
                  <span className="ml-2">Search</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ S</kbd>
                  <span className="ml-2">Save</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ O</kbd>
                  <span className="ml-2">Upload</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ E</kbd>
                  <span className="ml-2">Export</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ ⇧ N</kbd>
                  <span className="ml-2">Notes</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ ⌥ F</kbd>
                  <span className="ml-2">Focus</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ \</kbd>
                  <span className="ml-2">Sidebar</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ .</kbd>
                  <span className="ml-2">Fullscreen</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌥ ↑ ↓</kbd>
                  <span className="ml-2">Chapters</span>
                </li>
                <li>
                  <kbd className="text-[var(--ink-muted)]">⌘ ,</kbd>
                  <span className="ml-2">Settings</span>
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete manuscript?"
        description={`“${book.title || "Untitled Manuscript"}” will move to Trash. You can restore it from there — or start fresh on a new blank page.`}
        confirmLabel="Move to trash"
        onConfirm={() => {
          deleteManuscript();
          setConfirmDelete(false);
          onOpenChange(false);
        }}
      />

      <FolioHowToDialog open={howToOpen} onOpenChange={setHowToOpen} />
    </>
  );
}
