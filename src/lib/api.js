// Frontend API client for Render backend + Postgres.
// If VITE_API_URL is not set, all functions no-op (local BroadcastChannel mode keeps working).
// Set in .env or Render env: VITE_API_URL=https://your-api.onrender.com

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiEnabled() {
  return Boolean(BASE);
}

export function apiBase() {
  return BASE;
}

function token() {
  try {
    return sessionStorage.getItem("admin_token") || "";
  } catch {
    return "";
  }
}

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { "x-admin-token": token() } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `API ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

// --- admin auth ---
export async function apiLogin(username, password) {
  return req("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// --- visitors (public register/heartbeat + admin list) ---
export async function apiRegisterVisitor(v) {
  return req("/api/visitors", { method: "POST", body: JSON.stringify(v) });
}

export async function apiHeartbeat(id, patch) {
  return req(`/api/visitors/${id}/heartbeat`, { method: "POST", body: JSON.stringify(patch || {}) });
}

export async function apiGetVisitors() {
  return req("/api/admin/visitors");
}

export async function apiGetCommand(visitorId) {
  return req(`/api/visitors/${visitorId}/command`);
}

export async function apiSendCommand(visitorId, command) {
  return req(`/api/admin/commands`, { method: "POST", body: JSON.stringify({ visitorId, command }) });
}

// --- submissions ---
export async function apiSubmit(entry) {
  return req("/api/submissions", { method: "POST", body: JSON.stringify(entry) });
}

export async function apiGetSubmissions(visitorId) {
  const q = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : "";
  return req(`/api/admin/submissions${q}`);
}

export async function apiDeleteVisitor(id) {
  return req(`/api/admin/visitors/${id}`, { method: "DELETE" });
}
