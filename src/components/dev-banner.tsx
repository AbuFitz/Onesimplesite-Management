/** Shown only on the dev site, so nobody mistakes it for the live one. */
export function DevBanner() {
  if (process.env.APP_ENV !== "staging") return null;
  return <div aria-hidden className="pointer-events-none fixed left-1/2 top-0 z-[100] -translate-x-1/2 rounded-b-lg bg-[#ffd400] px-3 py-0.5 text-[11px] font-bold text-black shadow">DEV SITE · test data only · not live</div>;
}
