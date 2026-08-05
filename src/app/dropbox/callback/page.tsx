"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeDropboxAuth, consumeDropboxReturnPath } from "@/lib/dropboxSync";

function isLocalDeskHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "127.0.0.1" || host === "localhost";
}

function DropboxCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setError(err);
      return;
    }
    if (!code) {
      setError("No authorization code returned from Dropbox.");
      return;
    }

    // Browser finished Dropbox login for Folio Desk — hand the code back to the app.
    // (Google sign-in cannot run inside Electron; OAuth opens in the system browser.)
    if (isLocalDeskHost() && !window.folioDesk?.isDesktop) {
      const qs = window.location.search || `?code=${encodeURIComponent(code)}`;
      setHandoff(true);
      window.location.href = `folio-desk://dropbox/callback${qs}`;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await completeDropboxAuth(code);
        if (cancelled) return;
        const next = consumeDropboxReturnPath("/books");
        const sep = next.includes("?") ? "&" : "?";
        router.replace(
          next.startsWith("/m")
            ? `${next}${sep}dropbox=connected`
            : `/books?dropbox=connected`,
        );
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Dropbox connect failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper,#F7F3EA)] px-6">
      {error ? (
        <div className="max-w-md text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Dropbox connection failed
          </p>
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[#6B3A2A]">
            {error}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/m")}
            className="mt-8 rounded-full border border-[rgba(45,42,38,0.12)] px-5 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]"
          >
            Back to Mobile write
          </button>
        </div>
      ) : handoff ? (
        <div className="max-w-md text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            Returning to Folio Desk…
          </p>
          <p className="mt-3 font-[family-name:var(--font-ui)] text-sm leading-relaxed text-[var(--ink-muted)]">
            If the app doesn’t open, click the button below, then you can close
            this browser tab.
          </p>
          <a
            href={`folio-desk://dropbox/callback${typeof window !== "undefined" ? window.location.search : ""}`}
            className="mt-8 inline-block rounded-full border border-[rgba(45,42,38,0.12)] px-5 py-2 font-[family-name:var(--font-ui)] text-sm text-[var(--ink)]"
          >
            Open Folio Desk
          </a>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
            <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent,#B08D57)]" />
          </div>
          <p className="mt-6 font-[family-name:var(--font-ui)] text-sm text-[var(--ink-muted)]">
            Connecting Dropbox…
          </p>
        </div>
      )}
    </div>
  );
}

export default function DropboxCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--paper,#F7F3EA)]">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-[rgba(176,141,87,0.2)]">
            <div className="folio-loading-bar h-full w-1/2 rounded-full bg-[var(--accent,#B08D57)]" />
          </div>
        </div>
      }
    >
      <DropboxCallbackInner />
    </Suspense>
  );
}
