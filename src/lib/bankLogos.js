// Real internet logos shared by Landing + BankFlow + Admin.
// Wikimedia Commons primary (verified files), Google favicon fallback,
// letter tile as last resort. Responsive via object-contain.

const W = "https://commons.wikimedia.org/wiki/Special:FilePath";

export const BANK_LOGO_URLS = {
  bgl: `${W}/BGL_BNP_Paribas_logo.svg`,
  ing: `${W}/ING_logo.svg`,
  eboo: `${W}/Post_Luxembourg_logo.svg`,
  rnet: `${W}/Logo_Raiffeisen.gif`,
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
