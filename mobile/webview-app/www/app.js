const VIDEO_FORMATS = ["mp4", "webm", "mkv", "mov"];
const AUDIO_FORMATS = ["mp3", "m4a", "wav", "aac", "opus", "flac"];
const URL_PATTERN = /^https?:\/\//i;

// Inside the Android app, the backend runs in-process on 127.0.0.1 instead
// of a real server (see mobile/README.md) — everything else is identical.
const IS_EMBEDDED_APP = typeof window.Capacitor !== "undefined";
const API_BASE = IS_EMBEDDED_APP ? "http://127.0.0.1:8765" : "";

const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const statusEl = document.getElementById("status");
const resultsGrid = document.getElementById("results-grid");

const playerSection = document.getElementById("player-section");
const playerFrame = document.getElementById("player-frame");

const resultEl = document.getElementById("result");
const thumbnailEl = document.getElementById("thumbnail");
const titleEl = document.getElementById("title");
const uploaderEl = document.getElementById("uploader");
const durationEl = document.getElementById("duration");

const formatSelect = document.getElementById("format-select");
const resolutionSelect = document.getElementById("resolution-select");
const resolutionLabel = document.getElementById("resolution-label");
const downloadBtn = document.getElementById("download-btn");
const downloadStatusEl = document.getElementById("download-status");

let currentUrl = "";
let availableHeights = [];

function setStatus(el, message, isError = false) {
  if (!message) {
    el.hidden = true;
    return;
  }
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle("error", isError);
}

function formatDuration(seconds) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = h ? [h, m, s] : [m, s];
  return parts.map((p, i) => (i === 0 ? p : String(p).padStart(2, "0"))).join(":");
}

function youtubeIdFromUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    return null;
  }
  return null;
}

function showPlayerFor(url) {
  const videoId = youtubeIdFromUrl(url);
  if (!videoId) {
    playerSection.hidden = true;
    playerFrame.src = "";
    return;
  }
  playerFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  playerSection.hidden = false;
}

function populateFormatOptions() {
  formatSelect.innerHTML = "";
  const group = (label, values) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = label;
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v.toUpperCase();
      optgroup.appendChild(opt);
    }
    formatSelect.appendChild(optgroup);
  };
  group("Video", VIDEO_FORMATS);
  group("Audio only", AUDIO_FORMATS);
}

function populateResolutionOptions(heights) {
  resolutionSelect.innerHTML = "";
  const best = document.createElement("option");
  best.value = "";
  best.textContent = "Best available";
  resolutionSelect.appendChild(best);
  for (const h of heights) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = `${h}p`;
    resolutionSelect.appendChild(opt);
  }
}

function updateResolutionVisibility() {
  const isAudio = AUDIO_FORMATS.includes(formatSelect.value);
  resolutionLabel.hidden = isAudio;
}

async function loadVideo(url) {
  currentUrl = url;
  resultEl.hidden = true;
  setStatus(statusEl, "Fetching video info...");
  showPlayerFor(url);

  try {
    const res = await fetch(`${API_BASE}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Failed to fetch video info");
    }

    titleEl.textContent = data.title || "Untitled";
    uploaderEl.textContent = data.uploader ? `by ${data.uploader}` : "";
    durationEl.textContent = formatDuration(data.duration);
    thumbnailEl.src = data.thumbnail || "";

    availableHeights = [
      ...new Set(
        (data.formats || [])
          .filter((f) => f.has_video && f.height)
          .map((f) => f.height)
      ),
    ].sort((a, b) => b - a);

    populateFormatOptions();
    populateResolutionOptions(availableHeights);
    updateResolutionVisibility();

    setStatus(statusEl, "");
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    setStatus(statusEl, err.message, true);
  }
}

function renderResults(results) {
  resultsGrid.innerHTML = "";
  if (!results.length) {
    resultsGrid.hidden = true;
    return;
  }

  for (const r of results) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "result-card";
    card.innerHTML = `
      <img src="${r.thumbnail || ""}" alt="" loading="lazy" />
      <div class="card-body">
        <div class="card-title"></div>
        <p class="card-meta"></p>
      </div>
    `;
    card.querySelector(".card-title").textContent = r.title || "Untitled";
    const meta = [r.uploader, r.duration ? formatDuration(r.duration) : null]
      .filter(Boolean)
      .join(" · ");
    card.querySelector(".card-meta").textContent = meta;
    card.addEventListener("click", () => loadVideo(r.url));
    resultsGrid.appendChild(card);
  }

  resultsGrid.hidden = false;
}

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  resultsGrid.hidden = true;
  playerSection.hidden = true;
  resultEl.hidden = true;

  if (URL_PATTERN.test(query)) {
    await loadVideo(query);
    searchBtn.disabled = false;
    return;
  }

  setStatus(statusEl, "Searching...");
  try {
    const res = await fetch(`${API_BASE}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Search failed");
    }
    setStatus(statusEl, "");
    renderResults(data.results || []);
  } catch (err) {
    setStatus(statusEl, err.message, true);
  } finally {
    searchBtn.disabled = false;
  }
});

formatSelect.addEventListener("change", updateResolutionVisibility);

downloadBtn.addEventListener("click", async () => {
  const format = formatSelect.value;
  const height = resolutionSelect.value ? Number(resolutionSelect.value) : null;

  downloadBtn.disabled = true;
  setStatus(downloadStatusEl, "Preparing download... this can take a while for large videos.");

  try {
    const res = await fetch(`${API_BASE}/api/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl, format, height }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Download failed");
    }

    if (IS_EMBEDDED_APP) {
      // The embedded server saves straight into the device's Downloads
      // folder and reports back the filename, rather than streaming bytes
      // for the page to save (blob: downloads aren't reliable in a WebView).
      const data = await res.json();
      setStatus(downloadStatusEl, `Saved to Downloads as ${data.saved_as}`);
      return;
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `download.${format}`;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);

    setStatus(downloadStatusEl, "Download complete.");
  } catch (err) {
    setStatus(downloadStatusEl, err.message, true);
  } finally {
    downloadBtn.disabled = false;
  }
});
