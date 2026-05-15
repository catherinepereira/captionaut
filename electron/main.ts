import { app, BrowserWindow, shell } from "electron";
import { startSidecar, stopSidecar } from "./sidecar";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let backendPort: number | null = null;

function createSplash(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: false,
    backgroundColor: "#0e0c1a",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  win.loadURL(
    `data:text/html,<!DOCTYPE html><html><head>` +
    `<style>*{margin:0;padding:0;box-sizing:border-box}` +
    `body{background:#0e0c1a;display:flex;flex-direction:column;` +
    `align-items:center;justify-content:center;height:100vh;` +
    `font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e8e4ff}` +
    `.dot{width:10px;height:10px;border-radius:50%;background:#7c5cfc;margin-bottom:12px}` +
    `h1{font-size:20px;font-weight:700;margin-bottom:8px}` +
    `p{font-size:13px;color:#7a74a0}</style></head>` +
    `<body><div class="dot"></div><h1>Captionaut</h1><p>Starting up…</p></body></html>`
  );

  return win;
}

async function createMainWindow(port: number): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#0e0c1a",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}`);

  win.once("ready-to-show", () => {
    win.show();
    splashWindow?.close();
    splashWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Scheme allowlist: prevents file://, javascript://, etc. from reaching the OS.
    try {
      const scheme = new URL(url).protocol;
      if (scheme === "http:" || scheme === "https:") {
        shell.openExternal(url);
      }
    } catch {
      // malformed URL, ignore
    }
    return { action: "deny" };
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(async () => {
  splashWindow = createSplash();

  try {
    backendPort = await startSidecar();
    mainWindow = await createMainWindow(backendPort);
  } catch (err) {
    console.error("Startup failed:", err);
    splashWindow?.close();
    app.quit();
    return;
  }

  app.on("activate", async () => {
    if (!mainWindow && backendPort) {
      mainWindow = await createMainWindow(backendPort);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopSidecar();
    app.quit();
  }
});

app.on("before-quit", () => {
  stopSidecar();
});
