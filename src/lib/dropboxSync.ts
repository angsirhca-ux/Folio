import type { AppSettings, FolioLibrary } from "./types";
import { FOLIO_BACKUP_FORMAT, FOLIO_BACKUP_VERSION } from "./backup";
import { createId } from "./utils";

export const DROPBOX_LIBRARY_PATH = "/folio-library.json";
export const DROPBOX_REDIRECT_PATH = "/dropbox/callback";

const TOKENS_KEY = "folio:dropbox:tokens";
const META_KEY = "folio:dropbox:meta";
const DEVICE_KEY = "folio:deviceId";
const VERIFIER_KEY = "folio:dropbox:codeVerifier";
const RETURN_KEY = "folio:dropbox:returnPath";

export type DropboxSyncMeta = {
  revision: number;
  deviceId: string;
  updatedAt: number;
};

export type FolioDropboxPayload = {
  format: typeof FOLIO_BACKUP_FORMAT;
  version: typeof FOLIO_BACKUP_VERSION;
  exportedAt: number;
  sync: DropboxSyncMeta;
  library: FolioLibrary;
  settings: AppSettings;
};

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
  email?: string;
  displayName?: string;
};

export type DropboxConnectionStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  displayName: string | null;
  lastSyncedAt: number | null;
  lastAckRevision: number;
  lastRemoteRev: string | null;
};

type DropboxLocalMeta = {
  lastSyncedAt: number | null;
  lastAckRevision: number;
  lastRemoteRev: string | null;
};

export function dropboxAppKey(): string | null {
  const key = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY?.trim();
  return key || null;
}

export function isDropboxConfigured(): boolean {
  return Boolean(dropboxAppKey());
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = createId();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return createId();
  }
}

function loadTokens(): TokenBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenBundle;
    if (!parsed?.accessToken || !parsed?.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveTokens(tokens: TokenBundle | null) {
  if (typeof window === "undefined") return;
  if (!tokens) {
    localStorage.removeItem(TOKENS_KEY);
    return;
  }
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

function loadLocalMeta(): DropboxLocalMeta {
  if (typeof window === "undefined") {
    return { lastSyncedAt: null, lastAckRevision: 0, lastRemoteRev: null };
  }
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return { lastSyncedAt: null, lastAckRevision: 0, lastRemoteRev: null };
    }
    const parsed = JSON.parse(raw) as DropboxLocalMeta;
    return {
      lastSyncedAt: parsed.lastSyncedAt ?? null,
      lastAckRevision: parsed.lastAckRevision ?? 0,
      lastRemoteRev: parsed.lastRemoteRev ?? null,
    };
  } catch {
    return { lastSyncedAt: null, lastAckRevision: 0, lastRemoteRev: null };
  }
}

function saveLocalMeta(partial: Partial<DropboxLocalMeta>) {
  if (typeof window === "undefined") return;
  const next = { ...loadLocalMeta(), ...partial };
  localStorage.setItem(META_KEY, JSON.stringify(next));
}

export function getDropboxStatus(): DropboxConnectionStatus {
  const tokens = loadTokens();
  const meta = loadLocalMeta();
  return {
    configured: isDropboxConfigured(),
    connected: Boolean(tokens?.refreshToken),
    email: tokens?.email ?? null,
    displayName: tokens?.displayName ?? null,
    lastSyncedAt: meta.lastSyncedAt,
    lastAckRevision: meta.lastAckRevision,
    lastRemoteRev: meta.lastRemoteRev,
  };
}

export function disconnectDropbox() {
  saveTokens(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem(VERIFIER_KEY);
  }
}

/** Vercel preview/deployment hosts (not the stable project alias). */
function isEphemeralVercelHost(hostname: string): boolean {
  if (!hostname.endsWith(".vercel.app")) return false;
  if (hostname.includes("-git-")) return true;
  // e.g. folio-85gsrh4x5-folio17.vercel.app
  return /-[a-z0-9]{8,}(?:-|$)/i.test(hostname.replace(/\.vercel\.app$/i, ""));
}

function appOrigin(): string {
  if (typeof window === "undefined") return "";
  // Prefer explicit production origin so preview/alias hosts don't break OAuth.
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return window.location.origin;
}

function redirectUri(): string {
  const origin = appOrigin();
  if (!origin) return "";
  return `${origin}${DROPBOX_REDIRECT_PATH}`;
}

/** URI Folio will send to Dropbox — useful for debugging App Console mismatches. */
export function dropboxRedirectUriForDisplay(): string {
  return redirectUri() || `(open Folio in a browser)…${DROPBOX_REDIRECT_PATH}`;
}

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes.buffer);
}

/** Start Dropbox OAuth (PKCE). Call from a click handler. */
export async function beginDropboxAuth(): Promise<void> {
  const clientId = dropboxAppKey();
  if (!clientId) {
    throw new Error(
      "NEXT_PUBLIC_DROPBOX_APP_KEY is not set. Add it to .env.local (see env.example).",
    );
  }
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (
    typeof window !== "undefined" &&
    !configured &&
    isEphemeralVercelHost(window.location.hostname)
  ) {
    throw new Error(
      "This is a temporary Vercel preview URL. Open https://folio-jet-eta.vercel.app to connect Dropbox, or set NEXT_PUBLIC_APP_ORIGIN on Vercel to that origin.",
    );
  }
  const verifier = randomVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (path.startsWith("/") && !path.startsWith("//")) {
      sessionStorage.setItem(RETURN_KEY, path);
    }
  } catch {
    /* ignore */
  }
  const challenge = base64Url(await sha256(verifier));
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    token_access_type: "offline",
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri(),
    // Explicit scopes — must match Permissions enabled in Dropbox App Console
    scope: [
      "account_info.read",
      "files.content.read",
      "files.content.write",
      "files.metadata.read",
      "files.metadata.write",
    ].join(" "),
  });
  window.location.href = `https://www.dropbox.com/oauth2/authorize?${params}`;
}

/** Where to send the user after a successful Dropbox OAuth. */
export function consumeDropboxReturnPath(fallback = "/books"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Finish PKCE on /dropbox/callback. */
export async function completeDropboxAuth(code: string): Promise<void> {
  const clientId = dropboxAppKey();
  if (!clientId) throw new Error("Dropbox app key missing.");
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) {
    throw new Error("Missing PKCE verifier — try connecting again.");
  }

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: redirectUri(),
  });

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    account_id?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(
      data.error_description || data.error || "Dropbox authorization failed.",
    );
  }

  sessionStorage.removeItem(VERIFIER_KEY);

  const tokens: TokenBundle = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 14400) * 1000 - 60_000,
    accountId: data.account_id,
  };

  saveTokens(tokens);

  try {
    const account = await dropboxRpc<{
      email?: string;
      name?: { display_name?: string };
    }>("users/get_current_account", {});
    const next = {
      ...tokens,
      email: account.email,
      displayName: account.name?.display_name,
    };
    saveTokens(next);
  } catch {
    // Account info is optional for sync.
  }
}

async function refreshAccessToken(bundle: TokenBundle): Promise<TokenBundle> {
  const clientId = dropboxAppKey();
  if (!clientId) throw new Error("Dropbox app key missing.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: bundle.refreshToken,
    client_id: clientId,
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || "Could not refresh Dropbox session. Reconnect.",
    );
  }
  const next: TokenBundle = {
    ...bundle,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 14400) * 1000 - 60_000,
  };
  saveTokens(next);
  return next;
}

async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) throw new Error("Dropbox is not connected.");
  if (Date.now() >= tokens.expiresAt) {
    tokens = await refreshAccessToken(tokens);
  }
  return tokens.accessToken;
}

async function dropboxRpc<T>(
  endpoint: string,
  arg: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getValidAccessToken();
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arg),
  });
  if (res.status === 409) {
    const err = (await res.json()) as { error_summary?: string };
    throw Object.assign(new Error(err.error_summary || "Dropbox conflict"), {
      dropboxNotFound: String(err.error_summary || "").includes("not_found"),
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Dropbox API error (${res.status})`);
  }
  if (res.status === 200 && res.headers.get("Content-Type")?.includes("json")) {
    return (await res.json()) as T;
  }
  return undefined as T;
}

export type RemoteLibraryResult =
  | { exists: false }
  | {
      exists: true;
      payload: FolioDropboxPayload;
      remoteRev: string;
      remoteRevision: number;
    };

export async function downloadDropboxLibrary(): Promise<RemoteLibraryResult> {
  const accessToken = await getValidAccessToken();
  const res = await fetch(
    "https://content.dropboxapi.com/2/files/download",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({ path: DROPBOX_LIBRARY_PATH }),
      },
    },
  );

  if (res.status === 409) {
    const err = (await res.json().catch(() => ({}))) as {
      error_summary?: string;
    };
    if (String(err.error_summary || "").includes("not_found")) {
      return { exists: false };
    }
    throw new Error(err.error_summary || "Could not download from Dropbox.");
  }
  if (!res.ok) {
    throw new Error(`Dropbox download failed (${res.status}).`);
  }

  const apiResult = res.headers.get("Dropbox-API-Result");
  let remoteRev = "";
  if (apiResult) {
    try {
      const meta = JSON.parse(apiResult) as { rev?: string };
      remoteRev = meta.rev ?? "";
    } catch {
      /* ignore */
    }
  }

  const text = await res.text();
  const parsed = JSON.parse(text) as FolioDropboxPayload;
  if (parsed.format !== FOLIO_BACKUP_FORMAT || !parsed.library?.books) {
    throw new Error("Dropbox file is not a Folio library backup.");
  }

  const remoteRevision = parsed.sync?.revision ?? 0;
  return {
    exists: true,
    payload: parsed,
    remoteRev,
    remoteRevision,
  };
}

export function buildDropboxPayload(
  library: FolioLibrary,
  settings: AppSettings,
  previousRevision = 0,
): FolioDropboxPayload {
  return {
    format: FOLIO_BACKUP_FORMAT,
    version: FOLIO_BACKUP_VERSION,
    exportedAt: Date.now(),
    sync: {
      revision: previousRevision + 1,
      deviceId: getDeviceId(),
      updatedAt: Date.now(),
    },
    library,
    settings,
  };
}

export async function uploadDropboxLibrary(
  payload: FolioDropboxPayload,
): Promise<{ remoteRev: string; revision: number }> {
  const accessToken = await getValidAccessToken();
  const body = JSON.stringify(payload, null, 2);
  const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: DROPBOX_LIBRARY_PATH,
        mode: "overwrite",
        mute: true,
        autorename: false,
      }),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Dropbox upload failed (${res.status}).`);
  }
  const meta = (await res.json()) as { rev?: string };
  const revision = payload.sync.revision;
  saveLocalMeta({
    lastSyncedAt: Date.now(),
    lastAckRevision: revision,
    lastRemoteRev: meta.rev ?? null,
  });
  return { remoteRev: meta.rev ?? "", revision };
}

export function acknowledgeRemote(
  revision: number,
  remoteRev: string | null,
) {
  saveLocalMeta({
    lastSyncedAt: Date.now(),
    lastAckRevision: revision,
    lastRemoteRev: remoteRev,
  });
}

export type SyncCompare =
  | { kind: "none" }
  | { kind: "push" }
  | { kind: "pull"; remote: Extract<RemoteLibraryResult, { exists: true }> }
  | {
      kind: "conflict";
      remote: Extract<RemoteLibraryResult, { exists: true }>;
    };

/**
 * Decide sync action from Dropbox file rev + local dirty flag.
 * Dropbox `rev` is the source of truth for “did the cloud copy change?”
 */
export function compareWithRemote(
  remote: RemoteLibraryResult,
  args: {
    localDirty: boolean;
    lastAckRevision: number;
    lastRemoteRev: string | null;
  },
): SyncCompare {
  if (!remote.exists) {
    return { kind: "push" };
  }
  const revChanged =
    Boolean(args.lastRemoteRev) &&
    Boolean(remote.remoteRev) &&
    remote.remoteRev !== args.lastRemoteRev;
  const revisionAhead = remote.remoteRevision > args.lastAckRevision;

  if (revChanged || revisionAhead) {
    if (args.localDirty) return { kind: "conflict", remote };
    return { kind: "pull", remote };
  }

  // First connect with existing cloud file and no local ack yet
  if (!args.lastRemoteRev && remote.remoteRev && !args.localDirty) {
    return { kind: "pull", remote };
  }

  if (args.localDirty) return { kind: "push" };
  return { kind: "none" };
}

/** Lightweight check — does the Dropbox file rev differ from what we last wrote? */
export async function getDropboxFileRev(): Promise<string | null> {
  try {
    const meta = await dropboxRpc<{ rev?: string }>("files/get_metadata", {
      path: DROPBOX_LIBRARY_PATH,
    });
    return meta.rev ?? null;
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "dropboxNotFound" in e &&
      (e as { dropboxNotFound?: boolean }).dropboxNotFound
    ) {
      return null;
    }
    throw e;
  }
}
