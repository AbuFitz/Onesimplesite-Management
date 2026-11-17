"use client";
import { usePlatform, searchKeyLabel } from "@/lib/platform";

/** "Press ⌘K" or "Press Ctrl K", for whoever is reading it. Shows nothing on phones and tablets, which have no such key. */
export function SearchTip() {
  const { ready, apple, touch } = usePlatform();
  if (!ready || touch) return null;
  return <p className="hint mb-4">Tip: press <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[11px] font-semibold">{searchKeyLabel(apple)}</kbd> anywhere to search without leaving the page.</p>;
}
