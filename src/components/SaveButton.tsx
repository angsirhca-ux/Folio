"use client";

import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBook } from "@/providers/BookProvider";
import { cn } from "@/lib/utils";

export function SaveButton() {
  const { isSaving, isDirty, saveNow, lastSavedAt } = useBook();
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!lastSavedAt || isDirty || isSaving) return;
    setJustSaved(true);
    const t = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(t);
  }, [lastSavedAt, isDirty, isSaving]);

  const label = isSaving
    ? "Saving…"
    : isDirty
      ? "Save"
      : justSaved
        ? "Saved"
        : "Saved";

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={isDirty ? "Save manuscript" : "Manuscript saved"}
      onClick={saveNow}
      disabled={isSaving}
      className={cn(
        "h-8 gap-1.5 px-2.5 font-[family-name:var(--font-ui)] text-xs tracking-wide",
        isDirty
          ? "text-[var(--accent)] hover:text-[var(--accent)]"
          : "text-[var(--ink-faint)]",
      )}
    >
      {justSaved && !isDirty ? (
        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
      ) : (
        <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
      )}
      <span>{label}</span>
    </Button>
  );
}
