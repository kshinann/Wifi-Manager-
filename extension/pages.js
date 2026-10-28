// Shared script for blocked.html and warn.html.
const params = new URLSearchParams(location.search);
const tool = params.get("tool") || "This AI tool";
const isWarn = location.pathname.endsWith("warn.html");
document.getElementById("title").textContent = isWarn ? `${tool}: use with care` : `${tool} is blocked`;
document.getElementById("message").textContent = params.get("message") || "";
const reason = params.get("reason");
document.getElementById("reason").textContent = reason ? `Reason: ${reason}` : "";

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 2) history.go(-2);
  else location.href = "about:blank";
});

const cont = document.getElementById("continue");
if (cont) {
  cont.addEventListener("click", async () => {
    const target = params.get("target") || "";
    if (!/^https?:\/\//i.test(target)) return;
    await chrome.runtime.sendMessage({ type: "ackWarning", key: params.get("key") });
    location.replace(target);
  });
}

if (!isWarn && params.get("key") && !params.get("logged")) {
  chrome.runtime.sendMessage({ type: "blockedVisit", key: params.get("key"), domain: params.get("domain") });
}
