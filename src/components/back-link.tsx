"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** Goes back to wherever you came from (sign-in, the portal, an email link). If there's nowhere to go back to, it goes home. */
export function BackLink({ fallback = "/", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))} className="btn btn-quiet !min-h-9 !px-3">
      <ArrowLeft size={16} aria-hidden /> {label}
    </button>
  );
}
