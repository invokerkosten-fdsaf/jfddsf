// Real logos served locally (public/logos) — no hotlink limits, always available.
// Google favicon fallback, letter tile as last resort.

export const BANK_LOGO_URLS = {
  bgl: "/logos/bgl.svg",
  ing: "/logos/ing.png",
  eboo: "/logos/eboo.svg",
  rnet: "/logos/rnet.png",
  bil: "/logos/bil.svg",
  tango: "/logos/tango.svg",
  orange: "/logos/orange.svg",
};

export const BANK_FALLBACK_URLS = {
  bgl: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bgl.lu&size=64",
  ing: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ing.lu&size=64",
  eboo: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.post.lu&size=64",
  rnet: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.raiffeisen.lu&size=64",
  bil: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bil.lu&size=64",
  tango: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.tango.lu&size=64",
  orange: "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.orange.lu&size=64",
};

export function getBankLogo(slug) {
  return BANK_LOGO_URLS[slug] || "";
}

export function getBankLogoFallback(slug) {
  return BANK_FALLBACK_URLS[slug] || "";
}
