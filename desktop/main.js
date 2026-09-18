const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 8756;
let backendProcess = null;
let mainWindow = null;

function backendExecutablePath() {
  const exeName =
    process.platform === "win32" ? "utube-download-backend.exe" : "utube-download-backend";
  if (app.isPackaged) {
    // Copied in by electron-builder's `extraResources` config (package.json).
    return path.join(process.resourcesPath, "backend", exeName);
  }
  // Dev mode: expects `pyinstaller desktop/backend.spec` to have been run
  // already, producing desktop/dist/<exeName>.
  return path.join(__dirname, "dist", exeName);
}

function startBackend() {
  backendProcess = spawn(backendExecutablePath(), [String(PORT)], { stdio: "ignore" });
  backendProcess.on("error", (err) => {
    console.error("Failed to start backend:", err);
  });
}

function waitForBackend(callback, attemptsLeft = 60) {
  const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
    res.resume();
    callback();
  });
  req.on("error", () => {
    if (attemptsLeft <= 0) {
      callback(new Error("Backend did not start in time"));
      return;
    }
    setTimeout(() => waitForBackend(callback, attemptsLeft - 1), 500);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    title: "UTube Download",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}

app.whenReady().then(() => {
  startBackend();
  waitForBackend((err) => {
    if (err) console.error(err);
    createWindow();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});
