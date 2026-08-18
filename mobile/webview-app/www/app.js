const STORAGE_KEY = "video-downloader.server-url";

const setupScreen = document.getElementById("setup-screen");
const appScreen = document.getElementById("app-screen");
const serverUrlInput = document.getElementById("server-url");
const connectBtn = document.getElementById("connect-btn");
const setupError = document.getElementById("setup-error");
const serverLabel = document.getElementById("server-label");
const changeServerBtn = document.getElementById("change-server-btn");
const appFrame = document.getElementById("app-frame");

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, "");
}

function showApp(url) {
  serverLabel.textContent = url;
  appFrame.src = url;
  setupScreen.hidden = true;
  appScreen.hidden = false;
}

function showSetup(prefill) {
  serverUrlInput.value = prefill || "";
  setupError.hidden = true;
  appScreen.hidden = true;
  setupScreen.hidden = false;
}

connectBtn.addEventListener("click", () => {
  const raw = serverUrlInput.value;
  if (!raw.trim()) return;

  const url = normalizeUrl(raw);
  localStorage.setItem(STORAGE_KEY, url);
  setupError.hidden = true;
  showApp(url);
});

changeServerBtn.addEventListener("click", () => {
  showSetup(localStorage.getItem(STORAGE_KEY));
});

const savedUrl = localStorage.getItem(STORAGE_KEY);
if (savedUrl) {
  showApp(savedUrl);
} else {
  showSetup();
}
