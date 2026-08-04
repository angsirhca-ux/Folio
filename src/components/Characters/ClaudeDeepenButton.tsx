"use client";

import { Cat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CLARENCE } from "@/lib/clarence";
import { cn } from "@/lib/utils";

export function ClarenceButton({
  onClick,
  busy,
  disabled,
  configured,
  label = CLARENCE.deepenLabel,
  title,
  className,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  configured: boolean | null;
  label?: string;
  title?: string;
  className?: string;
}) {
  const ready = configured === true;
  const busyLabel = (() => {
    if (!busy) return null;
    const lower = label.toLowerCase();
    if (lower.includes("read")) {
      return label.endsWith("…") || label.endsWith("...")
        ? label
        : `${label}…`;
    }
    if (lower.includes("appl")) return CLARENCE.applying;
    return CLARENCE.reading;
  })();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("gap-1.5 rounded-full", className)}
      onClick={onClick}
      disabled={disabled || busy || configured === false}
      title={
        configured === false
          ? CLARENCE.needsKey
          : title ?? CLARENCE.deepenTitle
      }
    >
      <Cat
        className={cn("h-3.5 w-3.5", busy && "animate-pulse")}
        strokeWidth={1.5}
      />
      {busy ? busyLabel : ready ? label : CLARENCE.unavailable}
    </Button>
  );
}

/** @deprecated Prefer ClarenceButton — kept for gradual import updates. */
export const ClaudeDeepenButton = ClarenceButton;
