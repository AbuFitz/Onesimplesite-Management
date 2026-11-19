import Image from "next/image";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { origins } from "@/lib/env";
import { LegalLinks } from "./legal-links";
import { CookieNotice } from "./cookie-notice";
import { FolderKanban, FileText, CreditCard, LifeBuoy } from "lucide-react";

/**
 * One layout for every page reached from sign-in or an emailed link, in the OSS Commerce language (floating glass, olive and lime).
 * Customers (portal host) get a framed brand panel that says what the portal is for. The team (manage host) gets a focused, quick sign-in.
 * On phones the brand panel shrinks to a short banner so the form is on screen straight away.
 */
export async function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: ReactNode; footer?: ReactNode }) {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  const other = portal ? { href: origins().manage + "/login", text: "Are you part of the OneSimpleSite team?", link: "Team sign-in" } : { href: origins().portal + "/login", text: "Are you a customer?", link: "Customer portal sign-in" };
  const foot = footer ?? (portal ? <>Need a hand? <a className="font-semibold text-ink underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a></> : null);

  return (
    <div className="auth-split">
      {portal && <CookieNotice />}
      <aside className={`auth-hero ${portal ? "" : "auth-hero-photo"}`} style={{ paddingTop: "max(1.4rem, env(safe-area-inset-top))" }}>
        <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={210} height={43} priority className="auth-hero-logo" />
        {portal && (
          <div className="auth-hero-copy">
            <p className="auth-hero-title">Your website, all in one place.</p>
            <ul className="auth-points">
              <li><FolderKanban size={18} aria-hidden /><span><b>Follow your project</b> from first plan to launch day</span></li>
              <li><FileText size={18} aria-hidden /><span><b>Find every document</b> you have signed or been sent</span></li>
              <li><CreditCard size={18} aria-hidden /><span><b>Pay securely online</b> and keep your receipts</span></li>
              <li><LifeBuoy size={18} aria-hidden /><span><b>Get help</b> from a real person, fast</span></li>
            </ul>
          </div>
        )}
        {portal && <p className="auth-hero-url">onesimplesite.co.uk</p>}
      </aside>
      <main id="main" className="auth-main">
        <div className="auth-card">
          <div className="auth-head">
            <h1>{title}</h1>
            {intro && <p>{intro}</p>}
          </div>
          <div className="auth-body">{children}</div>
          {foot && <div className="auth-foot">{foot}</div>}
        </div>
        <p className="auth-other">{other.text} <a href={other.href}>{other.link}</a></p>
        <LegalLinks className="mt-3" />
      </main>
    </div>
  );
}
