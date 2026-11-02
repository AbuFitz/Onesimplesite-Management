import { SignShell } from "@/components/public-shell";
export const metadata = { title: "Signed", robots: { index: false } };
export default function Done() {
  return (
    <SignShell>
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-[0_2px_28px_rgba(14,19,17,.08)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#dff5ea] text-moss" aria-hidden><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>
        <h1 className="mt-5 mb-2 text-2xl font-semibold">Thank you, you are all signed</h1>
        <p>We have emailed you a confirmation with a copy of your signed order. We will be in touch about next steps.</p>
        <p className="mt-4 text-sm text-muted">You can close this page.</p>
      </div>
    </SignShell>
  );
}
