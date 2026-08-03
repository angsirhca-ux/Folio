"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function WikiField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline = true,
  rows = 2,
  className,
  inputClassName,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !multiline) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, rows * 24)}px`;
  }, [value, multiline, rows]);

  return (
    <label className={cn("block", className)}>
      <span className="font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block font-[family-name:var(--font-ui)] text-xs text-[var(--ink-faint)]">
          {hint}
        </span>
      ) : null}
      {multiline ? (
        <textarea
          ref={ref}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "mt-2 w-full resize-none overflow-hidden border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-[0.95rem] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none",
            inputClassName,
          )}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "mt-2 w-full border-0 border-b border-[rgba(45,42,38,0.1)] bg-transparent pb-2 font-[family-name:var(--font-body)] text-[0.95rem] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:outline-none",
            inputClassName,
          )}
        />
      )}
    </label>
  );
}
