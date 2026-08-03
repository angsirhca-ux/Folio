"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  PanelLeft,
  Settings2,
  Focus,
  Maximize2,
  Minimize2,
  StickyNote,
  Download,
  Upload,
  ScrollText,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { BookPage } from "@/components/BookPage/BookPage";
import { ChapterSidebar } from "@/components/ChapterSidebar/ChapterSidebar";
import { BetaReadersPanel } from "@/components/Editor/BetaReadersPanel";
import { DevelopmentalPanel } from "@/components/Editor/DevelopmentalPanel";
import { BackupDialog } from "@/components/Backup/BackupDialog";
import { ExportDialog } from "@/components/Export/ExportDialog";
import { FocusModeIndicator } from "@/components/FocusMode/FocusMode";
import { ImportDialog } from "@/components/Import/ImportDialog";
import { NotesPanel } from "@/components/Notes/NotesPanel";
import { GoalsPanel } from "@/components/Goals/GoalsPanel";
import { ResearchPanel } from "@/components/Research/ResearchPanel";
import { SceneInspector } from "@/components/SceneInspector/SceneInspector";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { Toolbar } from "@/components/Toolbar/Toolbar";
import { WordCounter } from "@/components/WordCounter/WordCounter";
import { SaveButton } from "@/components/SaveButton";
import { Button } from "@/components/ui/button";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useBook } from "@/providers/BookProvider";
import { AppShell } from "@/components/Sidebar/AppShell";
import { cn } from "@/lib/utils";
import type { DevelopmentalPassKind } from "@/lib/types";

export function WritingApp() {
  const {
    settings,
    activeChapter,
    book,
    saveNow,
    selectAdjacentChapter,
    toggleFocusMode,
    toggleFullscreen,
    toggleSidebar,
    sceneFocus,
  } = useBook();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [betaOpen, setBetaOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorSceneId, setInspectorSceneId] = useState<string | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const [researchEntryId, setResearchEntryId] = useState<string | null>(null);
  const [activeReviewFlagId, setActiveReviewFlagId] = useState<string | null>(
    null,
  );
  const [reviewPassKind, setReviewPassKind] =
    useState<DevelopmentalPassKind>("style");
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  function resolveInspectorSceneId(): string | null {
    if (
      sceneFocus &&
      sceneFocus.chapterId === activeChapter.id &&
      activeChapter.scenes[sceneFocus.sceneIndex]
    ) {
      return activeChapter.scenes[sceneFocus.sceneIndex].id;
    }
    if (
      inspectorSceneId &&
      activeChapter.scenes.some((s) => s.id === inspectorSceneId)
    ) {
      return inspectorSceneId;
    }
    return activeChapter.scenes[0]?.id ?? null;
  }

  function openInspector() {
    setNotesOpen(false);
    setGoalsOpen(false);
    setEditorOpen(false);
    setBetaOpen(false);
    setResearchOpen(false);
    setInspectorSceneId(resolveInspectorSceneId());
    setInspectorOpen(true);
  }

  function openResearch() {
    setNotesOpen(false);
    setGoalsOpen(false);
    setEditorOpen(false);
    setBetaOpen(false);
    setInspectorOpen(false);
    setResearchOpen(true);
  }

  const handlers = useMemo(
    () => ({
      onToggleFocus: toggleFocusMode,
      onToggleSidebar: toggleSidebar,
      onToggleFullscreen: toggleFullscreen,
      onOpenSettings: () => setSettingsOpen(true),
      onToggleToolbar: () => setToolbarVisible((v) => !v),
      onToggleNotes: () => {
        setEditorOpen(false);
        setBetaOpen(false);
        setInspectorOpen(false);
        setGoalsOpen(false);
        setResearchOpen(false);
        setNotesOpen((v) => !v);
      },
      onToggleGoals: () => {
        setEditorOpen(false);
        setBetaOpen(false);
        setInspectorOpen(false);
        setNotesOpen(false);
        setResearchOpen(false);
        setGoalsOpen((v) => !v);
      },
      onToggleInspector: () => {
        if (inspectorOpen) {
          setInspectorOpen(false);
          return;
        }
        openInspector();
      },
      onToggleResearch: () => {
        if (researchOpen) {
          setResearchOpen(false);
          return;
        }
        openResearch();
      },
      onOpenExport: () => setExportOpen(true),
      onOpenImport: () => setImportOpen(true),
      onSave: saveNow,
      onChapterUp: () => selectAdjacentChapter("up"),
      onChapterDown: () => selectAdjacentChapter("down"),
    }),
    [
      toggleFocusMode,
      toggleSidebar,
      toggleFullscreen,
      saveNow,
      selectAdjacentChapter,
      inspectorOpen,
      researchOpen,
      activeChapter,
      sceneFocus,
      inspectorSceneId,
    ],
  );

  useKeyboardShortcuts(handlers);

  useEffect(() => {
    if (!inspectorOpen || !sceneFocus) return;
    if (sceneFocus.chapterId !== activeChapter.id) return;
    const scene = activeChapter.scenes[sceneFocus.sceneIndex];
    if (scene) setInspectorSceneId(scene.id);
  }, [sceneFocus?.token, inspectorOpen, activeChapter, sceneFocus]);

  useEffect(() => {
    if (!inspectorOpen) return;
    if (
      inspectorSceneId &&
      activeChapter.scenes.some((s) => s.id === inspectorSceneId)
    ) {
      return;
    }
    setInspectorSceneId(activeChapter.scenes[0]?.id ?? null);
  }, [activeChapter.id, activeChapter.scenes, inspectorOpen, inspectorSceneId]);

  useEffect(() => {
    if (!settings.fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.fullscreen, toggleFullscreen]);

  const onEditorReady = useCallback((ed: Editor | null) => {
    setEditor(ed);
  }, []);

  const sidebarOffset =
    settings.sidebarOpen && !settings.fullscreen
      ? "md:pl-[calc(15.5rem)]"
      : "";

  const hasNotes = Boolean(activeChapter.notes?.trim());
  const hasEditorFlags = Boolean(
    (book.developmentalEditor?.passes ?? []).some(
      (p) => p.chapterId === activeChapter.id && p.flags.length > 0,
    ),
  );
  const hasBetaReview = Boolean(
    (book.betaReaders?.reviews ?? []).some(
      (r) => r.chapterId === activeChapter.id,
    ),
  );

  return (
    <AppShell
      contentClassName={cn(
        "h-screen overflow-y-auto overscroll-contain transition-[padding] duration-500 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        sidebarOffset,
      )}
    >
    <div
      className={cn(
        "relative min-h-screen bg-[var(--paper)] text-[var(--ink)]",
        settings.fullscreen && "folio-fullscreen",
      )}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -10%, var(--accent-soft), transparent 70%)",
        }}
      />

      <ChapterSidebar />

      <header className="folio-chrome fixed right-4 top-4 z-40 flex items-center gap-1">
        <SaveButton />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            settings.sidebarOpen ? "Collapse contents" : "Expand contents"
          }
          title={
            settings.sidebarOpen ? "Collapse contents" : "Expand contents"
          }
          onClick={toggleSidebar}
          className={cn(
            settings.fullscreen ? "opacity-0 hover:opacity-100" : "",
            settings.sidebarOpen ? "text-[var(--accent)]" : "",
          )}
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Chapter notes"
          onClick={() => {
            setEditorOpen(false);
            setBetaOpen(false);
            setInspectorOpen(false);
            setResearchOpen(false);
            setGoalsOpen(false);
            setNotesOpen(true);
          }}
          className={hasNotes || notesOpen ? "text-[var(--accent)]" : ""}
        >
          <StickyNote className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Research beside manuscript"
          title="Research — open beside the draft (⌘⌥R)"
          onClick={() => {
            if (researchOpen) {
              setResearchOpen(false);
              return;
            }
            openResearch();
          }}
          className={researchOpen ? "text-[var(--accent)]" : ""}
        >
          <ScrollText className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Scene details"
          title="Scene metadata — POV, place, cast, synopsis (⌘⇧M)"
          onClick={() => {
            if (inspectorOpen) {
              setInspectorOpen(false);
              return;
            }
            openInspector();
          }}
          className={inspectorOpen ? "text-[var(--accent)]" : ""}
        >
          <Tags className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Developmental editor"
          onClick={() => {
            setNotesOpen(false);
            setInspectorOpen(false);
            setResearchOpen(false);
            setGoalsOpen(false);
            setBetaOpen(false);
            setEditorOpen(true);
          }}
          className={hasEditorFlags || editorOpen ? "text-[var(--accent)]" : ""}
          title="Developmental editor — flags only, never rewrites"
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Beta readers"
          onClick={() => {
            setNotesOpen(false);
            setInspectorOpen(false);
            setResearchOpen(false);
            setGoalsOpen(false);
            setEditorOpen(false);
            setActiveReviewFlagId(null);
            setBetaOpen(true);
          }}
          className={hasBetaReview || betaOpen ? "text-[var(--accent)]" : ""}
          title="Beta readers — memory across chapters, reactions only"
        >
          <Users className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Upload manuscript"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Export"
          onClick={() => setExportOpen(true)}
        >
          <Download className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Focus mode"
          onClick={toggleFocusMode}
          className={settings.focusMode ? "text-[var(--accent)]" : ""}
        >
          <Focus className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            settings.fullscreen ? "Exit fullscreen" : "Fullscreen writing"
          }
          onClick={toggleFullscreen}
        >
          {settings.fullscreen ? (
            <Minimize2 className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </header>

      <FocusModeIndicator />

      <main
        data-folio-scroll
        className={cn(
          "folio-scroll relative z-10 h-screen overflow-y-auto transition-[padding] duration-400 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          editorOpen || betaOpen || inspectorOpen || researchOpen
            ? "lg:pr-[26rem]"
            : "",
        )}
      >
        <BookPage
          onEditorReady={onEditorReady}
          activeReviewFlagId={activeReviewFlagId}
          showReviewHighlights={editorOpen}
          reviewPassKind={reviewPassKind}
        />
      </main>

      <Toolbar
        editor={editor}
        visible={toolbarVisible && !settings.fullscreen}
      />

      {!toolbarVisible && !settings.fullscreen ? (
        <button
          type="button"
          onClick={() => setToolbarVisible(true)}
          className="folio-chrome fixed bottom-8 left-1/2 z-30 -translate-x-1/2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-faint)] opacity-0 transition-opacity duration-500 hover:opacity-100 focus:opacity-100"
        >
          Format · ⌘/
        </button>
      ) : null}

      {toolbarVisible && !settings.fullscreen ? (
        <button
          type="button"
          onClick={() => setToolbarVisible(false)}
          className="folio-chrome fixed bottom-[4.75rem] left-1/2 z-40 -translate-x-1/2 font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.18em] text-[var(--ink-faint)] transition-opacity hover:text-[var(--ink-muted)]"
        >
          Hide
        </button>
      ) : null}

      <WordCounter onOpenGoals={() => {
        setNotesOpen(false);
        setEditorOpen(false);
        setBetaOpen(false);
        setInspectorOpen(false);
        setResearchOpen(false);
        setGoalsOpen(true);
      }} />
      <NotesPanel open={notesOpen} onClose={() => setNotesOpen(false)} />
      <GoalsPanel open={goalsOpen} onClose={() => setGoalsOpen(false)} />
      <ResearchPanel
        open={researchOpen}
        onClose={() => setResearchOpen(false)}
        entryId={researchEntryId}
        onEntryIdChange={setResearchEntryId}
      />
      <SceneInspector
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        sceneId={inspectorSceneId}
        onSceneIdChange={setInspectorSceneId}
        chapterId={activeChapter.id}
      />
      <DevelopmentalPanel
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setActiveReviewFlagId(null);
        }}
        editor={editor}
        activeFlagId={activeReviewFlagId}
        onActiveFlagChange={setActiveReviewFlagId}
        passKind={reviewPassKind}
        onPassKindChange={setReviewPassKind}
      />
      <BetaReadersPanel
        open={betaOpen}
        onClose={() => setBetaOpen(false)}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <BackupDialog open={backupOpen} onOpenChange={setBackupOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenExport={() => {
          setSettingsOpen(false);
          setExportOpen(true);
        }}
        onOpenImport={() => {
          setSettingsOpen(false);
          setImportOpen(true);
        }}
        onOpenBackup={() => {
          setSettingsOpen(false);
          setBackupOpen(true);
        }}
      />
    </div>
    </AppShell>
  );
}
