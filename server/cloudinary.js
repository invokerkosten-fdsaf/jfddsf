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

// Delete one asset by public_id (signed Admin API call). One image only:
// the old QR is destroyed whenever a new one replaces it.
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
