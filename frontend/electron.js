// electron.js — main process
const path = require("path");
const { app, BrowserWindow, ipcMain, shell, nativeImage } = require("electron");
const { spawn } = require("child_process");
const fetch = require("node-fetch");
const fs = require("fs");

function logMain(message, extra = null) {
  try {
    const base = app?.isReady?.() ? app.getPath("userData") : __dirname;
    const logFile = path.join(base, "splitme-main.log");
    const line = `[${new Date().toISOString()}] ${message}${
      extra ? ` ${JSON.stringify(extra)}` : ""
    }\n`;
    fs.appendFileSync(logFile, line, "utf8");
  } catch (err) {
    console.error("Failed to write main log", err);
  }
}

function sanitizeFileName(name, fallback = "SplitMe Stems") {
  const safe = (name || "")
    .toString()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return safe.length ? safe : fallback;
}

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const isDev = !app.isPackaged;

let mainWin = null;
let pillWin = null;
let backendProcess = null;

const BACKEND_PORT = 5050;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Backend server managemen
const RESULTS_H = 478;
async function startBackendServer() {
  console.log("Starting backend server...");

  try {
    // First check if backend is already running
    const healthCheck = await fetch(`${BACKEND_URL}/api/health`).catch(
      () => null
    );
    if (healthCheck && healthCheck.ok) {
      console.log("Backend server already running");
      return;
    }
  } catch (err) {
    // Backend not running, continue to start it
  }

  const backendDir = path.join(__dirname, "..");

  // Try to use uvicorn directly first, fall back to python -m uvicorn
  let uvicornCmd;
  let args;

  if (isWin) {
    uvicornCmd = path.join(backendDir, ".venv", "Scripts", "uvicorn.exe");
    args = [
      "api.server:app",
      "--host",
      "127.0.0.1",
      "--port",
      BACKEND_PORT.toString(),
    ];
  } else {
    // Check if uvicorn exists in the venv, otherwise use python -m
    const uvicornPath = path.join(backendDir, ".venv", "bin", "uvicorn");

    if (fs.existsSync(uvicornPath)) {
      uvicornCmd = uvicornPath;
      args = [
        "api.server:app",
        "--host",
        "127.0.0.1",
        "--port",
        BACKEND_PORT.toString(),
      ];
    } else {
      // Fall back to the global uvicorn that we found earlier
      uvicornCmd = "/Users/geet/Desktop/SplitMe/.venv/bin/uvicorn";
      args = [
        "api.server:app",
        "--host",
        "127.0.0.1",
        "--port",
        BACKEND_PORT.toString(),
      ];
    }
  }

  backendProcess = spawn(uvicornCmd, args, {
    cwd: backendDir,
    env: {
      ...process.env,
      VIRTUAL_ENV: path.join(backendDir, ".venv"),
      PATH: `${path.join(backendDir, ".venv", isWin ? "Scripts" : "bin")}${
        path.delimiter
      }${process.env.PATH}`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`Backend stdout: ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.log(`Backend stderr: ${data}`);
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
    backendProcess = null;
  });

  backendProcess.on("error", (err) => {
    console.error("Failed to start backend server:", err);
    backendProcess = null;
  });

  // Wait for server to be ready
  await waitForBackend();
}

async function waitForBackend(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/health`);
      if (response.ok) {
        console.log("Backend server is ready!");
        return;
      }
    } catch (err) {
      // Server not ready yet
    }

    console.log(`Waiting for backend... (${attempt}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error("Backend server failed to start within timeout");
}

function stopBackendServer() {
  if (backendProcess) {
    console.log("Stopping backend server...");
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

function abs(p) {
  // robust preload resolution, works in dev & prod
  return path.join(app.getAppPath(), p);
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1400, // Reduced for better screen fit
    height: 900, // Reduced for better screen fit
    resizable: false,

    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    fullscreenWindowTitleVisibility: "hidden",

    webPreferences: {
      preload: abs("preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    mainWin.setHasShadow(false);
  } catch {}
  try {
    mainWin.setWindowButtonVisibility?.(false);
  } catch {}

  if (isDev) mainWin.loadURL("http://localhost:3000");
  else mainWin.loadFile(path.join(app.getAppPath(), "build", "index.html"));

  mainWin.webContents.on("render-process-gone", (_event, details) => {
    const info = {
      reason: details.reason,
      exitCode: details.exitCode,
    };
    console.error("Renderer process crashed", JSON.stringify(info));
    logMain("renderer-crashed", info);
  });

  mainWin.on("closed", () => {
    mainWin = null;
    if (pillWin && !pillWin.isDestroyed()) pillWin.close();
    pillWin = null;
  });
}

function ensurePillWindow() {
  if (!mainWin) return;
  if (pillWin && !pillWin.isDestroyed()) return;

  pillWin = new BrowserWindow({
    width: 800,
    height: 65,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    focusable: true,
    parent: mainWin,
    show: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    webPreferences: {
      preload: abs("pill-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    ...(isMac ? { vibrancy: "under-window", visualEffectState: "active" } : {}),
  });

  if (isMac) {
    try {
      pillWin.setVibrancy("under-window");
      pillWin.setVisualEffectState?.("active");
    } catch {}
  }
  if (isWin && typeof pillWin.setBackgroundMaterial === "function") {
    try {
      pillWin.setBackgroundMaterial("acrylic");
    } catch {}
  }
  try {
    pillWin.setHasShadow(false);
  } catch {}

  const pillHTML = `
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .wrap{position:fixed;inset:0;border-radius:39px;overflow:hidden}

  .glass{
    position:absolute; inset:0; border-radius:39px;
    background: rgba(0,0,0,0.26);
    border:2px solid transparent; background-clip:padding-box;
    z-index:0;
  }

  .stroke{
    position:absolute; inset:0; border-radius:39px; padding:2px;
    background: linear-gradient(90deg,#fe14a8,#1a00ff,#fe14a8);
    background-size:200% 100%;
    animation: spin 4s linear infinite;
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    pointer-events:none; z-index:1;
  }
  @keyframes spin { from{background-position:0 0} to{background-position:200% 0} }

  .field{
    position:absolute; inset:0; display:flex; align-items:center;
    padding:0 28px; border-radius:39px; z-index:2; color:#fff;
    font:500 18px/1.2 system-ui,-apple-system,Inter,sans-serif;
  }
  #q{
    flex:1; height:100%; border:none; outline:none; background:transparent; color:#fff;
    font:600 20px/65px system-ui,-apple-system,Inter,sans-serif; /* centers caret */
  }

  .ghost{
    position:absolute; left:28px; right:28px; top:50%;
    transform: translateY(-50%);
    font:600 22px/1 system-ui,-apple-system,Inter,sans-serif;
    color: rgba(255,255,255,0.70);
    pointer-events:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    opacity:0; transition:opacity .2s ease; z-index:2;
  }
  .ghost.show{ opacity:1; }
</style>

<div class="wrap">
  <div class="glass"></div>
  <div class="stroke"></div>

  <div class="field">
    <input id="q" type="text" autocomplete="off" spellcheck="false" />
  </div>

  <div id="ghost" class="ghost"></div>
</div>

<script>
  const msgs = ["Type in a search","Paste a link","Drop in a file"];
  const ghost = document.getElementById('ghost');
  const q = document.getElementById('q');
  let idx = 0, loop = null, fade = null;

  function tick(){
    ghost.textContent = msgs[idx];
    ghost.classList.add('show');
    clearTimeout(fade);
    fade = setTimeout(()=>ghost.classList.remove('show'), 1600);
    idx = (idx + 1) % msgs.length;
  }
  function start(){ stop(); tick(); loop = setInterval(tick, 2400); }
  function stop(){ if(loop){ clearInterval(loop); loop=null; } ghost.classList.remove('show'); }
  function syncGhost(){
    const focused = document.activeElement === q;
    const hasText = q.value.trim().length > 0;
    if (focused || hasText){ stop(); ghost.style.display = 'none'; }
    else { ghost.style.display = ''; start(); }
  }

  // Start visible; hide once focused/typing
  syncGhost();

  q.addEventListener('focus', syncGhost);
  q.addEventListener('blur', syncGhost);
  q.addEventListener('input', syncGhost);

  document.addEventListener('mousedown', () => q.focus());

  // Enter -> send text to main
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.pillAPI?.submit(q.value || "");
    }
  });
</script>
  `;
  pillWin.loadURL(
    "data:text/html;charset=utf-8," + encodeURIComponent(pillHTML)
  );

  pillWin.on("closed", () => {
    pillWin = null;
  });
}

ipcMain.on("pill:set-geometry", (_evt, g) => {
  if (!mainWin) return;
  ensurePillWindow();
  if (!pillWin) return;

  const content = mainWin.getContentBounds();
  const zoom = mainWin.webContents.getZoomFactor();

  const x = Math.round(content.x + g.x * zoom);
  const y = Math.round(content.y + g.y * zoom);
  const w = Math.max(10, Math.round(g.w * zoom));
  const h = Math.max(10, Math.round(g.h * zoom));

  pillWin.setBounds({ x, y, width: w, height: h }, false);
});

// Child (Enter) -> main -> renderer
ipcMain.on("pill:submit", (_evt, value) => {
  // forward to the renderer
  if (mainWin) mainWin.webContents.send("pill:submit", value ?? "");
});

ipcMain.handle("stems:download-all", async (_event, payload = {}) => {
  if (!payload.stems || !Array.isArray(payload.stems) || payload.stems.length === 0) {
    return { ok: false, error: "No stems provided" };
  }

  try {
    const downloadsDir = app.getPath("downloads");
    const folderName = sanitizeFileName(payload.title, "SplitMe Stems");
    const targetDir = path.join(downloadsDir, folderName);
    await fs.promises.mkdir(targetDir, { recursive: true });

    for (const stem of payload.stems) {
      if (!stem?.streamUrl) continue;
      const response = await fetch(stem.streamUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch stem: ${stem?.stem || "stem"}`);
      }
      const buffer = await response.buffer();
      const ext = sanitizeFileName(stem.format || "mp3", "mp3").toLowerCase();
      const basename = sanitizeFileName(stem.stem || "stem");
      const filePath = path.join(targetDir, `${basename}.${ext}`);
      await fs.promises.writeFile(filePath, buffer);
    }

    shell.showItemInFolder?.(targetDir);
    logMain("stems-downloaded", { targetDir, count: payload.stems.length });
    return { ok: true, path: targetDir };
  } catch (error) {
    logMain("stems-download-error", { message: error.message });
    return { ok: false, error: error.message };
  }
});

ipcMain.on("stems:drag-file", (event, payload = {}) => {
  try {
    const { filePath, displayName } = payload;
    if (!filePath) {
      throw new Error("Missing file path");
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error("Stem file does not exist");
    }

    const icon = nativeImage.createEmpty();
    event.sender.startDrag({
      file: resolved,
      icon,
      title: typeof displayName === "string" ? displayName : undefined,
    });
    logMain("stems-drag", { path: resolved });
  } catch (error) {
    logMain("stems-drag-error", { message: error.message });
  }
});

// Optional no-ops for your existing calls
ipcMain.on("results-opened", () => {});
ipcMain.on("results-closed", () => {});

app.whenReady().then(async () => {
  try {
    logMain("app-ready", { userData: app.getPath("userData") });

    // Start backend server first
    await startBackendServer();

    // Then create windows
    createMainWindow();
    ensurePillWindow();

    if (isMac) {
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
      });
    }
  } catch (error) {
    console.error("Failed to start backend server:", error);
    // Continue with app startup even if backend fails
    createMainWindow();
    ensurePillWindow();
  }
});

app.on("window-all-closed", () => {
  stopBackendServer();
  if (!isMac) app.quit();
});

app.on("before-quit", () => {
  stopBackendServer();
});
