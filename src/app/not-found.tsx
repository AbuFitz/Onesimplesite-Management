import Link from "next/link";
export default function NotFound() {
  return (
    <div className="err-card">
      <span className="err-ico" aria-hidden>?</span>
      <h1>We couldn&apos;t find that page</h1>
      <p>The link may be old, or the item may have been removed.</p>
      <div className="err-act"><Link href="/">Go to home</Link></div>
    </div>
  );
}
