// AI Guard prompt monitor. Injected only on AI tool domains from the catalog.
// Intercepts prompt submission so the agent can run DLP checks (and capture the prompt when the
// organization's policy enables it) before the text reaches the AI service.
(() => {
  if (window.__aiguardLoaded) return;
  window.__aiguardLoaded = true;

  const SITES = [
    { host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, input: "#prompt-textarea, textarea",
      send: 'button[data-testid="send-button"], button[aria-label*="Send" i]' },
    { host: /(^|\.)claude\.ai$/, input: 'div[contenteditable="true"], textarea',
      send: 'button[aria-label*="Send" i]' },
    { host: /(^|\.)gemini\.google\.com$/, input: 'rich-textarea div[contenteditable="true"], textarea',
      send: 'button[aria-label*="Send" i], button.send-button' },
    { host: /(^|\.)copilot\.microsoft\.com$/, input: "textarea", send: 'button[aria-label*="Submit" i], button[aria-label*="Send" i]' },
  ];
  const FALLBACK = { input: 'textarea, div[contenteditable="true"]',
                     send: 'button[aria-label*="Send" i], button[data-testid*="send" i], button[type="submit"]' };
  const site = SITES.find((s) => s.host.test(location.hostname)) || FALLBACK;

  let config = null;
  let bypass = false;
  let pending = false;

  function promptText(target) {
    const el = (target && target.closest && target.closest(site.input)) || document.querySelector(site.input);
    if (!el) return "";
    return (el.value !== undefined ? el.value : el.innerText || "").trim();
  }

  function sendButton() {
    return document.querySelector(site.send);
  }

  function toast(text, kind) {
    const box = document.createElement("div");
    box.textContent = text;
    box.setAttribute("role", "alert");
    Object.assign(box.style, {
      position: "fixed", zIndex: 2147483647, left: "50%", bottom: "24px", transform: "translateX(-50%)",
      maxWidth: "560px", padding: "12px 16px", borderRadius: "8px", font: "14px/1.4 system-ui, sans-serif",
      color: "#fff", background: kind === "block" ? "#b42318" : "#b54708", boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    });
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 8000);
  }

  function notice() {
    if (!config || !(config.capturePrompts || config.dlpEnabled)) return;
    const bar = document.createElement("div");
    const who = config.tenant || "your organization";
    bar.textContent = config.capturePrompts
      ? `Prompts on this site are recorded by ${who} under its AI usage policy.`
      : `Prompts on this site are checked for sensitive data by ${who}.`;
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Dismiss");
    Object.assign(close.style, { marginLeft: "12px", background: "none", border: 0, color: "inherit", cursor: "pointer",
                                 fontSize: "16px" });
    close.onclick = () => bar.remove();
    bar.appendChild(close);
    Object.assign(bar.style, {
      position: "fixed", zIndex: 2147483646, top: 0, left: 0, right: 0, padding: "6px 12px", textAlign: "center",
      font: "12px/1.4 system-ui, sans-serif", background: "#1d2939", color: "#fff",
    });
    document.documentElement.appendChild(bar);
  }

  async function check(text) {
    try {
      return await chrome.runtime.sendMessage({ type: "prompt", text });
    } catch {
      return { action: "allow" };
    }
  }

  function resubmit(originalTarget) {
    bypass = true;
    try {
      const btn = sendButton();
      if (btn && !btn.disabled) {
        btn.click();
      } else if (originalTarget) {
        originalTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13,
                                                                   which: 13, bubbles: true, cancelable: true }));
      }
    } finally {
      setTimeout(() => { bypass = false; }, 0);
    }
  }

  // Gate the submission: hold it, ask the agent, then let it through or keep it blocked.
  async function gate(event, target) {
    const text = promptText(target);
    if (!text) return;
    const mustWait = config && (config.capturePrompts || config.dlpEnabled);
    if (!mustWait) {
      check(text); // record prompt size only, never delay the user
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending) return;
    pending = true;
    try {
      const result = await check(text);
      if (result.action === "block") {
        toast(result.message || "This prompt was blocked by your organization's AI policy.", "block");
        return;
      }
      if (result.action === "warn" && !window.confirm(`${result.message}\n\nSend anyway?`)) return;
      resubmit(target);
    } finally {
      pending = false;
    }
  }

  document.addEventListener("keydown", (e) => {
    if (bypass || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    if (!e.target.closest || !e.target.closest(site.input)) return;
    gate(e, e.target);
  }, true);

  document.addEventListener("click", (e) => {
    if (bypass) return;
    const btn = e.target.closest && e.target.closest(site.send);
    if (btn) gate(e, null);
  }, true);

  chrome.runtime.sendMessage({ type: "config" }).then((c) => {
    config = c;
    notice();
  }).catch(() => {});
})();
