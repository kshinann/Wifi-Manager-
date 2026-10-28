export type Role = "owner" | "admin" | "viewer";
export type Action = "allow" | "warn" | "block";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  event_retention_days: number;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string | null;
  email: string;
  name: string;
  role: Role;
  is_platform_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface Session {
  access_token: string;
  user: User;
  tenant: Tenant | null;
}

export interface ToolRule {
  tool: string;
  action: Action;
  daily_minutes: number | null;
}

export interface PolicyRules {
  default_action: Action;
  tool_rules: ToolRule[];
  daily_minutes_total: number | null;
  schedule: { days: number[]; start: string; end: string; outside_action: "warn" | "block" } | null;
  capture_prompts: boolean;
  prompt_retention_days: number;
  dlp: { enabled: boolean; detectors: string[]; keywords: string[]; action: "log" | "warn" | "block" };
  monitor_processes: boolean;
  monitor_network: boolean;
  enforce_processes: boolean;
  enforce_hosts_file: boolean;
  warn_message: string;
  block_message: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  rules: PolicyRules;
  version: number;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  policy_id: string | null;
  device_count: number;
}

export interface Tool {
  id: number;
  key: string;
  name: string;
  vendor: string;
  category: string;
  domains: string[];
  processes: Record<string, string[]>;
  builtin: boolean;
}

export interface Device {
  id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  os_user: string;
  group_id: string | null;
  status: string;
  enrolled_at: string;
  last_seen_at: string | null;
  policy_version: string;
}

export interface EnrollmentToken {
  id: string;
  label: string;
  group_id: string | null;
  token_prefix: string;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
  token?: string;
}

export interface UsageEvent {
  id: number;
  device_id: string;
  tool_key: string;
  source: string;
  event_type: string;
  action: string;
  reason: string;
  domain: string;
  url: string;
  process_name: string;
  os_user: string;
  occurred_at: string;
  duration_seconds: number;
  prompt_chars: number | null;
  prompt_text: string | null;
  dlp_hits: string[];
}

export interface Summary {
  days: number;
  totals: { events: number; minutes: number; blocked: number; warned: number; prompts: number; dlp_hits: number;
            active_devices: number };
  by_tool: { tool_key: string; events: number; minutes: number; blocked: number; devices: number }[];
  by_day: { date: string; events: number; minutes: number; blocked: number }[];
  by_source: { source: string; events: number; minutes: number }[];
  top_devices: { device_id: string; hostname: string; events: number; minutes: number; blocked: number }[];
  top_users: { os_user: string; events: number; minutes: number }[];
}

const TOKEN_KEY = "aiguard.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  }
  return fallback;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const resp = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (resp.status === 401 && token) {
    setToken(null);
    window.location.assign("/login");
  }
  if (resp.status === 204) return undefined as T;
  const body = await resp.json().catch(() => null);
  if (!resp.ok) throw new ApiError(resp.status, errorMessage(body, resp.statusText));
  return body as T;
}

export async function download(path: string, filename: string): Promise<void> {
  const resp = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
  const url = URL.createObjectURL(await resp.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function query(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
