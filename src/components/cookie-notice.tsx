"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const KEY = "oss-cookie-notice";

/**
 * A short, friendly cookie notice for customers. We only use cookies the portal needs to work (staying signed in, keeping you safe),
 * which the law doesn't need consent for, so this informs rather than asks. It remembers "Got it" on this device.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { if (!localStorage.getItem(KEY)) setShow(true); } catch { setShow(true); } }, []);
  if (!show) return null;
  const ok = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private window: it just shows again next time */ } setShow(false); };
  return (
    <div role="dialog" aria-label="Cookies" aria-live="polite" className="mx-auto mb-4 w-full max-w-md sm:fixed sm:bottom-4 sm:left-4 sm:z-40 sm:m-0 sm:w-[26rem]">
      <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_12px_40px_rgba(14,19,17,.18)]">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-butter"><Cookie size={20} aria-hidden /></span>
          <div className="min-w-0">
            <p className="font-bold">Just the cookies we need</p>
            <p className="mt-1 text-sm text-muted">We use cookies to keep you signed in and your account safe. Nothing for tracking or adverts.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <Link href="/legal/cookies" className="btn btn-quiet !min-h-9">Cookie notice</Link>
          <button type="button" onClick={ok} className="btn btn-dark !min-h-9">Got it</button>
        </div>
      </div>
    </div>
  );
}
