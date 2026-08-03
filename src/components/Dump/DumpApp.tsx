"use client";

import { motion } from "framer-motion";
import { ManuscriptEditor } from "@/components/Editor/ManuscriptEditor";
import { DumpSidebar } from "@/components/Dump/DumpSidebar";
import { AppShell } from "@/components/Sidebar/AppShell";
import { useBook } from "@/providers/BookProvider";

export function DumpApp() {
  const { activeDumpPage, updateDumpPageContent, updateDumpPageTitle, book } =
    useBook();

  return (
    <AppShell
      contentClassName="h-screen overflow-hidden overscroll-contain"
    >
      <div className="relative flex h-screen bg-[var(--paper)] text-[var(--ink)]">
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

        <DumpSidebar />

        <main className="folio-scroll relative z-10 min-w-0 flex-1 overflow-y-auto">
          <motion.article
            key={activeDumpPage.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative mx-auto w-full max-w-[var(--page-width)] px-8 pb-36 pt-16 sm:px-10 md:px-12 lg:px-14"
          >
            <header className="mb-12 text-center">
              <p className="font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]">
                {book.title?.trim() || "Untitled"} · Dump
              </p>
              <input
                value={activeDumpPage.title}
                onChange={(e) =>
                  updateDumpPageTitle(activeDumpPage.id, e.target.value)
                }
                aria-label="Dump page title"
                className="mt-4 w-full bg-transparent text-center font-[family-name:var(--font-display)] text-3xl font-medium tracking-wide text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                placeholder="Untitled"
              />
              <div
                className="mx-auto mt-8 h-px w-10 bg-[var(--accent)] opacity-45"
                aria-hidden
              />
            </header>

            <ManuscriptEditor
              key={activeDumpPage.id}
              content={activeDumpPage.content}
              onChange={updateDumpPageContent}
            />
          </motion.article>
        </main>
      </div>
    </AppShell>
  );
}
