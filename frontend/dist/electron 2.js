var $jtGlC$path = require("path");
var $jtGlC$fs = require("fs");


var $5a4cc231698613ea$var$$parcel$__dirname = $jtGlC$path.resolve(__dirname, "../src");
var $66ecfa474fe3b270$exports = {};

var $66ecfa474fe3b270$var$$parcel$__dirname = $jtGlC$path.resolve(__dirname, "../node_modules/electron");


const $66ecfa474fe3b270$var$pathFile = $jtGlC$path.join($66ecfa474fe3b270$var$$parcel$__dirname, 'path.txt');
function $66ecfa474fe3b270$var$getElectronPath() {
    let executablePath;
    if ($jtGlC$fs.existsSync($66ecfa474fe3b270$var$pathFile)) executablePath = $jtGlC$fs.readFileSync($66ecfa474fe3b270$var$pathFile, 'utf-8');
    if (process.env.ELECTRON_OVERRIDE_DIST_PATH) return $jtGlC$path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, executablePath || 'electron');
    if (executablePath) return $jtGlC$path.join($66ecfa474fe3b270$var$$parcel$__dirname, 'dist', executablePath);
    else throw new Error('Electron failed to install correctly, please delete node_modules/electron and try installing again');
}
$66ecfa474fe3b270$exports = $66ecfa474fe3b270$var$getElectronPath();


var $5a4cc231698613ea$require$app = $66ecfa474fe3b270$exports.app;
var $5a4cc231698613ea$require$BrowserWindow = $66ecfa474fe3b270$exports.BrowserWindow;

function $5a4cc231698613ea$var$createWindow() {
    const win = new $5a4cc231698613ea$require$BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: $jtGlC$path.join($5a4cc231698613ea$var$$parcel$__dirname, 'preload.js')
        }
    });
    win.loadFile('dist/index.html');
}
$5a4cc231698613ea$require$app.whenReady().then(()=>{
    $5a4cc231698613ea$var$createWindow();
    $5a4cc231698613ea$require$app.on('activate', ()=>{
        if ($5a4cc231698613ea$require$BrowserWindow.getAllWindows().length === 0) $5a4cc231698613ea$var$createWindow();
    });
});
$5a4cc231698613ea$require$app.on('window-all-closed', ()=>{
    if (process.platform !== 'darwin') $5a4cc231698613ea$require$app.quit();
});


//# sourceMappingURL=electron.js.map
