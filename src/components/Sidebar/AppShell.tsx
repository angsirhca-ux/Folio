"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/Sidebar/AppSidebar";
import {
  ProjectSearch,
  useProjectSearchHotkeys,
  type SearchPanelMode,
} from "@/components/Search/ProjectSearch";
import { ManuscriptEditorProvider } from "@/providers/ManuscriptEditorContext";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const { settings, hydrated, toggleFullscreen } = useBook();
  const fullscreen = hydrated && Boolean(settings.fullscreen);
  const navOpen = hydrated ? (settings.appNavOpen ?? true) : true;
  const showNav = navOpen && !fullscreen;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchPanelMode>("project");

  const openProject = useCallback(() => {
    setSearchMode("project");
    setSearchOpen(true);
  }, []);

  const openChapter = useCallback(() => {
    setSearchMode("chapter");
    setSearchOpen(true);
  }, []);

  const hotkeyHandlers = useMemo(
    () => ({
      onOpenProject: openProject,
      onOpenChapter: openChapter,
    }),
    [openProject, openChapter],
  );
  useProjectSearchHotkeys(hotkeyHandlers);

  // Esc: close search first, then leave writing fullscreen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (searchOpen) {
        e.preventDefault();
        setSearchOpen(false);
        return;
      }
      if (!fullscreen) return;
      e.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [fullscreen, searchOpen, toggleFullscreen]);

  return (
    <ManuscriptEditorProvider>
      <div
        className={cn(
          "relative min-h-screen bg-[var(--paper)]",
          fullscreen && "folio-fullscreen",
          className,
        )}
      >
        {!fullscreen ? <AppSidebar onOpenSearch={openProject} /> : null}
        <div
          data-folio-scroll
          className={cn(
            "min-h-screen transition-[padding] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
            showNav ? "pl-[4.75rem] md:pl-[13.5rem]" : "pl-0",
            contentClassName,
          )}
        >
          {children}
        </div>
        <ProjectSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          mode={searchMode}
          onModeChange={setSearchMode}
        />
      </div>
    </ManuscriptEditorProvider>
  );
}
