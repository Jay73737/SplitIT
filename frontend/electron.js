
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ytdl = require("ytdl-core");

let win;

const PILL_W = 800;
const PILL_H = 65;
const RESULTS_W = 960;
const RESULTS_H = 438;
const DASH_W = 1900;
const DASH_H = 1200;
const GAP = 24;

function createWindow() {
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
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      zoomFactor: 1.0,
    },
  });


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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("results-opened", (_evt, { height }) => {
  let width, windowHeight;
  if (height === RESULTS_H) {
    width = 1020; // Increased to give extra buffer space
    windowHeight = 850;
  } else if (height === DASH_H) {
    width = DASH_W;
    windowHeight = DASH_H;
  } else {
    width = PILL_W;
    windowHeight = 150;
  }
  console.log(`Setting window size to: ${width}x${windowHeight}`);
  win?.setSize(width, windowHeight);
  setTimeout(() => {
    const actualSize = win?.getSize();
    console.log(`Actual window size: ${actualSize?.[0]}x${actualSize?.[1]}`);
  }, 100);
});
ipcMain.on("results-closed", () => {
  win?.setSize(PILL_W, 150);
});

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

ipcMain.handle("download-audio-for-video", async (_evt, { videoId }) => {
  if (!videoId) throw new Error("Missing videoId");
  const { info, ext, mime } = await downloadAudioInfo(videoId);

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
  const arrayBuffer = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  );
  return { mime, data: arrayBuffer };
});

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
