/**
 * Shared typographic primitives for Folio.
 * Keep manuscript styling in globals.css; use these for chrome UI.
 */

import { cn } from "@/lib/utils";

export function DisplayHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p";
}) {
  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-display)] font-medium tracking-wide text-[var(--ink)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-[family-name:var(--font-display)] text-[0.65rem] uppercase tracking-[0.3em] text-[var(--ink-faint)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function BodyNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function Ornament({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "mx-auto h-px w-10 bg-[var(--accent)] opacity-45",
        className,
      )}
    />
  );
}
