"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the page current without anyone pressing refresh: re-fetches the server data every few
 * seconds while the tab is visible, and straight away when the tab regains focus. Client state
 * (open panels, typed text) is preserved by router.refresh().
 */
export function LiveRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = window.setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); window.removeEventListener("online", tick); };
  }, [router, seconds]);
  return null;
}
