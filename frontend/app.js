const VIDEO_FORMATS = ["mp4", "webm", "mkv", "mov"];
const AUDIO_FORMATS = ["mp3", "m4a", "wav", "aac", "opus", "flac"];

const infoForm = document.getElementById("info-form");
const urlInput = document.getElementById("url-input");
const fetchBtn = document.getElementById("fetch-btn");
const statusEl = document.getElementById("status");
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

infoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  currentUrl = url;
  resultEl.hidden = true;
  setStatus(statusEl, "Fetching video info...");
  fetchBtn.disabled = true;

  try {
    const res = await fetch("/api/info", {
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
  } catch (err) {
    setStatus(statusEl, err.message, true);
  } finally {
    fetchBtn.disabled = false;
  }
});

formatSelect.addEventListener("change", updateResolutionVisibility);

downloadBtn.addEventListener("click", async () => {
  const format = formatSelect.value;
  const height = resolutionSelect.value ? Number(resolutionSelect.value) : null;

  downloadBtn.disabled = true;
  setStatus(downloadStatusEl, "Preparing download... this can take a while for large videos.");

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl, format, height }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Download failed");
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
