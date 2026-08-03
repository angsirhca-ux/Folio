"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BookMarked,
  GitBranch,
  History,
  Inbox,
  LayoutGrid,
  Library,
  Map,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Search,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/books", label: "Books", icon: Library, ready: true },
  { href: "/", label: "Manuscript", icon: BookOpen, ready: true },
  { href: "/storyboard", label: "Storyboard", icon: LayoutGrid, ready: true },
  { href: "/timeline", label: "Timeline", icon: GitBranch, ready: true },
  { href: "/characters", label: "Characters", icon: Users, ready: true },
  { href: "/locations", label: "Locations", icon: MapPin, ready: true },
  { href: "/map", label: "Map", icon: Map, ready: true },
  { href: "/encyclopedia", label: "Encyclopedia", icon: BookMarked, ready: true },
  { href: "/chronicle", label: "Chronicle", icon: History, ready: true },
  { href: "/research", label: "Research", icon: ScrollText, ready: true },
  { href: "/dump", label: "Dump", icon: Inbox, ready: true },
  { href: "/m", label: "Mobile write", icon: Smartphone, ready: true },
  { href: "/trash", label: "Trash", icon: Trash2, ready: true },
] as const;

export function AppSidebar({
  onOpenSearch,
}: {
  onOpenSearch?: () => void;
}) {
  const pathname = usePathname();
  const { settings, toggleAppNav } = useBook();
  const open = settings.appNavOpen ?? true;

  return (
    <>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.aside
            key="app-nav"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            className="folio-chrome fixed bottom-0 left-0 top-0 z-40 flex w-[4.75rem] flex-col items-center border-r border-[var(--border)] bg-[rgba(241,235,224,0.92)] py-5 backdrop-blur-xl md:w-[13.5rem] md:items-stretch md:px-3"
            aria-label="Folio navigation"
          >
            <div className="mb-6 flex w-full items-center justify-center gap-2 px-2 md:justify-between md:px-3">
              <Link
                href="/"
                className="font-[family-name:var(--font-display)] text-lg font-medium tracking-[0.12em] text-[var(--ink)] transition-opacity hover:opacity-70"
              >
                <span className="md:hidden">F</span>
                <span className="hidden md:inline">Folio</span>
              </Link>
              <button
                type="button"
                onClick={toggleAppNav}
                aria-label="Collapse tools"
                title="Collapse tools"
                className="hidden rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)] md:inline-flex"
              >
                <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Mobile collapse */}
            <button
              type="button"
              onClick={toggleAppNav}
              aria-label="Collapse tools"
              title="Collapse tools"
              className="mb-4 rounded-lg p-1.5 text-[var(--ink-faint)] transition-colors hover:bg-[rgba(45,42,38,0.05)] hover:text-[var(--ink)] md:hidden"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <nav className="flex flex-1 flex-col gap-0.5">
              {onOpenSearch ? (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  title="Search project (⌘K)"
                  className="group relative mb-1 flex items-center justify-center gap-3 rounded-xl px-0 py-2.5 text-[var(--ink-muted)] transition-all duration-300 hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)] md:justify-start md:px-3"
                >
                  <Search
                    className="h-[1.15rem] w-[1.15rem] shrink-0"
                    strokeWidth={1.5}
                  />
                  <span className="hidden font-[family-name:var(--font-ui)] text-sm tracking-wide md:inline">
                    Search
                  </span>
                  <kbd className="ml-auto hidden rounded border border-[rgba(45,42,38,0.1)] px-1 py-0.5 font-[family-name:var(--font-ui)] text-[0.6rem] text-[var(--ink-faint)] md:inline">
                    ⌘K
                  </kbd>
                </button>
              ) : null}
              {NAV.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.ready ? item.label : `${item.label} — soon`}
                    className={cn(
                      "group relative flex items-center justify-center gap-3 rounded-xl px-0 py-2.5 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] md:justify-start md:px-3",
                      active
                        ? "bg-[var(--accent-soft)] text-[var(--ink)]"
                        : "text-[var(--ink-muted)] hover:bg-[rgba(45,42,38,0.04)] hover:text-[var(--ink)]",
                      !item.ready && "opacity-55",
                    )}
                  >
                    <Icon
                      className="h-[1.15rem] w-[1.15rem] shrink-0"
                      strokeWidth={1.5}
                    />
                    <span className="hidden font-[family-name:var(--font-ui)] text-sm tracking-wide md:inline">
                      {item.label}
                    </span>
                    {!item.ready ? (
                      <span className="ml-auto hidden font-[family-name:var(--font-ui)] text-[0.6rem] uppercase tracking-[0.16em] text-[var(--ink-faint)] md:inline">
                        Soon
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {!open ? (
        <button
          type="button"
          onClick={toggleAppNav}
          aria-label="Expand tools"
          title="Expand tools"
          className="folio-chrome fixed left-3 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(45,42,38,0.08)] bg-[rgba(241,235,224,0.92)] text-[var(--ink-muted)] shadow-[0_8px_24px_rgba(45,42,38,0.08)] backdrop-blur-xl transition-colors hover:text-[var(--ink)]"
        >
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.5} />
        </button>
      ) : null}
    </>
  );
}
