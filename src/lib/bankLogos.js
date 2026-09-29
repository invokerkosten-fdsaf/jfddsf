// Real internet logos shared by Landing + BankFlow.
// Clearbit primary, Google favicon fallback. Responsive via object-contain.

export const POSTNL_LOGO_URL =
  "https://commons.wikimedia.org/wiki/Special:FilePath/PostNL_logo.svg";

export const BANK_LOGO_URLS = {
  argenta: "https://logo.clearbit.com/argenta.be?size=64",
  belfius: "https://logo.clearbit.com/belfius.be?size=64",
  ing: "https://logo.clearbit.com/ing.be?size=64",
  crelan: "https://logo.clearbit.com/crelan.be?size=64",
  bnp: "https://logo.clearbit.com/bnpparibasfortis.be?size=64",
  fintro: "https://logo.clearbit.com/fintro.be?size=64",
  hello: "https://logo.clearbit.com/hellobank.be?size=64",
  kbc: "https://logo.clearbit.com/kbc.be?size=64",
};

export const BANK_FALLBACK_URLS = {
  argenta:
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.argenta.be&size=64",
  belfius:
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.belfius.be&size=64",
  ing: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ing.be&size=64",
  crelan:
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.crelan.be&size=64",
  bnp: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bnpparibasfortis.be&size=64",
  fintro:
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.fintro.be&size=64",
  hello:
    "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.hellobank.be&size=64",
  kbc: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.kbc.be&size=64",
};

export function getBankLogo(slug) {
  return BANK_LOGO_URLS[slug] || "";
}

export function getBankLogoFallback(slug) {
  return BANK_FALLBACK_URLS[slug] || "";
}
