"use client";

import { useEffect } from "react";

/** Registers the app-shell service worker once on the client. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;
    // Electron already ships a local server — skip the PWA worker.
    if (window.folioDesk?.isDesktop) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore */
    });
  }, []);
  return null;
}
