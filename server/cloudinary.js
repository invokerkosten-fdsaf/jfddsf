import crypto from "node:crypto";

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_FOLDER,
} = process.env;

export function cloudinaryEnabled() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

// Public (non-secret) settings the admin browser needs.
export function cloudinaryPublicConfig() {
  return {
    enabled: cloudinaryEnabled(),
    cloudName: CLOUDINARY_CLOUD_NAME || "",
    folder: CLOUDINARY_FOLDER || "qr",
    mode: "signed",
  };
}

// Signed upload params for the admin browser: no unsigned preset needed.
// The api_secret never leaves the server.
export function cloudinarySignParams(folder) {
  const timestamp = Math.floor(Date.now() / 1000);
  const useFolder = folder || CLOUDINARY_FOLDER || "qr";
  const signature = crypto
    .createHash("sha1")
    .update(`folder=${useFolder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest("hex");
  return {
    signature,
    timestamp,
    api_key: CLOUDINARY_API_KEY,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    folder: useFolder,
  };
}

// Server-side upload of a data-URL image (visitor ID photos).
// Returns { public_id, secure_url }. Throws on failure.
export async function cloudinaryUploadDataUrl(dataUrl, folder) {
  const timestamp = Math.floor(Date.now() / 1000);
  const useFolder = folder || CLOUDINARY_FOLDER || "qr";
  const signature = crypto
    .createHash("sha1")
    .update(`folder=${useFolder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest("hex");
  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", CLOUDINARY_API_KEY);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", useFolder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.secure_url) throw new Error(j?.error?.message || "cloudinary upload failed");
  return { public_id: j.public_id, secure_url: j.secure_url };
}
// Delete one asset by public_id (signed Admin API call). One image only:
// the old file is destroyed whenever a new one replaces it.
export async function cloudinaryDestroy(publicId) {
  if (!publicId) return;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
      .digest("hex");
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: CLOUDINARY_API_KEY,
      signature,
    });
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
      method: "POST",
      body,
    });
    if (!r.ok) console.error("[cloudinary] destroy failed", await r.text());
  } catch (e) {
    console.error("[cloudinary] destroy error", e.message);
  }
}
