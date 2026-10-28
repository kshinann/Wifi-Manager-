// AI Guard extension service worker.
// Detects AI tool tabs, reports activity to the local desktop agent and applies its decisions.
const AGENT = "http://127.0.0.1:47615";
const ACTIVITY_PERIOD_SECONDS = 30;
const WARN_ACK_MINUTES = 30;
const CONTENT_SCRIPT_ID = "aiguard-content";

let state = { tools: [], decisions: {}, status: null, policy: null, agentOnline: false };

async function agent(path, body) {
  const headers = { "X-AIGuard-Client": "extension" };
  const init = body === undefined ? { headers } : {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const resp = await fetch(AGENT + path, init);
  if (!resp.ok) throw new Error(`agent ${path}: ${resp.status}`);
  return resp.json();
}

function matchTool(url) {
  let host;
  try {
    const u = new URL(url);
    if (!u.protocol.startsWith("http")) return null;
    host = u.hostname.toLowerCase();
  } catch {
    return null;
  }
  let best = null;
  for (const tool of state.tools) {
    for (const d of tool.domains || []) {
      if ((host === d || host.endsWith("." + d)) && (!best || d.length > best.domain.length)) {
        best = { key: tool.key, name: tool.name, domain: d, host };
      }
    }
  }
  return best;
}

function pageUrl(page, params) {
  return chrome.runtime.getURL(page) + "?" + new URLSearchParams(params).toString();
}

// --- policy sync ------------------------------------------------------------

async function refresh() {
  try {
    const data = await agent("/v1/policy");
    state = { tools: data.tools || [], decisions: data.decisions || {}, status: data.status, policy: data.policy,
              agentOnline: true };
  } catch (e) {
    // Fail open: keep the last known tools but drop blocking rules we can no longer justify.
    state = { ...state, decisions: {}, agentOnline: false };
  }
  await chrome.storage.session.set({ aiguardState: state });
  await syncBlockRules();
  await syncContentScript();
  chrome.action.setBadgeText({ text: state.agentOnline ? "" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#b42318" });
}

// Redirect blocked tools before the page loads.
async function syncBlockRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = [];
  let id = 1;
  for (const tool of state.tools) {
    const decision = state.decisions[tool.key];
    if (!decision || decision.action !== "block") continue;
    for (const domain of tool.domains || []) {
      addRules.push({
        id: id++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: pageUrl("blocked.html", { tool: tool.name, key: tool.key, domain, reason: decision.reason, message: decision.message }) },
        },
        condition: { requestDomains: [domain], resourceTypes: ["main_frame"] },
      });
    }
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules,
  });
}

// Inject the prompt monitor into every catalog domain, including tenant-defined tools.
async function syncContentScript() {
  const matches = [...new Set(state.tools.flatMap((t) => (t.domains || []).flatMap((d) => [`*://${d}/*`, `*://*.${d}/*`])))];
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (!matches.length) {
    if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    return;
  }
  const script = { id: CONTENT_SCRIPT_ID, matches, js: ["content.js"], runAt: "document_idle", allFrames: false };
  const current = registered[0];
  if (current && JSON.stringify([...current.matches].sort()) === JSON.stringify([...matches].sort())) return;
  if (current) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}

// --- navigation & activity ----------------------------------------------------

async function warnAcknowledged(toolKey) {
  const { warnAcks = {} } = await chrome.storage.session.get("warnAcks");
  return (warnAcks[toolKey] || 0) > Date.now();
}

async function handleDecision(tabId, url, tool, decision) {
  if (decision.action === "block") {
    // logged=1: the visit was already recorded by /v1/visit or /v1/activity.
    chrome.tabs.update(tabId, { url: pageUrl("blocked.html", { tool: tool.name, logged: "1", reason: decision.reason, message: decision.message }) });
  } else if (decision.action === "warn" && !(await warnAcknowledged(tool.key))) {
    chrome.tabs.update(tabId, {
      url: pageUrl("warn.html", { tool: tool.name, key: tool.key, reason: decision.reason, message: decision.message, target: url }),
    });
  }
}

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  const tool = matchTool(details.url);
  if (!tool) return;
  try {
    const decision = await agent("/v1/visit", { tool_key: tool.key, domain: tool.host, url: details.url });
    await handleDecision(details.tabId, details.url, tool, decision);
  } catch {
    // Agent unavailable: fail open.
  }
});

async function reportActivity() {
  if ((await chrome.idle.queryState(60)) !== "active") return;
  const win = await chrome.windows.getLastFocused({ populate: true }).catch(() => null);
  if (!win || !win.focused) return;
  const tab = (win.tabs || []).find((t) => t.active);
  const tool = tab && matchTool(tab.url);
  if (!tool) return;
  try {
    const decision = await agent("/v1/activity", {
      tool_key: tool.key, seconds: ACTIVITY_PERIOD_SECONDS, domain: tool.host, url: tab.url,
    });
    if (decision.action === "block") {
      await handleDecision(tab.id, tab.url, tool, decision);
      await refresh();
    }
  } catch {
    /* agent offline */
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refresh") await refresh();
  if (alarm.name === "activity") await reportActivity();
});

function setup() {
  chrome.alarms.create("refresh", { periodInMinutes: 1 });
  chrome.alarms.create("activity", { periodInMinutes: ACTIVITY_PERIOD_SECONDS / 60 });
  refresh();
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);

// The service worker is restarted often; restore the last state immediately, then refresh.
chrome.storage.session.get("aiguardState").then(({ aiguardState }) => {
  if (aiguardState && !state.tools.length) state = aiguardState;
  refresh();
});

// --- messages from content script, warn page and popup -------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "config") {
      const tool = sender.tab && matchTool(sender.tab.url);
      const s = state.status || {};
      sendResponse({ tool, agentOnline: state.agentOnline, capturePrompts: !!s.capture_prompts,
                     dlpEnabled: !!s.dlp_enabled, tenant: s.tenant || "" });
    } else if (msg.type === "prompt") {
      const tool = sender.tab && matchTool(sender.tab.url);
      if (!tool) return sendResponse({ action: "allow" });
      try {
        const s = state.status || {};
        const needsText = s.capture_prompts || s.dlp_enabled;
        sendResponse(await agent("/v1/prompt", {
          tool_key: tool.key, domain: tool.host, url: sender.tab.url,
          ...(needsText ? { text: msg.text } : { chars: msg.text.length }),
        }));
      } catch {
        sendResponse({ action: "allow", offline: true });
      }
    } else if (msg.type === "blockedVisit") {
      // A redirect rule stopped the page before it loaded; record the attempt.
      await agent("/v1/visit", { tool_key: msg.key, domain: msg.domain || "" }).catch(() => {});
      sendResponse({ ok: true });
    } else if (msg.type === "ackWarning") {
      const { warnAcks = {} } = await chrome.storage.session.get("warnAcks");
      warnAcks[msg.key] = Date.now() + WARN_ACK_MINUTES * 60 * 1000;
      await chrome.storage.session.set({ warnAcks });
      sendResponse({ ok: true });
    } else if (msg.type === "status") {
      await refresh();
      sendResponse(state);
    }
  })();
  return true; // keep the channel open for the async response
});
