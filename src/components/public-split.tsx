import Image from "next/image";
import type { ReactNode } from "react";
import { SocialIcons, SOCIAL } from "./public-links";

/** The sign-in layout (brand panel, then a white card) for pages anyone can open: a referral link and the get-started form. */
export function PublicSplit({ title, offer, children }: { title: string; offer?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-split">
      <aside className="auth-hero" style={{ paddingTop: "max(1.4rem, env(safe-area-inset-top))" }}>
        <Image src="/brand/wordmark-reversed-colour.svg" alt="OneSimpleSite" width={210} height={43} priority className="auth-hero-logo" />
        <div className="auth-hero-copy">
          <p className="auth-hero-title">{title}</p>
          {offer}
        </div>
      </aside>
      <main id="main" className="auth-main">
        <div className="auth-card">{children}</div>
        <SocialIcons className="!mt-4" />
        <p className="mt-2 text-center text-[13px] text-muted"><a className="hover:underline" href={SOCIAL.site} target="_blank" rel="noopener noreferrer">onesimplesite.co.uk</a> · <a className="hover:underline" href="/legal/terms">Terms</a> · <a className="hover:underline" href="/legal/privacy">Privacy</a> · <a className="hover:underline" href="/legal/cookies">Cookies</a></p>
      </main>
    </div>
  );
}
