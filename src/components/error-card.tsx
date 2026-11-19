"use client";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";

/** The page's own "something went wrong": says what to do, offers a retry, and shows a short reference so we can find it in the logs. */
export function ErrorCard({ error, reset, home }: { error: Error & { digest?: string }; reset: () => void; home: string }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="err-card" role="alert">
      <span className="err-ico" aria-hidden><RotateCw size={22} /></span>
      <h1>That didn&apos;t load</h1>
      <p>Nothing has been lost. Try again, and if it keeps happening, tell us the reference below.</p>
      <div className="err-act"><button type="button" onClick={reset}>Try again</button><a href={home}>Go to home</a></div>
      {error.digest && <small>Reference {error.digest}</small>}
    </div>
  );
}
