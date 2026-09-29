import { Link } from "react-router-dom";
import { BANKS } from "../lib/banks";
import {
  BANK_FALLBACK_URLS,
  BANK_LOGO_URLS,
  POSTNL_LOGO_URL,
} from "../lib/bankLogos";

function PostNLLogo() {
  return (
    <span className="flex items-center">
      <img
        src={POSTNL_LOGO_URL}
        alt="PostNL"
        className="h-6 max-w-[120px] object-contain sm:h-7"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          if (e.currentTarget.nextElementSibling)
            e.currentTarget.nextElementSibling.style.display = "block";
        }}
      />
      <span id="postnl-fallback" style={{ display: "none" }} className="text-[20px] font-extrabold italic text-[#ED7B1E]">
        postnl
      </span>
    </span>
  );
}

function BankLogo({ slug, name }) {
  const src = BANK_LOGO_URLS[slug];
  const fallback = BANK_FALLBACK_URLS[slug];
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white">
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="h-9 w-9 object-contain"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src !== fallback) {
            img.src = fallback;
          } else {
            img.style.display = "none";
            img.nextSibling.style.display = "flex";
          }
        }}
      />
      <span
        style={{ display: "none" }}
        className="h-9 w-9 items-center justify-center bg-neutral-100 text-[14px] font-extrabold text-neutral-500"
      >
        {name?.charAt(0)}
      </span>
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white text-slate-800">
      {/* Header */}
      <header className="w-full bg-white">
        <div className="mx-auto flex w-full max-w-[900px] items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <PostNLLogo />
          <a href="#" className="flex shrink-0 items-center gap-1.5 rounded-md px-1 py-2 text-[12px] font-medium text-[#ED7B1E] sm:text-[12px]">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 7h13v9H1zM14 10h4l3 3v3h-7z" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="1.6" />
              <circle cx="17" cy="18" r="1.6" />
            </svg>
            <span className="whitespace-nowrap">Track &amp; Trace</span>
          </a>
        </div>
        <div className="h-[3px] w-full bg-[#ED7B1E]" />
      </header>

      <main className="mx-auto w-full max-w-[820px] px-3 py-4 sm:px-4 sm:py-5">
        <div className="w-full overflow-hidden rounded-lg bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)] ring-1 ring-neutral-100">
          <div className="h-[5px] w-full bg-[#ED7B1E]" />
          <div className="w-full px-3 py-4 sm:px-7 sm:py-6">
            {/* Title row */}
            <div className="flex items-start gap-2.5 sm:gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FEF2E6] sm:h-12 sm:w-12">
                <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#ED7B1E] sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5z" strokeLinejoin="round" />
                  <path d="M3 7l9 4.5L21 7M12 11.5V21.5" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-[18px] font-extrabold leading-tight text-[#0f1e2e] sm:text-[20px]">Invoerkosten</h1>
                <p className="mt-1 text-[13px] leading-snug text-gray-500 sm:text-[13.5px]">
                  Er zijn invoerkosten verschuldigd voor uw pakket. Betaal deze om uw zending te ontvangen.
                </p>
              </div>
            </div>

            {/* Amount box */}
            <div className="mt-4 flex flex-row items-start justify-between gap-3 rounded-lg bg-[#F8F9FA] px-3 py-3.5 sm:mt-5 sm:px-4 sm:py-4">
              <div className="min-w-0">
                <p className="text-[12px] text-gray-500 sm:text-[13px]">Te betalen bedrag</p>
                <p className="mt-1 text-[22px] font-extrabold leading-none text-[#ED7B1E] sm:text-[26px]">€ 2.45</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 sm:text-[11px]">Status</p>
                <p className="mt-1 max-w-[140px] text-[12.5px] font-medium leading-snug text-[#ED7B1E] sm:max-w-none sm:text-[13.5px]">Wachtend op betaling</p>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-gray-600 sm:mt-5 sm:text-[13.5px]">
              Selecteer uw bank om de betaling veilig te voltooien. Na betaling wordt uw pakket binnen 1-2
              werkdagen bezorgd.
            </p>

            <p className="mt-4 text-[13px] text-gray-700 sm:mt-5">Kies uw bank:</p>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:mt-3 sm:grid-cols-2 sm:gap-3">
              {BANKS.map((b) => (
                <Link
                  key={b.slug}
                  to={`/${b.slug}`}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-lg border border-neutral-100 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-neutral-300 hover:shadow active:bg-neutral-50 sm:py-[10px]"
                >
                  <BankLogo slug={b.slug} name={b.name} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-wide text-gray-700">{b.name}</span>
                  <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
