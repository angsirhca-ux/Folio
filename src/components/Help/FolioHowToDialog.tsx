"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  BookMarked,
  BookOpen,
  Cat,
  ClipboardCheck,
  GitBranch,
  History,
  Inbox,
  LayoutGrid,
  Library,
  Map,
  MapPin,
  Music,
  ScrollText,
  Smartphone,
  StickyNote,
  Tags,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLARENCE } from "@/lib/clarence";
import { cn } from "@/lib/utils";

const TABS: Array<{ icon: LucideIcon; label: string; blurb: string }> = [
  {
    icon: Library,
    label: "Books",
    blurb:
      "Your shelf — open a manuscript, start a series, sync backups. Named draft checkpoints live under Backup.",
  },
  {
    icon: BookOpen,
    label: "Manuscript",
    blurb:
      "The prose itself. Chapters, scenes, spellcheck on right-click, thesaurus via ⌘⇧T, and find & replace via Search → Manuscript (⌘F).",
  },
  {
    icon: LayoutGrid,
    label: "Storyboard",
    blurb: "Scene cards you can rearrange — structure at a glance.",
  },
  {
    icon: GitBranch,
    label: "Timeline",
    blurb: "Plot threads across scenes — tracks for arcs and subplots.",
  },
  {
    icon: Users,
    label: "Characters",
    blurb: "Cast wiki — roles, voice, relationships. On the page checks name spellings across prose and the bible.",
  },
  {
    icon: MapPin,
    label: "Locations",
    blurb: "Places in the story — atmosphere, and where each name shows up on the page.",
  },
  {
    icon: Map,
    label: "Map",
    blurb: "A corkboard of geography — pins, terrain, optional basemap.",
  },
  {
    icon: BookMarked,
    label: "Encyclopedia",
    blurb: "In-world canon — custom stacks for magic, factions, lore.",
  },
  {
    icon: History,
    label: "Chronicle",
    blurb: "World history — ages and founding moments, not plot beats.",
  },
  {
    icon: Music,
    label: "Soundtrack",
    blurb: "A listening list for the book — fun, not canon.",
  },
  {
    icon: ScrollText,
    label: "Research",
    blurb: "Outside sources — themes, period notes, craft questions.",
  },
  {
    icon: Inbox,
    label: "Dump",
    blurb: "Scraps and spare pages until they earn a real home.",
  },
  {
    icon: Smartphone,
    label: "Mobile write",
    blurb: "Phone drafting at /m — same shelf when Dropbox is connected.",
  },
  {
    icon: Trash2,
    label: "Trash",
    blurb: "Soft-deleted scenes, chapters, and wiki cards — restorable.",
  },
];

const TOOLBAR_ICONS: Array<{ icon: LucideIcon; label: string; blurb: string }> =
  [
    {
      icon: StickyNote,
      label: "Notes",
      blurb: "Chapter notes beside the draft.",
    },
    {
      icon: ScrollText,
      label: "Research rail",
      blurb: "Outside sources while you write.",
    },
    {
      icon: BookMarked,
      label: "Encyclopedia rail",
      blurb: "In-world canon beside the page.",
    },
    {
      icon: Tags,
      label: "Scene details",
      blurb: "POV, place, cast, synopsis, status.",
    },
    {
      icon: Cat,
      label: "Developmental",
      blurb: "Clarence flags craft issues — never rewrites prose.",
    },
    {
      icon: Users,
      label: "Beta readers",
      blurb: "Persona reactions across chapters.",
    },
    {
      icon: ClipboardCheck,
      label: "Critique",
      blurb: "Genre checklists and pressure passes.",
    },
    {
      icon: Target,
      label: "Goals",
      blurb: "Daily and manuscript word targets.",
    },
  ];

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "⌘ K", action: "Search the project" },
  { keys: "⌘ F", action: "Find & replace in manuscript" },
  { keys: "⌘ S", action: "Save now" },
  { keys: "⌘ O", action: "Upload / import" },
  { keys: "⌘ E", action: "Compile & export" },
  { keys: "⌘ ,", action: "Settings" },
  { keys: "⌘ /", action: "Formatting toolbar" },
  { keys: "⌘ ⇧ T", action: "Thesaurus (synonyms for word)" },
  { keys: "⌘ ⇧ N", action: "Chapter notes" },
  { keys: "⌘ ⇧ M", action: "Scene details" },
  { keys: "⌘ ⇧ G", action: "Writing goals" },
  { keys: "⌘ ⌥ F", action: "Focus mode" },
  { keys: "⌘ ⌥ R", action: "Research rail" },
  { keys: "⌘ ⌥ E", action: "Encyclopedia rail" },
  { keys: "⌘ \\", action: "Chapter sidebar" },
  { keys: "⌘ .", action: "Fullscreen writing" },
  { keys: "Esc", action: "Exit fullscreen / close search" },
  { keys: "⌥ ↑ ↓", action: "Previous / next chapter" },
];

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function IconRow({
  icon: Icon,
  label,
  blurb,
}: {
  icon: LucideIcon;
  label: string;
  blurb: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(45,42,38,0.05)] text-[var(--ink-muted)]">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0">
        <p className="font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]">
          {label}
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
          {blurb}
        </p>
      </div>
    </li>
  );
}

export function FolioHowToDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex w-[min(94vw,36rem)] max-h-[min(90vh,44rem)] flex-col gap-0 overflow-hidden p-0",
        )}
      >
        <div className="relative shrink-0 overflow-hidden rounded-t-xl border-b border-[var(--border)] px-7 pb-5 pt-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 80% at 90% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 65%), linear-gradient(180deg, color-mix(in srgb, var(--paper) 0%, #E8E0D4) 0%, transparent 100%)",
            }}
            aria-hidden
          />
          <DialogHeader className="relative mb-0 pr-8">
            <DialogTitle>How to use Folio</DialogTitle>
            <DialogDescription className="mt-2 max-w-md">
              A quiet novel studio — write the book, keep a world bible beside
              it, and invite help only when you want it.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="folio-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-6">
          <div className="space-y-8">
          <Section title="The idea">
            <div className="space-y-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              <p>
                Folio holds one manuscript at a time on the page, and a library
                of books on the shelf. The left rail opens tools for structure
                and world — characters, places, timeline, lore. The manuscript
                toolbar opens notes, rails, and optional editorial passes.
              </p>
              <p>
                Write first. Everything else is optional scaffolding that grows
                with the draft.
              </p>
            </div>
          </Section>

          <Section title="What each tab offers">
            <ul className="space-y-3.5">
              {TABS.map((tab) => (
                <IconRow key={tab.label} {...tab} />
              ))}
            </ul>
          </Section>

          <Section title={`${CLARENCE.name} — the house reader`}>
            <div className="space-y-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              <p className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(45,42,38,0.05)] text-[var(--ink)]">
                  <Cat className="h-3.5 w-3.5" strokeWidth={1.5} />
                </span>
                <span>
                  <span className="text-[var(--ink)]">{CLARENCE.name}</span> is
                  Folio’s in-house reader — the cat behind Ask Clarence,
                  populate, deepen, and soundtrack. He reads the manuscript into
                  a shared reading, then seeds empty bible shelves from that.
                </span>
              </p>
              <p>
                Expect flags, checklists, cast and place stubs, lore events, and
                playlist ideas — never rewritten paragraphs. If you deepen a
                wiki card, he fills empty fields and leaves what you wrote by
                hand.
              </p>
              <p>
                First populate may take a while (a full read). Later shelves
                reuse that reading until the prose changes — or you ask him to
                reread.
              </p>
            </div>
          </Section>

          <Section title="Critiques, betas & developmental">
            <div className="space-y-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              <p>
                <span className="text-[var(--ink)]">Developmental</span> (cat
                icon on the manuscript toolbar) — craft flags for style, story,
                action, and continuity. Suggestions stay in the panel; your
                sentences stay yours.
              </p>
              <p>
                <span className="text-[var(--ink)]">Beta readers</span> —
                persona passes that remember earlier chapters. They react and
                answer craft questions; they don’t rewrite.
              </p>
              <p>
                <span className="text-[var(--ink)]">Critique</span> — genre
                checklists. <em>Smart pack</em> covers scene craft, fantasy,
                romance, and arc (skips what doesn’t apply). <em>Pressure</em>{" "}
                is a short heat-check on stakes, agency, causality, and chapter
                pull. Verdicts and notes only — still no prose rewrites.
              </p>
            </div>
          </Section>

          <Section title="AI is optional">
            <p className="font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
              You never have to use Clarence, critique, or betas. Folio works as
              a plain writing studio — type, outline, build the bible by hand.
              AI never touches the manuscript unless you ask it to help, and
              even then it does not rewrite your prose.
            </p>
          </Section>

          <Section title="Icon summary">
            <p className="mb-3 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
              Manuscript toolbar — beside the draft
            </p>
            <ul className="space-y-3.5">
              {TOOLBAR_ICONS.map((row) => (
                <IconRow key={row.label} {...row} />
              ))}
            </ul>
            <p className="mb-3 mt-6 font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
              Left rail — the same icons as the tabs above
            </p>
            <p className="font-[family-name:var(--font-ui)] text-xs leading-relaxed text-[var(--ink-muted)]">
              Settings (gear) lives on the manuscript toolbar. Search (⌘K) and
              find &amp; replace (⌘F) share the Search entry in the left rail —
              toggle Project / Manuscript.
            </p>
          </Section>

          <Section title="Shortcuts" className="pb-2">
            <ul className="columns-1 gap-x-8 space-y-2 sm:columns-2">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.keys}
                  className="break-inside-avoid font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]"
                >
                  <kbd className="text-[var(--ink)]">{s.keys}</kbd>
                  <span className="ml-2">{s.action}</span>
                </li>
              ))}
            </ul>
          </Section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
