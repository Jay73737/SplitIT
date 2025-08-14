// electron.js (CommonJS)
//
// This file sets up the Electron main process. It creates the BrowserWindow
// for the React UI and exposes IPC handlers for downloading audio from
// YouTube. Additionally, it applies system vibrancy effects on supported
// platforms so that the application window has a frosted glass background.

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ytdl = require("ytdl-core");

let win;

// Window sizing constants to match your UI
const PILL_W = 800;
const PILL_H = 65;
const RESULTS_W = 960;
const RESULTS_H = 438;
const DASH_W = 1900;
const DASH_H = 1200;
const GAP = 24;

/**
 * Create the main application window and apply vibrancy or background material
 * effects on supported platforms. On macOS the window receives a vibrancy
 * effect using the `under-window` material. On Windows 11 22H2+ the
 * `acrylic` background material is applied. These effects require the
 * window to be transparent and frameless.
 */
function createWindow() {
  // Determine the current OS once when the window is created. We'll use
  // these flags both in the BrowserWindow options and after construction.
  const isMac = process.platform === "darwin";
  const isWin = process.platform === "win32";

  win = new BrowserWindow({
    width: PILL_W,
    height: 150,
    minWidth: PILL_W,
    minHeight: 150,
    useContentSize: false,
    frame: false,
    transparent: true,
    resizable: true,
    show: true,
    // Set the background color to fully transparent. Without this the OS
    // default window background may be visible through the vibrancy layer.
    backgroundColor: "#00000000",
    // On macOS we can pass vibrancy and visualEffectState up-front. This
    // ensures that the vibrancy is applied as soon as the window is shown.
    // Do not enable system vibrancy here; the renderer uses CSS backdrop-filter
    // for the frosted glass effect. The window remains transparent.
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // expose APIs to renderer
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allow local resources
      zoomFactor: 1.0, // Ensure no scaling
    },
  });

  // After the window is created, we can call the platform specific APIs to
  // fine‑tune the blur effect. The try/catch blocks guard against
  // unsupported Electron versions or OS builds.
  // We intentionally do not call setVibrancy or setBackgroundMaterial here.

  // Determine which URL to load based on whether we're in dev mode or
  // production. If running via `npm start` or `react-scripts`, the
  // environment variables VITE_DEV_SERVER_URL, ELECTRON_RENDERER_URL, or
  // ELECTRON_START_URL will point to the development server. Otherwise we
  // load the built index.html file from the packaged app.
  const devUrl =
    process.env.VITE_DEV_SERVER_URL ||
    process.env.ELECTRON_RENDERER_URL ||
    process.env.ELECTRON_START_URL;

  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, "index.html"));
  }
}

// Create the window when Electron is ready. Recreate it if all windows are
// closed and the app is activated (macOS behavior).
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // On macOS it is common for applications to stay open until the user quits
  if (process.platform !== "darwin") app.quit();
});

// Resize window when results/dashboard open/close
ipcMain.on("results-opened", (_evt, { height }) => {
  let width, windowHeight;
  if (height === RESULTS_H) {
    // Search results panel - make it larger to ensure everything fits
    width = 1020; // Increased to give extra buffer space
    windowHeight = 850; // Increased height to ensure no cutoff
  } else if (height === DASH_H) {
    // Dashboard view
    width = DASH_W;
    windowHeight = DASH_H;
  } else {
    // Fallback to pill size
    width = PILL_W;
    windowHeight = 150; // Enough height for search bar
  }
  console.log(`Setting window size to: ${width}x${windowHeight}`);
  win?.setSize(width, windowHeight);
  
  // Log actual size after setting
  setTimeout(() => {
    const actualSize = win?.getSize();
    console.log(`Actual window size: ${actualSize?.[0]}x${actualSize?.[1]}`);
  }, 100);
});
ipcMain.on("results-closed", () => {
  win?.setSize(PILL_W, 150); // Ensure enough height for search bar
});

// Helper to download the highest-quality audio stream for a given videoId
async function downloadAudioInfo(videoId) {
  const info = await ytdl.getInfo(videoId);
  const format = ytdl.chooseFormat(info.formats, {
    quality: "highestaudio",
    filter: "audioonly",
  });
  const ext =
    (format.container && `.${format.container}`) ||
    (format.mimeType?.includes("webm") ? ".webm" : ".m4a");
  const mime =
    format.mimeType || (ext === ".webm" ? "audio/webm" : "audio/mp4");
  return { info, format, ext, mime };
}

// Return raw bytes of the highest-quality audio stream (ytdl-core)
ipcMain.handle("download-audio-for-video", async (_evt, { videoId }) => {
  if (!videoId) throw new Error("Missing videoId");
  const { info, ext, mime } = await downloadAudioInfo(videoId);

  // Write to a temporary file first, then read back into memory
  const tmpPath = path.join(
    os.tmpdir(),
    `yt-audio-${videoId}-${Date.now()}${ext}`
  );
  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, {
      quality: "highestaudio",
      filter: "audioonly",
      highWaterMark: 1 << 25,
    });
    const out = fs.createWriteStream(tmpPath);
    stream.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
    stream.on("error", reject);
  });

  const buf = fs.readFileSync(tmpPath);
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    /* ignore temp cleanup errors */
  }
  // Slice the underlying buffer so that we return only the used portion
  const arrayBuffer = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  return { mime, data: arrayBuffer };
});

// Download audio and write it to the user's downloads folder. Returns the
// absolute file path and mime type. This is useful when further processing
// (such as stem splitting) needs a persistent file on disk.
ipcMain.handle("download-audio-to-file", async (_evt, { videoId }) => {
  if (!videoId) throw new Error("Missing videoId");
  const { info, ext, mime } = await downloadAudioInfo(videoId);
  const fileName = `yt-audio-${videoId}-${Date.now()}${ext}`;
  const filePath = path.join(app.getPath("downloads"), fileName);
  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, {
      quality: "highestaudio",
      filter: "audioonly",
      highWaterMark: 1 << 25,
    });
    const out = fs.createWriteStream(filePath);
    stream.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);
    stream.on("error", reject);
  });
  return { filePath, mime };
});
