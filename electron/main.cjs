/**
 * Folio Desk — Electron main process.
 * Dev: loads Next.js on localhost:3000
 * Prod: starts the Next standalone server, then opens the window.
 */

const { app, BrowserWindow, shell, Menu } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const net = require("net");

/** Packaged apps always use the bundled server. Unpackaged can opt in via FOLIO_USE_STANDALONE=1. */
const useStandalone =
  app.isPackaged || process.env.FOLIO_USE_STANDALONE === "1";
const isDev = !useStandalone;
const DEV_URL = process.env.FOLIO_DEV_URL || "http://127.0.0.1:3000";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
let serverPort = 0;

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

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
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
  const port = await findFreePort();
  serverPort = port;
  const dir = standaloneDir();
  const serverJs = path.join(dir, "server.js");
  if (!fs.existsSync(serverJs)) {
    throw new Error(
      `Missing packaged server at ${serverJs}. Run a full desktop build first.`,
    );
  }

  serverProcess = spawn(process.execPath, [serverJs], {
    cwd: dir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: isDev ? "inherit" : "pipe",
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (code && code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      console.error("Folio Desk server exited", code);
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
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
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: "deny" };
  });

  mainWindow.loadURL(url);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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

app.whenReady().then(() => {
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
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
});
