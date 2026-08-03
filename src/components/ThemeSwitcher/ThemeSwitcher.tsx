"use client";

import { motion } from "framer-motion";
import { themeList } from "@/lib/themes";
import type { ThemeId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBook } from "@/providers/BookProvider";

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { settings, setTheme } = useBook();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {themeList.map((theme) => {
        const active = settings.theme === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => setTheme(theme.id as ThemeId)}
            className={cn(
              "group flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-400",
              active
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--border))]",
            )}
          >
            <span
              className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--border)] shadow-inner"
              aria-hidden
            >
              <span
                className="absolute inset-0"
                style={{ background: theme.paper }}
              />
              <span
                className="absolute bottom-1.5 left-1.5 right-1.5 h-1.5 rounded-full"
                style={{ background: theme.ink }}
              />
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{ background: theme.accent }}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--font-display)] text-base tracking-wide text-[var(--ink)]">
                {theme.name}
              </span>
              <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs text-[var(--ink-muted)]">
                {theme.description}
              </span>
            </span>
            {active ? (
              <motion.span
                layoutId="theme-active"
                className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
              />
            ) : (
              <span className="h-1.5 w-1.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}
