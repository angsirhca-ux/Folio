"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { SCENE_STATUS_META, type Character } from "@/lib/types";
import type { CharacterAppearance } from "@/lib/characters";
import { cn } from "@/lib/utils";

export function AppearancesRail({
  appearances,
  onOpenScene,
}: {
  appearances: CharacterAppearance[];
  onOpenScene: (chapterId: string, sceneIndex: number) => void;
}) {
  const present = appearances.filter((a) => a.presence === "present");
  const mentioned = appearances.filter((a) => a.presence === "mentioned");

  if (appearances.length === 0) {
    return (
      <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
        No scenes yet. Set them as POV or add them to a scene’s cast on the
        storyboard — that marks them as present. Names only talked about in
        prose show up separately as mentions.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <AppearanceGroup
        title="Present in scene"
        hint="POV or cast-tagged — actually in the scene."
        appearances={present}
        empty="Not tagged on any scene yet. Add them as POV or cast on the storyboard."
        onOpenScene={onOpenScene}
      />
      <AppearanceGroup
        title="Mentioned only"
        hint="Their name appears in the prose, but they aren’t cast or POV — often talked about, not present."
        appearances={mentioned}
        empty="No prose-only mentions."
        onOpenScene={onOpenScene}
        muted
      />
    </div>
  );
}

function AppearanceGroup({
  title,
  hint,
  appearances,
  empty,
  onOpenScene,
  muted = false,
}: {
  title: string;
  hint: string;
  appearances: CharacterAppearance[];
  empty: string;
  onOpenScene: (chapterId: string, sceneIndex: number) => void;
  muted?: boolean;
}) {
  const router = useRouter();
  let lastChapter = "";

  return (
    <div>
      <p
        className={cn(
          "font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em]",
          muted ? "text-[var(--ink-faint)]" : "text-[var(--ink-faint)]",
        )}
      >
        {title}
      </p>
      <p className="mt-1 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
        {hint}
      </p>
      {appearances.length === 0 ? (
        <p className="mt-3 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-faint)]">
          {empty}
        </p>
      ) : (
        <ol className="relative mt-4 space-y-0 border-l border-[rgba(45,42,38,0.12)] pl-6">
          {appearances.map((a, i) => {
            const showChapter = a.chapterTitle !== lastChapter;
            lastChapter = a.chapterTitle;
            const status = SCENE_STATUS_META[a.scene.status];
            return (
              <motion.li
                key={`${a.scene.id}-${a.presence}-${i}`}
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
                    a.asPov
                      ? "bg-[var(--accent)]"
                      : muted
                        ? "bg-[rgba(45,42,38,0.2)]"
                        : "bg-[var(--ink-faint)]",
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
                    <span
                      className={cn(
                        "font-[family-name:var(--font-display)] text-base transition-colors group-hover:text-[color-mix(in_srgb,var(--accent)_70%,var(--ink))]",
                        muted ? "text-[var(--ink-muted)]" : "text-[var(--ink)]",
                      )}
                    >
                      {a.scene.title || "Untitled scene"}
                    </span>
                    {a.asPov ? (
                      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--accent)]">
                        POV
                      </span>
                    ) : null}
                    {a.inCast && !a.asPov ? (
                      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                        Cast
                      </span>
                    ) : null}
                    {a.presence === "mentioned" ? (
                      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                        Talked about
                        {a.matchedAs ? ` · ${a.matchedAs}` : ""}
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
      )}
    </div>
  );
}

export function characterHref(c: Character) {
  return `/characters/${c.id}`;
}

export function CharactersBackLink() {
  return (
    <Link
      href="/characters"
      className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
    >
      ← Cast
    </Link>
  );
}
