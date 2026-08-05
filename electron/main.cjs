/**
 * Folio Desk — Electron main process.
 * Dev: loads Next.js on localhost:3000
 * Prod: starts the Next standalone server, then opens the window.
 *
 * Dropbox OAuth runs in the system browser (Google sign-in is blank inside
 * Electron). After auth, the browser hits localhost and hands off via the
 * folio-desk:// protocol back into this window.
 */

const {
  app,
  BrowserWindow,
  shell,
  Menu,
  utilityProcess,
  ipcMain,
} = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const net = require("net");

/** Packaged apps always use the bundled server. Unpackaged can opt in via FOLIO_USE_STANDALONE=1. */
const useStandalone =
  app.isPackaged || process.env.FOLIO_USE_STANDALONE === "1";
const isDev = !useStandalone;
const DEV_URL = process.env.FOLIO_DEV_URL || "http://127.0.0.1:3000";
/**
 * Fixed port for the packaged app so Dropbox OAuth redirect stays stable.
 * Register in Dropbox App Console:
 *   http://127.0.0.1:18765/dropbox/callback
 */
const DESK_PORT = Number(process.env.FOLIO_DESK_PORT) || 18765;
const DESK_ORIGIN = `http://127.0.0.1:${DESK_PORT}`;
const PROTOCOL = "folio-desk";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Electron.UtilityProcess | null} */
let serverProcess = null;
let serverPort = 0;
/** @type {string | null} */
let pendingDeepLink = null;
let appOrigin = isDev ? DEV_URL.replace(/\/$/, "") : DESK_ORIGIN;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find(
      (a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`),
    );
    if (link) handleDeepLink(link);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function loadEnvFiles() {
  const candidates = [];
  if (isDev) {
    candidates.push(path.join(__dirname, "..", ".env.local"));
    candidates.push(path.join(__dirname, "..", ".env"));
  }
  candidates.push(path.join(app.getPath("userData"), ".env"));

  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (key && process.env[key] == null) process.env[key] = val;
      }
    } catch {
      /* ignore */
    }
  }
}

/** Resolve when `port` is free on 127.0.0.1, else reject. */
function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (err) => {
      reject(
        err && err.code === "EADDRINUSE"
          ? new Error(
              `Port ${port} is already in use. Quit the other Folio Desk (or whatever holds it), or set FOLIO_DESK_PORT and register that redirect in Dropbox.`,
            )
          : err,
      );
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => {
        left -= 1;
        if (left <= 0) {
          reject(new Error(`Folio Desk server did not start (${url}).`));
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function standaloneDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

async function startProductionServer() {
  // Fixed port — Dropbox only accepts registered redirect URIs.
  const port = await assertPortFree(DESK_PORT);
  serverPort = port;
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing packaged server at ${serverJs}. Run a full desktop build first.`,
    );
  }

  // utilityProcess = headless Node child (no second Dock icon).
  serverProcess = utilityProcess.fork(serverJs, [], {
    cwd: dir,
    serviceName: "folio-desk-server",
    stdio: isDev ? "inherit" : "pipe",
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (code && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      console.error("Folio Desk server exited", code);
    }
  });

  const url = DESK_ORIGIN;
  await waitForServer(url);
  return url;
}

/**
 * folio-desk://dropbox/callback?code=… → load the in-app callback route
 * so PKCE can finish with the verifier stored in the Desk window.
 */
function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    const isDropbox =
      parsed.hostname === "dropbox" ||
      parsed.pathname.includes("dropbox/callback");
    if (!isDropbox) return;

    const qs = parsed.search || "";
    const target = `${appOrigin}/dropbox/callback${qs}`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.loadURL(target);
    } else {
      pendingDeepLink = target;
    }
  } catch (err) {
    console.error("Folio Desk deep link failed", err);
  }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Folio Desk",
    backgroundColor: "#F7F3EA",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Windows / Linux: prefer US English; macOS uses the system spellchecker.
  if (process.platform !== "darwin") {
    try {
      const session = mainWindow.webContents.session;
      const available = session.availableSpellCheckerLanguages || [];
      const prefer = ["en-US", "en-GB", "en"].filter((code) =>
        available.includes(code),
      );
      if (prefer.length) session.setSpellCheckerLanguages(prefer);
    } catch {
      /* ignore */
    }
  }

  mainWindow.webContents.on("context-menu", (_event, params) => {
    // Hand the menu to the renderer so Folio can draw paper/ink UI instead of
    // the OS chrome menu. Spell suggestions still come from Electron.
    const raw =
      (params.selectionText || params.misspelledWord || "").trim().split(/\s+/)[0] ||
      "";
    const word = raw.replace(/^[^\p{L}\p{N}'’]+|[^\p{L}\p{N}'’]+$/gu, "");
    mainWindow?.webContents.send("folio:editor-context-menu", {
      x: params.x,
      y: params.y,
      selectionText: params.selectionText || "",
      misspelledWord: params.misspelledWord || "",
      dictionarySuggestions: params.dictionarySuggestions || [],
      isEditable: Boolean(params.isEditable),
      word,
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  // Keep the shell on the local Folio origin. Dropbox/Google OAuth runs in the
  // system browser — if the window ever lands elsewhere, /api fetch breaks
  // with "Failed to fetch".
  mainWindow.webContents.on("will-navigate", (event, target) => {
    if (!isAppUrl(target)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  mainWindow.webContents.on("did-navigate", (_event, target) => {
    if (!isAppUrl(target) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(appOrigin);
    }
  });

  const start = pendingDeepLink || url;
  pendingDeepLink = null;
  mainWindow.loadURL(start);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function isAppUrl(target) {
  try {
    const u = new URL(target);
    if (u.protocol === "devtools:") return true;
    const origin = `${u.protocol}//${u.host}`;
    if (origin === appOrigin) return true;
    // Dev desktop may use localhost vs 127.0.0.1
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? [{ role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot() {
  loadEnvFiles();
  app.setName("Folio Desk");
  buildMenu();

  const url = isDev ? DEV_URL : await startProductionServer();
  appOrigin = url.replace(/\/$/, "");
  if (isDev) {
    try {
      await waitForServer(DEV_URL, 80);
    } catch {
      console.error(
        "Start the Next.js app first: npm run dev  (or use npm run desktop:dev)",
      );
      throw new Error(`Dev server not reachable at ${DEV_URL}`);
    }
  }
  createWindow(url);
}

ipcMain.handle("folio:open-external", async (_event, url) => {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    throw new Error("Invalid external URL");
  }
  await shell.openExternal(url);
});

ipcMain.handle("folio:replace-misspelling", (_event, text) => {
  if (typeof text !== "string" || !text) return false;
  mainWindow?.webContents.replaceMisspelling(text);
  return true;
});

ipcMain.handle("folio:add-spell-word", (_event, word) => {
  if (typeof word !== "string" || !word.trim()) return false;
  mainWindow?.webContents.session.addWordToSpellCheckerDictionary(word.trim());
  return true;
});

// macOS: open from custom protocol while app is running / cold-started
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.whenReady().then(() => {
  const launchLink = process.argv.find(
    (a) => typeof a === "string" && a.startsWith(`${PROTOCOL}://`),
  );
  if (launchLink) handleDeepLink(launchLink);

  boot().catch((err) => {
    console.error(err);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      boot().catch(console.error);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
});
