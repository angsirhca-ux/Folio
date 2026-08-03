"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search scenes…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 flex-1 items-center",
        className,
      )}
    >
      <Search
        className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--ink-faint)]"
        strokeWidth={1.5}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full min-w-0 rounded-full border border-transparent bg-[rgba(45,42,38,0.04)] pl-9 pr-9 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] transition-colors focus:border-[var(--border)] focus:bg-[rgba(247,243,234,0.9)] focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2 rounded-full p-1 text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      ) : null}
    </label>
  );
}
