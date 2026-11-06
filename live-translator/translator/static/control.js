"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const token = new URLSearchParams(location.search).get("token") || "";
let config = null, languages = [], devices = { inputs: [], outputs: [] };

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(token ? { "X-Admin-Token": token } : {}) };
  const r = await fetch(path, { ...opts, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || r.statusText);
  return body;
}

const langOptions = (sel, withAuto) =>
  (withAuto ? `<option value="auto"${sel === "auto" ? " selected" : ""}>Auto-detect</option>` : "") +
  languages.map((l) => `<option value="${l.code}"${l.code === sel ? " selected" : ""}>${esc(l.name)}</option>`).join("");

const deviceOptions = (list, selected, multiple) =>
  (multiple ? "" : `<option value="">System default</option>`) +
  list.map((d) => {
    const on = multiple ? (selected || []).includes(d.index) : selected === d.index;
    return `<option value="${d.index}"${on ? " selected" : ""}>${esc(d.label)}</option>`;
  }).join("");

const rid = () => Math.random().toString(36).slice(2, 7);

function renderRoutes() {
  const box = $("routes");
  box.innerHTML = "";
  config.routes.forEach((r, ri) => {
    const div = document.createElement("div");
    div.className = "route";
    div.innerHTML = `
      <div class="row">
        <input data-k="name" value="${esc(r.name)}" style="flex:1;min-width:180px">
        <label class="row" style="margin:0"><input type="checkbox" data-k="enabled"${r.enabled ? " checked" : ""}> enabled</label>
        <div class="meter" title="input level"><div id="meter-${esc(r.id)}"></div></div>
        <span class="muted" id="stat-${esc(r.id)}"></span>
        <button class="danger" data-act="delRoute">Remove</button>
      </div>
      <div class="grid">
        <label>Input type
          <select data-k="itype">
            <option value="device"${r.input.type === "device" ? " selected" : ""}>Sound device (mic / VB-Cable / line-in)</option>
            <option value="browser"${r.input.type === "browser" ? " selected" : ""}>Browser or phone mic</option>
          </select></label>
        <label>Input device <select data-k="device"${r.input.type === "browser" ? " disabled" : ""}>${deviceOptions(devices.inputs, r.input.device, false)}</select></label>
        <label>Speaker language <select data-k="source_lang">${langOptions(r.source_lang, true)}</select></label>
      </div>
      ${r.input.type === "browser" ? `<div class="links muted">Speaker opens: <a target="_blank" href="/speak/${encodeURIComponent(r.id)}${token ? "?token=" + encodeURIComponent(token) : ""}">/speak/${esc(r.id)}</a></div>` : ""}
      <div data-channels></div>
      <button data-act="addChannel">+ Add language channel</button>`;
    div.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("change", () => {
      const k = el.dataset.k;
      if (k === "name") r.name = el.value;
      else if (k === "enabled") r.enabled = el.checked;
      else if (k === "itype") { r.input.type = el.value; renderRoutes(); }
      else if (k === "device") r.input.device = el.value === "" ? null : Number(el.value);
      else if (k === "source_lang") r.source_lang = el.value;
    }));
    div.querySelector('[data-act="delRoute"]').onclick = () => { config.routes.splice(ri, 1); renderRoutes(); };
    div.querySelector('[data-act="addChannel"]').onclick = () => {
      r.channels.push({ id: `${r.id}-${rid()}`, target_lang: "zh", voice: "", speak: true, web: true, outputs: [] });
      renderRoutes();
    };
    const chBox = div.querySelector("[data-channels]");
    r.channels.forEach((c, ci) => {
      const cd = document.createElement("div");
      cd.className = "channel";
      const room = `/room/${encodeURIComponent(c.id)}`;
      cd.innerHTML = `
        <div class="grid">
          <label>Translate into <select data-c="target_lang">${langOptions(c.target_lang, false)}</select></label>
          <label>Voice (blank = default for language) <input data-c="voice" value="${esc(c.voice)}" placeholder="${esc((languages.find((l) => l.code === c.target_lang) || {}).voice || "")}"></label>
          <label>Speak out of (Ctrl+click for several)
            <select data-c="outputs" multiple>${deviceOptions(devices.outputs, c.outputs, true)}</select></label>
        </div>
        <div class="row">
          <label class="row" style="margin:0"><input type="checkbox" data-c="speak"${c.speak ? " checked" : ""}> spoken audio</label>
          <label class="row" style="margin:0"><input type="checkbox" data-c="web"${c.web ? " checked" : ""}> web room</label>
          <button data-act="test">Test</button>
          <button class="danger" data-act="del">Remove</button>
          <span class="links"><a target="_blank" href="${room}">Listener room</a><a target="_blank" href="/overlay/${encodeURIComponent(c.id)}">Caption overlay</a><a href="/api/transcript/${encodeURIComponent(c.id)}">Transcript</a></span>
          <span class="muted" data-msg></span>
        </div>`;
      cd.querySelectorAll("[data-c]").forEach((el) => el.addEventListener("change", () => {
        const k = el.dataset.c;
        if (k === "outputs") c.outputs = [...el.selectedOptions].map((o) => Number(o.value));
        else if (el.type === "checkbox") c[k] = el.checked;
        else c[k] = el.value;
        if (k === "target_lang") renderRoutes();
      }));
      cd.querySelector('[data-act="del"]').onclick = () => { r.channels.splice(ci, 1); renderRoutes(); };
      cd.querySelector('[data-act="test"]').onclick = async () => {
        const msg = cd.querySelector("[data-msg]");
        msg.textContent = "testing…";
        try { const res = await api("/api/test", { method: "POST", body: JSON.stringify({ channel: c.id }) }); msg.textContent = "→ " + res.translation; }
        catch (e) { msg.textContent = e.message; }
      };
      chBox.appendChild(cd);
    });
    box.appendChild(div);
  });
}

const settingFields = {
  eng_asr: ["engines", "asr"], eng_translate: ["engines", "translate"], eng_tts: ["engines", "tts"],
  local_device: ["local", "device"], local_whisper_model: ["local", "whisper_model"], local_nllb_model: ["local", "nllb_model"],
  cloud_claude_model: ["cloud", "claude_model"], cloud_claude_effort: ["cloud", "claude_effort"],
  cloud_openai_asr_model: ["cloud", "openai_asr_model"], cloud_openai_translate_model: ["cloud", "openai_translate_model"],
  cloud_openai_tts_model: ["cloud", "openai_tts_model"], cloud_openai_tts_voice: ["cloud", "openai_tts_voice"],
  key_openai: ["api_keys", "openai"], key_anthropic: ["api_keys", "anthropic"],
  vad_silence_ms: ["vad", "silence_ms"], vad_max_segment_s: ["vad", "max_segment_s"], vad_min_rms: ["vad", "min_rms"],
};

function fillSettings() {
  for (const [id, [a, b]] of Object.entries(settingFields)) $(id).value = config[a][b] ?? "";
  $("glossary").value = config.glossary || "";
  $("admin_token").value = config.admin_token || "";
}

async function saveSettings() {
  const out = { glossary: $("glossary").value, admin_token: $("admin_token").value };
  for (const [id, [a, b]] of Object.entries(settingFields)) {
    out[a] = out[a] || {};
    const el = $(id);
    out[a][b] = el.type === "number" ? Number(el.value) : el.value;
  }
  try {
    const res = await api("/api/config", { method: "PUT", body: JSON.stringify(out) });
    config = res.config; fillSettings();
    $("settingsMsg").textContent = res.restart_needed ? "Saved. Press Stop then Start to apply." : "Saved.";
  } catch (e) { $("settingsMsg").textContent = e.message; }
}

async function saveRoutes() {
  try {
    const res = await api("/api/config", { method: "PUT", body: JSON.stringify({ routes: config.routes }) });
    config = res.config; renderRoutes();
    $("saveMsg").textContent = res.restart_needed ? "Saved. Press Stop then Start to apply." : "Saved.";
  } catch (e) { $("saveMsg").textContent = e.message; }
}

async function loadDevices() {
  devices = await api("/api/devices");
  if (devices.error) $("saveMsg").textContent = devices.error;
}

async function poll() {
  try {
    const s = await api("/api/status");
    $("state").textContent = s.state + (s.error ? `: ${s.error}` : "");
    $("state").className = "pill " + s.state;
    $("hw").textContent = s.hardware.gpu ? `GPU: ${s.hardware.gpu_name}` : "No NVIDIA GPU detected — built-in models run on CPU";
    $("engineLabels").textContent = s.engines ? `Using: ${s.engines.asr} · ${s.engines.translate} · ${s.engines.tts}` : "";
    $("lan").innerHTML = s.lan_urls.length ? `Listeners on the same Wi-Fi open: ${s.lan_urls.map((u) => `<a href="${u}/rooms" target="_blank">${u}/rooms</a>`).join(" ")}` : "";
    $("log").textContent = s.logs.join("\n");
    for (const [id, st] of Object.entries(s.routes)) {
      const m = document.getElementById(`meter-${id}`);
      if (m) m.style.width = Math.min(100, st.level * 1000) + "%";
      const t = document.getElementById(`stat-${id}`);
      if (t) t.textContent = `${st.utterances} lines · delay ${st.last_latency_s ?? "–"} s`;
    }
  } catch (e) { $("state").textContent = e.message; }
}

function connectFeed() {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/control${token ? "?token=" + encodeURIComponent(token) : ""}`);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type !== "caption") return;
    const d = document.createElement("div");
    d.innerHTML = `<div class="src">[${esc(m.source_lang)}] ${esc(m.source)}</div><div>[${esc(m.lang)}] ${esc(m.text)}</div>`;
    const feed = $("feed");
    feed.prepend(d);
    while (feed.children.length > 100) feed.lastChild.remove();
  };
  ws.onclose = () => setTimeout(connectFeed, 2000);
}

$("startBtn").onclick = async () => { await api("/api/start", { method: "POST" }); poll(); };
$("stopBtn").onclick = async () => { await api("/api/stop", { method: "POST" }); poll(); };
$("addRoute").onclick = () => {
  const id = "r" + rid();
  config.routes.push({ id, name: "New route", enabled: true, input: { type: "device", device: null }, source_lang: "en",
    channels: [{ id: `${id}-zh`, target_lang: "zh", voice: "", speak: true, web: true, outputs: [] }] });
  renderRoutes();
};
$("refreshDevices").onclick = async () => { await loadDevices(); renderRoutes(); };
$("saveRoutes").onclick = saveRoutes;
$("saveSettings").onclick = saveSettings;

(async () => {
  try {
    const c = await api("/api/config");
    config = c.config; languages = c.languages;
    await loadDevices();
    fillSettings(); renderRoutes(); connectFeed(); poll();
    setInterval(poll, 1000);
  } catch (e) {
    document.querySelector("main").innerHTML = `<section>${esc(e.message)}</section>`;
  }
})();
