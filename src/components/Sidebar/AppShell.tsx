"use client";

import { useCallback, useMemo, useState } from "react";
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
  const { settings, hydrated } = useBook();
  const navOpen = hydrated ? (settings.appNavOpen ?? true) : true;
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

  return (
    <ManuscriptEditorProvider>
      <div className={cn("relative min-h-screen bg-[var(--paper)]", className)}>
        <AppSidebar onOpenSearch={openProject} />
        <div
          data-folio-scroll
          className={cn(
            "min-h-screen transition-[padding] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
            navOpen ? "pl-[4.75rem] md:pl-[13.5rem]" : "pl-0",
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
