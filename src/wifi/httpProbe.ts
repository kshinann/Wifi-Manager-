export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 700
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url: string, timeoutMs = 700): Promise<any> {
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}
