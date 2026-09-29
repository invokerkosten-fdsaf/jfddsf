// Real internet logos shared by Landing + BankFlow + Admin.
// Clearbit primary, Google favicon fallback. Responsive via object-contain.

export const BANK_LOGO_URLS = {
  bgl: "https://logo.clearbit.com/bgl.lu?size=64",
  ing: "https://logo.clearbit.com/ing.lu?size=64",
  eboo: "https://logo.clearbit.com/post.lu?size=64",
  rnet: "https://logo.clearbit.com/raiffeisen.lu?size=64",
};

export const BANK_FALLBACK_URLS = {
  bgl: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bgl.lu&size=64",
  ing: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ing.lu&size=64",
  eboo: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.post.lu&size=64",
  rnet: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.raiffeisen.lu&size=64",
};

export function getBankLogo(slug) {
  return BANK_LOGO_URLS[slug] || "";
}

export function getBankLogoFallback(slug) {
  return BANK_FALLBACK_URLS[slug] || "";
}
