import { PublicShell } from "@/components/public-shell";
export const metadata = { title: "Signed", robots: { index: false } };
export default function Done() {
  return (
    <PublicShell narrow label="Secure signing">
      <div className="mt-6 flex size-12 items-center justify-center rounded-full bg-[#e9f6ef] text-[#0a5a3d]" aria-hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
      <h1 className="mt-5 mb-2">Thank you, you're signed</h1>
      <p>We've emailed you a confirmation with a copy of the signed agreement. Your project owner will be in touch about next steps.</p>
      <p className="mt-4 text-sm text-muted">You can close this page.</p>
    </PublicShell>
  );
}
