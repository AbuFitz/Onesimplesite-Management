import { SignShell } from "@/components/public-shell";
import { origins } from "@/lib/env";
import { Mail, MessageCircleHeart, FolderKanban } from "lucide-react";
export const metadata = { title: "Signed", robots: { index: false } };

export default function Done() {
  const steps = [
    { Icon: Mail, t: "Check your email", d: "We have sent a confirmation with a copy of your signed order." },
    { Icon: MessageCircleHeart, t: "We will be in touch", d: "We will contact you about the next steps." },
    { Icon: FolderKanban, t: "Follow it in your portal", d: "Sign in any time to see your project, documents and payments." },
  ];
  return (
    <SignShell>
      <div className="done-card mx-auto max-w-xl">
        <div className="done-tick" aria-hidden>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" /></svg>
        </div>
        <h1 className="mt-5 text-[28px] font-light tracking-tight">Thank you, you are all signed</h1>
        <p className="mt-2 text-ink-2">Nothing more is needed from you right now.</p>
        <ol className="done-steps">
          {steps.map(({ Icon, t, d }, i) => (
            <li key={t} style={{ "--i": i } as React.CSSProperties}><span><Icon size={18} aria-hidden /></span><div><b>{t}</b><p>{d}</p></div></li>
          ))}
        </ol>
        <a className="btn mt-6 w-full sm:w-auto sm:px-8" href={`${origins().portal}/login`}>Go to your portal</a>
        <p className="mt-4 text-sm text-muted">You can close this page.</p>
      </div>
    </SignShell>
  );
}
