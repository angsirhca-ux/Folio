"use client";

/**
 * FocusMode is applied via CSS class on the manuscript editor.
 * This module exports helpers and a subtle indicator for when focus mode is active.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useBook } from "@/providers/BookProvider";

export function FocusModeIndicator() {
  const { settings } = useBook();

  return (
    <AnimatePresence>
      {settings.focusMode ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className="folio-chrome pointer-events-none fixed left-1/2 top-5 z-30 -translate-x-1/2 font-[family-name:var(--font-ui)] text-[0.65rem] uppercase tracking-[0.28em] text-[var(--ink-faint)]"
        >
          Focus
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
