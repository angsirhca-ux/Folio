"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { SCENE_STATUS_META, type ResearchEntry } from "@/lib/types";
import type { ResearchAppearance } from "@/lib/research";
import { cn } from "@/lib/utils";

export function ResearchAppearancesRail({
  appearances,
  onOpenScene,
}: {
  appearances: ResearchAppearance[];
  onOpenScene: (chapterId: string, sceneIndex: number) => void;
}) {
  const router = useRouter();

  if (appearances.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        No scenes yet. Tag a label on the storyboard — or let the title surface
        in prose — and appearances will gather here.
      </p>
    );
  }

  let lastChapter = "";

  return (
    <ol className="relative space-y-0 border-l border-[rgba(45,42,38,0.12)] pl-6">
      {appearances.map((a, i) => {
        const showChapter = a.chapterTitle !== lastChapter;
        lastChapter = a.chapterTitle;
        const status = SCENE_STATUS_META[a.scene.status];
        return (
          <motion.li
            key={`${a.scene.id}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min(i * 0.03, 0.4),
              ease: [0.25, 0.1, 0.25, 1],
            }}
            className="relative pb-7 last:pb-0"
          >
            <span
              className={cn(
                "absolute -left-[1.65rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#EDE8E0]",
                a.viaLabel ? "bg-[var(--accent)]" : "bg-[var(--ink-faint)]",
              )}
              aria-hidden
            />
            {showChapter ? (
              <p className="mb-2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.2em] text-[var(--ink-faint)]">
                {a.chapterTitle}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onOpenScene(a.chapterId, a.sceneIndex);
                router.push("/");
              }}
              className="group w-full text-left"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-[family-name:var(--font-display)] text-base text-[var(--ink)] transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]">
                  {a.scene.title || "Untitled scene"}
                </span>
                {!a.viaLabel && a.viaProse ? (
                  <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                    Prose
                  </span>
                ) : null}
                <span
                  className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.12em]"
                  style={{ color: status.color }}
                >
                  {status.shortLabel}
                </span>
              </div>
              {a.scene.synopsis ? (
                <p className="mt-1 line-clamp-2 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
                  {a.scene.synopsis}
                </p>
              ) : null}
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function ResearchBackLink() {
  return (
    <Link
      href="/research"
      className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
    >
      ← Commonplace
    </Link>
  );
}

export function researchHref(e: ResearchEntry) {
  return `/research/${e.id}`;
}
