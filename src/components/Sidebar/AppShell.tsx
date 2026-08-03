"use client";

import { useCallback, useState } from "react";
import { AppSidebar } from "@/components/Sidebar/AppSidebar";
import {
  ProjectSearch,
  useProjectSearchHotkey,
} from "@/components/Search/ProjectSearch";
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

  const openSearch = useCallback(() => setSearchOpen(true), []);
  useProjectSearchHotkey(openSearch);

  return (
    <div className={cn("relative min-h-screen bg-[var(--paper)]", className)}>
      <AppSidebar onOpenSearch={openSearch} />
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
      <ProjectSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
