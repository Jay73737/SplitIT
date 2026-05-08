const { app, BrowserWindow, dialog, ipcMain, nativeImage } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Tiny 16x16 transparent PNG used as the cursor preview when dragging stems
// out to the OS. webContents.startDrag requires a non-null icon.
const DRAG_ICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEElEQVR42mNkAAIAA" +
  "AABAAEArcAAAAASUVORK5CYII=";

ipcMain.on("splitit:start-drag", (event, filePath) => {
  if (typeof filePath !== "string" || !filePath) return;
  if (!fs.existsSync(filePath)) return;
  const icon = nativeImage.createFromBuffer(Buffer.from(DRAG_ICON_PNG_BASE64, "base64"));
  event.sender.startDrag({ file: filePath, icon });
});

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow = null;
let backendProc = null;
let backendReady = null;

const DEV_API_BASE = process.env.SPLITIT_DEV_API_BASE || "http://localhost:8000";

function backendExePath() {
  // electron-builder copies extraResources into process.resourcesPath
  const resourcesBackend = path.join(process.resourcesPath, "backend");
  const exe = process.platform === "win32" ? "splitit-backend.exe" : "splitit-backend";
  return path.join(resourcesBackend, exe);
}

function startBundledBackend() {
  const exe = backendExePath();
  if (!fs.existsSync(exe)) {
    return Promise.reject(new Error(`Bundled backend not found at ${exe}`));
  }

  const child = spawn(exe, [], {
    cwd: path.dirname(exe),
    env: { ...process.env, SPLITIT_CORS_ORIGINS: "*" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  backendProc = child;

  return new Promise((resolve, reject) => {
    let stderrBuf = "";
    let resolved = false;
    let stdoutBuf = "";

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try { child.kill(); } catch (_) {}
      reject(new Error("Backend startup timed out after 60s"));
    }, 60_000);

    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      let nl;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.event === "ready" && msg.port) {
            if (resolved) return;
            resolved = true;
            clearTimeout(timeout);
            resolve(`http://${msg.host || "127.0.0.1"}:${msg.port}`);
            return;
          }
        } catch (_) {
          // non-JSON stdout line - ignore
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      if (stderrBuf.length > 8192) stderrBuf = stderrBuf.slice(-8192);
    });

    child.on("exit", (code, signal) => {
      backendProc = null;
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Backend exited before ready (code=${code} signal=${signal})\n${stderrBuf}`));
      }
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function stopBundledBackend() {
  if (!backendProc) return;
  try {
    backendProc.kill();
  } catch (_) { /* ignore */ }
  backendProc = null;
}

function buildRendererUrl(apiBase) {
  const encoded = encodeURIComponent(apiBase);
  if (isDev) return `http://localhost:1234?api=${encoded}`;
  const fileUrl = "file://" + path.join(__dirname, "dist/index.html").replace(/\\/g, "/");
  return `${fileUrl}?api=${encoded}`;
}

async function createWindow() {
  let apiBase;
  try {
    apiBase = isDev ? DEV_API_BASE : await startBundledBackend();
  } catch (err) {
    dialog.showErrorBox("SplitIT failed to start", String(err && err.message || err));
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    frame: true,
    backgroundColor: "#0f2027",
    title: "SplitIT",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(buildRendererUrl(apiBase));

  if (isDev || process.env.SPLITIT_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopBundledBackend);
app.on("will-quit", stopBundledBackend);
process.on("exit", stopBundledBackend);
