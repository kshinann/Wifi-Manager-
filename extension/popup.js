const fmt = (s) => `${Math.round((s || 0) / 60)} min`;

chrome.runtime.sendMessage({ type: "status" }).then((state) => {
  const el = document.getElementById("state");
  const dl = document.getElementById("details");
  if (!state.agentOnline) {
    el.textContent = "Desktop agent is not running. AI usage is not being enforced.";
    el.className = "danger";
    return;
  }
  const s = state.status || {};
  el.textContent = s.tenant ? `Managed by ${s.tenant}` : "Agent connected";
  const rows = [
    ["Prompt recording", s.capture_prompts ? "On" : "Off"],
    ["Sensitive data checks", s.dlp_enabled ? "On" : "Off"],
  ];
  for (const tool of state.tools || []) {
    const d = (state.decisions || {})[tool.key];
    if (d && d.action !== "allow") rows.push([tool.name, d.action === "block" ? "Blocked" : "Warn"]);
  }
  for (const [k, v] of rows) {
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    dl.append(dt, dd);
  }
});
